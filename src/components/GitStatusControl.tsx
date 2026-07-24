import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowDown, ArrowUp, Download, GitBranch, LoaderCircle } from "lucide-react";
import { useStore } from "@/store/useStore";
import { getProjectContextPath } from "@/utils/projectContext";

export interface GitRepositoryInfo {
  rootPath: string;
  branch: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  dirty: boolean;
}

interface GitPullResult {
  success: boolean;
  output: string;
  repository: GitRepositoryInfo;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function GitStatusControl() {
  const {
    file,
    folder,
    setTerminalVisible,
    appendTerminalNotice,
  } = useStore();
  const [repository, setRepository] = useState<GitRepositoryInfo | null>(null);
  const [pulling, setPulling] = useState(false);
  const refreshVersion = useRef(0);
  const contextPath = getProjectContextPath(folder.rootPath, file?.path);

  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    if (!contextPath) {
      setRepository(null);
      return;
    }

    try {
      const nextRepository = await invoke<GitRepositoryInfo | null>(
        "get_git_repository_info",
        { path: contextPath }
      );
      if (version === refreshVersion.current) setRepository(nextRepository);
    } catch {
      if (version === refreshVersion.current) setRepository(null);
    }
  }, [contextPath]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (cancelled) return;
      await refresh();
    };

    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    window.addEventListener("focus", load);

    return () => {
      cancelled = true;
      refreshVersion.current += 1;
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [refresh]);

  if (!repository) return null;

  const handlePull = async () => {
    if (pulling || !repository.upstream) return;

    setPulling(true);
    setTerminalVisible(true);
    appendTerminalNotice(
      "command",
      `$ git -C "${repository.rootPath}" pull --ff-only`
    );

    try {
      const result = await invoke<GitPullResult>("git_pull", {
        path: repository.rootPath,
      });
      appendTerminalNotice(
        result.success ? "success" : "error",
        result.output || (result.success ? "Already up to date." : "git pull 执行失败")
      );
      setRepository(result.repository);
    } catch (error) {
      appendTerminalNotice("error", errorMessage(error));
      await refresh();
    } finally {
      setPulling(false);
    }
  };

  const pullTitle = repository.upstream
    ? `从 ${repository.upstream} 拉取代码`
    : "当前分支未设置上游分支";

  return (
    <div
      className="flex h-7 min-w-0 items-center overflow-hidden rounded-[5px] border border-border bg-bg-primary/70 text-xs"
      title={repository.rootPath}
    >
      <div className="flex min-w-0 items-center gap-1.5 px-2 text-text-secondary">
        <GitBranch size={13} className="flex-shrink-0 text-accent" />
        <span className="hidden max-w-32 truncate md:inline">{repository.branch}</span>
        {repository.dirty && (
          <span
            className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-warning"
            title="有未提交的更改"
            aria-label="有未提交的更改"
          />
        )}
        {repository.ahead > 0 && (
          <span className="hidden items-center gap-0.5 text-text-muted lg:flex" title={`领先 ${repository.ahead}`}>
            <ArrowUp size={10} />{repository.ahead}
          </span>
        )}
        {repository.behind > 0 && (
          <span className="hidden items-center gap-0.5 text-warning lg:flex" title={`落后 ${repository.behind}`}>
            <ArrowDown size={10} />{repository.behind}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={() => void handlePull()}
        disabled={pulling || !repository.upstream}
        className="grid h-7 w-7 flex-shrink-0 place-items-center border-l border-border text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-35"
        title={pullTitle}
        aria-label="拉取代码"
      >
        {pulling ? <LoaderCircle size={13} className="animate-spin" /> : <Download size={13} />}
      </button>
    </div>
  );
}
