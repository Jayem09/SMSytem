use tauri::Manager;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct ApiResponse {
    pub data: serde_json::Value,
    pub status: u16,
    pub status_text: String,
}

#[tauri::command]
async fn api_get(url: String) -> Result<ApiResponse, String> {
    let client = reqwest::Client::new();
    match client.get(&url)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
    {
        Ok(response) => {
            let status = response.status().as_u16();
            let status_text = response.status().canonical_reason().unwrap_or("").to_string();
            let data = response.json().await.unwrap_or(serde_json::Value::Null);
            Ok(ApiResponse { data, status, status_text })
        }
        Err(e) => Err(format!("GET failed: {}", e))
    }
}

#[tauri::command]
async fn api_post(url: String, body: String) -> Result<ApiResponse, String> {
    let client = reqwest::Client::new();
    match client.post(&url)
        .header("Content-Type", "application/json")
        .body(body)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
    {
        Ok(response) => {
            let status = response.status().as_u16();
            let status_text = response.status().canonical_reason().unwrap_or("").to_string();
            let data = response.json().await.unwrap_or(serde_json::Value::Null);
            Ok(ApiResponse { data, status, status_text })
        }
        Err(e) => Err(format!("POST failed: {}", e))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log::LevelFilter::Info)
          .build(),
      )?;
         
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![api_get, api_post])
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
