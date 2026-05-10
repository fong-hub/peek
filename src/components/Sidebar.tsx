import { Folder, FileText, ChevronRight, ChevronDown } from "lucide-react";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useStore } from "@/store/useStore";
import type { TreeNode } from "@/store/useStore";
import { detectFileType } from "@/utils/fileTypes";

function TreeItem({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const { folder, setFile, setSelectedPath, toggleNodeExpanded } = useStore();
  const isSelected = folder.selectedPath === node.path;

  const handleClick = async () => {
    if (node.isDirectory) {
      toggleNodeExpanded(node.path);
    } else {
      setSelectedPath(node.path);
      // Read and preview the file
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

  return (
    <div>
      <button
        onClick={handleClick}
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
    </div>
  );
}

export default function Sidebar() {
  const { folder, sidebarVisible } = useStore();

  if (!sidebarVisible) return null;

  return (
    <aside className="w-64 flex-shrink-0 border-r border-border bg-bg-secondary flex flex-col">
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
    </aside>
  );
}
