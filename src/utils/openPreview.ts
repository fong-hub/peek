import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile, readTextFileLines, stat } from "@tauri-apps/plugin-fs";
import { useStore } from "@/store/useStore";
import type { FileInfo, FilePreviewMeta } from "@/store/useStore";
import { hydrateTreeForPath, listDirectoryNodes } from "@/utils/fileTree";
import { detectFileType } from "@/utils/fileTypes";
import {
  isBinaryFile,
  MAX_LARGE_FILE_PREVIEW_CHARS,
  MAX_LARGE_FILE_PREVIEW_LINES,
  shouldUseLargeFileMode,
} from "@/utils/fileUtils";
import type { SessionSnapshot } from "@/utils/session";

function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() || "unknown";
}

export async function loadPreviewFile(path: string): Promise<FileInfo> {
  const name = getFileName(path);
  const type = detectFileType(name);

  let previewMeta: FilePreviewMeta | undefined;

  try {
    const fileInfo = await stat(path);
    previewMeta = {
      sizeBytes: fileInfo.size,
    };
  } catch (error) {
    console.warn("Failed to read file stat:", path, error);
  }

  if (type === "image" || type === "pdf") {
    return {
      name,
      path,
      content: "",
      type,
      previewMeta,
    };
  }

  if (isBinaryFile(name)) {
    return {
      name,
      path,
      content: "二进制文件暂不支持预览",
      type: "unsupported",
      previewMeta,
    };
  }

  try {
    const content = previewMeta?.sizeBytes && shouldUseLargeFileMode(previewMeta.sizeBytes)
      ? await readLargeTextPreview(path, previewMeta.sizeBytes)
      : { content: await readTextFile(path), previewMeta };

    return {
      name,
      path,
      content: content.content,
      type,
      previewMeta: content.previewMeta,
    };
  } catch (error) {
    console.error("Failed to read file:", path, error);
    return {
      name,
      path,
      content: "文件读取失败，可能是二进制文件、权限受限或文件已不存在",
      type: "unsupported",
      previewMeta,
    };
  }
}

async function readLargeTextPreview(
  path: string,
  sizeBytes?: number
): Promise<{ content: string; previewMeta: FilePreviewMeta }> {
  const iterator = await readTextFileLines(path);
  const lines: string[] = [];
  let accumulatedChars = 0;
  let isTruncated = false;

  for await (const line of iterator) {
    const nextCharCount = accumulatedChars + line.length + 1;

    if (
      lines.length >= MAX_LARGE_FILE_PREVIEW_LINES ||
      nextCharCount > MAX_LARGE_FILE_PREVIEW_CHARS
    ) {
      isTruncated = true;
      break;
    }

    lines.push(line);
    accumulatedChars = nextCharCount;
  }

  const content = lines.join("\n");

  return {
    content,
    previewMeta: {
      sizeBytes,
      previewedBytes: new TextEncoder().encode(content).byteLength,
      previewedLineCount: lines.length,
      isLargeFile: true,
      isTruncated,
    },
  };
}

export async function openStandaloneFile(
  path: string,
  options: { addToRecent?: boolean } = {}
) {
  const { setFile } = useStore.getState();
  const fileInfo = await loadPreviewFile(path);

  setFile(fileInfo, options.addToRecent ?? true);
}

export async function openFileInCurrentFolder(path: string) {
  const { setFile, setSelectedPath } = useStore.getState();
  const fileInfo = await loadPreviewFile(path);

  setSelectedPath(path);
  setFile(fileInfo, false);
}

export async function openFolderWorkspace(
  rootPath: string,
  options: {
    selectedPath?: string | null;
    filePath?: string | null;
    addToRecent?: boolean;
    activateFile?: boolean;
  } = {}
) {
  const { setFile, setFolder } = useStore.getState();
  const activePath = options.filePath ?? options.selectedPath ?? null;
  const initialTree = await listDirectoryNodes(rootPath);
  const tree = activePath
    ? await hydrateTreeForPath(rootPath, initialTree, activePath)
    : initialTree;

  setFile(null, false);
  setFolder(
    {
      rootPath,
      tree,
      selectedPath: options.selectedPath ?? activePath,
    },
    options.addToRecent ?? true
  );

  if (activePath && options.activateFile !== false) {
    const fileInfo = await loadPreviewFile(activePath);
    setFile(fileInfo, false);
    return;
  }

  setFile(null, false);
}

export async function openPreviewPath(
  path: string,
  options: { addToRecent?: boolean } = {}
): Promise<"folder" | "file"> {
  try {
    await openFolderWorkspace(path, { addToRecent: options.addToRecent });
    return "folder";
  } catch {
    await openStandaloneFile(path, { addToRecent: options.addToRecent });
    return "file";
  }
}

export async function restoreSession(session: SessionSnapshot) {
  if (session.rootPath) {
    await openFolderWorkspace(session.rootPath, {
      selectedPath: session.selectedPath,
      addToRecent: false,
      activateFile: false,
    });
  } else {
    useStore.getState().setFile(null, false);
  }

  const tabPaths = session.tabPaths.length > 0
    ? session.tabPaths
    : session.filePath
      ? [session.filePath]
      : [];

  for (const path of tabPaths) {
    try {
      const fileInfo = await loadPreviewFile(path);
      useStore.getState().setFile(fileInfo, false);
    } catch (error) {
      console.warn("Failed to restore preview tab:", path, error);
    }
  }

  if (session.activeTabPath) {
    useStore.getState().activateTab(session.activeTabPath);
  }
}

export async function openFileDialog() {
  const selected = await open({
    multiple: true,
    directory: false,
  });

  const paths = Array.isArray(selected) ? selected : selected ? [selected] : [];
  for (const path of paths) {
    await openStandaloneFile(path);
  }
}

export async function openFolderDialog() {
  const selected = await open({
    multiple: false,
    directory: true,
  });

  if (selected && typeof selected === "string") {
    await openFolderWorkspace(selected);
  }
}
