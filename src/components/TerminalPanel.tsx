import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal, type ITheme } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { RotateCw, SquareTerminal, Trash2, X } from "lucide-react";
import { useStore } from "@/store/useStore";
import { getPathName, getProjectContextPath } from "@/utils/projectContext";

interface TerminalStarted {
  terminalId: number;
  cwd: string;
  shell: string;
}

interface TerminalOutputEvent {
  terminalId: number;
  data: number[];
}

interface TerminalExitEvent {
  terminalId: number;
}

function terminalTheme(theme: "dark" | "light"): ITheme {
  return theme === "dark"
    ? {
        background: "#0f0f0f",
        foreground: "#d4d4d4",
        cursor: "#60a5fa",
        cursorAccent: "#0f0f0f",
        selectionBackground: "#264f78",
        black: "#1f1f1f",
        red: "#f87171",
        green: "#4ade80",
        yellow: "#fbbf24",
        blue: "#60a5fa",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: "#e5e7eb",
      }
    : {
        background: "#ffffff",
        foreground: "#24292f",
        cursor: "#2563eb",
        cursorAccent: "#ffffff",
        selectionBackground: "#bfdbfe",
        black: "#24292f",
        red: "#cf222e",
        green: "#1a7f37",
        yellow: "#9a6700",
        blue: "#0969da",
        magenta: "#8250df",
        cyan: "#1b7c83",
        white: "#f6f8fa",
      };
}

function normalizeTerminalText(text: string): string {
  return text.replace(/\r?\n/g, "\r\n");
}

export default function TerminalPanel() {
  const {
    file,
    folder,
    theme,
    terminalVisible,
    terminalHeight,
    terminalNotices,
    setTerminalVisible,
    setTerminalHeight,
    dismissTerminalNotice,
  } = useStore();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const terminalIdRef = useRef<number | null>(null);
  const [sessionNonce, setSessionNonce] = useState(0);
  const [sessionInfo, setSessionInfo] = useState<TerminalStarted | null>(null);
  const contextPath = getProjectContextPath(folder.rootPath, file?.path);
  const contextLabel = useMemo(
    () => getPathName(sessionInfo?.cwd ?? contextPath),
    [contextPath, sessionInfo?.cwd]
  );

  useEffect(() => {
    if (!terminalVisible || !hostRef.current) return;

    let disposed = false;
    let outputUnlisten: UnlistenFn | null = null;
    let exitUnlisten: UnlistenFn | null = null;
    const pendingOutput: TerminalOutputEvent[] = [];
    const terminal = new Terminal({
      allowProposedApi: false,
      cursorBlink: true,
      cursorStyle: "bar",
      fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
      fontSize: 12.5,
      lineHeight: 1.25,
      scrollback: 10_000,
      theme: terminalTheme(theme),
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(hostRef.current);
    terminalRef.current = terminal;

    const inputDisposable = terminal.onData((data) => {
      const terminalId = terminalIdRef.current;
      if (terminalId === null) return;
      void invoke("write_terminal", { terminalId, data });
    });
    const resizeDisposable = terminal.onResize(({ rows, cols }) => {
      const terminalId = terminalIdRef.current;
      if (terminalId === null) return;
      void invoke("resize_terminal", { terminalId, rows, cols });
    });
    const observer = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // The terminal may already be disposing during a layout transition.
      }
    });
    observer.observe(hostRef.current);

    const start = async () => {
      try {
        outputUnlisten = await listen<TerminalOutputEvent>("terminal-output", (event) => {
          const activeId = terminalIdRef.current;
          if (activeId === null) {
            pendingOutput.push(event.payload);
            return;
          }
          if (event.payload.terminalId === activeId) {
            terminal.write(Uint8Array.from(event.payload.data));
          }
        });
        exitUnlisten = await listen<TerminalExitEvent>("terminal-exit", (event) => {
          if (event.payload.terminalId !== terminalIdRef.current) return;
          terminalIdRef.current = null;
          terminal.write("\r\n\x1b[90m[终端进程已退出]\x1b[0m\r\n");
        });

        fitAddon.fit();
        const started = await invoke<TerminalStarted>("start_terminal", {
          cwd: contextPath,
          rows: terminal.rows,
          cols: terminal.cols,
        });
        if (disposed) {
          await invoke("close_terminal", { terminalId: started.terminalId }).catch(() => undefined);
          return;
        }

        terminalIdRef.current = started.terminalId;
        setSessionInfo(started);
        pendingOutput
          .filter((event) => event.terminalId === started.terminalId)
          .forEach((event) => terminal.write(Uint8Array.from(event.data)));
        terminal.focus();
      } catch (error) {
        terminal.write(
          `\r\n\x1b[31m${normalizeTerminalText(String(error))}\x1b[0m\r\n`
        );
      }
    };

    void start();

    return () => {
      disposed = true;
      observer.disconnect();
      inputDisposable.dispose();
      resizeDisposable.dispose();
      outputUnlisten?.();
      exitUnlisten?.();
      const terminalId = terminalIdRef.current;
      terminalIdRef.current = null;
      if (terminalId !== null) {
        void invoke("close_terminal", { terminalId }).catch(() => undefined);
      }
      terminalRef.current = null;
      terminal.dispose();
      setSessionInfo(null);
    };
  }, [contextPath, sessionNonce, terminalVisible]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal || terminalNotices.length === 0) return;

    terminalNotices.forEach((notice) => {
      const color = notice.kind === "command" ? "36" : notice.kind === "success" ? "32" : "31";
      terminal.write(
        `\r\n\x1b[${color}m${normalizeTerminalText(notice.text)}\x1b[0m\r\n`
      );
      dismissTerminalNotice(notice.id);
    });
  }, [dismissTerminalNotice, terminalNotices]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = terminalTheme(theme);
    }
  }, [theme]);

  if (!terminalVisible) return null;

  const beginResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = panelRef.current?.getBoundingClientRect().height ?? terminalHeight;

    const move = (moveEvent: PointerEvent) => {
      const maximum = Math.max(120, window.innerHeight - 140);
      setTerminalHeight(
        Math.min(maximum, Math.max(120, startHeight + startY - moveEvent.clientY))
      );
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  };

  return (
    <section
      ref={panelRef}
      className="relative flex flex-shrink-0 flex-col border-t border-border bg-bg-primary"
      style={{ height: terminalHeight, maxHeight: "calc(100vh - 140px)" }}
      aria-label="终端面板"
    >
      <div
        role="separator"
        aria-label="调整终端高度"
        aria-orientation="horizontal"
        onPointerDown={beginResize}
        onDoubleClick={() => setTerminalHeight(240)}
        className="absolute -top-1 left-0 z-10 h-2 w-full cursor-row-resize touch-none before:absolute before:left-1/2 before:top-[3px] before:h-0.5 before:w-10 before:-translate-x-1/2 before:rounded-full before:bg-border hover:before:bg-accent"
      />
      <div className="flex h-9 flex-shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-2">
          <SquareTerminal size={14} className="flex-shrink-0 text-accent" />
          <span className="text-xs font-medium text-text-primary">终端</span>
          <span className="truncate text-[11px] text-text-muted" title={sessionInfo?.cwd ?? contextPath ?? ""}>
            {contextLabel}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => terminalRef.current?.clear()}
            className="grid h-7 w-7 place-items-center rounded-[4px] text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
            title="清空终端"
            aria-label="清空终端"
          >
            <Trash2 size={13} />
          </button>
          <button
            type="button"
            onClick={() => setSessionNonce((value) => value + 1)}
            className="grid h-7 w-7 place-items-center rounded-[4px] text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
            title="重新启动终端"
            aria-label="重新启动终端"
          >
            <RotateCw size={13} />
          </button>
          <button
            type="button"
            onClick={() => setTerminalVisible(false)}
            className="grid h-7 w-7 place-items-center rounded-[4px] text-text-muted hover:bg-bg-tertiary hover:text-text-primary"
            title="关闭终端"
            aria-label="关闭终端"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      <div ref={hostRef} className="terminal-host min-h-0 flex-1 px-2 py-1.5" />
    </section>
  );
}
