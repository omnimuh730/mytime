use chrono::{Datelike, Duration, Local, NaiveDate, Utc};

use crate::{
    app_state::AppState,
    app_usage_monitor,
    models::{
        ActivityHeatmapDto, ActivityTimelineDto, ActivityTimelinePointDto, AppInputMinuteDto,
        AppStatusDto, DashboardMetricsDto, DashboardSummaryDto, InputStatsDto, MetricCardDto,
        MetricTrendDto, NetworkSummaryDto,
    },
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
        ip_address: "192.168.1.42".to_string(),
        online: true,
        latency_ms: 12,
    }
}

pub fn build_dashboard_summary(stats: Option<InputStatsDto>) -> DashboardSummaryDto {
    let today = Local::now().date_naive();
    let seed = today.ordinal() % 7;

    let (active_time, mouse_events, keystrokes) = match stats {
        Some(s) => {
            let active_mins = s
                .first_activity_ts_ms
                .zip(s.last_activity_ts_ms)
                .map(|(first, last)| ((last - first) / 60_000).max(0) as u64)
                .unwrap_or(0);
            let active_str = format!("{}h {:02}m", active_mins / 60, active_mins % 60);
            (
                metric(
                    "Active Time Today",
                    active_str,
                    None,
                    None,
                    Some("first → last activity today"),
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
            network_traffic: metric(
                "Network Traffic",
                format!("{:.1} GB", 24.8 + seed as f32 * 0.4),
                Some("+24%"),
                Some(MetricTrendDto::Up),
                Some("download + upload"),
            ),
        },
    }
}

pub fn build_network_summary() -> NetworkSummaryDto {
    let today = Local::now().date_naive();
    let seed = today.ordinal() % 9;

    NetworkSummaryDto {
        generated_at: Utc::now().to_rfc3339(),
        download_today: metric(
            "Download Today",
            format!("{:.1} GB", 18.0 + seed as f32 * 0.3),
            Some("+28%"),
            Some(MetricTrendDto::Up),
            None,
        ),
        upload_today: metric(
            "Upload Today",
            format!("{:.1} GB", 7.1 + seed as f32 * 0.2),
            Some("+15%"),
            Some(MetricTrendDto::Up),
            None,
        ),
        active_connections: metric(
            "Active Connections",
            format!("{}", 132 + seed * 3),
            Some("+12"),
            Some(MetricTrendDto::Up),
            None,
        ),
        unique_domains: metric(
            "Unique Domains",
            format!("{}", 81 + seed),
            Some("+7"),
            Some(MetricTrendDto::Up),
            None,
        ),
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

    let input_minutes = app_usage_monitor::get_activity_app_usage(None).input_minutes;
    let today_input = if start <= today && today <= end {
        aggregate_today_input(&input_minutes)
    } else {
        TodayInputAggregate::default()
    };

    let day_count = (end - start).num_days() + 1;
    let is_hourly = day_count <= 1;
    let mut points = Vec::new();

    if is_hourly {
        for hour in 0..24 {
            let active = if start == today {
                today_input.hourly_active_minutes[hour as usize] as f32
            } else {
                0.0
            };

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
            let active = if date == today {
                today_input.total_active_minutes as f32 / 60.0
            } else {
                0.0
            };
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
            let active = if week_start <= today && today <= week_end {
                (today_input.total_active_minutes as f32 / 60.0) / days_in_week as f32
            } else {
                0.0
            };

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
    let input_minutes = app_usage_monitor::get_activity_app_usage(None).input_minutes;
    let today_input = aggregate_today_input(&input_minutes);
    let mut grid = vec![vec![0u8; 24]; 7];
    let weekday = today.weekday().num_days_from_monday() as usize;
    grid[weekday] = today_input.hourly_intensity.to_vec();
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
