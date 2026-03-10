use tauri::State;

use crate::{
    app_state::AppState,
    app_usage_monitor,
    input_aggregator,
    models::{
        ActivityAppUsageDto, ActivityTimelineDto, AppStatusDto, DashboardSummaryDto,
        LiveFeedEventDto, NetConnectionDto, NetOverviewDto, NetProcessBandwidthDto,
        NetSpeedSnapshotDto, NetUsagePointDto, NetworkSummaryDto, SpeedTestResultDto,
    },
    network_monitor,
    services,
};

#[tauri::command]
pub fn get_app_status(state: State<'_, AppState>) -> Result<AppStatusDto, String> {
    Ok(services::build_app_status(state.inner()))
}

#[tauri::command]
pub fn get_dashboard_summary() -> Result<DashboardSummaryDto, String> {
    let stats = input_aggregator::get_stats();
    Ok(services::build_dashboard_summary(stats))
}

#[tauri::command]
pub fn get_input_stats() -> Result<crate::models::InputStatsDto, String> {
    Ok(input_aggregator::get_stats().unwrap_or_else(|| {
        crate::models::InputStatsDto {
            key_presses_today: 0,
            mouse_events_today: 0,
            scroll_events_today: 0,
            first_activity_ts_ms: None,
            last_activity_ts_ms: None,
        }
    }))
}

#[tauri::command]
pub fn get_recent_input_events(limit: Option<u32>) -> Result<Vec<LiveFeedEventDto>, String> {
    Ok(input_aggregator::get_recent_events(limit))
}

#[tauri::command]
pub fn get_activity_heatmap() -> Result<crate::models::ActivityHeatmapDto, String> {
    Ok(services::build_activity_heatmap())
}

#[tauri::command]
pub fn get_activity_app_usage(limit: Option<u32>) -> Result<ActivityAppUsageDto, String> {
    Ok(app_usage_monitor::get_activity_app_usage(limit))
}

#[tauri::command]
pub fn get_activity_timeline(
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<ActivityTimelineDto, String> {
    services::build_activity_timeline(start_date, end_date)
}

#[tauri::command]
pub fn get_network_summary() -> Result<NetworkSummaryDto, String> {
    Ok(services::build_network_summary())
}

#[tauri::command]
pub fn get_network_overview() -> Result<NetOverviewDto, String> {
    Ok(network_monitor::get_network_overview())
}

#[tauri::command]
pub fn get_network_connections() -> Result<Vec<NetConnectionDto>, String> {
    Ok(network_monitor::get_network_connections())
}

#[tauri::command]
pub fn get_process_bandwidth() -> Result<Vec<NetProcessBandwidthDto>, String> {
    Ok(network_monitor::get_process_bandwidth())
}

#[tauri::command]
pub fn get_speed_history() -> Result<Vec<NetSpeedSnapshotDto>, String> {
    Ok(network_monitor::get_speed_history())
}

#[tauri::command]
pub fn get_network_usage_history() -> Result<Vec<NetUsagePointDto>, String> {
    Ok(network_monitor::get_network_usage_history())
}

#[tauri::command]
pub fn run_speed_test() -> Result<SpeedTestResultDto, String> {
    let (dl, ul, lat) = network_monitor::run_speed_test();
    Ok(SpeedTestResultDto {
        download_bps: dl,
        upload_bps: ul,
        latency_ms: lat,
    })
}
