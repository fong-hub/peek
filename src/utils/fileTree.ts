import { readDir } from "@tauri-apps/plugin-fs";
import type { TreeNode } from "@/store/useStore";

const SUPPORTED_EXTENSIONS = new Set([
  "md", "mdx", "markdown",
  "json", "jsonc",
  "html", "htm",
  "log",
  "txt",
  "js", "ts", "jsx", "tsx",
  "py", "rs", "go", "java", "c", "cpp", "h", "hpp", "cs", "rb", "php", "swift", "kt",
  "sh", "bash", "zsh",
  "yaml", "yml", "xml", "sql",
  "css", "scss", "sass", "less",
  "vue", "svelte",
  "dockerfile",
]);

function isSupportedFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return SUPPORTED_EXTENSIONS.has(ext);
}

// Normalize path to handle both Windows and Unix paths
function joinPath(dir: string, name: string): string {
  // Remove trailing slashes from directory path
  const cleanDir = dir.replace(/[/\\]$/, "");
  // Check if directory already ends with a drive letter (Windows)
  if (/^[A-Za-z]:$/.test(cleanDir)) {
    return cleanDir + "\\" + name;
  }
  // Use the same separator as the input directory
  const separator = dir.includes("\\") ? "\\" : "/";
  return cleanDir + separator + name;
}

export async function buildFileTree(dirPath: string): Promise<TreeNode[]> {
  try {
    const entries = await readDir(dirPath);
    const nodes: TreeNode[] = [];

    for (const entry of entries) {
      const fullPath = joinPath(dirPath, entry.name);
      if (entry.isDirectory) {
        try {
          const children = await buildFileTree(fullPath);
          // Only include directories that contain supported files (recursively)
          const hasSupportedFiles = (children: TreeNode[]): boolean =>
            children.some((c) => !c.isDirectory || hasSupportedFiles(c.children));
          if (hasSupportedFiles(children)) {
            nodes.push({
              name: entry.name,
              path: fullPath,
              isDirectory: true,
              children,
              expanded: false,
            });
          }
        } catch (err) {
          // Skip directories we can't access (permission denied, etc.)
          console.warn(`Cannot access directory ${fullPath}:`, err);
        }
      } else if (isSupportedFile(entry.name)) {
        nodes.push({
          name: entry.name,
          path: fullPath,
          isDirectory: false,
          children: [],
        });
      }
    }

    // Sort: directories first, then files, both alphabetically
    nodes.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return nodes;
  } catch (err) {
    console.error(`Failed to build file tree for ${dirPath}:`, err);
    throw err;
  }
}
