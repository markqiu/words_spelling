use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::async_runtime::spawn;

use crate::models::{SegmentRequest, SegmentResponse};

#[derive(Debug, Serialize)]
struct ServerSegmentRequest {
    text: String,
    mode: String,
}

#[derive(Debug, Deserialize)]
struct ServerSegmentResponse {
    segments: Vec<String>,
    #[allow(dead_code)]
    engine_used: Option<String>,
    #[allow(dead_code)]
    metadata: Option<serde_json::Value>,
}

/// 调用服务器进行分词
#[tauri::command]
pub async fn segment_text(request: SegmentRequest) -> Result<SegmentResponse, String> {
    let server_url = request.server_url.unwrap_or_else(|| {
        "http://localhost:8000".to_string()
    });
    
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    
    let server_request = ServerSegmentRequest {
        text: request.text,
        mode: request.mode,
    };
    
    let url = format!("{}/api/segment", server_url);
    
    spawn(async move {
        let response = client
            .post(&url)
            .json(&server_request)
            .send()
            .await
            .map_err(|e| format!("Network error: {}", e))?;
        
        if !response.status().is_success() {
            return Err(format!("Server error: {}", response.status()));
        }
        
        let result: ServerSegmentResponse = response
            .json()
            .await
            .map_err(|e| format!("Parse error: {}", e))?;
        
        Ok(SegmentResponse {
            segments: result.segments,
            success: true,
            error: None,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
