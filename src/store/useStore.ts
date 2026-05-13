import { create } from "zustand";
import { addRecentItem } from "@/utils/recent";

export type PreviewType = "markdown" | "json" | "text" | "html" | "log" | "unknown";

export interface FileInfo {
  name: string;
  path: string;
  content: string;
  type: PreviewType;
}

export interface RecentItem {
  path: string;
  name: string;
  isDirectory: boolean;
  timestamp: number;
}

export interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: TreeNode[];
  expanded?: boolean;
}

export interface FolderState {
  rootPath: string | null;
  tree: TreeNode[];
  selectedPath: string | null;
}

interface Store {
  file: FileInfo | null;
  folder: FolderState;
  isDragging: boolean;
  theme: "dark" | "light";
  sidebarVisible: boolean;
  sidebarWidth: number;
  infoPanelVisible: boolean;
  setFile: (file: FileInfo | null, addToRecent?: boolean) => void;
  setFolder: (folder: FolderState) => void;
  setIsDragging: (dragging: boolean) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setSelectedPath: (path: string | null) => void;
  toggleNodeExpanded: (path: string) => void;
  toggleInfoPanel: () => void;
}

export const useStore = create<Store>((set) => ({
  file: null,
  folder: {
    rootPath: null,
    tree: [],
    selectedPath: null,
  },
  isDragging: false,
  theme: "dark",
  sidebarVisible: true,
  sidebarWidth: 256,
  infoPanelVisible: false,
  setFile: (file, addToRecent = true) => {
    if (file && addToRecent) {
      addRecentItem(file.path, file.name, false);
    }
    set({ file });
  },
  setFolder: (folder) => {
    if (folder.rootPath) {
      const name = folder.rootPath.split(/[/\\]/).pop() || folder.rootPath;
      addRecentItem(folder.rootPath, name, true);
    }
    set({ folder });
  },
  setIsDragging: (isDragging) => set({ isDragging }),
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      return { theme: next };
    }),
  toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),
  setSidebarWidth: (width) => set({ sidebarWidth: Math.max(180, Math.min(500, width)) }),
  setSelectedPath: (path) =>
    set((state) => ({
      folder: { ...state.folder, selectedPath: path },
    })),
  toggleNodeExpanded: (path) =>
    set((state) => {
      const toggleInTree = (nodes: TreeNode[]): TreeNode[] =>
        nodes.map((node) => {
          if (node.path === path) {
            return { ...node, expanded: !node.expanded };
          }
          if (node.children.length > 0) {
            return { ...node, children: toggleInTree(node.children) };
          }
          return node;
        });
      return {
        folder: { ...state.folder, tree: toggleInTree(state.folder.tree) },
      };
    }),
  toggleInfoPanel: () =>
    set((state) => ({ infoPanelVisible: !state.infoPanelVisible })),
}));
