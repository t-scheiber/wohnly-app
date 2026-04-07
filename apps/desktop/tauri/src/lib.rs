pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {
            // The deep-link feature ensures the URL is forwarded
            // to the existing instance's deep-link event automatically.
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("error while running Wohnly");
}
