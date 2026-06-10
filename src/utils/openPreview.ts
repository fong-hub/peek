import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useStore } from "@/store/useStore";
import type { FileInfo, FolderState } from "@/store/useStore";
import { buildFileTree } from "@/utils/fileTree";
import { detectFileType } from "@/utils/fileTypes";
import { isBinaryFile } from "@/utils/fileUtils";
import type { SessionSnapshot } from "@/utils/session";

const EMPTY_FOLDER_STATE: FolderState = {
  rootPath: null,
  tree: [],
  selectedPath: null,
};

function getFileName(path: string): string {
  return path.split(/[/\\]/).pop() || "unknown";
}

export async function loadPreviewFile(path: string): Promise<FileInfo> {
  const name = getFileName(path);

  if (isBinaryFile(name)) {
    return {
      name,
      path,
      content: "二进制文件暂不支持预览",
      type: "unsupported",
    };
  }

  try {
    const content = await readTextFile(path);
    return {
      name,
      path,
      content,
      type: detectFileType(name),
    };
  } catch (error) {
    console.error("Failed to read file:", path, error);
    return {
      name,
      path,
      content: "文件读取失败，可能是二进制文件、权限受限或文件已不存在",
      type: "unsupported",
    };
  }
}

export async function openStandaloneFile(
  path: string,
  options: { addToRecent?: boolean } = {}
) {
  const { setFile, setFolder } = useStore.getState();
  const fileInfo = await loadPreviewFile(path);

  setFile(fileInfo, options.addToRecent ?? true);
  setFolder(EMPTY_FOLDER_STATE, false);
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
  } = {}
) {
  const { setFile, setFolder } = useStore.getState();
  const tree = await buildFileTree(rootPath);
  const activePath = options.filePath ?? options.selectedPath ?? null;

  setFolder(
    {
      rootPath,
      tree,
      selectedPath: options.selectedPath ?? activePath,
    },
    options.addToRecent ?? true
  );

  if (activePath) {
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
      filePath: session.filePath ?? session.selectedPath,
      addToRecent: false,
    });
    return;
  }

  if (session.filePath) {
    await openStandaloneFile(session.filePath, { addToRecent: false });
  }
}

export async function openFileDialog() {
  const selected = await open({
    multiple: false,
    directory: false,
  });

  if (selected && typeof selected === "string") {
    await openStandaloneFile(selected);
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
