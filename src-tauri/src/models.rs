use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppStatusDto {
    pub app_name: String,
    pub version: String,
    pub platform: String,
    pub started_at: String,
    pub backend_mode: String,
    pub collectors_running: bool,
    pub data_dir: String,
    pub log_dir: String,
    pub db_path: String,
    pub db_exists: bool,
    pub ip_address: String,
    pub online: bool,
    pub latency_ms: u32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum MetricTrendDto {
    Up,
    Down,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricCardDto {
    pub title: String,
    pub value: String,
    pub change: Option<String>,
    pub trend: Option<MetricTrendDto>,
    pub subtitle: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardMetricsDto {
    pub active_time_today: MetricCardDto,
    pub mouse_events: MetricCardDto,
    pub keystrokes: MetricCardDto,
    pub network_traffic: MetricCardDto,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardSummaryDto {
    pub generated_at: String,
    pub metrics: DashboardMetricsDto,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityTimelinePointDto {
    pub label: String,
    pub active: f32,
    pub inactive: f32,
    pub full_date: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityTimelineDto {
    pub generated_at: String,
    pub start_date: String,
    pub end_date: String,
    pub is_hourly: bool,
    pub y_label: String,
    pub max_value: f32,
    pub avg_active: f32,
    pub points: Vec<ActivityTimelinePointDto>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkSummaryDto {
    pub generated_at: String,
    pub download_today: MetricCardDto,
    pub upload_today: MetricCardDto,
    pub active_connections: MetricCardDto,
    pub unique_domains: MetricCardDto,
}

/// Real-time input stats from the global hook aggregator (same source as dashboard + live feed).
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InputStatsDto {
    pub key_presses_today: u64,
    pub mouse_events_today: u64,
    pub scroll_events_today: u64,
    pub first_activity_ts_ms: Option<i64>,
    pub last_activity_ts_ms: Option<i64>,
}

/// Single event for the live activity feed (from the same global input stream).
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveFeedEventDto {
    pub id: u64,
    pub event_type: String,
    pub description: String,
    pub timestamp: String,
    pub detail: Option<String>,
}

/// 7 days (Mon–Sun) × 24 hours, activity intensity 0–100.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityHeatmapDto {
    /// Row index 0 = Monday, 6 = Sunday; column index 0 = 00:00, 23 = 23:00.
    pub grid: Vec<Vec<u8>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUsageSessionDto {
    pub id: u64,
    pub app_id: String,
    pub app_name: String,
    pub icon_data_url: Option<String>,
    pub title: String,
    pub pid: u32,
    pub started_at_ms: i64,
    pub ended_at_ms: i64,
    pub duration_ms: u64,
    pub key_presses: u32,
    pub mouse_clicks: u32,
    pub scroll_events: u32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUsageSummaryDto {
    pub app_id: String,
    pub app_name: String,
    pub icon_data_url: Option<String>,
    pub session_count: u32,
    pub total_duration_ms: u64,
    pub key_presses: u32,
    pub mouse_clicks: u32,
    pub scroll_events: u32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInputMinuteDto {
    pub minute_of_day: u32,
    pub key_presses: u32,
    pub mouse_clicks: u32,
    pub mouse_moves: u32,
    pub scroll_events: u32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityAppUsageDto {
    pub generated_at: String,
    pub sessions: Vec<AppUsageSessionDto>,
    pub apps: Vec<AppUsageSummaryDto>,
    pub input_minutes: Vec<AppInputMinuteDto>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityOverviewDto {
    pub generated_at: String,
    pub total_sessions: u32,
    pub apps: Vec<AppUsageSummaryDto>,
    pub input_minutes: Vec<AppInputMinuteDto>,
    pub timeline_sessions: Vec<AppUsageSessionDto>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivitySessionPageDto {
    pub generated_at: String,
    pub total: u32,
    pub offset: u32,
    pub limit: u32,
    pub has_more: bool,
    pub sessions: Vec<AppUsageSessionDto>,
}

// ── Network monitoring DTOs ──

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetConnectionDto {
    pub id: String,
    pub process: String,
    pub pid: u32,
    pub icon: String,
    pub protocol: String,
    pub local_addr: String,
    pub local_port: u16,
    pub remote_addr: String,
    pub remote_port: u16,
    pub state: String,
    pub download_bytes: u64,
    pub upload_bytes: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetProcessBandwidthDto {
    pub id: String,
    pub process: String,
    pub pid: u32,
    pub icon: String,
    pub icon_data_url: Option<String>,
    pub download_bytes: u64,
    pub upload_bytes: u64,
    pub total_bytes: u64,
    pub connection_count: u32,
    pub peak_bps: f64,
    pub process_type: String,
    pub status: String,
    pub description: String,
}

#[allow(dead_code)]
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetDomainDto {
    pub domain: String,
    pub request_count: u32,
    pub bandwidth_bytes: u64,
    pub category: String,
    pub color: String,
    pub percentage: f32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetSpeedSnapshotDto {
    pub download_bps: f64,
    pub upload_bps: f64,
    pub latency_ms: u32,
    pub jitter_ms: f64,
    pub timestamp: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetUsagePointDto {
    pub label: String,
    pub download_bytes: u64,
    pub upload_bytes: u64,
}

#[allow(dead_code)]
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetDayVelocityDto {
    pub date: String,
    pub day: u32,
    pub month: u32,
    pub year: i32,
    pub dow: u32,
    pub download_bytes: u64,
    pub upload_bytes: u64,
    pub total_bytes: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetStatusDto {
    pub is_online: bool,
    pub latency_ms: u32,
    pub uptime_percent: f64,
    pub avg_latency_ms: u32,
    pub connection_type: String,
    pub dns_server: String,
    pub gateway: String,
    pub local_ip: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetOverviewDto {
    pub generated_at: String,
    pub download_bytes_today: u64,
    pub upload_bytes_today: u64,
    pub active_connections: u32,
    pub unique_remote_addrs: u32,
    pub speed: NetSpeedSnapshotDto,
    pub status: NetStatusDto,
}

#[allow(dead_code)]
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetQuotaConfigDto {
    pub quota_gb: f64,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SpeedTestResultDto {
    pub download_bps: f64,
    pub upload_bps: f64,
    pub latency_ms: u32,
}
