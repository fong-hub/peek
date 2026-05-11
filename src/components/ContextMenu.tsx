import { useEffect, useRef } from "react";
import { FolderOpen, Copy, ExternalLink, FileDigit } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";

interface ContextMenuProps {
  x: number;
  y: number;
  path: string;
  isDirectory: boolean;
  onClose: () => void;
  onOpenFolder?: () => void;
}

export default function ContextMenu({
  x,
  y,
  path,
  isDirectory,
  onClose,
  onOpenFolder,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const copyPath = async () => {
    await writeText(path);
    onClose();
  };

  const openInFinder = async () => {
    // 打开所在目录
    const dirPath = isDirectory ? path : path.split(/[/\\]/).slice(0, -1).join("/");
    await open(dirPath);
    onClose();
  };

  const openWithDefault = async () => {
    await open(path);
    onClose();
  };

  const menuItems = [
    {
      label: isDirectory ? "打开目录" : "打开所在目录",
      icon: <FolderOpen size={14} />,
      onClick: openInFinder,
    },
    {
      label: "复制文件路径",
      icon: <Copy size={14} />,
      onClick: copyPath,
    },
    ...(!isDirectory
      ? [
          {
            label: "用默认应用打开",
            icon: <ExternalLink size={14} />,
            onClick: openWithDefault,
          },
        ]
      : []),
  ];

  // 调整菜单位置避免超出屏幕
  const adjustedX = Math.min(x, window.innerWidth - 160);
  const adjustedY = Math.min(y, window.innerHeight - menuItems.length * 36 - 10);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] py-1 rounded-lg shadow-xl border border-border bg-bg-tertiary"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {menuItems.map((item, index) => (
        <button
          key={index}
          onClick={item.onClick}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
