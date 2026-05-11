import { useState, useRef, useCallback, useEffect } from "react";
import { Folder, FileText, ChevronRight, ChevronDown, GripVertical } from "lucide-react";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useStore } from "@/store/useStore";
import type { TreeNode } from "@/store/useStore";
import { detectFileType } from "@/utils/fileTypes";
import ContextMenu from "./ContextMenu";

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
        setFile({
          name: node.name,
          path: node.path,
          content,
          type: detectFileType(node.name),
        });
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
      // 双击目录一键展开所有子目录
      const expandAll = (nodes: TreeNode[]): TreeNode[] => {
        return nodes.map((n) => {
          if (n.isDirectory) {
            return {
              ...n,
              expanded: true,
              children: expandAll(n.children),
            };
          }
          return n;
        });
      };
      // 这里需要一个全局展开的方法，暂时用toggle模拟
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

export default function Sidebar() {
  const { folder, sidebarVisible, sidebarWidth, setSidebarWidth } = useStore();
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef(0);
  const startWidth = useRef(0);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    startWidth.current = sidebarWidth;
    e.preventDefault();
  }, [sidebarWidth]);

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

  if (!sidebarVisible) return null;

  return (
    <aside
      className="flex-shrink-0 border-r border-border bg-bg-secondary flex flex-col relative"
      style={{ width: sidebarWidth }}
    >
      <div className="h-10 flex items-center px-3 border-b border-border">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
          文件浏览
        </span>
      </div>
      <div className="flex-1 overflow-auto py-2 px-1">
        {folder.tree.length === 0 ? (
          <div className="px-3 py-4 text-xs text-text-muted text-center">
            {folder.rootPath ? "文件夹中没有支持的文件" : "拖入文件夹以开始浏览"}
          </div>
        ) : (
          folder.tree.map((node) => <TreeItem key={node.path} node={node} />)
        )}
      </div>
      {folder.rootPath && (
        <div className="px-3 py-2 border-t border-border">
          <span className="text-[10px] text-text-muted truncate block" title={folder.rootPath}>
            {folder.rootPath.split(/[/\\]/).pop()}
          </span>
        </div>
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
