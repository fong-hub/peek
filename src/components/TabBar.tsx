import { useEffect, useRef, useState } from "react";
import {
  CodeXml,
  FileImage,
  FileJson2,
  FileSpreadsheet,
  FileText,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { useStore, type FileInfo } from "@/store/useStore";
import { openFileDialog } from "@/utils/openPreview";

interface TabMenuState {
  path: string;
  x: number;
  y: number;
}

function TabIcon({ tab }: { tab: FileInfo }) {
  const iconProps = { size: 14, strokeWidth: 1.8, className: "shrink-0" };

  switch (tab.type) {
    case "html":
      return <CodeXml {...iconProps} />;
    case "json":
      return <FileJson2 {...iconProps} />;
    case "csv":
      return <FileSpreadsheet {...iconProps} />;
    case "image":
      return <FileImage {...iconProps} />;
    default:
      return <FileText {...iconProps} />;
  }
}

export default function TabBar() {
  const {
    tabs,
    activeTabPath,
    closedTabs,
    activateTab,
    closeTab,
    closeOtherTabs,
    closeAllTabs,
    reopenClosedTab,
  } = useStore();
  const [menu, setMenu] = useState<TabMenuState | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menu) return;

    const closeMenu = () => setMenu(null);
    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("blur", closeMenu);
    return () => {
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("blur", closeMenu);
    };
  }, [menu]);

  useEffect(() => {
    scrollRef.current
      ?.querySelector<HTMLElement>("[data-tab-active='true']")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTabPath]);

  if (tabs.length === 0) return null;

  return (
    <div className="h-9 shrink-0 flex items-stretch border-b border-border bg-bg-secondary">
      <div
        ref={scrollRef}
        className="min-w-0 flex-1 flex overflow-x-auto overflow-y-hidden tab-strip-scrollbar"
        role="tablist"
        aria-label="打开的文件"
        onWheel={(event) => {
          if (!scrollRef.current || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
          scrollRef.current.scrollLeft += event.deltaY;
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.path === activeTabPath;
          return (
            <div
              key={tab.path}
              className={`group relative flex h-9 min-w-[132px] max-w-[220px] items-center border-r border-border text-xs transition-colors ${
                isActive
                  ? "bg-bg-primary text-text-primary"
                  : "bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
              }`}
              data-tab-active={isActive}
              onContextMenu={(event) => {
                event.preventDefault();
                setMenu({ path: tab.path, x: event.clientX, y: event.clientY });
              }}
              onAuxClick={(event) => {
                if (event.button === 1) closeTab(tab.path);
              }}
            >
              {isActive && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-accent" />}
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => activateTab(tab.path)}
                className="flex min-w-0 flex-1 items-center gap-2 self-stretch pl-3 pr-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
                title={tab.path}
              >
                <span className={isActive ? "text-accent" : "text-text-muted"}>
                  <TabIcon tab={tab} />
                </span>
                <span className="min-w-0 flex-1 truncate font-mono">{tab.name}</span>
              </button>
              <button
                type="button"
                onClick={() => closeTab(tab.path)}
                className={`mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-[4px] outline-none hover:bg-border/70 focus-visible:ring-2 focus-visible:ring-accent ${
                  isActive ? "text-text-secondary" : "text-transparent group-hover:text-text-muted"
                }`}
                title={`关闭 ${tab.name}`}
                aria-label={`关闭 ${tab.name}`}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 border-l border-border px-1">
        {closedTabs.length > 0 && (
          <button
            type="button"
            onClick={reopenClosedTab}
            className="grid h-7 w-7 place-items-center rounded-[4px] text-text-muted hover:bg-bg-tertiary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            title="重新打开关闭的页签 (Cmd/Ctrl+Shift+T)"
          >
            <RotateCcw size={13} />
          </button>
        )}
        <button
          type="button"
          onClick={() => void openFileDialog()}
          className="grid h-7 w-7 place-items-center rounded-[4px] text-text-muted hover:bg-bg-tertiary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          title="打开文件"
          aria-label="打开文件"
        >
          <Plus size={15} />
        </button>
      </div>

      {menu && (
        <div
          className="fixed z-[70] w-44 border border-border bg-bg-secondary p-1 shadow-xl"
          style={{
            left: Math.min(menu.x, window.innerWidth - 184),
            top: Math.min(menu.y, window.innerHeight - 132),
          }}
          role="menu"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <MenuButton
            label="关闭"
            onClick={() => {
              closeTab(menu.path);
              setMenu(null);
            }}
          />
          <MenuButton
            label="关闭其他页签"
            disabled={tabs.length === 1}
            onClick={() => {
              closeOtherTabs(menu.path);
              setMenu(null);
            }}
          />
          <MenuButton
            label="关闭全部页签"
            onClick={() => {
              closeAllTabs();
              setMenu(null);
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuButton({
  label,
  disabled = false,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="w-full px-2.5 py-1.5 text-left text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary disabled:pointer-events-none disabled:opacity-40"
    >
      {label}
    </button>
  );
}
