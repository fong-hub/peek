import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readTextFile, stat } from "@tauri-apps/plugin-fs";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import FileDropZone from "@/components/FileDropZone";
import PreviewContainer from "@/components/PreviewContainer";
import { useStore } from "@/store/useStore";
import { detectFileType } from "@/utils/fileTypes";
import { buildFileTree } from "@/utils/fileTree";
import { isBinaryFile, isFileTooLarge, formatFileSize } from "@/utils/fileUtils";

export default function App() {
  const { file, setFile, setFolder, setSelectedPath } = useStore();

  // Tauri native drag-drop event handler
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupDragDrop = async () => {
      unlisten = await getCurrentWindow().onDragDropEvent(async (event: any) => {
        console.log("[DEBUG] DragDrop event:", event.payload.type, event.payload.paths);
        if (event.payload.type === "drop") {
          const paths = event.payload.paths;
          if (paths.length === 0) return;

          const droppedPath = paths[0];
          console.log("[DEBUG] Dropped path:", droppedPath);

          // Try to treat as directory first
          try {
            const tree = await buildFileTree(droppedPath);
            console.log("[DEBUG] Folder tree loaded, items:", tree.length);
            setFolder({
              rootPath: droppedPath,
              tree,
              selectedPath: null,
            });
            setFile(null);
            return;
          } catch (err) {
            console.log("[DEBUG] Not a directory or empty:", err);
          }

          // Treat as single file
          const name = droppedPath.split(/[/\\]/).pop() || "unknown";

          // Check if binary file
          if (isBinaryFile(name)) {
            setFile({
              name,
              path: droppedPath,
              content: "二进制文件不支持预览",
              type: "unsupported",
            });
            setFolder({
              rootPath: null,
              tree: [],
              selectedPath: null,
            });
            return;
          }

          // Check file size
          try {
            const fileMeta = await stat(droppedPath);
            if (isFileTooLarge(Number(fileMeta.size))) {
              setFile({
                name,
                path: droppedPath,
                content: `文件过大 (${formatFileSize(Number(fileMeta.size))})，不支持预览`,
                type: "unsupported",
              });
              setFolder({
                rootPath: null,
                tree: [],
                selectedPath: null,
              });
              return;
            }
          } catch (err) {
            console.error("[DEBUG] Failed to get file metadata:", err);
          }

          try {
            const content = await readTextFile(droppedPath);
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
            console.error("[DEBUG] Failed to read dropped file:", err);
            setFile({
              name,
              path: droppedPath,
              content: "文件读取失败，可能是二进制文件或权限问题",
              type: "unsupported",
            });
            setFolder({
              rootPath: null,
              tree: [],
              selectedPath: null,
            });
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
