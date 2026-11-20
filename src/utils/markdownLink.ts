// The WebView URL identifies Peek, so resolve hrefs against the source document.
export function resolveMarkdownLink(href: string, sourcePath: string) {
  if (!href || /^[a-z][\w+.-]*:|^[/\\]{2}/i.test(href)) return null;

  const windows = /^(?:[a-z]:\\|\\\\)/i.test(sourcePath);
  const base = new URL("file:///");
  base.pathname = (windows ? sourcePath.replace(/\\/g, "/") : sourcePath)
    .replace(/[%?#]/g, encodeURIComponent);
  const target = new URL(href, base);
  if (target.protocol !== "file:" || target.host !== base.host) return null;
  let path = decodeURIComponent(target.pathname).replace(/^\/([A-Za-z]:\/)/, "$1");
  if (windows) path = path.replace(/\//g, "\\");
  return { path, fragment: decodeURIComponent(target.hash.slice(1)) };
}
