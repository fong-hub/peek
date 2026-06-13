import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { prepareHtmlPreviewContent } from "../src/utils/htmlPreview.ts";

const host = "127.0.0.1";
const port = 38123;
const root = resolve("examples/html-preview-repro");
const htmlPath = resolve(root, "index.html");

const buildAssetUrl = (filePath) =>
  `http://${host}:${port}${encodeURI(filePath.replace(/\\/g, "/"))}`;

const preview = await prepareHtmlPreviewContent(
  await readFile(htmlPath, "utf8"),
  { filePath: htmlPath, rootPath: root },
  buildAssetUrl,
  (filePath) => readFile(filePath, "utf8")
);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${host}:${port}`);

  if (url.pathname === "/preview") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(preview);
    return;
  }

  const filePath = decodeURIComponent(url.pathname);

  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      "content-type":
        contentTypes[extname(filePath)] ?? "application/octet-stream",
      "access-control-allow-origin": "*",
    });
    res.end(data);
  } catch (error) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end(String(error));
  }
});

server.listen(port, host, () => {
  console.log(`preview server ready at http://${host}:${port}/preview`);
});
