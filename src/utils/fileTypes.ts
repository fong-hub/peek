import type { PreviewType } from "@/store/useStore";

const extensionMap: Record<string, PreviewType> = {
  // Markdown
  md: "markdown",
  mdx: "markdown",
  markdown: "markdown",
  // JSON
  json: "json",
  jsonc: "json",
  // HTML
  html: "html",
  htm: "html",
  // Log
  log: "log",
};

export function detectFileType(fileName: string): PreviewType {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return extensionMap[ext] || "text";
}

export function getLanguageFromFileName(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const langMap: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    jsx: "jsx",
    tsx: "tsx",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    rb: "ruby",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    sql: "sql",
    dockerfile: "dockerfile",
    vue: "vue",
    svelte: "svelte",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",
    html: "html",
    json: "json",
    md: "markdown",
    log: "log",
  };
  return langMap[ext] || "text";
}
