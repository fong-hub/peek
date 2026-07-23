import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import FileDropZone from "@/components/FileDropZone";
import PreviewContainer from "@/components/PreviewContainer";
import TabBar from "@/components/TabBar";
import { useStore } from "@/store/useStore";
import { openPreviewPath, restoreSession } from "@/utils/openPreview";
import { getCurrentSession, isEmptySession } from "@/utils/session";

let appBootstrapped = false;
const CLI_EVENT_NAME = "cli-launch-requested";

interface LaunchRequestEvent {
  paths: string[];
}

async function consumeQueuedLaunchPaths() {
  const launchPaths = await invoke<string[]>("take_launch_paths");
  const nextPath = launchPaths.at(-1);

  if (!nextPath) {
    return false;
  }

  await openPreviewPath(nextPath, { addToRecent: true });
  return true;
}

export default function App() {
  const { file, tabs, closeTab, reopenClosedTab, activateTab } = useStore();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", useStore.getState().theme);
  }, []);

  useEffect(() => {
    if (appBootstrapped) return;
    appBootstrapped = true;

    const bootstrapApp = async () => {
      try {
        if (await consumeQueuedLaunchPaths()) {
          return;
        }
      } catch (error) {
        console.error("Failed to consume queued launch paths:", error);
      }

      const currentSession = getCurrentSession();
      if (!isEmptySession(currentSession)) {
        try {
          await restoreSession(currentSession);
        } catch (error) {
          console.error("Failed to restore previous session:", error);
        }
      }
    };

    void bootstrapApp();
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupLaunchListener = async () => {
      unlisten = await listen<LaunchRequestEvent>(CLI_EVENT_NAME, async () => {
        try {
          await consumeQueuedLaunchPaths();
        } catch (error) {
          console.error("Failed to open forwarded CLI path:", error);
        }
      });

      try {
        await consumeQueuedLaunchPaths();
      } catch (error) {
        console.error("Failed to consume pending CLI path after listener setup:", error);
      }
    };

    void setupLaunchListener();
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  // Tauri native drag-drop event handler
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupDragDrop = async () => {
      unlisten = await getCurrentWindow().onDragDropEvent(async (event: any) => {
        if (event.payload.type === "drop") {
          const paths = event.payload.paths;
          if (paths.length === 0) return;
          for (const path of paths) {
            await openPreviewPath(path);
          }
        }
      });
    };

    setupDragDrop();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "o") {
        e.preventDefault();
        document.getElementById("open-file-btn")?.click();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "w" && file) {
        e.preventDefault();
        closeTab(file.path);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        reopenClosedTab();
        return;
      }
      if (e.ctrlKey && e.key === "Tab" && tabs.length > 1) {
        e.preventDefault();
        const currentIndex = tabs.findIndex((tab) => tab.path === file?.path);
        const direction = e.shiftKey ? -1 : 1;
        const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
        activateTab(tabs[nextIndex].path);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && /^[1-9]$/.test(e.key) && tabs.length > 0) {
        e.preventDefault();
        const requestedIndex = Number(e.key) - 1;
        const nextTab = tabs[Math.min(requestedIndex, tabs.length - 1)];
        activateTab(nextTab.path);
        return;
      }
      if (e.key === "Escape" && file) {
        e.preventDefault();
        closeTab(file.path);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activateTab, closeTab, file, reopenClosedTab, tabs]);

  return (
    <div className="w-full h-full flex flex-col bg-bg-primary">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
          <TabBar />
          <FileDropZone>
            <PreviewContainer />
          </FileDropZone>
        </main>
      </div>
    </div>
  );
}
