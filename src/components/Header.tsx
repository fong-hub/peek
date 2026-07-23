import { useState } from "react";
import { FolderOpen, FolderTree, Moon, PanelLeft, Search, Settings, Sun, X, Info, FileText } from "lucide-react";
import { useStore } from "@/store/useStore";
import { openFileDialog, openFolderDialog } from "@/utils/openPreview";
import About from "./About";
import ShortcutSettings from "./ShortcutSettings";
import { formatShortcut } from "@/utils/shortcuts";
import { getSearchableContent } from "@/utils/search";

export default function Header() {
  const { file, folder, tabs, theme, shortcuts, closeAllTabs, setFolder, toggleTheme, toggleSidebar, sidebarVisible, toggleInfoPanel, infoPanelVisible, openSearch } = useStore();
  const [showAbout, setShowAbout] = useState(false);
  const [showShortcutSettings, setShowShortcutSettings] = useState(false);
  const canSearch = file ? getSearchableContent(file) !== null : false;

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
    closeAllTabs();
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
        {folder.rootPath && (
          <>
            <span className="text-border">|</span>
            <span className="text-xs text-text-secondary truncate max-w-md" title={folder.rootPath}>
              {folder.rootPath.split(/[/\\]/).pop()}
            </span>
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
          type="button"
          onClick={openSearch}
          disabled={!canSearch}
          className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-35"
          title={`搜索当前文件 (${formatShortcut(shortcuts.find)})`}
        >
          <Search size={15} />
          <span className="hidden md:inline">搜索</span>
        </button>
        <button
          id="open-file-btn"
          onClick={handleOpenFile}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          title={`打开文件 (${formatShortcut(shortcuts.openFile)})`}
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
        {(tabs.length > 0 || folder.rootPath) && (
          <button
            onClick={handleClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-text-secondary hover:text-error hover:bg-bg-tertiary transition-colors"
            title="关闭工作区"
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
          type="button"
          onClick={() => setShowShortcutSettings(true)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
          title="快捷键设置"
          aria-label="快捷键设置"
        >
          <Settings size={15} />
        </button>
        <button
          onClick={() => setShowAbout(true)}
          className="flex items-center justify-center w-8 h-8 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          title="关于 Peek"
        >
          <Info size={15} />
        </button>
      </div>
      {showAbout && <About onClose={() => setShowAbout(false)} />}
      {showShortcutSettings && (
        <ShortcutSettings onClose={() => setShowShortcutSettings(false)} />
      )}
    </header>
  );
}
