// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{Emitter, Manager, State};

mod git;
mod terminal;

const CLI_EVENT_NAME: &str = "cli-launch-requested";

struct PendingLaunchPaths(Mutex<Vec<String>>);

#[derive(Clone, serde::Serialize)]
struct LaunchRequestEvent {
    paths: Vec<String>,
}

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
fn take_launch_paths(state: State<PendingLaunchPaths>) -> Vec<String> {
    let mut pending = state.0.lock().unwrap();
    std::mem::take(&mut *pending)
}

fn resolve_existing_path(arg: OsString, cwd: &Path) -> Option<String> {
    let path = PathBuf::from(arg);
    let resolved = if path.is_absolute() {
        path
    } else {
        cwd.join(path)
    };

    if !resolved.exists() {
        return None;
    }

    resolved
        .canonicalize()
        .ok()
        .or(Some(resolved))
        .map(|p| p.to_string_lossy().to_string())
}

fn collect_launch_paths<I>(args: I, cwd: &Path) -> Vec<String>
where
    I: IntoIterator<Item = OsString>,
{
    args.into_iter()
        .filter_map(|arg| resolve_existing_path(arg, cwd))
        .collect()
}

#[derive(Debug)]
enum CliAction {
    Launch(Vec<String>),
    Help,
    Version,
}

fn cli_help_text() -> String {
    format!(
        "\
Peek CLI

Usage:
  peek <path>
  peek open <path>
  peek --help
  peek --version

Examples:
  peek README.md
  peek .
  peek open ~/project

Version:
  {}
",
        env!("CARGO_PKG_VERSION")
    )
}

fn parse_cli_launch_target<I>(args: I, cwd: &Path) -> Result<Vec<String>, String>
where
    I: IntoIterator<Item = OsString>,
{
    let args = args.into_iter().collect::<Vec<_>>();

    if args.is_empty() {
        return Err("缺少路径参数".to_string());
    }

    if args.len() > 1 {
        return Err("当前 CLI 每次只支持打开一个文件或文件夹".to_string());
    }

    collect_launch_paths(args, cwd)
        .into_iter()
        .next()
        .map(|path| vec![path])
        .ok_or_else(|| "传入路径不存在或不可访问".to_string())
}

fn parse_cli_args<I>(args: I, cwd: &Path) -> Result<CliAction, String>
where
    I: IntoIterator<Item = OsString>,
{
    let args = args.into_iter().collect::<Vec<_>>();
    if args.is_empty() {
        return Ok(CliAction::Launch(Vec::new()));
    }

    let first = args[0].to_string_lossy();
    match first.as_ref() {
        "-h" | "--help" | "help" => {
            if args.len() > 1 {
                return Err("`help` 不接受额外参数".to_string());
            }
            Ok(CliAction::Help)
        }
        "-V" | "--version" | "version" => {
            if args.len() > 1 {
                return Err("`version` 不接受额外参数".to_string());
            }
            Ok(CliAction::Version)
        }
        "open" => parse_cli_launch_target(args.into_iter().skip(1), cwd).map(CliAction::Launch),
        _ if first.starts_with('-') => Err(format!("未知参数: {first}")),
        _ => parse_cli_launch_target(args, cwd).map(CliAction::Launch),
    }
}

fn push_launch_paths(state: &PendingLaunchPaths, paths: Vec<String>) {
    let mut pending = state.0.lock().unwrap();
    pending.extend(paths);
}

fn handle_forwarded_launch(
    app: &tauri::AppHandle,
    args: Vec<String>,
    cwd: PathBuf,
) -> Result<(), String> {
    let launch_paths = match parse_cli_args(args.into_iter().skip(1).map(OsString::from), &cwd)? {
        CliAction::Launch(paths) => paths,
        CliAction::Help | CliAction::Version => Vec::new(),
    };

    if launch_paths.is_empty() {
        return Ok(());
    }

    let state = app.state::<PendingLaunchPaths>();
    push_launch_paths(&state, launch_paths.clone());

    app.emit(
        CLI_EVENT_NAME,
        LaunchRequestEvent {
            paths: launch_paths,
        },
    )
    .map_err(|error| error.to_string())
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
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let initial_launch_paths = match parse_cli_args(std::env::args_os().skip(1), &cwd) {
        Ok(CliAction::Launch(paths)) => paths,
        Ok(CliAction::Help) => {
            print!("{}", cli_help_text());
            return;
        }
        Ok(CliAction::Version) => {
            println!("{}", env!("CARGO_PKG_VERSION"));
            return;
        }
        Err(message) => {
            eprintln!("{message}\n");
            eprintln!("{}", cli_help_text());
            std::process::exit(2);
        }
    };

    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }

            let _ = handle_forwarded_launch(app, args, cwd.into());
        }));
    }

    builder
        .manage(PendingLaunchPaths(Mutex::new(initial_launch_paths)))
        .manage(terminal::TerminalState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            open_path,
            get_system_info,
            take_launch_paths,
            terminal::start_terminal,
            terminal::write_terminal,
            terminal::resize_terminal,
            terminal::close_terminal,
            git::get_git_repository_info,
            git::git_pull
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::{cli_help_text, collect_launch_paths, parse_cli_args, CliAction};
    use std::ffi::OsString;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn collect_launch_paths_filters_missing_entries() {
        let file_path = create_temp_file();
        let cwd = std::env::temp_dir();
        let result = collect_launch_paths(
            vec![
                OsString::from("/path/does/not/exist"),
                file_path.clone().into_os_string(),
            ],
            &cwd,
        );

        assert_eq!(result.len(), 1);
        assert_eq!(
            result[0],
            fs::canonicalize(&file_path).unwrap().to_string_lossy()
        );

        let _ = fs::remove_file(file_path);
    }

    #[test]
    fn parse_cli_args_supports_relative_open() {
        let dir = create_temp_dir();
        let file_path = dir.join("README.md");
        fs::write(&file_path, "# Peek").unwrap();

        let result = parse_cli_args(
            vec![OsString::from("open"), OsString::from("README.md")],
            &dir,
        )
        .unwrap();

        match result {
            CliAction::Launch(paths) => {
                assert_eq!(
                    paths,
                    vec![fs::canonicalize(file_path).unwrap().to_string_lossy()]
                );
            }
            CliAction::Help | CliAction::Version => panic!("unexpected cli action"),
        }

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn parse_cli_args_rejects_multiple_paths() {
        let dir = create_temp_dir();
        let file_a = dir.join("a.md");
        let file_b = dir.join("b.md");
        fs::write(&file_a, "a").unwrap();
        fs::write(&file_b, "b").unwrap();

        let error = parse_cli_args(
            vec![
                file_a.clone().into_os_string(),
                file_b.clone().into_os_string(),
            ],
            &dir,
        )
        .unwrap_err();

        assert!(error.contains("只支持打开一个"));

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn cli_help_mentions_open_command() {
        let help = cli_help_text();
        assert!(help.contains("peek open <path>"));
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

    fn create_temp_dir() -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("peek-cli-test-{unique}"));
        fs::create_dir_all(&path).unwrap();
        path
    }
}
