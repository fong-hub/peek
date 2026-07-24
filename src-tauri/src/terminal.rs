use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use tauri::{AppHandle, Emitter, Manager, State};

const TERMINAL_OUTPUT_EVENT: &str = "terminal-output";
const TERMINAL_EXIT_EVENT: &str = "terminal-exit";

struct TerminalSession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn Child + Send + Sync>,
}

pub struct TerminalState {
    next_id: AtomicU64,
    sessions: Mutex<HashMap<u64, TerminalSession>>,
}

impl Default for TerminalState {
    fn default() -> Self {
        Self {
            next_id: AtomicU64::new(1),
            sessions: Mutex::new(HashMap::new()),
        }
    }
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalOutputEvent {
    terminal_id: u64,
    data: Vec<u8>,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalExitEvent {
    terminal_id: u64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalStarted {
    terminal_id: u64,
    cwd: String,
    shell: String,
}

fn resolve_terminal_cwd(requested: Option<&str>) -> Result<PathBuf, String> {
    let fallback = std::env::current_dir().map_err(|error| error.to_string())?;
    let Some(requested) = requested.filter(|value| !value.trim().is_empty()) else {
        return Ok(fallback);
    };

    let requested_path = PathBuf::from(requested);
    let directory = if requested_path.is_file() {
        requested_path
            .parent()
            .unwrap_or(Path::new("."))
            .to_path_buf()
    } else {
        requested_path
    };

    if !directory.is_dir() {
        return Err(format!("终端目录不存在: {}", directory.to_string_lossy()));
    }

    Ok(directory.canonicalize().unwrap_or(directory))
}

fn default_shell() -> String {
    #[cfg(target_os = "windows")]
    {
        std::env::var("COMSPEC").unwrap_or_else(|_| "powershell.exe".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string())
    }
}

#[tauri::command]
pub fn start_terminal(
    app: AppHandle,
    state: State<TerminalState>,
    cwd: Option<String>,
    rows: u16,
    cols: u16,
) -> Result<TerminalStarted, String> {
    let cwd = resolve_terminal_cwd(cwd.as_deref())?;
    let shell = default_shell();
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: rows.max(2),
            cols: cols.max(2),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| error.to_string())?;

    let mut command = CommandBuilder::new(&shell);
    command.cwd(&cwd);
    command.env("TERM", "xterm-256color");
    command.env("COLORTERM", "truecolor");

    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|error| error.to_string())?;
    drop(pair.slave);

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| error.to_string())?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|error| error.to_string())?;
    let terminal_id = state.next_id.fetch_add(1, Ordering::Relaxed);

    state
        .sessions
        .lock()
        .map_err(|_| "终端状态不可用".to_string())?
        .insert(
            terminal_id,
            TerminalSession {
                master: pair.master,
                writer,
                child,
            },
        );

    let reader_app = app.clone();
    std::thread::spawn(move || {
        let mut buffer = [0_u8; 8192];

        loop {
            match reader.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(count) => {
                    let _ = reader_app.emit(
                        TERMINAL_OUTPUT_EVENT,
                        TerminalOutputEvent {
                            terminal_id,
                            data: buffer[..count].to_vec(),
                        },
                    );
                }
            }
        }

        if let Ok(mut sessions) = reader_app.state::<TerminalState>().sessions.lock() {
            sessions.remove(&terminal_id);
        }
        let _ = reader_app.emit(TERMINAL_EXIT_EVENT, TerminalExitEvent { terminal_id });
    });

    Ok(TerminalStarted {
        terminal_id,
        cwd: cwd.to_string_lossy().to_string(),
        shell,
    })
}

#[tauri::command]
pub fn write_terminal(
    state: State<TerminalState>,
    terminal_id: u64,
    data: String,
) -> Result<(), String> {
    let mut sessions = state
        .sessions
        .lock()
        .map_err(|_| "终端状态不可用".to_string())?;
    let session = sessions
        .get_mut(&terminal_id)
        .ok_or_else(|| "终端会话不存在".to_string())?;

    session
        .writer
        .write_all(data.as_bytes())
        .and_then(|_| session.writer.flush())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn resize_terminal(
    state: State<TerminalState>,
    terminal_id: u64,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let sessions = state
        .sessions
        .lock()
        .map_err(|_| "终端状态不可用".to_string())?;
    let session = sessions
        .get(&terminal_id)
        .ok_or_else(|| "终端会话不存在".to_string())?;

    session
        .master
        .resize(PtySize {
            rows: rows.max(2),
            cols: cols.max(2),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn close_terminal(state: State<TerminalState>, terminal_id: u64) -> Result<(), String> {
    let session = state
        .sessions
        .lock()
        .map_err(|_| "终端状态不可用".to_string())?
        .remove(&terminal_id);

    if let Some(mut session) = session {
        let _ = session.child.kill();
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::resolve_terminal_cwd;
    #[cfg(unix)]
    use portable_pty::{native_pty_system, CommandBuilder, PtySize};
    use std::fs;
    #[cfg(unix)]
    use std::io::Read;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn terminal_cwd_uses_parent_for_files() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let directory = std::env::temp_dir().join(format!("peek-terminal-{unique}"));
        let file = directory.join("README.md");
        fs::create_dir_all(&directory).unwrap();
        fs::write(&file, "# Peek").unwrap();

        assert_eq!(
            resolve_terminal_cwd(file.to_str()).unwrap(),
            directory.canonicalize().unwrap()
        );

        let _ = fs::remove_dir_all(directory);
    }

    #[cfg(unix)]
    #[test]
    fn native_pty_runs_an_interactive_process() {
        let pair = native_pty_system()
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .unwrap();
        let mut command = CommandBuilder::new("/bin/sh");
        command.args(["-c", "printf peek-terminal"]);
        let mut child = pair.slave.spawn_command(command).unwrap();
        drop(pair.slave);
        let mut reader = pair.master.try_clone_reader().unwrap();
        let mut output = String::new();
        reader.read_to_string(&mut output).unwrap();
        child.wait().unwrap();

        assert!(output.contains("peek-terminal"));
    }
}
