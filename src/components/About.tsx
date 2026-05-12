import { useState, useEffect, useCallback } from "react";
import {
  X,
  RefreshCw,
  Check,
  Info,
  ExternalLink,
  Download,
  RotateCcw,
  AlertCircle,
  Cpu,
  Monitor,
  Box,
  Tag,
} from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { invoke } from "@tauri-apps/api/core";

interface AboutProps {
  onClose: () => void;
}

type UpdateSource = "updater" | "github-api";

type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "latest"
  | "error";

interface SystemInfo {
  os: string;
  os_version: string;
  arch: string;
  tauri_version: string;
}

export default function About({ onClose }: AboutProps) {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [appVersion, setAppVersion] = useState("");
  const [latestVersion, setLatestVersion] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [updateSource, setUpdateSource] = useState<UpdateSource>("updater");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadTotal, setDownloadTotal] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    getVersion().then((v) => setAppVersion(v));
    invoke<SystemInfo>("get_system_info")
      .then((info) => setSystemInfo(info))
      .catch((err) => console.error("获取系统信息失败:", err));
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    try {
      setStatus("checking");
      setErrorMsg("");
      setUpdateSource("updater");

      // 先尝试 Tauri updater（需要 latest.json）
      const update = await check();

      if (update) {
        setLatestVersion(update.version);
        setReleaseNotes(update.body || "");
        setUpdateSource("updater");
        setStatus("available");
      } else {
        setStatus("latest");
        setTimeout(() => setStatus("idle"), 3000);
      }
    } catch (err) {
      console.error("Updater 检查失败，降级到 GitHub API:", err);
      const errMsg = err instanceof Error ? err.message : String(err);

      // 如果是因为没有 latest.json，降级到 GitHub API 检查
      if (errMsg.includes("Could not fetch a valid release JSON")) {
        try {
          const response = await fetch(
            "https://api.github.com/repos/fong-hub/peek/releases/latest"
          );
          if (!response.ok) throw new Error("GitHub API 请求失败");

          const data = await response.json();
          const latest = data.tag_name?.replace(/^v/, "");
          const notes = data.body || "";

          if (latest && latest !== appVersion) {
            setLatestVersion(latest);
            setReleaseNotes(notes);
            setUpdateSource("github-api");
            setStatus("available");
          } else {
            setStatus("latest");
            setTimeout(() => setStatus("idle"), 3000);
          }
          return;
        } catch (apiErr) {
          console.error("GitHub API 检查也失败了:", apiErr);
        }
      }

      setErrorMsg(errMsg);
      setStatus("error");
    }
  }, [appVersion]);

  const handleDownloadAndInstall = useCallback(async () => {
    try {
      setStatus("downloading");
      setDownloadProgress(0);
      setDownloadTotal(0);

      const update = await check();
      if (!update) {
        setStatus("latest");
        setTimeout(() => setStatus("idle"), 3000);
        return;
      }

      await update.downloadAndInstall(
        (progress: DownloadEvent) => {
          switch (progress.event) {
            case "Started":
              if (progress.data.contentLength) {
                setDownloadTotal(progress.data.contentLength);
              }
              break;
            case "Progress":
              setDownloadProgress((prev) => prev + progress.data.chunkLength);
              break;
            case "Finished":
              break;
          }
        }
      );

      setStatus("ready");
    } catch (err) {
      console.error("下载更新失败:", err);
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, []);

  const handleRelaunch = useCallback(async () => {
    await relaunch();
  }, []);

  const handleOpenExternal = useCallback(async (url: string) => {
    try {
      await invoke("open_path", { path: url });
    } catch (err) {
      console.error("打开链接失败:", err);
      window.open(url, "_blank");
    }
  }, []);

  const progressPercent =
    downloadTotal > 0
      ? Math.min(100, Math.round((downloadProgress / downloadTotal) * 100))
      : 0;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[420px] max-w-[90vw] rounded-xl border border-border bg-bg-primary shadow-2xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Info size={18} className="text-accent" />
            <span className="font-semibold text-text-primary">关于 Peek</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-tertiary text-text-secondary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6">
          {/* Logo 和应用信息 */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-bold text-accent">P</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">Peek</h2>
              <p className="text-sm text-text-secondary">极速文件预览器</p>
              <div className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-0.5 rounded-full bg-bg-tertiary text-text-secondary text-xs">
                <Tag size={10} />
                v{appVersion}
              </div>
            </div>
          </div>

          {/* 系统信息 */}
          {systemInfo && (
            <div className="mb-5 p-3 rounded-lg bg-bg-secondary border border-border">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-text-secondary">
                  <Monitor size={12} className="text-text-muted" />
                  <span>OS: {systemInfo.os} {systemInfo.os_version}</span>
                </div>
                <div className="flex items-center gap-1.5 text-text-secondary">
                  <Cpu size={12} className="text-text-muted" />
                  <span>架构: {systemInfo.arch}</span>
                </div>
                <div className="flex items-center gap-1.5 text-text-secondary">
                  <Box size={12} className="text-text-muted" />
                  <span>Tauri: v{systemInfo.tauri_version}</span>
                </div>
              </div>
            </div>
          )}

          {/* 更新状态区域 */}
          <div className="space-y-3">
            {status === "idle" && (
              <button
                onClick={handleCheckUpdate}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-colors"
              >
                <RefreshCw size={16} />
                检查更新
              </button>
            )}

            {status === "checking" && (
              <div className="flex items-center justify-center gap-2 py-2.5 text-text-secondary">
                <RefreshCw size={16} className="animate-spin" />
                <span>正在检查更新...</span>
              </div>
            )}

            {status === "available" && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-bg-secondary border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-text-primary">
                      发现新版本
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                      v{latestVersion}
                    </span>
                  </div>
                  {releaseNotes && (
                    <div className="text-xs text-text-secondary max-h-24 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                      {releaseNotes}
                    </div>
                  )}
                </div>
                {updateSource === "updater" ? (
                  <button
                    onClick={handleDownloadAndInstall}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-colors"
                  >
                    <Download size={16} />
                    下载并安装更新
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      handleOpenExternal(
                        "https://github.com/fong-hub/peek/releases/latest"
                      )
                    }
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-white font-medium hover:bg-accent-hover transition-colors"
                  >
                    <ExternalLink size={16} />
                    去 GitHub 下载新版本
                  </button>
                )}
              </div>
            )}

            {status === "downloading" && (
              <div className="space-y-2 py-1">
                <div className="flex items-center justify-between text-xs text-text-secondary">
                  <span className="flex items-center gap-1.5">
                    <Download size={14} className="animate-bounce" />
                    正在下载更新...
                  </span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="h-2 rounded-full bg-bg-tertiary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-200"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                {downloadTotal > 0 && (
                  <div className="text-xs text-text-muted text-right">
                    {formatBytes(downloadProgress)} / {formatBytes(downloadTotal)}
                  </div>
                )}
              </div>
            )}

            {status === "ready" && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 py-2 text-green-500">
                  <Check size={16} />
                  <span>更新已下载完成</span>
                </div>
                <button
                  onClick={handleRelaunch}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-success text-white font-medium hover:opacity-90 transition-opacity"
                >
                  <RotateCcw size={16} />
                  重启应用以完成更新
                </button>
              </div>
            )}

            {status === "latest" && (
              <div className="flex items-center justify-center gap-2 py-2.5 text-green-500">
                <Check size={16} />
                <span>已是最新版本</span>
              </div>
            )}

            {status === "error" && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 py-2 text-error">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p>检查更新失败</p>
                    {errorMsg && (
                      <p className="text-xs text-text-muted mt-1 break-all">
                        {errorMsg}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleCheckUpdate}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border text-text-secondary font-medium hover:bg-bg-tertiary transition-colors"
                >
                  <RefreshCw size={16} />
                  重试
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 底部 */}
        <div className="px-4 py-3 border-t border-border bg-bg-secondary flex items-center justify-between">
          <span className="text-xs text-text-muted">
            © {new Date().getFullYear()} Peek
          </span>
          <button
            onClick={() => handleOpenExternal("https://github.com/fong-hub/peek")}
            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            <ExternalLink size={12} />
            GitHub 主页
          </button>
        </div>
      </div>
    </div>
  );
}
