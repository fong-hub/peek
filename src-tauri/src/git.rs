use std::path::{Path, PathBuf};
use std::process::{Command, Output};

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRepositoryInfo {
    root_path: String,
    branch: String,
    upstream: Option<String>,
    ahead: u32,
    behind: u32,
    dirty: bool,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitPullResult {
    success: bool,
    output: String,
    repository: GitRepositoryInfo,
}

fn command_output(root: &Path, args: &[&str]) -> Result<Output, String> {
    Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GCM_INTERACTIVE", "Never")
        .output()
        .map_err(|error| error.to_string())
}

fn successful_text(root: &Path, args: &[&str]) -> Option<String> {
    let output = command_output(root, args).ok()?;
    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn discover_repository_root(path: &Path) -> Option<PathBuf> {
    let candidate = if path.is_file() { path.parent()? } else { path };
    let root = successful_text(candidate, &["rev-parse", "--show-toplevel"])?;
    let root = PathBuf::from(root);
    root.canonicalize().ok().or(Some(root))
}

fn inspect_repository(root: &Path) -> Result<GitRepositoryInfo, String> {
    let branch = successful_text(root, &["rev-parse", "--abbrev-ref", "HEAD"])
        .filter(|branch| branch != "HEAD")
        .or_else(|| {
            successful_text(root, &["rev-parse", "--short", "HEAD"])
                .map(|commit| format!("detached@{commit}"))
        })
        .unwrap_or_else(|| "未提交".to_string());
    let upstream = successful_text(
        root,
        &[
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            "@{upstream}",
        ],
    );
    let (ahead, behind) = upstream
        .as_ref()
        .and_then(|_| {
            successful_text(
                root,
                &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
            )
        })
        .and_then(|counts| {
            let mut values = counts.split_whitespace();
            Some((values.next()?.parse().ok()?, values.next()?.parse().ok()?))
        })
        .unwrap_or((0, 0));
    let dirty = successful_text(root, &["status", "--porcelain"])
        .map(|status| !status.is_empty())
        .unwrap_or(false);

    Ok(GitRepositoryInfo {
        root_path: root.to_string_lossy().to_string(),
        branch,
        upstream,
        ahead,
        behind,
        dirty,
    })
}

#[tauri::command]
pub fn get_git_repository_info(path: String) -> Result<Option<GitRepositoryInfo>, String> {
    let Some(root) = discover_repository_root(Path::new(&path)) else {
        return Ok(None);
    };

    inspect_repository(&root).map(Some)
}

#[tauri::command]
pub fn git_pull(path: String) -> Result<GitPullResult, String> {
    let root = discover_repository_root(Path::new(&path))
        .ok_or_else(|| "当前工作区不是 Git 仓库".to_string())?;
    let before = inspect_repository(&root)?;
    if before.upstream.is_none() {
        return Err("当前分支未设置上游分支，无法拉取".to_string());
    }

    let result = command_output(&root, &["pull", "--ff-only"])?;
    let mut output = String::from_utf8_lossy(&result.stdout).to_string();
    output.push_str(&String::from_utf8_lossy(&result.stderr));

    Ok(GitPullResult {
        success: result.status.success(),
        output: output.trim().to_string(),
        repository: inspect_repository(&root)?,
    })
}

#[cfg(test)]
mod tests {
    use super::{discover_repository_root, git_pull};
    use std::fs;
    use std::path::Path;
    use std::process::{Command, Stdio};
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn discovers_repository_from_nested_file() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("peek-git-{unique}"));
        let nested = root.join("src");
        let file = nested.join("main.rs");
        fs::create_dir_all(&nested).unwrap();
        fs::write(&file, "fn main() {}").unwrap();
        let status = Command::new("git")
            .arg("init")
            .arg(&root)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .unwrap();
        assert!(status.success());

        assert_eq!(
            discover_repository_root(&file).unwrap(),
            root.canonicalize().unwrap()
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn pulls_fast_forward_updates_from_upstream() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let sandbox = std::env::temp_dir().join(format!("peek-git-pull-{unique}"));
        let remote = sandbox.join("remote.git");
        let source = sandbox.join("source");
        let target = sandbox.join("target");
        fs::create_dir_all(&sandbox).unwrap();

        run_git(
            &sandbox,
            &[
                "init",
                "--bare",
                "--initial-branch=main",
                remote.to_str().unwrap(),
            ],
        );
        run_git(
            &sandbox,
            &["clone", remote.to_str().unwrap(), source.to_str().unwrap()],
        );
        run_git(&source, &["config", "user.email", "peek@example.com"]);
        run_git(&source, &["config", "user.name", "Peek Tests"]);
        fs::write(source.join("README.md"), "first").unwrap();
        run_git(&source, &["add", "README.md"]);
        run_git(&source, &["commit", "-m", "first"]);
        run_git(&source, &["push", "-u", "origin", "main"]);
        run_git(
            &sandbox,
            &["clone", remote.to_str().unwrap(), target.to_str().unwrap()],
        );

        fs::write(source.join("README.md"), "second").unwrap();
        run_git(&source, &["commit", "-am", "second"]);
        run_git(&source, &["push"]);

        let result = git_pull(target.to_string_lossy().to_string()).unwrap();
        assert!(result.success);
        assert_eq!(
            fs::read_to_string(target.join("README.md")).unwrap(),
            "second"
        );

        let _ = fs::remove_dir_all(sandbox);
    }

    fn run_git(cwd: &Path, args: &[&str]) {
        let status = Command::new("git")
            .arg("-C")
            .arg(cwd)
            .args(args)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .unwrap();
        assert!(
            status.success(),
            "git command failed: git {}",
            args.join(" ")
        );
    }
}
