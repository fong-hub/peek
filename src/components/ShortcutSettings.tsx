import { useEffect, useRef, useState } from "react";
import { Keyboard, RotateCcw, X } from "lucide-react";
import { useStore } from "@/store/useStore";
import {
  SHORTCUT_ACTIONS,
  formatShortcut,
  isValidShortcut,
  shortcutFromKeyboardEvent,
  type ShortcutAction,
} from "@/utils/shortcuts";

interface Props {
  onClose: () => void;
}

const ACTION_LABELS: Record<ShortcutAction, string> = {
  openFile: "打开文件",
  find: "搜索当前文件",
  closeTab: "关闭当前页签",
  reopenClosedTab: "重新打开关闭的页签",
  nextTab: "下一个页签",
  previousTab: "上一个页签",
};

export default function ShortcutSettings({ onClose }: Props) {
  const { shortcuts, setShortcut, resetShortcuts } = useStore();
  const [recording, setRecording] = useState<ShortcutAction | null>(null);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const captureShortcut = (event: React.KeyboardEvent, action: ShortcutAction) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape") {
      setRecording(null);
      setError("");
      return;
    }

    const shortcut = shortcutFromKeyboardEvent(event.nativeEvent);
    if (!shortcut) return;
    if (!isValidShortcut(shortcut)) {
      setError("快捷键需要包含 Command、Ctrl、Alt 或 Shift");
      return;
    }

    const conflict = SHORTCUT_ACTIONS.find(
      (candidate) => candidate !== action && shortcuts[candidate] === shortcut
    );
    if (conflict) {
      setError(`与“${ACTION_LABELS[conflict]}”冲突`);
      return;
    }

    setShortcut(action, shortcut);
    setRecording(null);
    setError("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-settings-title"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !recording) {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
        }}
        className="w-full max-w-[520px] overflow-hidden rounded-[8px] border border-border bg-bg-primary shadow-2xl outline-none"
      >
        <div className="flex h-12 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <Keyboard size={17} className="text-accent" />
            <h2 id="shortcut-settings-title" className="text-sm font-semibold text-text-primary">
              快捷键设置
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-[4px] text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
            title="关闭"
            aria-label="关闭快捷键设置"
          >
            <X size={17} />
          </button>
        </div>

        <div className="divide-y divide-border">
          {SHORTCUT_ACTIONS.map((action) => (
            <div key={action} className="flex min-h-12 items-center justify-between gap-4 px-4 py-2">
              <span className="text-sm text-text-secondary">{ACTION_LABELS[action]}</span>
              <button
                type="button"
                data-shortcut-capture="true"
                onClick={() => {
                  setRecording(action);
                  setError("");
                }}
                onKeyDown={(event) => recording === action && captureShortcut(event, action)}
                className={`min-w-28 rounded-[5px] border px-3 py-1.5 text-xs font-medium outline-none transition-colors ${
                  recording === action
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-bg-secondary text-text-primary hover:border-text-muted focus-visible:border-accent"
                }`}
              >
                {recording === action ? "录制中…" : formatShortcut(shortcuts[action])}
              </button>
            </div>
          ))}
        </div>

        <div className="flex min-h-12 items-center justify-between border-t border-border px-4 py-2">
          <span className="text-xs text-error" role="alert">{error}</span>
          <button
            type="button"
            onClick={() => {
              resetShortcuts();
              setRecording(null);
              setError("");
            }}
            className="flex items-center gap-1.5 rounded-[5px] px-2.5 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
          >
            <RotateCcw size={13} />
            恢复默认
          </button>
        </div>
      </div>
    </div>
  );
}
