use chrono::{Datelike, Duration, Local, LocalResult, NaiveDate, TimeZone, Utc};

use crate::{
    app_state::AppState,
    app_usage_monitor,
    db,
    models::{
        ActivityHeatmapDto, ActivityOverviewDto, ActivitySessionPageDto, ActivityTimelineDto,
        ActivityTimelinePointDto, AppInputMinuteDto, AppStatusDto, AppUsageSessionDto,
        AppUsageSummaryDto, DashboardMetricsDto, DashboardSummaryDto, InputStatsDto,
        MetricCardDto, MetricTrendDto, NetworkSummaryDto,
    },
    network_monitor,
};

fn format_count(value: usize) -> String {
    let digits = value.to_string();
    let reversed_chars: Vec<char> = digits.chars().rev().collect();
    let mut with_separators = String::with_capacity(digits.len() + digits.len() / 3);

    for (index, ch) in reversed_chars.iter().enumerate() {
        if index > 0 && index % 3 == 0 {
            with_separators.push(',');
        }
        with_separators.push(*ch);
    }

    with_separators.chars().rev().collect()
}

fn metric(
    title: &str,
    value: impl Into<String>,
    change: Option<&str>,
    trend: Option<MetricTrendDto>,
    subtitle: Option<&str>,
) -> MetricCardDto {
    MetricCardDto {
        title: title.to_string(),
        value: value.into(),
        change: change.map(str::to_string),
        trend,
        subtitle: subtitle.map(str::to_string),
    }
}

pub fn build_app_status(state: &AppState) -> AppStatusDto {
    let paths = state.paths();

    let net = network_monitor::get_network_overview();
    AppStatusDto {
        app_name: "MyTime".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
        started_at: state.started_at_rfc3339(),
        backend_mode: state.backend_mode().to_string(),
        collectors_running: state.collectors_running(),
        data_dir: paths.data_dir.display().to_string(),
        log_dir: paths.log_dir.display().to_string(),
        db_path: paths.db_path.display().to_string(),
        db_exists: paths.db_path.exists(),
        ip_address: network_monitor::get_local_ip(),
        online: net.status.is_online,
        latency_ms: net.status.latency_ms,
    }
}

pub fn build_dashboard_summary(stats: Option<InputStatsDto>) -> DashboardSummaryDto {
    let today = Local::now().date_naive();
    let seed = today.ordinal() % 7;

    // Align with Activity timeline "active" minutes (per-minute input buckets), not first→last event span.
    let active_mins_from_buckets = {
        let minutes = app_usage_monitor::get_input_minutes();
        aggregate_today_input(&minutes).total_active_minutes as u64
    };

    let (active_time, mouse_events, keystrokes) = match stats {
        Some(s) => {
            let active_str = format!("{}h {:02}m", active_mins_from_buckets / 60, active_mins_from_buckets % 60);
            (
                metric(
                    "Active Time Today",
                    active_str,
                    None,
                    None,
                    Some("minutes with keyboard/mouse activity"),
                ),
                metric(
                    "Mouse Events",
                    format_count(s.mouse_events_today as usize),
                    None,
                    None,
                    Some("clicks & movements"),
                ),
                metric(
                    "Keystrokes",
                    format_count(s.key_presses_today as usize),
                    None,
                    None,
                    Some("total today"),
                ),
            )
        }
        None => (
            metric(
                "Active Time Today",
                format!("{}h {:02}m", 6 + (seed / 3), 32 + seed * 3),
                Some("+12%"),
                Some(MetricTrendDto::Up),
                Some("vs yesterday"),
            ),
            metric(
                "Mouse Events",
                format_count(14_200 + seed as usize * 137),
                Some("+8%"),
                Some(MetricTrendDto::Up),
                Some("clicks & movements"),
            ),
            metric(
                "Keystrokes",
                format_count(22_900 + seed as usize * 211),
                Some("-3%"),
                Some(MetricTrendDto::Down),
                Some("total today"),
            ),
        ),
    };

    DashboardSummaryDto {
        generated_at: Utc::now().to_rfc3339(),
        metrics: DashboardMetricsDto {
            active_time_today: active_time,
            mouse_events,
            keystrokes,
            network_traffic: {
                let overview = network_monitor::get_network_overview();
                let total_bytes = overview.download_bytes_today + overview.upload_bytes_today;
                let gb = total_bytes as f64 / (1024.0 * 1024.0 * 1024.0);
                metric(
                    "Network Traffic",
                    if gb >= 1.0 { format!("{:.1} GB", gb) } else { format!("{:.1} MB", gb * 1024.0) },
                    None,
                    None,
                    Some("download + upload"),
                )
            },
        },
    }
}

pub fn build_network_summary() -> NetworkSummaryDto {
    let overview = network_monitor::get_network_overview();
    let fmt_bytes = |b: u64| -> String {
        let gb = b as f64 / (1024.0 * 1024.0 * 1024.0);
        if gb >= 1.0 { format!("{:.1} GB", gb) } else { format!("{:.1} MB", gb * 1024.0) }
    };

    NetworkSummaryDto {
        generated_at: overview.generated_at,
        download_today: metric("Download Today", fmt_bytes(overview.download_bytes_today), None, None, None),
        upload_today: metric("Upload Today", fmt_bytes(overview.upload_bytes_today), None, None, None),
        active_connections: metric("Active Connections", format!("{}", overview.active_connections), None, None, None),
        unique_domains: metric("Unique Remote IPs", format!("{}", overview.unique_remote_addrs), None, None, None),
    }
}

fn to_compact_session_dto(row: &db::ActivitySessionRow) -> AppUsageSessionDto {
    AppUsageSessionDto {
        id: row.id,
        app_id: row.app_id.clone(),
        app_name: row.app_name.clone(),
        icon_data_url: None,
        title: row.title.clone(),
        pid: row.pid,
        started_at_ms: row.started_at_ms,
        ended_at_ms: row.ended_at_ms,
        duration_ms: (row.ended_at_ms - row.started_at_ms).max(0) as u64,
        key_presses: row.key_presses,
        mouse_clicks: row.mouse_clicks,
        scroll_events: row.scroll_events,
    }
}

fn to_app_summary_dto(row: db::ActivityAppSummaryRow) -> AppUsageSummaryDto {
    AppUsageSummaryDto {
        app_id: row.app_id,
        app_name: row.app_name,
        icon_data_url: row.icon_data_url,
        session_count: row.session_count,
        total_duration_ms: row.total_duration_ms,
        key_presses: row.key_presses,
        mouse_clicks: row.mouse_clicks,
        scroll_events: row.scroll_events,
    }
}

fn local_day_start_ms(day: NaiveDate) -> Option<i64> {
    let start_naive = day.and_hms_opt(0, 0, 0)?;
    let start = match Local.from_local_datetime(&start_naive) {
        LocalResult::Single(dt) => dt,
        LocalResult::Ambiguous(_, dt) => dt,
        LocalResult::None => return None,
    };
    Some(start.timestamp_millis())
}

fn build_timeline_sessions(
    day: NaiveDate,
    rows: &[db::ActivitySessionRow],
) -> Vec<AppUsageSessionDto> {
    const MAX_RAW_TIMELINE_SESSIONS: usize = 1_200;
    const MINUTES_PER_DAY: usize = 24 * 60;
    const MINUTE_MS: i64 = 60_000;

    if rows.is_empty() {
        return Vec::new();
    }

    if rows.len() <= MAX_RAW_TIMELINE_SESSIONS {
        return rows.iter().map(to_compact_session_dto).collect();
    }

    let Some(day_start_ms) = local_day_start_ms(day) else {
        return rows.iter().take(MAX_RAW_TIMELINE_SESSIONS).map(to_compact_session_dto).collect();
    };
    let day_end_ms = day_start_ms + MINUTES_PER_DAY as i64 * MINUTE_MS;

    let mut minute_slots: Vec<Option<(usize, i64)>> = vec![None; MINUTES_PER_DAY];

    for (row_index, row) in rows.iter().enumerate() {
        let clamped_start = row.started_at_ms.max(day_start_ms);
        let clamped_end = row.ended_at_ms.min(day_end_ms);
        if clamped_end <= clamped_start {
            continue;
        }

        let start_minute = ((clamped_start - day_start_ms) / MINUTE_MS)
            .clamp(0, (MINUTES_PER_DAY - 1) as i64) as usize;
        let end_minute = (((clamped_end - 1) - day_start_ms) / MINUTE_MS)
            .clamp(0, (MINUTES_PER_DAY - 1) as i64) as usize;

        for minute in start_minute..=end_minute {
            let bucket_start_ms = day_start_ms + minute as i64 * MINUTE_MS;
            let bucket_end_ms = bucket_start_ms + MINUTE_MS;
            let overlap_ms = (clamped_end.min(bucket_end_ms) - clamped_start.max(bucket_start_ms))
                .max(0);

            if overlap_ms == 0 {
                continue;
            }

            let should_replace = match minute_slots[minute] {
                Some((_, current_overlap_ms)) => overlap_ms > current_overlap_ms,
                None => true,
            };

            if should_replace {
                minute_slots[minute] = Some((row_index, overlap_ms));
            }
        }
    }

    let mut sessions = Vec::new();
    let mut minute = 0usize;

    while minute < MINUTES_PER_DAY {
        let Some((row_index, _)) = minute_slots[minute] else {
            minute += 1;
            continue;
        };

        let mut end_minute = minute + 1;
        while end_minute < MINUTES_PER_DAY {
            match minute_slots[end_minute] {
                Some((next_row_index, _)) if next_row_index == row_index => {
                    end_minute += 1;
                }
                _ => break,
            }
        }

        let row = &rows[row_index];
        let block_start_ms = day_start_ms + minute as i64 * MINUTE_MS;
        let block_end_ms = day_start_ms + end_minute as i64 * MINUTE_MS;
        let block_duration_ms = (block_end_ms - block_start_ms).max(MINUTE_MS);
        let row_duration_ms = (row.ended_at_ms - row.started_at_ms).max(1);
        let ratio = (block_duration_ms as f64 / row_duration_ms as f64).clamp(0.0, 1.0);

        sessions.push(AppUsageSessionDto {
            id: row.id,
            app_id: row.app_id.clone(),
            app_name: row.app_name.clone(),
            icon_data_url: None,
            title: row.title.clone(),
            pid: row.pid,
            started_at_ms: block_start_ms,
            ended_at_ms: block_end_ms,
            duration_ms: block_duration_ms as u64,
            key_presses: (row.key_presses as f64 * ratio).round() as u32,
            mouse_clicks: (row.mouse_clicks as f64 * ratio).round() as u32,
            scroll_events: (row.scroll_events as f64 * ratio).round() as u32,
        });

        minute = end_minute;
    }

    sessions
}

pub fn build_activity_overview() -> ActivityOverviewDto {
    let today = Local::now().date_naive();
    let today_str = today.format("%Y-%m-%d").to_string();

    let session_rows = db::load_activity_session_rows_for_date(&today_str);
    let total_sessions = session_rows.len() as u32;

    ActivityOverviewDto {
        generated_at: Utc::now().to_rfc3339(),
        total_sessions,
        apps: db::load_activity_app_summaries_for_date(&today_str)
            .into_iter()
            .map(to_app_summary_dto)
            .collect(),
        input_minutes: app_usage_monitor::get_input_minutes(),
        timeline_sessions: build_timeline_sessions(today, &session_rows),
    }
}

pub fn build_activity_session_page(
    offset: Option<u32>,
    limit: Option<u32>,
    filter_text: Option<String>,
    app_id: Option<String>,
    sort_field: Option<String>,
    sort_dir: Option<String>,
) -> ActivitySessionPageDto {
    let today = Local::now().date_naive();
    let today_str = today.format("%Y-%m-%d").to_string();
    let resolved_limit = limit.unwrap_or(150).clamp(1, 500);
    let resolved_offset = offset.unwrap_or(0);
    let resolved_sort_field = sort_field.unwrap_or_else(|| "start".to_string());
    let resolved_sort_dir = sort_dir.unwrap_or_else(|| "desc".to_string());

    let (total, rows) = db::load_activity_sessions_page_for_date(
        &today_str,
        filter_text.as_deref(),
        app_id.as_deref(),
        &resolved_sort_field,
        &resolved_sort_dir,
        resolved_limit,
        resolved_offset,
    );
    let sessions: Vec<AppUsageSessionDto> = rows.iter().map(to_compact_session_dto).collect();
    let has_more = resolved_offset.saturating_add(sessions.len() as u32) < total;

    ActivitySessionPageDto {
        generated_at: Utc::now().to_rfc3339(),
        total,
        offset: resolved_offset,
        limit: resolved_limit,
        has_more,
        sessions,
    }
}

pub fn build_activity_timeline(
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<ActivityTimelineDto, String> {
    let today = Local::now().date_naive();
    let start = match start_date {
        Some(value) => parse_date(&value)?,
        None => today - Duration::days(6),
    };
    let end = match end_date {
        Some(value) => parse_date(&value)?,
        None => today,
    };

    if end < start {
        return Err("end_date must be on or after start_date".to_string());
    }

    // Live in-memory minutes for today (may be ahead of SQLite by a few seconds).
    let today_live_minutes: Vec<AppInputMinuteDto> = app_usage_monitor::get_input_minutes();

    let day_count = (end - start).num_days() + 1;
    let is_hourly = day_count <= 1;
    let mut points = Vec::new();

    if is_hourly {
        let mins = input_minutes_for_timeline_date(start, today, &today_live_minutes);
        let day_agg = aggregate_today_input(&mins);
        for hour in 0..24 {
            let active = day_agg.hourly_active_minutes[hour as usize] as f32;

            points.push(ActivityTimelinePointDto {
                label: format!("{hour:02}:00"),
                active,
                inactive: 60.0 - active,
                full_date: format!("{} {hour:02}:00", start.format("%Y-%m-%d")),
            });
        }
    } else if day_count <= 31 {
        for offset in 0..day_count {
            let date = start + Duration::days(offset);
            let mins = input_minutes_for_timeline_date(date, today, &today_live_minutes);
            let agg = aggregate_today_input(&mins);
            let active = agg.total_active_minutes as f32 / 60.0;
            let label = if day_count <= 14 {
                format!("{}/{}", date.month(), date.day())
            } else {
                date.day().to_string()
            };

            points.push(ActivityTimelinePointDto {
                label,
                active,
                inactive: 24.0 - active,
                full_date: date.format("%Y-%m-%d").to_string(),
            });
        }
    } else {
        let week_count = ((day_count + 6) / 7) as usize;
        for week_index in 0..week_count {
            let week_start = start + Duration::days((week_index * 7) as i64);
            let week_end = std::cmp::min(week_start + Duration::days(6), end);
            let days_in_week = (week_end - week_start).num_days() + 1;
            let mut total_active_hours = 0.0_f32;
            for d in 0i64..days_in_week {
                let date = week_start + Duration::days(d);
                let mins = input_minutes_for_timeline_date(date, today, &today_live_minutes);
                let agg = aggregate_today_input(&mins);
                total_active_hours += agg.total_active_minutes as f32 / 60.0;
            }
            let active = total_active_hours / days_in_week as f32;

            points.push(ActivityTimelinePointDto {
                label: format!("W{}", week_index + 1),
                active,
                inactive: 24.0 - active,
                full_date: format!("Week of {}/{}", week_start.month(), week_start.day()),
            });
        }
    }

    let max_value = if is_hourly { 60.0 } else { 24.0 };
    let avg_active = if points.is_empty() {
        0.0
    } else {
        let total: f32 = points.iter().map(|point| point.active).sum();
        ((total / points.len() as f32) * 10.0).round() / 10.0
    };

    Ok(ActivityTimelineDto {
        generated_at: Utc::now().to_rfc3339(),
        start_date: start.format("%Y-%m-%d").to_string(),
        end_date: end.format("%Y-%m-%d").to_string(),
        is_hourly,
        y_label: if is_hourly {
            "Minutes".to_string()
        } else {
            "Hours".to_string()
        },
        max_value,
        avg_active,
        points,
    })
}

/// Returns a 7 (days) × 24 (hours) grid of activity intensity 0–100.
/// Row 0 = Monday, row 6 = Sunday; column = hour of day.
pub fn build_activity_heatmap() -> ActivityHeatmapDto {
    let today = Local::now().date_naive();
    let week_start = today - Duration::days(6);
    let today_live_minutes: Vec<AppInputMinuteDto> = app_usage_monitor::get_input_minutes();
    let mut grid = vec![vec![0u8; 24]; 7];
    for offset in 0..7 {
        let date = week_start + Duration::days(offset);
        let mins = input_minutes_for_timeline_date(date, today, &today_live_minutes);
        let agg = aggregate_today_input(&mins);
        let weekday = date.weekday().num_days_from_monday() as usize;
        grid[weekday] = agg.hourly_intensity.to_vec();
    }
    ActivityHeatmapDto { grid }
}

#[derive(Default)]
struct TodayInputAggregate {
    total_active_minutes: u32,
    hourly_active_minutes: [u32; 24],
    hourly_intensity: [u8; 24],
}

fn bucket_activity_score(bucket: &AppInputMinuteDto) -> u32 {
    (bucket.key_presses * 12)
        .saturating_add(bucket.mouse_clicks * 10)
        .saturating_add(bucket.scroll_events * 8)
        .saturating_add(bucket.mouse_moves * 3)
}

fn input_minutes_for_date_from_db(date: &str) -> Vec<AppInputMinuteDto> {
    db::load_input_minutes_for_date(date)
        .into_iter()
        .map(
            |(minute_of_day, key_presses, mouse_clicks, mouse_moves, scroll_events)| AppInputMinuteDto {
                minute_of_day,
                key_presses,
                mouse_clicks,
                mouse_moves,
                scroll_events,
            },
        )
        .collect()
}

/// For timeline/heatmap: use live in-memory minutes for `today`, otherwise load from SQLite.
fn input_minutes_for_timeline_date(
    date: NaiveDate,
    today: NaiveDate,
    today_live: &[AppInputMinuteDto],
) -> Vec<AppInputMinuteDto> {
    if date == today {
        today_live.to_vec()
    } else {
        let date_str = date.format("%Y-%m-%d").to_string();
        input_minutes_for_date_from_db(&date_str)
    }
}

fn aggregate_today_input(input_minutes: &[AppInputMinuteDto]) -> TodayInputAggregate {
    let mut aggregate = TodayInputAggregate::default();
    let mut hourly_scores = [0u32; 24];

    for bucket in input_minutes {
        let hour = (bucket.minute_of_day / 60).min(23) as usize;
        let is_active = bucket.key_presses > 0
            || bucket.mouse_clicks > 0
            || bucket.mouse_moves > 0
            || bucket.scroll_events > 0;

        if is_active {
            aggregate.total_active_minutes = aggregate.total_active_minutes.saturating_add(1);
            aggregate.hourly_active_minutes[hour] =
                aggregate.hourly_active_minutes[hour].saturating_add(1);
        }

        hourly_scores[hour] = hourly_scores[hour].saturating_add(bucket_activity_score(bucket));
    }

    for (hour, score) in hourly_scores.into_iter().enumerate() {
        let active_pct = aggregate.hourly_active_minutes[hour].saturating_mul(100) / 60;
        let intensity_from_volume = (score / 6).min(100) as u8;
        aggregate.hourly_intensity[hour] = active_pct.max(intensity_from_volume as u32) as u8;
    }

    aggregate
}

fn parse_date(value: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|error| format!("invalid date '{value}': {error}"))
}
