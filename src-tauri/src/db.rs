//! SQLite persistence for activity and network telemetry.
//! Uses WAL mode, busy_timeout, synchronous=FULL for crash-safe atomic writes.
use rusqlite::{Connection, OpenFlags, Transaction, TransactionBehavior};
use std::path::Path;
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::Duration;
use tracing::{info, warn};

/// Queued input event for batch insert.
pub struct QueuedInputEvent {
    pub ts_ms: i64,
    pub kind: String,
    pub action: String,
    pub label: String,
    pub state_key: Option<String>,
    pub button: Option<String>,
    pub direction: Option<String>,
    pub x: Option<i32>,
    pub y: Option<i32>,
}

static EVENT_QUEUE: OnceLock<Mutex<Vec<QueuedInputEvent>>> = OnceLock::new();

const SCHEMA_VERSION: i32 = 1;

static DB: OnceLock<Mutex<Connection>> = OnceLock::new();

/// Initialize the database at the given path. Call once during app setup.
pub fn init(path: &Path) -> Result<(), String> {
    let flags = OpenFlags::SQLITE_OPEN_READ_WRITE
        | OpenFlags::SQLITE_OPEN_CREATE
        | OpenFlags::SQLITE_OPEN_NO_MUTEX;
    let conn = Connection::open_with_flags(path, flags).map_err(|e| e.to_string())?;

    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| e.to_string())?;
    conn.pragma_update(None, "synchronous", "FULL")
        .map_err(|e| e.to_string())?;
    conn.pragma_update(None, "busy_timeout", 5000_i32)
        .map_err(|e| e.to_string())?;
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(|e| e.to_string())?;

    migrate(&conn)?;

    DB.set(Mutex::new(conn)).map_err(|_| "DB already initialized".to_string())?;
    EVENT_QUEUE.get_or_init(|| Mutex::new(Vec::new()));

    thread::spawn(flush_loop);

    info!("SQLite DB initialized: {:?}", path);
    Ok(())
}

fn flush_loop() {
    loop {
        thread::sleep(Duration::from_secs(1));
        if let Err(e) = flush_pending() {
            warn!("db flush failed: {}", e);
        }
    }
}

fn flush_pending() -> Result<(), String> {
    let batch = {
        let Ok(mut q) = EVENT_QUEUE.get().ok_or("queue not init")?.lock() else {
            return Ok(());
        };
        if q.is_empty() {
            return Ok(());
        }
        std::mem::take(&mut *q)
    };

    with_atomic_tx(|tx| {
        for e in &batch {
            insert_input_event(
                tx,
                e.ts_ms,
                &e.kind,
                Some(&e.action),
                Some(&e.label),
                e.state_key.as_deref(),
                e.button.as_deref(),
                e.direction.as_deref(),
                e.x,
                e.y,
            )?;
        }
        Ok(())
    })
    .ok_or_else(|| "flush transaction failed".to_string())?;

    Ok(())
}

/// Queue an input event for async batch insert.
pub fn queue_input_event(
    ts_ms: i64,
    kind: &str,
    action: &str,
    label: &str,
    state_key: Option<&str>,
    button: Option<&str>,
    direction: Option<&str>,
    x: Option<i32>,
    y: Option<i32>,
) {
    if let Some(q) = EVENT_QUEUE.get() {
        if let Ok(mut guard) = q.lock() {
            guard.push(QueuedInputEvent {
                ts_ms,
                kind: kind.to_string(),
                action: action.to_string(),
                label: label.to_string(),
                state_key: state_key.map(str::to_string),
                button: button.map(str::to_string),
                direction: direction.map(str::to_string),
                x,
                y,
            });
        }
    }
}

fn migrate(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);
        INSERT OR IGNORE INTO schema_version (version) VALUES (0);

        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at_ms INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS input_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts_ms INTEGER NOT NULL,
            kind TEXT NOT NULL,
            action TEXT,
            label TEXT,
            state_key TEXT,
            button TEXT,
            direction TEXT,
            x INTEGER,
            y INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_input_events_ts ON input_events(ts_ms);

        CREATE TABLE IF NOT EXISTS activity_sessions (
            id INTEGER PRIMARY KEY,
            date TEXT NOT NULL,
            app_id TEXT NOT NULL,
            app_name TEXT NOT NULL,
            title TEXT,
            pid INTEGER NOT NULL,
            started_at_ms INTEGER NOT NULL,
            ended_at_ms INTEGER NOT NULL,
            key_presses INTEGER NOT NULL DEFAULT 0,
            mouse_clicks INTEGER NOT NULL DEFAULT 0,
            scroll_events INTEGER NOT NULL DEFAULT 0,
            icon_data_url TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_activity_sessions_date ON activity_sessions(date);
        CREATE INDEX IF NOT EXISTS idx_activity_sessions_started ON activity_sessions(started_at_ms);

        CREATE TABLE IF NOT EXISTS input_minutes (
            date TEXT NOT NULL,
            minute_of_day INTEGER NOT NULL,
            key_presses INTEGER NOT NULL DEFAULT 0,
            mouse_clicks INTEGER NOT NULL DEFAULT 0,
            mouse_moves INTEGER NOT NULL DEFAULT 0,
            scroll_events INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (date, minute_of_day)
        );

        CREATE TABLE IF NOT EXISTS network_samples (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            ts_ms INTEGER NOT NULL,
            download_bytes_today INTEGER NOT NULL DEFAULT 0,
            upload_bytes_today INTEGER NOT NULL DEFAULT 0,
            active_connections INTEGER NOT NULL DEFAULT 0,
            download_bps REAL NOT NULL DEFAULT 0,
            upload_bps REAL NOT NULL DEFAULT 0,
            latency_ms INTEGER NOT NULL DEFAULT 0,
            is_online INTEGER NOT NULL DEFAULT 1
        );
        CREATE INDEX IF NOT EXISTS idx_network_samples_date ON network_samples(date);
        CREATE INDEX IF NOT EXISTS idx_network_samples_ts ON network_samples(ts_ms);
        "#,
    )
    .map_err(|e| e.to_string())?;

    let current: i32 = conn
        .query_row("SELECT version FROM schema_version LIMIT 1", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    if current < SCHEMA_VERSION {
        conn.execute("UPDATE schema_version SET version = ?1", [SCHEMA_VERSION])
            .map_err(|e| e.to_string())?;
        info!("DB migrated to schema version {}", SCHEMA_VERSION);
    }

    Ok(())
}

fn with_conn<F, T>(f: F) -> Option<T>
where
    F: FnOnce(&Connection) -> Result<T, rusqlite::Error>,
{
    let guard = DB.get()?.lock().ok()?;
    f(&guard).ok()
}

/// Get config value by key.
pub fn get_config(key: &str) -> Option<String> {
    with_conn(|conn| {
        let mut stmt = conn.prepare("SELECT value FROM config WHERE key = ?1")?;
        let mut rows = stmt.query([key])?;
        if let Some(row) = rows.next()? {
            row.get(0)
        } else {
            Ok(String::new())
        }
    })
}

/// Set config value (upsert). Used e.g. to remember that startup was registered.
pub fn set_config(key: &str, value: &str) -> Option<()> {
    use chrono::Utc;
    with_tx(|tx| {
        let now = Utc::now().timestamp_millis();
        tx.execute(
            r#"INSERT INTO config (key, value, updated_at_ms) VALUES (?1, ?2, ?3)
               ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at_ms = ?3"#,
            rusqlite::params![key, value, now],
        )?;
        Ok(())
    })
}

/// Run a function inside an immediate transaction (blocks until lock acquired).
/// Ensures atomic writes and crash safety.
fn with_tx<F, T>(f: F) -> Option<T>
where
    F: FnOnce(&Transaction) -> Result<T, rusqlite::Error>,
{
    let mut guard = DB.get()?.lock().ok()?;
    let tx = guard
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .ok()?;
    let result = f(&tx).ok()?;
    tx.commit().ok()?;
    Some(result)
}

/// Write an input event. Batched writes should call this in a single transaction externally.
pub fn insert_input_event(
    tx: &Transaction,
    ts_ms: i64,
    kind: &str,
    action: Option<&str>,
    label: Option<&str>,
    state_key: Option<&str>,
    button: Option<&str>,
    direction: Option<&str>,
    x: Option<i32>,
    y: Option<i32>,
) -> Result<(), rusqlite::Error> {
    tx.execute(
        r#"INSERT INTO input_events (ts_ms, kind, action, label, state_key, button, direction, x, y)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"#,
        rusqlite::params![
            ts_ms,
            kind,
            action.unwrap_or(""),
            label.unwrap_or(""),
            state_key,
            button,
            direction,
            x,
            y,
        ],
    )?;
    Ok(())
}

/// Save activity session (upsert by id for today).
pub fn upsert_activity_session(
    tx: &Transaction,
    id: u64,
    date: &str,
    app_id: &str,
    app_name: &str,
    title: &str,
    pid: u32,
    started_at_ms: i64,
    ended_at_ms: i64,
    key_presses: u32,
    mouse_clicks: u32,
    scroll_events: u32,
    icon_data_url: Option<&str>,
) -> Result<(), rusqlite::Error> {
    tx.execute(
        r#"INSERT INTO activity_sessions (id, date, app_id, app_name, title, pid, started_at_ms, ended_at_ms, key_presses, mouse_clicks, scroll_events, icon_data_url)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
           ON CONFLICT(id) DO UPDATE SET ended_at_ms = ?8, key_presses = ?9, mouse_clicks = ?10, scroll_events = ?11"#,
        rusqlite::params![
            id as i64,
            date,
            app_id,
            app_name,
            title,
            pid as i64,
            started_at_ms,
            ended_at_ms,
            key_presses as i64,
            mouse_clicks as i64,
            scroll_events as i64,
            icon_data_url,
        ],
    )?;
    Ok(())
}
/// Replace input minutes for a date (clear and reinsert for today's snapshot).
pub fn replace_input_minutes_for_date(
    tx: &Transaction,
    date: &str,
    minutes: &[(u32, u32, u32, u32, u32)], // (minute_of_day, kp, mc, mm, se)
) -> Result<(), rusqlite::Error> {
    tx.execute("DELETE FROM input_minutes WHERE date = ?1", [date])?;
    for (min, kp, mc, mm, se) in minutes {
        tx.execute(
            r#"INSERT INTO input_minutes (date, minute_of_day, key_presses, mouse_clicks, mouse_moves, scroll_events)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6)"#,
            rusqlite::params![date, *min as i64, *kp as i64, *mc as i64, *mm as i64, *se as i64],
        )?;
    }
    Ok(())
}

/// Insert network sample.
pub fn insert_network_sample(
    tx: &Transaction,
    date: &str,
    ts_ms: i64,
    download_bytes_today: u64,
    upload_bytes_today: u64,
    active_connections: u32,
    download_bps: f64,
    upload_bps: f64,
    latency_ms: u32,
    is_online: bool,
) -> Result<(), rusqlite::Error> {
    tx.execute(
        r#"INSERT INTO network_samples (date, ts_ms, download_bytes_today, upload_bytes_today, active_connections, download_bps, upload_bps, latency_ms, is_online)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"#,
        rusqlite::params![
            date,
            ts_ms,
            download_bytes_today as i64,
            upload_bytes_today as i64,
            active_connections as i64,
            download_bps,
            upload_bps,
            latency_ms as i64,
            if is_online { 1i64 } else { 0i64 },
        ],
    )?;
    Ok(())
}

/// Load last N input events for a date (for live feed / recovery).
pub fn load_input_events_for_date(
    date: &str,
    limit: usize,
) -> Vec<(i64, String, String, String, Option<String>, Option<String>, Option<String>, Option<i32>, Option<i32>)> {
    let start_ms = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .ok()
        .and_then(|d| d.and_hms_opt(0, 0, 0))
        .map(|dt| dt.and_utc().timestamp_millis())
        .unwrap_or(0);
    let end_ms = start_ms + 86400 * 1000; // +1 day

    with_conn(|conn| {
        let mut stmt = conn.prepare(
            r#"SELECT ts_ms, kind, action, label, state_key, button, direction, x, y
               FROM input_events WHERE ts_ms >= ?1 AND ts_ms < ?2 ORDER BY ts_ms DESC LIMIT ?3"#,
        )?;
        let rows = stmt.query_map([start_ms, end_ms, limit as i64], |r| {
            Ok((
                r.get(0)?,
                r.get(1)?,
                r.get(2)?,
                r.get(3)?,
                r.get(4)?,
                r.get(5)?,
                r.get(6)?,
                r.get(7)?,
                r.get(8)?,
            ))
        })?;
        let out: Result<Vec<_>, _> = rows.collect();
        out
    })
    .unwrap_or_default()
}

/// Load activity sessions for a date.
pub fn load_activity_sessions_for_date(
    date: &str,
) -> Vec<(
    u64,
    String,
    String,
    String,
    u32,
    i64,
    i64,
    u32,
    u32,
    u32,
    Option<String>,
)> {
    with_conn(|conn| {
        let mut stmt = conn.prepare(
            r#"SELECT id, app_id, app_name, title, pid, started_at_ms, ended_at_ms,
                      key_presses, mouse_clicks, scroll_events, icon_data_url
               FROM activity_sessions WHERE date = ?1 ORDER BY started_at_ms ASC"#,
        )?;
        let rows = stmt.query_map([date], |r| {
            Ok((
                r.get::<_, i64>(0)? as u64,
                r.get(1)?,
                r.get(2)?,
                r.get(3)?,
                r.get::<_, i64>(4)? as u32,
                r.get(5)?,
                r.get(6)?,
                r.get::<_, i64>(7)? as u32,
                r.get::<_, i64>(8)? as u32,
                r.get::<_, i64>(9)? as u32,
                r.get(10)?,
            ))
        })?;
        let out: Result<Vec<_>, _> = rows.collect();
        out
    })
    .unwrap_or_default()
}

/// Load input minutes for a date.
pub fn load_input_minutes_for_date(
    date: &str,
) -> Vec<(u32, u32, u32, u32, u32)> {
    with_conn(|conn| {
        let mut stmt = conn.prepare(
            r#"SELECT minute_of_day, key_presses, mouse_clicks, mouse_moves, scroll_events
               FROM input_minutes WHERE date = ?1 ORDER BY minute_of_day ASC"#,
        )?;
        let rows = stmt.query_map([date], |r| {
            Ok((
                r.get::<_, i64>(0)? as u32,
                r.get::<_, i64>(1)? as u32,
                r.get::<_, i64>(2)? as u32,
                r.get::<_, i64>(3)? as u32,
                r.get::<_, i64>(4)? as u32,
            ))
        })?;
        let out: Result<Vec<_>, _> = rows.collect();
        out
    })
    .unwrap_or_default()
}

/// Load latest network sample for a date.
pub fn load_latest_network_sample_for_date(date: &str) -> Option<(
    u64,
    u64,
    u32,
    f64,
    f64,
    u32,
    bool,
)> {
    with_conn(|conn| {
        let mut stmt = conn.prepare(
            r#"SELECT download_bytes_today, upload_bytes_today, active_connections,
                      download_bps, upload_bps, latency_ms, is_online
               FROM network_samples WHERE date = ?1 ORDER BY ts_ms DESC LIMIT 1"#,
        )?;
        let mut rows = stmt.query([date])?;
        if let Some(row) = rows.next()? {
            Ok((
                row.get::<_, i64>(0)? as u64,
                row.get::<_, i64>(1)? as u64,
                row.get::<_, i64>(2)? as u32,
                row.get::<_, f64>(3)?,
                row.get::<_, f64>(4)?,
                row.get::<_, i64>(5)? as u32,
                row.get::<_, i64>(6)? != 0,
            ))
        } else {
            Err(rusqlite::Error::QueryReturnedNoRows)
        }
    })
}

/// Execute multiple operations in a single atomic transaction.
pub fn with_atomic_tx<F, T>(f: F) -> Option<T>
where
    F: FnOnce(&Transaction) -> Result<T, rusqlite::Error>,
{
    with_tx(f)
}
