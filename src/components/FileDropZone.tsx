import { useCallback } from "react";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useStore } from "@/store/useStore";
import { detectFileType } from "@/utils/fileTypes";
import { buildFileTree } from "@/utils/fileTree";

export default function FileDropZone({ children }: { children: React.ReactNode }) {
  const { setFile, setFolder, setIsDragging } = useStore();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, [setIsDragging]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, [setIsDragging]);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const items = e.dataTransfer.files;
      if (items.length === 0) return;

      const dropped = items[0];
      if (!dropped) return;

      // @ts-expect-error path may exist on dragged files in Tauri
      const filePath = dropped.path as string | undefined;
      if (!filePath) {
        // Fallback to web API for non-Tauri environments
        try {
          const content = await dropped.text();
          setFile({
            name: dropped.name,
            path: dropped.name,
            content,
            type: detectFileType(dropped.name),
          });
        } catch (err) {
          console.error("Failed to read dropped file:", err);
        }
        return;
      }

      // Try to treat as directory first
      try {
        const tree = await buildFileTree(filePath);
        setFolder({
          rootPath: filePath,
          tree,
          selectedPath: null,
        });
        setFile(null);
        return;
      } catch {
        // Not a directory, treat as file
      }

      // Treat as single file
      try {
        const content = await readTextFile(filePath);
        setFile({
          name: dropped.name,
          path: filePath,
          content,
          type: detectFileType(dropped.name),
        });
        // Clear folder state when opening a single file
        setFolder({
          rootPath: null,
          tree: [],
          selectedPath: null,
        });
      } catch (err) {
        console.error("Failed to read dropped file:", err);
      }
    },
    [setFile, setFolder, setIsDragging]
  );

  return (
    <div
      className="w-full h-full relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      <DropOverlay />
    </div>
  );
}

function DropOverlay() {
  const { isDragging } = useStore();

  if (!isDragging) return null;

  return (
    <div className="absolute inset-0 z-50 bg-accent/10 backdrop-blur-sm flex items-center justify-center border-2 border-dashed border-accent rounded-lg m-2">
      <div className="text-accent text-lg font-medium">释放文件或文件夹以预览</div>
    </div>
  );
}
