import { useEffect } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import FileDropZone from "@/components/FileDropZone";
import PreviewContainer from "@/components/PreviewContainer";
import { useStore } from "@/store/useStore";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { detectFileType } from "@/utils/fileTypes";

export default function App() {
  const { file, folder, setFile, setSelectedPath } = useStore();

  // Load file content when selected path changes in sidebar
  useEffect(() => {
    if (!folder.selectedPath) {
      setFile(null);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const content = await readTextFile(folder.selectedPath);
        if (cancelled) return;
        const name = folder.selectedPath.split(/[/\\]/).pop() || "unknown";
        setFile({
          name,
          path: folder.selectedPath,
          content,
          type: detectFileType(name),
        });
      } catch (err) {
        console.error("Failed to read file:", err);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [folder.selectedPath, setFile]);

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
