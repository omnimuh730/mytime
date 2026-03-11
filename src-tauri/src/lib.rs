use std::{error::Error, path::Path, sync::OnceLock};

mod app_state;
mod app_usage_monitor;
mod config;
mod db;
mod input_aggregator;
mod input_monitor;
mod ipc;
mod models;
mod network_monitor;
mod services;
mod singleton;
mod startup;

use app_state::AppState;
use config::AppPaths;
use tauri::{ Manager, tray::{TrayIconBuilder, TrayIconEvent, TrayIcon} };
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
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // Second launch: focus and show the existing main window.
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .setup(|app| {
            let paths = AppPaths::resolve(&app.handle())?;
            init_logging(&paths.log_dir)?;

            info!(
                data_dir = %paths.data_dir.display(),
                log_dir = %paths.log_dir.display(),
                db_path = %paths.db_path.display(),
                "initialized foundation paths"
            );

            db::init(&paths.db_path)
                .map_err(|e| Box::<dyn std::error::Error>::from(std::io::Error::new(std::io::ErrorKind::Other, e)))?;

            // Register app to start at Windows login (once; no re-register).
            startup::register_once();

            let state = AppState::new(paths);
            app.manage(state);

            info!("registered backend foundation state");

            // Start background collectors.
            app_usage_monitor::start_global_app_usage_monitor(app.handle().clone());
            input_monitor::start_global_input_monitor(app.handle().clone());
            network_monitor::start_network_monitor();

            // Create a system tray icon so the app can live in the tray when "closed".
            let app_handle = app.handle().clone();
            if let Some(icon) = app_handle.default_window_icon() {
                let _tray: TrayIcon = TrayIconBuilder::new()
                    .icon(icon.clone())
                    .on_tray_icon_event(|tray, event| {
                        // Single left click on tray icon restores the main window.
                        if let TrayIconEvent::Click { .. } = event {
                            if let Some(window) = tray.app_handle().get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        // When the user clicks the window close button, hide to tray instead of quitting.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Hide the window and keep the process + collectors running.
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            ipc::get_app_status,
            ipc::get_dashboard_summary,
            ipc::get_input_stats,
            ipc::get_recent_input_events,
            ipc::get_activity_app_usage,
            ipc::get_activity_heatmap,
            ipc::get_activity_timeline,
            ipc::get_network_summary,
            ipc::get_network_overview,
            ipc::get_network_connections,
            ipc::get_process_bandwidth,
            ipc::get_speed_history,
            ipc::get_network_usage_history,
            ipc::run_speed_test,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub fn run_input_hook_helper(port: u16) -> Result<(), String> {
    input_monitor::run_input_hook_helper(port)
}
