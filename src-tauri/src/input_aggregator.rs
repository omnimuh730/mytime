//! Aggregates global input events (same stream as the hook) for dashboard stats and live feed.
//! Only receives events when the Windows hook is running; get_stats/get_recent_events work on all platforms.

use chrono::{Local, NaiveDate};
use std::{
    collections::VecDeque,
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex, OnceLock,
    },
};

use crate::{
    input_monitor::InputMonitorEventDto,
    models::{InputStatsDto, LiveFeedEventDto},
};

const MAX_RECENT_EVENTS: usize = 100;

struct Inner {
    date_today: NaiveDate,
    key_presses: u64,
    mouse_events: u64,
    scroll_events: u64,
    first_activity_ts_ms: Option<i64>,
    last_activity_ts_ms: Option<i64>,
    recent: VecDeque<LiveFeedEventDto>,
}

static AGGREGATOR: OnceLock<Mutex<Inner>> = OnceLock::new();
static NEXT_ID: AtomicU64 = AtomicU64::new(1);

fn ensure_today(inner: &mut Inner) {
    let today = Local::now().date_naive();
    if inner.date_today != today {
        inner.date_today = today;
        inner.key_presses = 0;
        inner.mouse_events = 0;
        inner.scroll_events = 0;
        inner.first_activity_ts_ms = None;
        inner.last_activity_ts_ms = None;
        inner.recent.clear();
    }
}

fn push_recent(inner: &mut Inner, dto: LiveFeedEventDto) {
    inner.recent.push_front(dto);
    while inner.recent.len() > MAX_RECENT_EVENTS {
        inner.recent.pop_back();
    }
}

/// Record an event from the global hook (called from the input_monitor emitter thread on Windows).
pub fn record(event: &InputMonitorEventDto) {
    let Some(mutex) = AGGREGATOR.get() else { return };
    let Ok(mut inner) = mutex.lock() else { return };

    ensure_today(&mut inner);

    let ts = event.timestamp;
    if inner.first_activity_ts_ms.is_none() {
        inner.first_activity_ts_ms = Some(ts);
    }
    inner.last_activity_ts_ms = Some(ts);

    let event_type = match event.kind {
        "keyboard" => "keyboard",
        "mouse" => "mouse",
        "scroll" => "scroll",
        _ => "mouse",
    };

    match event.kind {
        "keyboard" => {
            if event.action == "press" {
                inner.key_presses = inner.key_presses.saturating_add(1);
            }
        }
        "mouse" => inner.mouse_events = inner.mouse_events.saturating_add(1),
        "scroll" => inner.scroll_events = inner.scroll_events.saturating_add(1),
        _ => {}
    }

    let time_str = format_timestamp(ts);
    let detail = detail_string(event);
    let id = NEXT_ID.fetch_add(1, Ordering::Relaxed);
    push_recent(
        &mut inner,
        LiveFeedEventDto {
            id,
            event_type: event_type.to_string(),
            description: event.label.clone(),
            timestamp: time_str,
            detail: if detail.is_empty() { None } else { Some(detail) },
        },
    );
}

fn format_timestamp(ms: i64) -> String {
    chrono::DateTime::from_timestamp_millis(ms)
        .map(|dt| dt.format("%H:%M:%S").to_string())
        .unwrap_or_else(|| "00:00:00".to_string())
}

fn detail_string(e: &InputMonitorEventDto) -> String {
    let mut parts = Vec::new();
    if let (Some(x), Some(y)) = (e.x, e.y) {
        parts.push(format!("({}, {})", x, y));
    }
    if let Some(ref d) = e.direction {
        parts.push(format!("scroll {}", d));
    }
    if let Some(ref b) = e.button {
        parts.push(b.to_string());
    }
    parts.join(", ")
}

/// Initialize the aggregator (call once when starting the global input monitor).
pub fn init() {
    let today = Local::now().date_naive();
    let _ = AGGREGATOR.set(Mutex::new(Inner {
        date_today: today,
        key_presses: 0,
        mouse_events: 0,
        scroll_events: 0,
        first_activity_ts_ms: None,
        last_activity_ts_ms: None,
        recent: VecDeque::new(),
    }));
}

/// Returns current input stats for today, or None if aggregator not initialized.
/// If the stored date is not today (e.g. past midnight, no events yet), returns zeroed stats.
pub fn get_stats() -> Option<InputStatsDto> {
    let guard = AGGREGATOR.get()?.lock().ok()?;
    let inner = guard;
    let today = Local::now().date_naive();
    if inner.date_today != today {
        return Some(InputStatsDto {
            key_presses_today: 0,
            mouse_events_today: 0,
            scroll_events_today: 0,
            first_activity_ts_ms: None,
            last_activity_ts_ms: None,
        });
    }
    Some(InputStatsDto {
        key_presses_today: inner.key_presses,
        mouse_events_today: inner.mouse_events,
        scroll_events_today: inner.scroll_events,
        first_activity_ts_ms: inner.first_activity_ts_ms,
        last_activity_ts_ms: inner.last_activity_ts_ms,
    })
}

/// Returns the most recent events for the live feed (newest first).
pub fn get_recent_events(limit: Option<u32>) -> Vec<LiveFeedEventDto> {
    let Some(mutex) = AGGREGATOR.get() else { return Vec::new() };
    let Ok(inner) = mutex.lock() else { return Vec::new() };

    let cap = limit.unwrap_or(50).min(MAX_RECENT_EVENTS as u32) as usize;
    inner
        .recent
        .iter()
        .take(cap)
        .cloned()
        .collect()
}
