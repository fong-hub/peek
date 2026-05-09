import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readTextFile } from "@tauri-apps/plugin-fs";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import FileDropZone from "@/components/FileDropZone";
import PreviewContainer from "@/components/PreviewContainer";
import { useStore } from "@/store/useStore";
import { detectFileType } from "@/utils/fileTypes";
import { buildFileTree } from "@/utils/fileTree";

export default function App() {
  const { file, setFile, setFolder, setSelectedPath } = useStore();

  // Tauri native drag-drop event handler
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupDragDrop = async () => {
      unlisten = await getCurrentWindow().onDragDropEvent(async (event) => {
        if (event.payload.type === "drop") {
          const paths = event.payload.paths;
          if (paths.length === 0) return;

          const droppedPath = paths[0];

          // Try to treat as directory first
          try {
            const tree = await buildFileTree(droppedPath);
            setFolder({
              rootPath: droppedPath,
              tree,
              selectedPath: null,
            });
            setFile(null);
            return;
          } catch (err) {
            console.log("Not a directory or empty:", err);
          }

          // Treat as single file
          try {
            const content = await readTextFile(droppedPath);
            const name = droppedPath.split(/[/\\]/).pop() || "unknown";
            setFile({
              name,
              path: droppedPath,
              content,
              type: detectFileType(name),
            });
            setFolder({
              rootPath: null,
              tree: [],
              selectedPath: null,
            });
          } catch (err) {
            console.error("Failed to read dropped file:", err);
          }
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
        setFile(null);
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
