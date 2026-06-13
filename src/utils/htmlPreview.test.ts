import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  fromAssetUrl,
  fromFileUrl,
  prepareHtmlPreviewContent,
  processHtmlContent,
  resolveHtmlUrlToPath,
  toFileUrl,
} from "@/utils/htmlPreview";

const buildAssetUrl = (filePath: string) =>
  `http://asset.localhost${encodeURI(filePath.replace(/\\/g, "/"))}`;

const fixtureRoot = path.resolve(
  process.cwd(),
  "examples/html-preview-repro"
);

describe("htmlPreview utils", () => {
  it("resolves relative and root-relative paths against current html context", () => {
    const context = {
      filePath: "/Users/fong/work/code/peek/site/pages/index.html",
      rootPath: "/Users/fong/work/code/peek/site",
    };

    expect(resolveHtmlUrlToPath("./app.css", context)).toBe(
      "/Users/fong/work/code/peek/site/pages/app.css"
    );
    expect(resolveHtmlUrlToPath("../shared.js", context)).toBe(
      "/Users/fong/work/code/peek/site/shared.js"
    );
    expect(resolveHtmlUrlToPath("/assets/app.js", context)).toBe(
      "/Users/fong/work/code/peek/site/assets/app.js"
    );
  });

  it("round-trips file and asset urls", () => {
    const filePath = "/Users/fong/work/code/peek/examples/index.html";

    expect(fromFileUrl(toFileUrl(filePath))).toBe(filePath);
    expect(fromAssetUrl(buildAssetUrl(filePath))).toBe(filePath);
  });

  it("rewrites local resource urls but preserves anchor navigation urls", () => {
    const processed = processHtmlContent(
      `
      <html>
        <head>
          <link rel="stylesheet" href="/assets/app.css" />
          <style>.hero{background-image:url('./banner.png')}</style>
        </head>
        <body style="background-image:url('/assets/bg.png')">
          <a href="/docs/getting-started.html">Docs</a>
          <img src="./cover.png" />
          <script type="module" src="/assets/app.js"></script>
        </body>
      </html>
      `,
      {
        filePath: "/Users/fong/work/code/peek/site/pages/index.html",
        rootPath: "/Users/fong/work/code/peek/site",
      },
      buildAssetUrl
    );

    expect(processed).toContain(
      'href="http://asset.localhost/Users/fong/work/code/peek/site/assets/app.css"'
    );
    expect(processed).toContain(
      'src="http://asset.localhost/Users/fong/work/code/peek/site/pages/cover.png"'
    );
    expect(processed).toContain(
      "background-image:url('http://asset.localhost/Users/fong/work/code/peek/site/pages/banner.png')"
    );
    expect(processed).toContain(
      'background-image:url(\'http://asset.localhost/Users/fong/work/code/peek/site/assets/bg.png\')'
    );
    expect(processed).toContain(
      'href="/docs/getting-started.html"'
    );
    expect(processed).toContain(
      '<base href="http://asset.localhost/Users/fong/work/code/peek/site/pages/index.html">'
    );
  });

  it("inlines local stylesheet files and rewrites nested css asset urls", async () => {
    const htmlPath = path.join(fixtureRoot, "index.html");
    const processed = await prepareHtmlPreviewContent(
      await readFile(htmlPath, "utf8"),
      {
        filePath: htmlPath,
        rootPath: fixtureRoot,
      },
      buildAssetUrl,
      (filePath) => readFile(filePath, "utf8")
    );

    expect(processed).not.toContain('<link rel="stylesheet" href="./assets/style.css"');
    expect(processed).toContain('data-peek-inline-style="true"');
    expect(processed).toContain(
      'url("http://asset.localhost/Users/fong/work/code/peek/examples/html-preview-repro/assets/pattern.svg")'
    );
    expect(processed).toContain(
      '@import "http://asset.localhost/Users/fong/work/code/peek/examples/html-preview-repro/assets/theme.css"'
    );
    expect(processed).toContain(
      'src="http://asset.localhost/Users/fong/work/code/peek/examples/html-preview-repro/assets/app.js"'
    );
    expect(processed).toContain(
      '<base href="http://asset.localhost/Users/fong/work/code/peek/examples/html-preview-repro/index.html">'
    );
  });
});
