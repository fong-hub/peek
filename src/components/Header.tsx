import { useState } from "react";
import { FolderOpen, FolderTree, Moon, PanelLeft, Sun, X, Info, FileText, Copy } from "lucide-react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useStore } from "@/store/useStore";
import { openFileDialog, openFolderDialog } from "@/utils/openPreview";
import About from "./About";

export default function Header() {
  const { file, folder, theme, setFile, setFolder, toggleTheme, toggleSidebar, sidebarVisible, toggleInfoPanel, infoPanelVisible } = useStore();
  const [showAbout, setShowAbout] = useState(false);

  const copyFilePath = async () => {
    if (file) {
      await writeText(file.path);
    }
  };

  const handleOpenFile = async () => {
    try {
      await openFileDialog();
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await openFolderDialog();
    } catch (err) {
      console.error("Failed to open folder:", err);
    }
  };

  const handleClose = () => {
    setFile(null);
    setFolder({ rootPath: null, tree: [], selectedPath: null });
  };

  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-bg-secondary flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center">
            <span className="text-white text-xs font-bold">P</span>
          </div>
          <span className="font-semibold text-sm text-text-primary">Peek</span>
        </div>
        {file && (
          <>
            <span className="text-border">|</span>
            <span className="text-sm text-text-secondary truncate max-w-md" title={file.path}>
              {file.name}
            </span>
            <button
              onClick={copyFilePath}
              className="p-1 text-text-muted hover:text-text-primary transition-colors"
              title="复制文件路径"
            >
              <Copy size={14} />
            </button>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={toggleSidebar}
          className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
            sidebarVisible
              ? "text-accent bg-accent/10"
              : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
          }`}
          title="切换侧边栏"
        >
          <PanelLeft size={15} />
        </button>
        <button
          id="open-file-btn"
          onClick={handleOpenFile}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          title="打开文件 (Ctrl+O)"
        >
          <FolderOpen size={15} />
          <span className="hidden sm:inline">文件</span>
        </button>
        <button
          id="open-folder-btn"
          onClick={handleOpenFolder}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          title="打开文件夹"
        >
          <FolderTree size={15} />
          <span className="hidden sm:inline">文件夹</span>
        </button>
        {(file || folder.rootPath) && (
          <button
            onClick={handleClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-text-secondary hover:text-error hover:bg-bg-tertiary transition-colors"
            title="关闭"
          >
            <X size={15} />
          </button>
        )}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center w-8 h-8 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          title="切换主题"
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        {file && (
          <button
            onClick={toggleInfoPanel}
            className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
              infoPanelVisible
                ? "text-accent bg-accent/10"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
            }`}
            title="文件信息"
          >
            <FileText size={15} />
          </button>
        )}
        <button
          onClick={() => setShowAbout(true)}
          className="flex items-center justify-center w-8 h-8 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          title="关于 Peek"
        >
          <Info size={15} />
        </button>
      </div>
      {showAbout && <About onClose={() => setShowAbout(false)} />}
    </header>
  );
}
