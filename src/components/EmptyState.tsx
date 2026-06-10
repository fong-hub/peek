import { useMemo } from "react";
import { Clock3, FileSearch, FileText, FolderOpen, FolderTree, History, Keyboard } from "lucide-react";
import { getRecentItems } from "@/utils/recent";
import {
  openFileDialog,
  openFolderDialog,
  openFolderWorkspace,
  openStandaloneFile,
  restoreSession,
} from "@/utils/openPreview";
import { getLastSession, isEmptySession } from "@/utils/session";

export default function EmptyState() {
  const lastSession = useMemo(() => getLastSession(), []);
  const recentItems = useMemo(() => getRecentItems().slice(0, 5), []);
  const hasLastSession = !isEmptySession(lastSession);

  return (
    <div className="w-full h-full overflow-auto bg-bg-primary">
      <div className="mx-auto flex h-full max-w-5xl flex-col justify-center gap-8 px-6 py-10 text-text-secondary">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-tertiary">
              <FileSearch size={32} className="text-accent" />
            </div>
            <h2 className="mb-2 text-3xl font-semibold text-text-primary">
              开发者文件预览器
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-text-secondary">
              打开 Markdown、JSON、HTML、CSV、图片、PDF、代码、纯文本和日志文件。
              支持拖入文件或文件夹，也可以直接恢复上次工作区继续浏览。
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => void openFileDialog()}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
              >
                <FolderOpen size={15} />
                打开文件
              </button>
              <button
                onClick={() => void openFolderDialog()}
                className="inline-flex items-center gap-2 rounded-lg bg-bg-tertiary px-4 py-2 text-sm text-text-primary hover:bg-border/60 transition-colors"
              >
                <FolderTree size={15} />
                打开文件夹
              </button>
              {hasLastSession && (
                <button
                  onClick={() => void restoreSession(lastSession)}
                  className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-text-primary hover:bg-bg-secondary transition-colors"
                >
                  <History size={15} />
                  恢复上次工作区
                </button>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-bg-secondary/80 p-5 lg:w-[340px]">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-text-primary">
              <Clock3 size={15} className="text-accent" />
              最近打开
            </div>
            {recentItems.length === 0 ? (
              <div className="rounded-xl bg-bg-primary px-4 py-6 text-center text-sm text-text-muted">
                还没有最近记录，先打开一个文件或文件夹。
              </div>
            ) : (
              <div className="space-y-2">
                {recentItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() =>
                      void (item.isDirectory
                        ? openFolderWorkspace(item.path)
                        : openStandaloneFile(item.path))
                    }
                    className="flex w-full items-center gap-2 rounded-xl bg-bg-primary px-3 py-3 text-left text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors"
                    title={item.path}
                  >
                    {item.isDirectory ? (
                      <FolderTree size={15} className="shrink-0 text-warning" />
                    ) : (
                      <FileText size={15} className="shrink-0 text-text-muted" />
                    )}
                    <span className="truncate">{item.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-6 text-xs text-text-muted">
          <div className="flex items-center gap-1.5">
            <Keyboard size={13} />
            <span>Ctrl / Cmd + O 打开文件</span>
          </div>
          <div className="flex items-center gap-1.5">
            <FolderOpen size={13} />
            <span>拖入文件或文件夹快速预览</span>
          </div>
          <div className="flex items-center gap-1.5">
            <History size={13} />
            <span>自动记住主题、侧边栏和上次浏览状态</span>
          </div>
        </div>
      </div>
    </div>
  );
}
