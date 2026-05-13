import { FileText, Copy, Calendar, Hash } from "lucide-react";
import { useStore } from "@/store/useStore";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function FileInfoPanel() {
  const { file, folder, infoPanelVisible } = useStore();

  if (!file || !infoPanelVisible) return null;

  const lineCount = file.content.split("\n").length;
  const charCount = file.content.length;
  const byteCount = new Blob([file.content]).size;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(console.error);
  };


  return (
    <div className="border-b border-border bg-bg-tertiary">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-6">
          {/* 文件名和路径 */}
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-accent flex-shrink-0" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-text-primary">
                {file.name}
              </span>
              <span
                className="text-xs text-text-muted truncate max-w-md"
                title={file.path}
              >
                {file.path}
              </span>
            </div>
            <button
              onClick={() => copyToClipboard(file.path)}
              className="p-1 text-text-muted hover:text-text-primary transition-colors"
              title="复制路径"
            >
              <Copy size={12} />
            </button>
          </div>

          {/* 文件统计 */}
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <div className="flex items-center gap-1.5">
              <Hash size={12} />
              <span>{lineCount} 行</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>{charCount} 字符</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>{formatBytes(byteCount)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>类型: {file.type.toUpperCase()}</span>
            </div>
          </div>

          {/* 文件夹信息 */}
          {folder.rootPath && (
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Calendar size={12} />
              <span>来自: {folder.rootPath.split(/[/\\]/).pop()}</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
