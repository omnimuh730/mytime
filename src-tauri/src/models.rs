use serde::Serialize;

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
