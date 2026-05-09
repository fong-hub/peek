import { FileSearch, FolderOpen, Zap, Keyboard } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-text-secondary">
      <div className="flex flex-col items-center gap-6 max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-bg-tertiary flex items-center justify-center">
          <FileSearch size={32} className="text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            拖入文件或文件夹即可预览
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            支持 Markdown、JSON、HTML、纯文本、日志等多种格式
          </p>
        </div>
        <div className="flex items-center gap-6 text-xs text-text-muted">
          <div className="flex items-center gap-1.5">
            <Zap size={13} />
            <span>零延迟加载</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Keyboard size={13} />
            <span>Ctrl + O 打开文件</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FolderOpen size={13} />
            <span>拖入文件夹浏览</span>
          </div>
        </div>
      </div>
    </div>
  );
}
