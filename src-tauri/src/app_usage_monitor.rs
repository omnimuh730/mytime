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
    db,
    input_monitor::InputMonitorEventDto,
    models::{ActivityAppUsageDto, AppInputMinuteDto, AppUsageSessionDto, AppUsageSummaryDto},
};

const MAX_STORED_SESSIONS: usize = 512;
const MOVE_SEQUENCE_GAP_MS: i64 = 650;
const SCROLL_SEQUENCE_GAP_MS: i64 = 450;
/// Inactivity interval: activity extends 30s past last input. Inactivity starts at last_activity + 30s.
pub const INACTIVITY_INTERVAL_MS: i64 = 30_000;

#[derive(Clone, Copy, PartialEq, Eq)]
enum SequenceKind {
    MouseMove,
    ScrollWheel,
    Other,
}

#[derive(Clone, Copy)]
struct SequenceState {
    kind: SequenceKind,
    timestamp_ms: i64,
}

#[derive(Clone)]
struct WindowSnapshot {
    pid: u32,
    app_name: String,
    title: String,
    app_id: String,
    icon_data_url: Option<String>,
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
    last_sequence: Option<SequenceState>,
}

static STATE: OnceLock<Mutex<State>> = OnceLock::new();
#[cfg(windows)]
static ICON_CACHE: OnceLock<Mutex<HashMap<String, Option<String>>>> = OnceLock::new();

fn state() -> &'static Mutex<State> {
    STATE.get_or_init(|| {
        let mut s = State {
            date_today: Local::now().date_naive(),
            next_id: 1,
            current: None,
            finished: VecDeque::new(),
            input_minutes: BTreeMap::new(),
            last_sequence: None,
        };
        load_from_db(&mut s);
        Mutex::new(s)
    })
}

/// Load persisted sessions and input minutes from DB into state.
fn persist_session(record: &SessionRecord, date: &str) {
    let _ = db::with_atomic_tx(|tx| {
        db::upsert_activity_session(
            tx,
            record.id,
            date,
            &record.snapshot.app_id,
            &record.snapshot.app_name,
            &record.snapshot.title,
            record.snapshot.pid,
            record.started_at_ms,
            record.ended_at_ms,
            record.key_presses,
            record.mouse_clicks,
            record.scroll_events,
            record.snapshot.icon_data_url.as_deref(),
        )
    });
}

fn load_from_db(state: &mut State) {
    let today = Local::now().date_naive().format("%Y-%m-%d").to_string();
    let sessions = db::load_activity_sessions_for_date(&today);
    let mut max_id = 0u64;
    for (id, app_id, app_name, title, pid, started_at_ms, ended_at_ms, kp, mc, se, icon) in
        sessions
    {
        max_id = max_id.max(id);
        let snapshot = WindowSnapshot {
            pid,
            app_name,
            title,
            app_id,
            icon_data_url: icon,
        };
        state.finished.push_front(SessionRecord {
            id,
            snapshot,
            started_at_ms,
            ended_at_ms,
            key_presses: kp,
            mouse_clicks: mc,
            scroll_events: se,
        });
    }
    if max_id > 0 {
        state.next_id = max_id + 1;
    }
    while state.finished.len() > MAX_STORED_SESSIONS {
        state.finished.pop_back();
    }

    let minutes = db::load_input_minutes_for_date(&today);
    for (min, kp, mc, mm, se) in minutes {
        let e = state.input_minutes.entry(min).or_default();
        e.key_presses = kp;
        e.mouse_clicks = mc;
        e.mouse_moves = mm;
        e.scroll_events = se;
    }
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

#[cfg(windows)]
fn get_cached_icon_data_url(path: &str) -> Option<String> {
    let cache = ICON_CACHE.get_or_init(|| Mutex::new(HashMap::new()));

    if let Ok(cache) = cache.lock() {
        if let Some(value) = cache.get(path) {
            return value.clone();
        }
    }

    let resolved = windows_icons::get_icon_base64_by_path(path)
        .ok()
        .map(|base64| format!("data:image/png;base64,{base64}"));

    if let Ok(mut cache) = cache.lock() {
        cache.insert(path.to_string(), resolved.clone());
    }

    resolved
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

/// Returns the minute that contains (ts_ms + INACTIVITY_INTERVAL_MS).
/// Used to extend "active" into the 30s window after last activity.
fn extended_minute_of_day(ts_ms: i64) -> Option<u32> {
    minute_of_day(ts_ms.saturating_add(INACTIVITY_INTERVAL_MS))
}

fn event_sequence_kind(event: &InputMonitorEventDto) -> SequenceKind {
    match (event.kind, event.action) {
        ("mouse", "move") => SequenceKind::MouseMove,
        ("scroll", "wheel") => SequenceKind::ScrollWheel,
        _ => SequenceKind::Other,
    }
}

fn is_sequence_continuation(last_sequence: Option<SequenceState>, event: &InputMonitorEventDto) -> bool {
    let Some(last) = last_sequence else {
        return false;
    };

    match event_sequence_kind(event) {
        SequenceKind::MouseMove => {
            last.kind == SequenceKind::MouseMove
                && event.timestamp.saturating_sub(last.timestamp_ms) <= MOVE_SEQUENCE_GAP_MS
        }
        SequenceKind::ScrollWheel => {
            last.kind == SequenceKind::ScrollWheel
                && event.timestamp.saturating_sub(last.timestamp_ms) <= SCROLL_SEQUENCE_GAP_MS
        }
        SequenceKind::Other => false,
    }
}

fn ensure_today(state: &mut State) {
    let today = Local::now().date_naive();
    if state.date_today != today {
        state.date_today = today;
        state.current = None;
        state.finished.clear();
        state.input_minutes.clear();
        state.last_sequence = None;
    }
}

fn transition_snapshot(state: &mut State, now: i64, snapshot: Option<WindowSnapshot>) {
    let date = state.date_today.format("%Y-%m-%d").to_string();
    match (state.current.clone(), snapshot) {
        (Some(mut current), Some(next)) if same_window(&current.snapshot, &next) => {
            current.ended_at_ms = now;
            state.current = Some(current);
        }
        (Some(mut current), Some(next)) => {
            current.ended_at_ms = now;
            persist_session(&current, &date);
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
            persist_session(&current, &date);
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
    let is_sequence_continuation = is_sequence_continuation(state.last_sequence, event);
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
            if !is_sequence_continuation {
                if let Some(minute) = minute {
                    let bucket = state.input_minutes.entry(minute).or_default();
                    bucket.mouse_moves = bucket.mouse_moves.saturating_add(1);
                }
            }
        }
        ("scroll", "wheel") => {
            if let Some(current) = state.current.as_mut() {
                current.ended_at_ms = now;
                if !is_sequence_continuation {
                    current.scroll_events = current.scroll_events.saturating_add(1);
                }
            }
            if !is_sequence_continuation {
                if let Some(minute) = minute {
                    let bucket = state.input_minutes.entry(minute).or_default();
                    bucket.scroll_events = bucket.scroll_events.saturating_add(1);
                }
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

    // Extend "active" 30s past last activity: inactivity starts at last_activity + 30s.
    if let (Some(minute), Some(ext)) = (minute, extended_minute_of_day(now)) {
        if ext != minute && is_today(now.saturating_add(INACTIVITY_INTERVAL_MS)) {
            let bucket = state.input_minutes.entry(ext).or_default();
            bucket.mouse_moves = bucket.mouse_moves.saturating_add(1);
        }
    }

    state.last_sequence = Some(SequenceState {
        kind: event_sequence_kind(event),
        timestamp_ms: now,
    });
}

fn to_session_dto(record: &SessionRecord) -> AppUsageSessionDto {
    AppUsageSessionDto {
        id: record.id,
        app_id: record.snapshot.app_id.clone(),
        app_name: record.snapshot.app_name.clone(),
        icon_data_url: record.snapshot.icon_data_url.clone(),
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
                icon_data_url: session.snapshot.icon_data_url.clone(),
                session_count: 0,
                total_duration_ms: 0,
                key_presses: 0,
                mouse_clicks: 0,
                scroll_events: 0,
            });
        entry.session_count += 1;
        entry.total_duration_ms += duration_ms;
        if entry.icon_data_url.is_none() {
            entry.icon_data_url = session.snapshot.icon_data_url.clone();
        }
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

    thread::spawn(|| {
        loop {
            thread::sleep(Duration::from_secs(5));
            persist_checkpoint();
        }
    });

    info!("started global app usage monitor");
}

#[cfg(not(windows))]
fn persist_checkpoint() {}

#[cfg(windows)]
fn persist_checkpoint() {
        let (current_opt, input_minutes_vec, date) = {
        let Ok(state) = state().lock() else { return };
        let date = state.date_today.format("%Y-%m-%d").to_string();
        let current = state.current.as_ref().map(|c| {
            (
                c.id,
                c.snapshot.app_id.clone(),
                c.snapshot.app_name.clone(),
                c.snapshot.title.clone(),
                c.snapshot.pid,
                c.started_at_ms,
                c.ended_at_ms,
                c.key_presses,
                c.mouse_clicks,
                c.scroll_events,
                c.snapshot.icon_data_url.clone(),
            )
        });
        let minutes: Vec<_> = state
            .input_minutes
            .iter()
            .map(|(m, r)| (*m, r.key_presses, r.mouse_clicks, r.mouse_moves, r.scroll_events))
            .collect();
        (current, minutes, date)
    };

    let _ = db::with_atomic_tx(|tx| {
        if let Some((id, app_id, app_name, title, pid, started, ended, kp, mc, se, icon)) =
            current_opt
        {
            db::upsert_activity_session(
                tx,
                id,
                &date,
                &app_id,
                &app_name,
                &title,
                pid,
                started,
                ended,
                kp,
                mc,
                se,
                icon.as_deref(),
            )?;
        }
        let minutes: Vec<_> = input_minutes_vec
            .into_iter()
            .map(|(m, kp, mc, mm, se)| (m, kp, mc, mm, se))
            .collect();
        db::replace_input_minutes_for_date(tx, &date, &minutes)?;
        Ok(())
    });
}

#[allow(dead_code)]
#[cfg(windows)]
pub fn process_name_for_pid(pid: u32) -> Option<String> {
    let info = windows_impl::read_process_info_public(pid);
    info.map(|(name, _path)| name)
}

#[cfg(windows)]
pub fn process_info_for_pid(pid: u32) -> Option<(String, String)> {
    windows_impl::read_process_info_public(pid)
}

#[cfg(windows)]
pub fn icon_for_exe_path(path: &str) -> Option<String> {
    get_cached_icon_data_url(path)
}

#[allow(dead_code)]
#[cfg(not(windows))]
pub fn process_name_for_pid(_pid: u32) -> Option<String> {
    None
}

#[cfg(not(windows))]
pub fn process_info_for_pid(_pid: u32) -> Option<(String, String)> {
    None
}

#[cfg(not(windows))]
pub fn icon_for_exe_path(_path: &str) -> Option<String> {
    None
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

    fn read_process_info(pid: u32) -> Option<(String, String)> {
        read_process_info_public(pid)
    }

    pub fn read_process_info_public(pid: u32) -> Option<(String, String)> {
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
        let path = path.trim().to_string();
        let stem = Path::new(&path)
            .file_stem()
            .and_then(|name| name.to_str())
            .unwrap_or("Unknown App")
            .trim()
            .to_string();
        if stem.is_empty() {
            None
        } else {
            Some((stem, path))
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

        let (app_name, executable_path) =
            read_process_info(pid).unwrap_or_else(|| ("Unknown App".to_string(), String::new()));
        let title = read_window_title(hwnd).unwrap_or_else(|| app_name.clone());
        let app_id = sanitize_app_id(&app_name);
        let icon_data_url = if executable_path.is_empty() {
            None
        } else {
            super::get_cached_icon_data_url(&executable_path)
        };

        Some(WindowSnapshot {
            pid,
            app_name,
            title,
            app_id,
            icon_data_url,
        })
    }
}
