import { FileX, Copy, FolderOpen, ExternalLink } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  fileName: string;
  filePath: string;
  reason?: string;
}

export default function UnsupportedPreviewer({ fileName, filePath, reason }: Props) {
  const copyPath = async () => {
    await navigator.clipboard.writeText(filePath);
  };

  const openInFinder = async () => {
    const dirPath = filePath.split(/[/\\]/).slice(0, -1).join("/");
    await invoke("open_path", { path: dirPath });
  };

  const openWithDefault = async () => {
    await invoke("open_path", { path: filePath });
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center gap-6 text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-bg-tertiary flex items-center justify-center">
          <FileX size={32} className="text-text-muted" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            不支持预览此文件
          </h2>
          <p className="text-sm text-text-secondary mb-2">
            {fileName}
          </p>
          {reason && (
            <p className="text-xs text-text-muted">
              {reason}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={copyPath}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors whitespace-nowrap"
          >
            <Copy size={14} />
            复制路径
          </button>
          <button
            onClick={openInFinder}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors whitespace-nowrap"
          >
            <FolderOpen size={14} />
            打开所在目录
          </button>
          <button
            onClick={openWithDefault}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors whitespace-nowrap"
          >
            <ExternalLink size={14} />
            用默认应用打开
          </button>
        </div>
      </div>
    </div>
  );
}
