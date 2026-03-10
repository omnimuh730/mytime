use chrono::{Datelike, Duration, Local, NaiveDate, Utc};

use crate::{
    app_state::AppState,
    models::{
        ActivityHeatmapDto, ActivityTimelineDto, ActivityTimelinePointDto, AppStatusDto,
        DashboardMetricsDto, DashboardSummaryDto, InputStatsDto, MetricCardDto, MetricTrendDto,
        NetworkSummaryDto,
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

    let day_count = (end - start).num_days() + 1;
    let is_hourly = day_count <= 1;
    let mut points = Vec::new();

    if is_hourly {
        for hour in 0..24 {
            let seed = ((start.day() * 100) + (hour as u32 * 7) + start.month() * 31) % 100;
            let is_work_hour = (8..=17).contains(&hour);
            let is_extended = (6..=20).contains(&hour);
            let active = if is_work_hour {
                35.0 + (seed % 25) as f32
            } else if is_extended {
                10.0 + (seed % 15) as f32
            } else {
                (seed % 5) as f32
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
            let seed = (date.day() * 17 + date.month() * 31 + date.year() as u32) % 100;
            let is_weekend = matches!(date.weekday(), chrono::Weekday::Sat | chrono::Weekday::Sun);
            let active = if is_weekend {
                (2 + (seed % 4)) as f32
            } else {
                (5 + (seed % 5)) as f32
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
            let date = start + Duration::days((week_index * 7) as i64);
            let seed = (date.day() * 13 + week_index as u32 * 23 + date.month() * 7) % 100;
            let active = (4 + (seed % 7)) as f32;

            points.push(ActivityTimelinePointDto {
                label: format!("W{}", week_index + 1),
                active,
                inactive: 24.0 - active,
                full_date: format!("Week of {}/{}", date.month(), date.day()),
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
    let seed_base = today.ordinal() as usize;
    let mut grid = Vec::with_capacity(7);
    for day in 0..7 {
        let mut row = Vec::with_capacity(24);
        for hour in 0..24 {
            let seed = (seed_base.wrapping_mul(31).wrapping_add(day * 17).wrapping_add(hour * 7)) % 100;
            let is_weekend = day >= 5;
            let is_work_hour = (9..=17).contains(&hour) && !is_weekend;
            let is_extended = (7..=22).contains(&hour);
            let value = if is_work_hour {
                (50 + seed % 50).min(100)
            } else if is_extended && !is_weekend {
                (10 + seed % 30).min(100)
            } else if is_extended {
                (5 + seed % 20).min(100)
            } else {
                (seed % 10).min(100)
            };
            row.push(value as u8);
        }
        grid.push(row);
    }
    ActivityHeatmapDto { grid }
}

fn parse_date(value: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|error| format!("invalid date '{value}': {error}"))
}
