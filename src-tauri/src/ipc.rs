use tauri::State;

use crate::{
    app_state::AppState,
    models::{ActivityTimelineDto, AppStatusDto, DashboardSummaryDto, NetworkSummaryDto},
    services,
};

#[tauri::command]
pub fn get_app_status(state: State<'_, AppState>) -> Result<AppStatusDto, String> {
    Ok(services::build_app_status(state.inner()))
}

#[tauri::command]
pub fn get_dashboard_summary() -> Result<DashboardSummaryDto, String> {
    Ok(services::build_dashboard_summary())
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
