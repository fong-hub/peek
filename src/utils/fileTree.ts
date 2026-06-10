import { readDir } from "@tauri-apps/plugin-fs";
import type { TreeNode } from "@/store/useStore";

const SUPPORTED_EXTENSIONS = new Set([
  "md", "mdx", "markdown",
  "json", "jsonc",
  "html", "htm",
  "log",
  "txt",
  "csv",
  "pdf",
  "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp",
  "js", "ts", "jsx", "tsx",
  "py", "rs", "go", "java", "c", "cpp", "h", "hpp", "cs", "rb", "php", "swift", "kt",
  "sh", "bash", "zsh",
  "yaml", "yml", "xml", "sql",
  "css", "scss", "sass", "less",
  "vue", "svelte",
  "dockerfile",
]);

export function isSupportedFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return SUPPORTED_EXTENSIONS.has(ext);
}

export function joinPath(dir: string, name: string): string {
  const cleanDir = dir.replace(/[/\\]$/, "");
  if (/^[A-Za-z]:$/.test(cleanDir)) {
    return cleanDir + "\\" + name;
  }

  const separator = dir.includes("\\") ? "\\" : "/";
  return cleanDir + separator + name;
}

function sortTreeNodes(nodes: TreeNode[]): TreeNode[] {
  return nodes.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

export function getRelativePathSegments(
  rootPath: string,
  targetPath: string
): string[] {
  const normalizedRoot = normalizePath(rootPath);
  const normalizedTarget = normalizePath(targetPath);

  if (normalizedTarget === normalizedRoot) {
    return [];
  }

  if (!normalizedTarget.startsWith(`${normalizedRoot}/`)) {
    return [];
  }

  return normalizedTarget
    .slice(normalizedRoot.length + 1)
    .split("/")
    .filter(Boolean);
}

export async function listDirectoryNodes(dirPath: string): Promise<TreeNode[]> {
  const entries = await readDir(dirPath);
  const nodes: TreeNode[] = [];

  for (const entry of entries) {
    const fullPath = joinPath(dirPath, entry.name);

    if (entry.isDirectory) {
      nodes.push({
        name: entry.name,
        path: fullPath,
        isDirectory: true,
        children: [],
        expanded: false,
        childrenLoaded: false,
      });
      continue;
    }

    if (!isSupportedFile(entry.name)) {
      continue;
    }

    nodes.push({
      name: entry.name,
      path: fullPath,
      isDirectory: false,
      children: [],
    });
  }

  return sortTreeNodes(nodes);
}

async function expandTreeAlongPath(
  nodes: TreeNode[],
  currentDir: string,
  segments: string[]
): Promise<TreeNode[]> {
  if (segments.length === 0) {
    return nodes;
  }

  const [nextSegment, ...restSegments] = segments;
  const nextPath = joinPath(currentDir, nextSegment);

  return Promise.all(
    nodes.map(async (node) => {
      if (node.path !== nextPath || !node.isDirectory) {
        return node;
      }

      const children = node.childrenLoaded
        ? node.children
        : await listDirectoryNodes(node.path);
      const expandedChildren = await expandTreeAlongPath(
        children,
        node.path,
        restSegments
      );

      return {
        ...node,
        expanded: true,
        childrenLoaded: true,
        children: expandedChildren,
      };
    })
  );
}

export async function hydrateTreeForPath(
  rootPath: string,
  nodes: TreeNode[],
  targetPath: string
): Promise<TreeNode[]> {
  const segments = getRelativePathSegments(rootPath, targetPath);
  if (segments.length <= 1) {
    return nodes;
  }

  return expandTreeAlongPath(nodes, rootPath, segments.slice(0, -1));
}
