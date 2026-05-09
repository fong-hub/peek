import { useCallback } from "react";
import { useStore } from "@/store/useStore";

export default function FileDropZone({ children }: { children: React.ReactNode }) {
  const { setIsDragging } = useStore();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, [setIsDragging]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, [setIsDragging]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      // Actual file/folder handling is done by Tauri's native onDragDropEvent in App.tsx
    },
    [setIsDragging]
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
