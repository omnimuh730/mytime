use tauri::State;

use crate::{
    app_state::AppState,
    app_usage_monitor,
    input_aggregator,
    models::{
        ActivityAppUsageDto, ActivityTimelineDto, AppStatusDto, DashboardSummaryDto,
        LiveFeedEventDto, NetworkSummaryDto,
    },
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
