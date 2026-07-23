import { FileText, Copy, Calendar, Hash, FolderOpen, ExternalLink } from "lucide-react";
import { useStore } from "@/store/useStore";
import { invoke } from "@tauri-apps/api/core";
import { formatFileSize } from "@/utils/fileUtils";

function supportsTextStats(type: string): boolean {
  return type !== "image" && type !== "pdf" && type !== "unsupported";
}

export default function FileInfoPanel() {
  const { file, folder, infoPanelVisible } = useStore();

  if (!file || !infoPanelVisible) return null;

  const showTextStats = supportsTextStats(file.type);
  const lineCount = showTextStats ? file.content.split("\n").length : 0;
  const charCount = showTextStats ? file.content.length : 0;
  const byteCount = file.previewMeta?.sizeBytes ?? new Blob([file.content]).size;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(console.error);
  };

  const openInFinder = async () => {
    if (!file) return;
    const dirPath = file.path.split(/[/\\]/).slice(0, -1).join("/");
    await invoke("open_path", { path: dirPath });
  };

  const openWithDefault = async () => {
    if (!file) return;
    await invoke("open_path", { path: file.path });
  };


  return (
    <div className="overflow-x-auto border-b border-border bg-bg-tertiary">
      <div className="flex min-w-max items-center justify-between px-4 py-2">
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
            <button
              onClick={openInFinder}
              className="p-1 text-text-muted hover:text-text-primary transition-colors"
              title="打开所在目录"
            >
              <FolderOpen size={12} />
            </button>
            <button
              onClick={openWithDefault}
              className="p-1 text-text-muted hover:text-text-primary transition-colors"
              title="用默认应用打开"
            >
              <ExternalLink size={12} />
            </button>
          </div>

          {/* 文件统计 */}
            <div className="flex items-center gap-4 text-xs text-text-muted">
            {showTextStats && (
              <>
                <div className="flex items-center gap-1.5">
                  <Hash size={12} />
                  <span>
                    {file.previewMeta?.isLargeFile
                      ? `预览 ${lineCount} 行`
                      : `${lineCount} 行`}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span>
                    {file.previewMeta?.isLargeFile
                      ? `预览 ${charCount} 字符`
                      : `${charCount} 字符`}
                  </span>
                </div>
              </>
            )}
            <div className="flex items-center gap-1.5">
              <span>{formatFileSize(byteCount)}</span>
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
