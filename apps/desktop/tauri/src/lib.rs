use tauri::Manager;

#[derive(serde::Deserialize)]
struct NativeAppleSignInResponse {
    token: Option<String>,
    message: Option<String>,
    code: Option<String>,
}

/// Reliable OS detection for the frontend (userAgent is not trustworthy for MAS auth).
#[tauri::command]
fn platform_os() -> &'static str {
    std::env::consts::OS
}

/// The distribution flavor is compiled into the app so store-only behavior
/// cannot depend on a user agent, environment variable, or network request.
#[tauri::command]
fn distribution_channel() -> &'static str {
    if cfg!(feature = "mas") {
        "mac_app_store"
    } else {
        "direct"
    }
}

/// Complete the server half of native Sign in with Apple outside WKWebView.
/// The previous release obtained a native credential, but the webview fetch /
/// manual-cookie bridge could leave the UI on the login screen with no proof
/// that the resulting Better Auth session was usable.
#[tauri::command]
async fn exchange_apple_identity_token(
    api_url: String,
    identity_token: String,
    nonce: String,
    given_name: Option<String>,
    family_name: Option<String>,
    email: Option<String>,
) -> Result<String, String> {
    if !cfg!(debug_assertions) && api_url != "https://api.wohnly.app" {
        return Err("Invalid authentication server".to_string());
    }

    let mut id_token = serde_json::json!({
        "token": identity_token,
        "nonce": nonce,
    });

    if given_name.is_some() || family_name.is_some() || email.is_some() {
        let mut user = serde_json::Map::new();
        let mut name = serde_json::Map::new();
        if let Some(value) = given_name {
            name.insert("firstName".to_string(), value.into());
        }
        if let Some(value) = family_name {
            name.insert("lastName".to_string(), value.into());
        }
        if !name.is_empty() {
            user.insert("name".to_string(), name.into());
        }
        if let Some(value) = email {
            user.insert("email".to_string(), value.into());
        }
        id_token["user"] = user.into();
    }

    let response = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|_| "Could not initialize secure sign-in".to_string())?
        .post(format!("{api_url}/api/auth/sign-in/social"))
        .json(&serde_json::json!({
            "provider": "apple",
            "idToken": id_token,
        }))
        .send()
        .await
        .map_err(|_| "Could not reach the authentication server".to_string())?;

    let status = response.status();
    let payload = response
        .json::<NativeAppleSignInResponse>()
        .await
        .map_err(|_| format!("Authentication server returned an invalid response ({status})"))?;

    if !status.is_success() {
        return Err(payload
            .message
            .or(payload.code)
            .unwrap_or_else(|| format!("Sign in with Apple failed ({status})")));
    }

    payload
        .token
        .filter(|token| !token.is_empty())
        .ok_or_else(|| "Authentication completed without a session".to_string())
}

pub fn run() {
    let builder = tauri::Builder::default()
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
        .plugin(tauri_plugin_iap::init());

    // Guideline 2.4.5(vii): Mac App Store apps must use the App Store update
    // mechanism. Keep GitHub updates only in direct-download/Windows builds.
    #[cfg(not(feature = "mas"))]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    builder
        .invoke_handler(tauri::generate_handler![
            platform_os,
            distribution_channel,
            exchange_apple_identity_token
        ])
        .run(tauri::generate_context!())
        .expect("error while running Wohnly");
}
