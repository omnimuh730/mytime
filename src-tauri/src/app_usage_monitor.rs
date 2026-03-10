use chrono::{Local, Timelike, Utc};
use std::{
    collections::{BTreeMap, HashMap, VecDeque},
    sync::{Mutex, OnceLock},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Runtime};
use tracing::info;
#[cfg(not(windows))]
use tracing::warn;

use crate::{
    input_monitor::InputMonitorEventDto,
    models::{ActivityAppUsageDto, AppInputMinuteDto, AppUsageSessionDto, AppUsageSummaryDto},
};

const MAX_STORED_SESSIONS: usize = 512;

#[derive(Clone)]
struct WindowSnapshot {
    pid: u32,
    app_name: String,
    title: String,
    app_id: String,
}

#[derive(Clone)]
struct SessionRecord {
    id: u64,
    snapshot: WindowSnapshot,
    started_at_ms: i64,
    ended_at_ms: i64,
    key_presses: u32,
    mouse_clicks: u32,
    scroll_events: u32,
}

#[derive(Default, Clone)]
struct InputMinuteRecord {
    key_presses: u32,
    mouse_clicks: u32,
    mouse_moves: u32,
    scroll_events: u32,
}

struct State {
    date_today: chrono::NaiveDate,
    next_id: u64,
    current: Option<SessionRecord>,
    finished: VecDeque<SessionRecord>,
    input_minutes: BTreeMap<u32, InputMinuteRecord>,
}

static STATE: OnceLock<Mutex<State>> = OnceLock::new();

fn state() -> &'static Mutex<State> {
    STATE.get_or_init(|| {
        Mutex::new(State {
            date_today: Local::now().date_naive(),
            next_id: 1,
            current: None,
            finished: VecDeque::new(),
            input_minutes: BTreeMap::new(),
        })
    })
}

fn sanitize_app_id(name: &str) -> String {
    let mut out = String::with_capacity(name.len());
    let mut last_dash = false;
    for ch in name.chars().flat_map(|c| c.to_lowercase()) {
        if ch.is_ascii_alphanumeric() {
            out.push(ch);
            last_dash = false;
        } else if !last_dash {
            out.push('-');
            last_dash = true;
        }
    }
    out.trim_matches('-').to_string()
}

fn same_window(a: &WindowSnapshot, b: &WindowSnapshot) -> bool {
    a.pid == b.pid && a.app_name == b.app_name && a.title == b.title
}

fn is_today(ts_ms: i64) -> bool {
    chrono::DateTime::from_timestamp_millis(ts_ms)
        .map(|dt| dt.with_timezone(&Local).date_naive() == Local::now().date_naive())
        .unwrap_or(false)
}

fn minute_of_day(ts_ms: i64) -> Option<u32> {
    chrono::DateTime::from_timestamp_millis(ts_ms).map(|dt| {
        let local = dt.with_timezone(&Local);
        (local.hour() * 60 + local.minute()) as u32
    })
}

fn ensure_today(state: &mut State) {
    let today = Local::now().date_naive();
    if state.date_today != today {
        state.date_today = today;
        state.current = None;
        state.finished.clear();
        state.input_minutes.clear();
    }
}

fn transition_snapshot(state: &mut State, now: i64, snapshot: Option<WindowSnapshot>) {
    match (state.current.clone(), snapshot) {
        (Some(mut current), Some(next)) if same_window(&current.snapshot, &next) => {
            current.ended_at_ms = now;
            state.current = Some(current);
        }
        (Some(mut current), Some(next)) => {
            current.ended_at_ms = now;
            state.finished.push_front(current);
            while state.finished.len() > MAX_STORED_SESSIONS {
                state.finished.pop_back();
            }
            let next_id = state.next_id;
            state.next_id += 1;
            state.current = Some(SessionRecord {
                id: next_id,
                snapshot: next,
                started_at_ms: now,
                ended_at_ms: now,
                key_presses: 0,
                mouse_clicks: 0,
                scroll_events: 0,
            });
        }
        (Some(mut current), None) => {
            current.ended_at_ms = now;
            state.finished.push_front(current);
            while state.finished.len() > MAX_STORED_SESSIONS {
                state.finished.pop_back();
            }
            state.current = None;
        }
        (None, Some(next)) => {
            let next_id = state.next_id;
            state.next_id += 1;
            state.current = Some(SessionRecord {
                id: next_id,
                snapshot: next,
                started_at_ms: now,
                ended_at_ms: now,
                key_presses: 0,
                mouse_clicks: 0,
                scroll_events: 0,
            });
        }
        (None, None) => {}
    }
}

fn record_snapshot(snapshot: Option<WindowSnapshot>) {
    let now = Utc::now().timestamp_millis();
    let Ok(mut state) = state().lock() else {
        return;
    };
    ensure_today(&mut state);
    transition_snapshot(&mut state, now, snapshot);
}

pub fn record_input_event(event: &InputMonitorEventDto) {
    let now = event.timestamp;
    let Ok(mut state) = state().lock() else {
        return;
    };
    ensure_today(&mut state);

    #[cfg(windows)]
    {
        let snapshot = unsafe { windows_impl::get_foreground_snapshot() };
        transition_snapshot(&mut state, now, snapshot);
    }

    let minute = minute_of_day(now);
    let has_current = state.current.is_some();
    if !has_current {
        return;
    }

    match (event.kind, event.action) {
        ("keyboard", "press") => {
            if let Some(current) = state.current.as_mut() {
                current.ended_at_ms = now;
                current.key_presses = current.key_presses.saturating_add(1);
            }
            if let Some(minute) = minute {
                let bucket = state.input_minutes.entry(minute).or_default();
                bucket.key_presses = bucket.key_presses.saturating_add(1);
            }
        }
        ("mouse", "press") => {
            if let Some(current) = state.current.as_mut() {
                current.ended_at_ms = now;
                current.mouse_clicks = current.mouse_clicks.saturating_add(1);
            }
            if let Some(minute) = minute {
                let bucket = state.input_minutes.entry(minute).or_default();
                bucket.mouse_clicks = bucket.mouse_clicks.saturating_add(1);
            }
        }
        ("mouse", "move") => {
            if let Some(current) = state.current.as_mut() {
                current.ended_at_ms = now;
            }
            if let Some(minute) = minute {
                let bucket = state.input_minutes.entry(minute).or_default();
                bucket.mouse_moves = bucket.mouse_moves.saturating_add(1);
            }
        }
        ("scroll", _) => {
            if let Some(current) = state.current.as_mut() {
                current.ended_at_ms = now;
                current.scroll_events = current.scroll_events.saturating_add(1);
            }
            if let Some(minute) = minute {
                let bucket = state.input_minutes.entry(minute).or_default();
                bucket.scroll_events = bucket.scroll_events.saturating_add(1);
            }
        }
        _ => {}
    }
}

fn to_session_dto(record: &SessionRecord) -> AppUsageSessionDto {
    AppUsageSessionDto {
        id: record.id,
        app_id: record.snapshot.app_id.clone(),
        app_name: record.snapshot.app_name.clone(),
        title: record.snapshot.title.clone(),
        pid: record.snapshot.pid,
        started_at_ms: record.started_at_ms,
        ended_at_ms: record.ended_at_ms,
        duration_ms: (record.ended_at_ms - record.started_at_ms).max(0) as u64,
        key_presses: record.key_presses,
        mouse_clicks: record.mouse_clicks,
        scroll_events: record.scroll_events,
    }
}

pub fn get_activity_app_usage(limit: Option<u32>) -> ActivityAppUsageDto {
    let now = Utc::now().timestamp_millis();
    let mut sessions: Vec<SessionRecord> = Vec::new();

    if let Ok(state) = state().lock() {
        if let Some(current) = &state.current {
            let mut snapshot = current.clone();
            snapshot.ended_at_ms = now;
            sessions.push(snapshot);
        }
        sessions.extend(state.finished.iter().cloned());
    }

    sessions.retain(|session| is_today(session.started_at_ms) || is_today(session.ended_at_ms));
    sessions.sort_by(|a, b| b.started_at_ms.cmp(&a.started_at_ms));

    let mut grouped: HashMap<String, AppUsageSummaryDto> = HashMap::new();
    for session in &sessions {
        let duration_ms = (session.ended_at_ms - session.started_at_ms).max(0) as u64;
        let entry = grouped
            .entry(session.snapshot.app_id.clone())
            .or_insert(AppUsageSummaryDto {
                app_id: session.snapshot.app_id.clone(),
                app_name: session.snapshot.app_name.clone(),
                session_count: 0,
                total_duration_ms: 0,
                key_presses: 0,
                mouse_clicks: 0,
                scroll_events: 0,
            });
        entry.session_count += 1;
        entry.total_duration_ms += duration_ms;
        entry.key_presses = entry.key_presses.saturating_add(session.key_presses);
        entry.mouse_clicks = entry.mouse_clicks.saturating_add(session.mouse_clicks);
        entry.scroll_events = entry.scroll_events.saturating_add(session.scroll_events);
    }

    let mut apps: Vec<AppUsageSummaryDto> = grouped.into_values().collect();
    apps.sort_by(|a, b| b.total_duration_ms.cmp(&a.total_duration_ms));

    let session_limit = limit.unwrap_or(100) as usize;
    let session_dtos = sessions
        .into_iter()
        .take(session_limit)
        .map(|session| to_session_dto(&session))
        .collect();
    let input_minutes = if let Ok(state) = state().lock() {
        state
            .input_minutes
            .iter()
            .map(|(minute_of_day, value)| AppInputMinuteDto {
                minute_of_day: *minute_of_day,
                key_presses: value.key_presses,
                mouse_clicks: value.mouse_clicks,
                mouse_moves: value.mouse_moves,
                scroll_events: value.scroll_events,
            })
            .collect()
    } else {
        Vec::new()
    };

    ActivityAppUsageDto {
        generated_at: Utc::now().to_rfc3339(),
        sessions: session_dtos,
        apps,
        input_minutes,
    }
}

#[cfg(not(windows))]
pub fn start_global_app_usage_monitor<R: Runtime>(_app: AppHandle<R>) {
    warn!("global app usage monitor is only implemented on Windows");
}

#[cfg(windows)]
pub fn start_global_app_usage_monitor<R: Runtime>(_app: AppHandle<R>) {
    let _ = state();

    thread::spawn(move || loop {
        let snapshot = unsafe { windows_impl::get_foreground_snapshot() };
        record_snapshot(snapshot);
        thread::sleep(Duration::from_millis(1000));
    });

    info!("started global app usage monitor");
}

#[cfg(windows)]
mod windows_impl {
    use super::{sanitize_app_id, WindowSnapshot};
    use std::path::Path;
    use windows::{
        core::PWSTR,
        Win32::{
            Foundation::CloseHandle,
            System::Threading::{
                OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
                PROCESS_QUERY_LIMITED_INFORMATION,
            },
            UI::WindowsAndMessaging::{
                GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW,
                GetWindowThreadProcessId,
            },
        },
    };

    fn read_window_title(hwnd: windows::Win32::Foundation::HWND) -> Option<String> {
        let len = unsafe { GetWindowTextLengthW(hwnd) };
        if len <= 0 {
            return None;
        }
        let mut buffer = vec![0u16; len as usize + 1];
        let copied = unsafe { GetWindowTextW(hwnd, &mut buffer) };
        if copied <= 0 {
            return None;
        }
        let title = String::from_utf16_lossy(&buffer[..copied as usize]);
        let title = title.trim().to_string();
        if title.is_empty() {
            None
        } else {
            Some(title)
        }
    }

    fn read_process_name(pid: u32) -> Option<String> {
        let process =
            unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()? };
        let mut buffer = vec![0u16; 260];
        let mut size = buffer.len() as u32;
        let result = unsafe {
            QueryFullProcessImageNameW(
                process,
                PROCESS_NAME_WIN32,
                PWSTR(buffer.as_mut_ptr()),
                &mut size,
            )
        };
        let _ = unsafe { CloseHandle(process) };
        result.ok()?;
        let path = String::from_utf16_lossy(&buffer[..size as usize]);
        let stem = Path::new(path.trim())
            .file_stem()
            .and_then(|name| name.to_str())
            .unwrap_or("Unknown App")
            .trim()
            .to_string();
        if stem.is_empty() {
            None
        } else {
            Some(stem)
        }
    }

    pub unsafe fn get_foreground_snapshot() -> Option<WindowSnapshot> {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }

        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return None;
        }

        let app_name = read_process_name(pid).unwrap_or_else(|| "Unknown App".to_string());
        let title = read_window_title(hwnd).unwrap_or_else(|| app_name.clone());
        let app_id = sanitize_app_id(&app_name);

        Some(WindowSnapshot {
            pid,
            app_name,
            title,
            app_id,
        })
    }
}
