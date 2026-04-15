use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize)]
pub struct ApiResponse {
    pub data: serde_json::Value,
    pub status: u16,
    pub status_text: String,
}

#[tauri::command]
async fn download_backup(url: String, filename: String, token: Option<String>) -> Result<String, String> {
    let client = reqwest::Client::new();
    let mut request = client.get(&url);
    
    if let Some(t) = token {
        request = request.header("Authorization", format!("Bearer {}", t));
    }
    
    let response = request.send().await.map_err(|e| e.to_string())?;
    
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    
    let downloads_dir = dirs::download_dir().unwrap_or_else(|| PathBuf::from("."));
    let path = downloads_dir.join(&filename);
    
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
async fn api_get(url: String, token: Option<String>) -> Result<ApiResponse, String> {
    let client = reqwest::Client::new();
    let mut request = client.get(&url)
        .timeout(std::time::Duration::from_secs(30));
    
    if let Some(t) = token {
        request = request.header("Authorization", format!("Bearer {}", t));
    }
    
    match request.send().await {
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
async fn api_post(url: String, body: String, token: Option<String>) -> Result<ApiResponse, String> {
    let client = reqwest::Client::new();
    let mut request = client.post(&url)
        .header("Content-Type", "application/json")
        .body(body)
        .timeout(std::time::Duration::from_secs(30));
    
    if let Some(t) = token {
        request = request.header("Authorization", format!("Bearer {}", t));
    }
    
    match request.send().await {
        Ok(response) => {
            let status = response.status().as_u16();
            let status_text = response.status().canonical_reason().unwrap_or("").to_string();
            let data = response.json().await.unwrap_or(serde_json::Value::Null);
            Ok(ApiResponse { data, status, status_text })
        }
        Err(e) => Err(format!("POST failed: {}", e))
    }
}

#[tauri::command]
async fn api_put(url: String, body: String, token: Option<String>) -> Result<ApiResponse, String> {
    let client = reqwest::Client::new();
    let mut request = client.put(&url)
        .header("Content-Type", "application/json")
        .body(body)
        .timeout(std::time::Duration::from_secs(30));
    
    if let Some(t) = token {
        request = request.header("Authorization", format!("Bearer {}", t));
    }
    
    match request.send().await {
        Ok(response) => {
            let status = response.status().as_u16();
            let status_text = response.status().canonical_reason().unwrap_or("").to_string();
            let data = response.json().await.unwrap_or(serde_json::Value::Null);
            Ok(ApiResponse { data, status, status_text })
        }
        Err(e) => Err(format!("PUT failed: {}", e))
    }
}

#[tauri::command]
async fn api_delete(url: String, token: Option<String>) -> Result<ApiResponse, String> {
    let client = reqwest::Client::new();
    let mut request = client.delete(&url)
        .timeout(std::time::Duration::from_secs(30));
    
    if let Some(t) = token {
        request = request.header("Authorization", format!("Bearer {}", t));
    }
    
    match request.send().await {
        Ok(response) => {
            let status = response.status().as_u16();
            let status_text = response.status().canonical_reason().unwrap_or("").to_string();
            let data = response.json().await.unwrap_or(serde_json::Value::Null);
            Ok(ApiResponse { data, status, status_text })
        }
        Err(e) => Err(format!("DELETE failed: {}", e))
    }
}

#[tauri::command]
async fn api_patch(url: String, body: String, token: Option<String>) -> Result<ApiResponse, String> {
    let client = reqwest::Client::new();
    let mut request = client.patch(&url)
        .header("Content-Type", "application/json")
        .body(body)
        .timeout(std::time::Duration::from_secs(30));
    
    if let Some(t) = token {
        request = request.header("Authorization", format!("Bearer {}", t));
    }
    
    match request.send().await {
        Ok(response) => {
            let status = response.status().as_u16();
            let status_text = response.status().canonical_reason().unwrap_or("").to_string();
            let data = response.json().await.unwrap_or(serde_json::Value::Null);
            Ok(ApiResponse { data, status, status_text })
        }
        Err(e) => Err(format!("PATCH failed: {}", e))
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
    .invoke_handler(tauri::generate_handler![download_backup, api_get, api_post, api_put, api_delete, api_patch])
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
