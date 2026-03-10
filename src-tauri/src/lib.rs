use std::{error::Error, path::Path, sync::OnceLock};

mod app_state;
mod app_usage_monitor;
mod config;
mod input_aggregator;
mod input_monitor;
mod ipc;
mod models;
mod services;

use app_state::AppState;
use config::AppPaths;
use tauri::Manager;
use tracing::info;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

static LOG_GUARD: OnceLock<WorkerGuard> = OnceLock::new();

fn init_logging(log_dir: &Path) -> Result<(), Box<dyn Error>> {
    let file_appender = tracing_appender::rolling::daily(log_dir, "mytime.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(
            tracing_subscriber::fmt::layer()
                .with_ansi(false)
                .with_writer(non_blocking),
        )
        .try_init()?;

    let _ = LOG_GUARD.set(guard);

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let paths = AppPaths::resolve(&app.handle())?;
            init_logging(&paths.log_dir)?;

            info!(
                data_dir = %paths.data_dir.display(),
                log_dir = %paths.log_dir.display(),
                db_path = %paths.db_path.display(),
                "initialized foundation paths"
            );

            let state = AppState::new(paths);
            app.manage(state);

            info!("registered backend foundation state");

            app_usage_monitor::start_global_app_usage_monitor(app.handle().clone());
            input_monitor::start_global_input_monitor(app.handle().clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ipc::get_app_status,
            ipc::get_dashboard_summary,
            ipc::get_input_stats,
            ipc::get_recent_input_events,
            ipc::get_activity_app_usage,
            ipc::get_activity_heatmap,
            ipc::get_activity_timeline,
            ipc::get_network_summary
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
