import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Folder,
  FileText,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Search,
  X,
  Clock,
  Trash2,
} from "lucide-react";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useStore } from "@/store/useStore";
import type { TreeNode, RecentItem } from "@/store/useStore";
import { detectFileType } from "@/utils/fileTypes";
import { getRecentItems, removeRecentItem } from "@/utils/recent";
import { buildFileTree } from "@/utils/fileTree";
import ContextMenu from "./ContextMenu";

type SidebarTab = "files" | "recent";

interface TreeItemProps {
  node: TreeNode;
  depth?: number;
}

function TreeItem({ node, depth = 0 }: TreeItemProps) {
  const { folder, setFile, setSelectedPath, toggleNodeExpanded } = useStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const isSelected = folder.selectedPath === node.path;

  const handleClick = async () => {
    if (node.isDirectory) {
      toggleNodeExpanded(node.path);
    } else {
      setSelectedPath(node.path);
      try {
        const content = await readTextFile(node.path);
        // 文件夹内点击文件不添加到最近记录
        setFile(
          {
            name: node.name,
            path: node.path,
            content,
            type: detectFileType(node.name),
          },
          false
        );
      } catch (err) {
        console.error("Failed to read file:", node.path, err);
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleDoubleClick = async () => {
    if (node.isDirectory) {
      toggleNodeExpanded(node.path);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-sm rounded-md transition-colors ${
          isSelected
            ? "bg-accent/20 text-accent"
            : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary"
        }`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        title={node.path}
      >
        {node.isDirectory ? (
          <>
            {node.expanded ? (
              <ChevronDown size={14} className="flex-shrink-0" />
            ) : (
              <ChevronRight size={14} className="flex-shrink-0" />
            )}
            <Folder size={14} className="flex-shrink-0 text-warning" />
          </>
        ) : (
          <>
            <span className="w-[14px] flex-shrink-0" />
            <FileText size={14} className="flex-shrink-0 text-text-muted" />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {node.isDirectory && node.expanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeItem key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          path={node.path}
          isDirectory={node.isDirectory}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

/** 递归过滤树节点，如果父节点匹配则保留整棵子树 */
function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const lower = query.toLowerCase();
  const result: TreeNode[] = [];
  for (const node of nodes) {
    const nameMatch = node.name.toLowerCase().includes(lower);
    const childrenMatch = node.isDirectory
      ? filterTree(node.children, query)
      : [];
    if (nameMatch || childrenMatch.length > 0) {
      result.push({
        ...node,
        expanded: true,
        children: childrenMatch,
      });
    }
  }
  return result;
}

function RecentPanel() {
  const { setFile, setFolder } = useStore();
  const [recents, setRecents] = useState<RecentItem[]>([]);

  const refreshRecents = useCallback(() => {
    setRecents(getRecentItems());
  }, []);

  useEffect(() => {
    refreshRecents();
  }, [refreshRecents]);

  const handleOpenRecent = async (item: RecentItem) => {
    try {
      if (item.isDirectory) {
        const tree = await buildFileTree(item.path);
        setFolder({
          rootPath: item.path,
          tree,
          selectedPath: null,
        });
        setFile(null);
      } else {
        const content = await readTextFile(item.path);
        setFile({
          name: item.name,
          path: item.path,
          content,
          type: detectFileType(item.name),
        });
        setFolder({ rootPath: null, tree: [], selectedPath: null });
      }
    } catch (err) {
      console.error("打开最近项失败:", err);
    }
  };

  const handleRemove = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    removeRecentItem(path);
    refreshRecents();
  };

  if (recents.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="text-xs text-text-muted">暂无最近打开记录</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto py-2 px-1">
      {recents.map((item) => (
        <div
          key={item.path}
          className="group flex items-center gap-1"
          title={item.path}
        >
          <button
            onClick={() => handleOpenRecent(item)}
            className="flex-1 flex items-center gap-1.5 px-2 py-1 text-sm rounded-md text-left text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            {item.isDirectory ? (
              <Folder size={13} className="flex-shrink-0 text-warning" />
            ) : (
              <FileText size={13} className="flex-shrink-0 text-text-muted" />
            )}
            <span className="truncate">{item.name}</span>
          </button>
          <button
            onClick={(e) => handleRemove(e, item.path)}
            className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-error transition-opacity"
            title="从历史中移除"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function Sidebar() {
  const { folder, sidebarVisible, sidebarWidth, setSidebarWidth } = useStore();
  const [isResizing, setIsResizing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SidebarTab>("files");
  const resizeStartX = useRef(0);
  const startWidth = useRef(0);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      setIsResizing(true);
      resizeStartX.current = e.clientX;
      startWidth.current = sidebarWidth;
      e.preventDefault();
    },
    [sidebarWidth]
  );

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing) return;
      const diff = e.clientX - resizeStartX.current;
      setSidebarWidth(startWidth.current + diff);
    },
    [isResizing, setSidebarWidth]
  );

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", handleResizeMove);
      window.addEventListener("mouseup", handleResizeEnd);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeEnd);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    return () => {
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeEnd);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  const displayedTree = useMemo(() => {
    if (!searchQuery.trim()) return folder.tree;
    return filterTree(folder.tree, searchQuery.trim());
  }, [folder.tree, searchQuery]);

  if (!sidebarVisible) return null;

  return (
    <aside
      className="flex-shrink-0 border-r border-border bg-bg-secondary flex flex-col relative"
      style={{ width: sidebarWidth }}
    >
      {/* 标签页切换 */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("files")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs transition-colors ${
            activeTab === "files"
              ? "text-accent bg-accent/10 border-b-2 border-accent"
              : "text-text-muted hover:text-text-secondary hover:bg-bg-tertiary"
          }`}
        >
          <Folder size={12} />
          文件
        </button>
        <button
          onClick={() => setActiveTab("recent")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-xs transition-colors ${
            activeTab === "recent"
              ? "text-accent bg-accent/10 border-b-2 border-accent"
              : "text-text-muted hover:text-text-secondary hover:bg-bg-tertiary"
          }`}
        >
          <Clock size={12} />
          最近
        </button>
      </div>

      {activeTab === "files" ? (
        <>
          {/* 搜索框 */}
          {folder.tree.length > 0 && (
            <div className="px-2 py-2 border-b border-border">
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索文件..."
                  className="w-full pl-7 pr-6 py-1 text-xs rounded-md bg-bg-tertiary text-text-primary placeholder:text-text-muted border border-transparent focus:border-accent focus:outline-none transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-auto py-2 px-1">
            {folder.tree.length === 0 ? (
              <div className="px-3 py-4 text-xs text-text-muted text-center">
                {folder.rootPath ? "文件夹中没有支持的文件" : "拖入文件夹以开始浏览"}
              </div>
            ) : displayedTree.length === 0 ? (
              <div className="px-3 py-4 text-xs text-text-muted text-center">
                无匹配结果
              </div>
            ) : (
              displayedTree.map((node) => <TreeItem key={node.path} node={node} />)
            )}
          </div>

          {folder.rootPath && (
            <div className="px-3 py-2 border-t border-border">
              <span
                className="text-[10px] text-text-muted truncate block"
                title={folder.rootPath}
              >
                {folder.rootPath.split(/[/\\]/).pop()}
              </span>
            </div>
          )}
        </>
      ) : (
        <RecentPanel />
      )}

      {/* 宽度调整手柄 */}
      <div
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-accent/30 transition-colors flex items-center justify-center"
        onMouseDown={handleResizeStart}
      >
        <GripVertical
          size={12}
          className={`text-text-muted opacity-0 transition-opacity ${
            isResizing ? "opacity-100" : "group-hover:opacity-100"
          }`}
        />
      </div>
    </aside>
  );
}
