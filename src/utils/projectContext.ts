export function getProjectContextPath(
  folderRootPath: string | null,
  filePath: string | null | undefined
): string | null {
  return folderRootPath || filePath || null;
}

export function getPathName(path: string | null): string {
  if (!path) return "当前目录";
  return path.split(/[/\\]/).filter(Boolean).at(-1) || path;
}
