// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::ffi::OsString;
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

#[tauri::command]
fn get_launch_paths() -> Vec<String> {
    collect_launch_paths(std::env::args_os().skip(1))
}

fn collect_launch_paths<I>(args: I) -> Vec<String>
where
    I: IntoIterator<Item = OsString>,
{
    args.into_iter()
        .filter_map(|arg| {
            let path = PathBuf::from(arg);
            if !path.exists() {
                return None;
            }

            path.canonicalize()
                .ok()
                .or(Some(path))
                .map(|p| p.to_string_lossy().to_string())
        })
        .collect()
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
        .invoke_handler(tauri::generate_handler![open_path, get_system_info, get_launch_paths])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::collect_launch_paths;
    use std::ffi::OsString;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn collect_launch_paths_filters_missing_entries() {
        let file_path = create_temp_file();
        let result = collect_launch_paths(vec![
            OsString::from("/path/does/not/exist"),
            file_path.clone().into_os_string(),
        ]);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0], fs::canonicalize(&file_path).unwrap().to_string_lossy());

        let _ = fs::remove_file(file_path);
    }

    fn create_temp_file() -> std::path::PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("peek-launch-path-{unique}.txt"));
        fs::write(&path, "peek").unwrap();
        path
    }
}
