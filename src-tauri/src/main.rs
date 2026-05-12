// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;

#[derive(serde::Serialize)]
struct SystemInfo {
    os: String,
    os_version: String,
    arch: String,
    tauri_version: String,
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    let os = std::env::consts::OS.to_string();
    let arch = std::env::consts::ARCH.to_string();
    let tauri_version = tauri::VERSION.to_string();

    // 尝试获取更详细的 OS 版本信息
    let os_version = if os == "macos" {
        std::process::Command::new("sw_vers")
            .arg("-productVersion")
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| "Unknown".to_string())
    } else {
        "Unknown".to_string()
    };

    SystemInfo {
        os,
        os_version,
        arch,
        tauri_version,
    }
}

// 打开文件或目录（不受shell scope限制）
#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(path);

    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        Command::new("open")
            .arg(&path_buf)
            .spawn()
            .map_err(|e| format!("Failed to open: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("explorer")
            .arg(&path_buf)
            .spawn()
            .map_err(|e| format!("Failed to open: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        Command::new("xdg-open")
            .arg(&path_buf)
            .spawn()
            .map_err(|e| format!("Failed to open: {}", e))?;
    }

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![open_path, get_system_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
