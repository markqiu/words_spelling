use std::process::Command;
use tauri::async_runtime::spawn;

/// 使用系统 TTS 朗读文本 (macOS)
#[tauri::command]
pub async fn speak(text: String, rate: Option<i32>) -> Result<(), String> {
    let rate = rate.unwrap_or(175); // 默认语速
    
    spawn(async move {
        #[cfg(target_os = "macos")]
        {
            let rate_str = rate.to_string();
            let output = Command::new("say")
                .arg("-r")
                .arg(&rate_str)
                .arg(&text)
                .output();
            
            match output {
                Ok(o) if o.status.success() => Ok(()),
                Ok(o) => Err(String::from_utf8_lossy(&o.stderr).to_string()),
                Err(e) => Err(e.to_string()),
            }
        }
        
        #[cfg(not(target_os = "macos"))]
        {
            // Windows/Linux 使用不同的 TTS 方案
            Err("TTS not implemented for this platform".to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 停止朗读
#[tauri::command]
pub fn stop_speaking() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("killall")
            .arg("say")
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Ok(())
    }
}
