use tauri::{Emitter, Listener};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            let handle = app.handle().clone();
            app.listen("deep-link://new-url", move |event: tauri::Event| {
                let payload = event.payload();
                // Strip surrounding quotes/brackets from the URL payload
                let cleaned = payload
                    .trim_start_matches('[')
                    .trim_end_matches(']')
                    .trim_start_matches('"')
                    .trim_end_matches('"');
                let _ = handle.emit("deep-link", cleaned);
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Wohnly");
}
