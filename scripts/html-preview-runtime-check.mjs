// Browser harness for the same preparation + nested-frame bridge used by HtmlPreviewer.
// Usage: node scripts/html-preview-runtime-check.mjs [path/to/index.html]
import http from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { Window } from "happy-dom";
import { createServer } from "vite";

const dom = new Window();
dom.happyDOM.settings.disableCSSFileLoading = true;
dom.happyDOM.settings.disableJavaScriptFileLoading = true;
globalThis.DOMParser = dom.DOMParser;
const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { prepareHtmlPreviewContent, withHtmlNavigationSuffix } = await vite.ssrLoadModule("/src/utils/htmlPreview.ts");
const { cacheLocalModuleGraph } = await vite.ssrLoadModule("/src/utils/htmlModules.ts");
const host = "127.0.0.1";
const port = 38123;
// localhost avoids triggering prototypes' optional 127.0.0.1-only development APIs.
const origin = `http://localhost:${port}`;
const htmlPath = await realpath(resolve(process.argv[2] || "examples/html-preview-repro/index.html"));
const root = dirname(htmlPath);
const previews = new Map();
const buildAssetUrl = path => `${origin}${path.split(sep).map(encodeURIComponent).join("/")}`;
async function readSource(path) {
  const actual = await realpath(path);
  if (actual !== root && !actual.startsWith(root + sep)) throw new Error("Outside preview root");
  return readFile(actual, "utf8");
}
async function prepare(url) {
  const source = new URL(url, origin);
  const path = decodeURIComponent(source.pathname);
  const generation = randomUUID();
  const assets = path => buildAssetUrl(path) + `?__peek_reload=${generation}`;
  const prepared = await prepareHtmlPreviewContent(await readSource(path),
    { filePath: path, rootPath: root }, assets, readSource,
    (entry, source) => cacheLocalModuleGraph(entry, { filePath: entry, rootPath: root }, readSource,
      async path => `/__peek_modules/${Buffer.from(path).toString("hex")}.js`,
      async (path, text) => { const output = `/__peek_modules/${Buffer.from(path).toString("hex")}.js`; previews.set(output, text); return output; },
      assets, source));
  const key = `/__peek_cache/${generation}.html`;
  previews.set(key, prepared);
  return withHtmlNavigationSuffix(`${origin}${key}`, source.href);
}
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png" };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", origin);
  try {
    res.setHeader("Cache-Control", "no-store");
    if (url.pathname === "/prepare") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ url: await prepare(url.searchParams.get("url")) }));
      return;
    }
    if (url.pathname === "/preview") {
      const initial = await prepare(buildAssetUrl(htmlPath));
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(`<!doctype html><html><body style="margin:0"><iframe id="preview" style="border:0;width:100vw;height:100vh" src="${initial}" sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"></iframe><script>
        window.previewErrors = [];
        window.addEventListener('message', async event => {
          const frame = document.getElementById('preview');
          if (event.source !== frame.contentWindow) return;
          const data = event.data;
          if (!['peek-navigate', 'peek-iframe-navigate'].includes(data?.type)) return;
          try {
            const response = await fetch('/prepare?url=' + encodeURIComponent(data.url));
            if (!response.ok) throw new Error(await response.text());
            const result = await response.json();
            if (data.type === 'peek-navigate') frame.src = result.url;
            else event.source.postMessage({type:'peek-iframe-content', frameId:data.frameId, url:result.url}, '*');
          } catch(error) { window.previewErrors.push(String(error)); }
        });
      </script></body></html>`);
      return;
    }
    const path = decodeURIComponent(url.pathname);
    const cached = previews.get(path);
    const actual = cached === undefined ? await realpath(path) : path;
    if (cached === undefined && actual !== root && !actual.startsWith(root + sep)) throw new Error("Outside preview root");
    const data = cached ?? await readFile(actual);
    res.setHeader("Content-Type", (types[extname(path)] ?? "application/octet-stream") + "; charset=utf-8");
    res.end(data);
  } catch (error) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end(String(error));
  }
});
server.listen(port, host, () => console.log(`preview server ready at ${origin}/preview`));
async function stop() { server.close(); await vite.close(); await dom.happyDOM.abort(); }
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
