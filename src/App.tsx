import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import FileDropZone from "@/components/FileDropZone";
import PreviewContainer from "@/components/PreviewContainer";
import { useStore } from "@/store/useStore";
import { openPreviewPath, restoreSession } from "@/utils/openPreview";
import { getCurrentSession, isEmptySession } from "@/utils/session";

let appBootstrapped = false;

export default function App() {
  const { file, setFile, setFolder, setSelectedPath } = useStore();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", useStore.getState().theme);
  }, []);

  useEffect(() => {
    if (appBootstrapped) return;
    appBootstrapped = true;

    const bootstrapApp = async () => {
      try {
        const launchPaths = await invoke<string[]>("get_launch_paths");
        if (launchPaths.length > 0) {
          await openPreviewPath(launchPaths[0], { addToRecent: true });
          return;
        }
      } catch (error) {
        console.error("Failed to read launch paths:", error);
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

  // Tauri native drag-drop event handler
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupDragDrop = async () => {
      unlisten = await getCurrentWindow().onDragDropEvent(async (event: any) => {
        if (event.payload.type === "drop") {
          const paths = event.payload.paths;
          if (paths.length === 0) return;
          await openPreviewPath(paths[0]);
        }
      });
    };

    setupDragDrop();
    return () => {
      if (unlisten) unlisten();
    };
  }, [setFile, setFolder]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "o") {
        e.preventDefault();
        document.getElementById("open-file-btn")?.click();
      }
      if (e.key === "Escape" && file) {
        e.preventDefault();
        setFile(null, false);
        setSelectedPath(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [file, setFile, setSelectedPath]);

  return (
    <div className="w-full h-full flex flex-col bg-bg-primary">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <FileDropZone>
            <PreviewContainer />
          </FileDropZone>
        </main>
      </div>
    </div>
  );
}
