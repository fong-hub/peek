import { create } from "zustand";
import { addRecentItem } from "@/utils/recent";
import {
  getStoredUiPreferences,
  saveCurrentSession,
  saveLastSession,
  saveUiPreferences,
  type SessionSnapshot,
} from "@/utils/session";

export type PreviewType =
  | "markdown"
  | "json"
  | "text"
  | "html"
  | "log"
  | "csv"
  | "image"
  | "pdf"
  | "unknown"
  | "unsupported";

export interface FilePreviewMeta {
  sizeBytes?: number;
  previewedBytes?: number;
  previewedLineCount?: number;
  isLargeFile?: boolean;
  isTruncated?: boolean;
}

export interface FileInfo {
  name: string;
  path: string;
  content: string;
  type: PreviewType;
  previewMeta?: FilePreviewMeta;
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
  childrenLoaded?: boolean;
}

export interface FolderState {
  rootPath: string | null;
  tree: TreeNode[];
  selectedPath: string | null;
}

interface Store {
  file: FileInfo | null;
  tabs: FileInfo[];
  activeTabPath: string | null;
  closedTabs: FileInfo[];
  folder: FolderState;
  isDragging: boolean;
  theme: "dark" | "light";
  sidebarVisible: boolean;
  sidebarWidth: number;
  infoPanelVisible: boolean;
  setFile: (file: FileInfo | null, addToRecent?: boolean) => void;
  activateTab: (path: string) => void;
  closeTab: (path: string) => void;
  closeOtherTabs: (path: string) => void;
  closeAllTabs: () => void;
  reopenClosedTab: () => void;
  setFolder: (folder: FolderState, addToRecent?: boolean) => void;
  setFolderTree: (tree: TreeNode[]) => void;
  setNodeChildren: (path: string, children: TreeNode[]) => void;
  setIsDragging: (dragging: boolean) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setSelectedPath: (path: string | null) => void;
  toggleNodeExpanded: (path: string) => void;
  toggleInfoPanel: () => void;
}

const storedUiPreferences = getStoredUiPreferences();

function buildSessionSnapshot(
  tabs: FileInfo[],
  activeTabPath: string | null,
  folder: FolderState
): SessionSnapshot {
  return {
    rootPath: folder.rootPath,
    selectedPath: folder.selectedPath,
    filePath: activeTabPath,
    tabPaths: tabs.map((tab) => tab.path),
    activeTabPath,
  };
}

function persistSession(
  tabs: FileInfo[],
  activeTabPath: string | null,
  folder: FolderState
) {
  const snapshot = buildSessionSnapshot(tabs, activeTabPath, folder);
  saveCurrentSession(snapshot);

  if (snapshot.rootPath || snapshot.filePath) {
    saveLastSession(snapshot);
  }
}

function persistUiPreferences(state: {
  theme: "dark" | "light";
  sidebarVisible: boolean;
  sidebarWidth: number;
  infoPanelVisible: boolean;
}) {
  saveUiPreferences({
    theme: state.theme,
    sidebarVisible: state.sidebarVisible,
    sidebarWidth: state.sidebarWidth,
    infoPanelVisible: state.infoPanelVisible,
  });
}

export const useStore = create<Store>((set) => ({
  file: null,
  tabs: [],
  activeTabPath: null,
  closedTabs: [],
  folder: {
    rootPath: null,
    tree: [],
    selectedPath: null,
  },
  isDragging: false,
  theme: storedUiPreferences.theme,
  sidebarVisible: storedUiPreferences.sidebarVisible,
  sidebarWidth: storedUiPreferences.sidebarWidth,
  infoPanelVisible: storedUiPreferences.infoPanelVisible,
  setFile: (file, addToRecent = true) => {
    if (file && addToRecent) {
      addRecentItem(file.path, file.name, false);
    }
    set((state) => {
      if (!file) {
        persistSession([], null, state.folder);
        return { file: null, tabs: [], activeTabPath: null };
      }

      const existingIndex = state.tabs.findIndex((tab) => tab.path === file.path);
      const tabs = existingIndex === -1
        ? [...state.tabs, file]
        : state.tabs.map((tab, index) => index === existingIndex ? file : tab);
      const folder = { ...state.folder, selectedPath: file.path };

      persistSession(tabs, file.path, folder);
      return { file, tabs, activeTabPath: file.path, folder };
    });
  },
  activateTab: (path) =>
    set((state) => {
      const file = state.tabs.find((tab) => tab.path === path);
      if (!file) return state;

      const folder = { ...state.folder, selectedPath: file.path };
      persistSession(state.tabs, file.path, folder);
      return { file, activeTabPath: file.path, folder };
    }),
  closeTab: (path) =>
    set((state) => {
      const closedIndex = state.tabs.findIndex((tab) => tab.path === path);
      if (closedIndex === -1) return state;

      const closedTab = state.tabs[closedIndex];
      const tabs = state.tabs.filter((tab) => tab.path !== path);
      const closingActiveTab = state.activeTabPath === path;
      const nextActiveTab = closingActiveTab
        ? tabs[Math.min(closedIndex, tabs.length - 1)] ?? null
        : state.file;
      const activeTabPath = nextActiveTab?.path ?? null;
      const folder = closingActiveTab
        ? { ...state.folder, selectedPath: activeTabPath }
        : state.folder;

      persistSession(tabs, activeTabPath, folder);
      return {
        file: nextActiveTab,
        tabs,
        activeTabPath,
        closedTabs: [closedTab, ...state.closedTabs.filter((tab) => tab.path !== path)].slice(0, 10),
        folder,
      };
    }),
  closeOtherTabs: (path) =>
    set((state) => {
      const activeTab = state.tabs.find((tab) => tab.path === path);
      if (!activeTab) return state;

      const closedTabs = state.tabs.filter((tab) => tab.path !== path);
      const tabs = [activeTab];
      const folder = { ...state.folder, selectedPath: path };
      persistSession(tabs, path, folder);
      return {
        file: activeTab,
        tabs,
        activeTabPath: path,
        closedTabs: [...closedTabs.reverse(), ...state.closedTabs].slice(0, 10),
        folder,
      };
    }),
  closeAllTabs: () =>
    set((state) => {
      const folder = { ...state.folder, selectedPath: null };
      persistSession([], null, folder);
      return {
        file: null,
        tabs: [],
        activeTabPath: null,
        closedTabs: [...state.tabs].reverse().concat(state.closedTabs).slice(0, 10),
        folder,
      };
    }),
  reopenClosedTab: () =>
    set((state) => {
      const [tab, ...closedTabs] = state.closedTabs;
      if (!tab) return state;

      const tabs = state.tabs.some((openTab) => openTab.path === tab.path)
        ? state.tabs
        : [...state.tabs, tab];
      const folder = { ...state.folder, selectedPath: tab.path };
      persistSession(tabs, tab.path, folder);
      return { file: tab, tabs, activeTabPath: tab.path, closedTabs, folder };
    }),
  setFolder: (folder, addToRecent = true) => {
    if (folder.rootPath && addToRecent) {
      const name = folder.rootPath.split(/[/\\]/).pop() || folder.rootPath;
      addRecentItem(folder.rootPath, name, true);
    }
    set((state) => {
      persistSession(state.tabs, state.activeTabPath, folder);
      return { folder };
    });
  },
  setFolderTree: (tree) =>
    set((state) => ({
      folder: { ...state.folder, tree },
    })),
  setNodeChildren: (path, children) =>
    set((state) => {
      const updateTree = (nodes: TreeNode[]): TreeNode[] =>
        nodes.map((node) => {
          if (node.path === path) {
            return {
              ...node,
              children,
              childrenLoaded: true,
            };
          }

          if (node.children.length > 0) {
            return {
              ...node,
              children: updateTree(node.children),
            };
          }

          return node;
        });

      return {
        folder: {
          ...state.folder,
          tree: updateTree(state.folder.tree),
        },
      };
    }),
  setIsDragging: (isDragging) => set({ isDragging }),
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      const nextState = { ...state, theme: next };
      persistUiPreferences(nextState);
      return { theme: next };
    }),
  toggleSidebar: () =>
    set((state) => {
      const nextState = { ...state, sidebarVisible: !state.sidebarVisible };
      persistUiPreferences(nextState);
      return { sidebarVisible: nextState.sidebarVisible };
    }),
  setSidebarWidth: (width) =>
    set((state) => {
      const nextWidth = Math.max(180, Math.min(500, width));
      persistUiPreferences({ ...state, sidebarWidth: nextWidth });
      return { sidebarWidth: nextWidth };
    }),
  setSelectedPath: (path) =>
    set((state) => ({
      folder: (() => {
        const nextFolder = { ...state.folder, selectedPath: path };
        persistSession(state.tabs, state.activeTabPath, nextFolder);
        return nextFolder;
      })(),
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
    set((state) => {
      const nextState = { ...state, infoPanelVisible: !state.infoPanelVisible };
      persistUiPreferences(nextState);
      return { infoPanelVisible: nextState.infoPanelVisible };
    }),
}));
