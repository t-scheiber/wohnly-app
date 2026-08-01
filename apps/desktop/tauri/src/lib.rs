use tauri::Manager;

/// Reliable OS detection for the frontend (userAgent is not trustworthy for MAS auth).
#[tauri::command]
fn platform_os() -> &'static str {
    std::env::consts::OS
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // The deep-link feature ensures the URL is forwarded
            // to the existing instance's deep-link event automatically.
            // Bring the existing window to the foreground.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_auth_session::init())
        .plugin(tauri_plugin_siwa::init())
        .plugin(tauri_plugin_iap::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![platform_os])
        .run(tauri::generate_context!())
        .expect("error while running Wohnly");
}
