// @vitest-environment happy-dom

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
  withHtmlNavigationSuffix,
  toHtmlAssetUrl,
} from "@/utils/htmlPreview";

const happyDomWindow = window as typeof window & {
  happyDOM: {
    settings: {
      disableCSSFileLoading: boolean;
      disableJavaScriptFileLoading: boolean;
      handleDisabledFileLoadingAsSuccess: boolean;
    };
  };
};
happyDomWindow.happyDOM.settings.disableCSSFileLoading = true;
happyDomWindow.happyDOM.settings.disableJavaScriptFileLoading = true;
happyDomWindow.happyDOM.settings.handleDisabledFileLoadingAsSuccess = true;

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
    expect(
      fromAssetUrl("asset://localhost/%2FUsers%2Ffong%2Fwork%2Findex.html")
    ).toBe("/Users/fong/work/index.html");
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

  it("does not rewrite script text or source viewport styles", () => {
    const processed = processHtmlContent(
      `<!doctype html>
      <html>
        <head>
          <meta name="viewport" content="width=720, initial-scale=2" />
          <style>.shell { min-height: 100vh; }</style>
        </head>
        <body>
          <script>
            const closingTag = "</body>";
            const markup = '<img src="./runtime.png">';
            window.__previewFixture = { closingTag, markup };
          </script>
        </body>
      </html>`,
      { filePath: "/workspace/index.html", rootPath: "/workspace" },
      buildAssetUrl
    );

    expect(processed).toContain('content="width=720, initial-scale=2"');
    expect(processed).toContain("min-height: 100vh");
    expect(processed).toContain('const closingTag = "</body>";');
    expect(processed).toContain(`const markup = '<img src="./runtime.png">';`);
    expect(processed.match(/data-peek-runtime="true"/g)).toHaveLength(1);
    expect(processed.indexOf("data-peek-runtime")).toBeLessThan(processed.indexOf("const closingTag"));
  });

  it("preserves query strings, fragments, srcset descriptors, and local base paths", () => {
    const processed = processHtmlContent(
      `<!doctype html>
      <html>
        <head><base href="./public/"></head>
        <body>
          <script src="app.js?v=4#boot"></script>
          <img srcset="small.png 1x, large.png 2x" />
        </body>
      </html>`,
      { filePath: "/workspace/index.html", rootPath: "/workspace" },
      buildAssetUrl
    );

    expect(processed).toContain('base href="http://asset.localhost/workspace/public/"');
    expect(processed).toContain(
      'src="http://asset.localhost/workspace/public/app.js?v=4#boot"'
    );
    expect(processed).toContain(
      'srcset="http://asset.localhost/workspace/public/small.png 1x, http://asset.localhost/workspace/public/large.png 2x"'
    );
  });

  it("inlines local stylesheets without losing their nested resource context", async () => {
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

    expect(processed).toContain('data-peek-inline-style="true"');
    expect(processed).toContain(
      `url("${buildAssetUrl(path.join(fixtureRoot, "assets/pattern.svg"))}")`
    );
    expect(processed).toContain(
      `@import "${buildAssetUrl(path.join(fixtureRoot, "assets/theme.css"))}"`
    );
    expect(processed).toContain(
      `src="${buildAssetUrl(path.join(fixtureRoot, "assets/app.js"))}"`
    );
    expect(processed).toContain(
      `<base href="${buildAssetUrl(htmlPath)}">`
    );
  });
});

describe("preview navigation URLs", () => {
  it("normalizes Tauri-encoded paths without introducing a second leading slash", () => {
    const path = "/Users/test/原型 #1/index.html";
    const url = toHtmlAssetUrl(path, path => `asset://localhost/${encodeURIComponent(path)}`);
    expect(url).toBe("asset://localhost/Users/test/%E5%8E%9F%E5%9E%8B%20%231/index.html");
    expect(fromAssetUrl(url)).toBe(path);
    expect(new URL("module.html", url).pathname).toBe("/Users/test/%E5%8E%9F%E5%9E%8B%20%231/module.html");
    const windows = toHtmlAssetUrl("C:/site/index.html", path => `http://asset.localhost/${encodeURIComponent(path)}`);
    expect(fromAssetUrl(windows)).toBe("C:/site/index.html");
  });
  it("keeps embedded-mode flags, bridge tokens, repeated parameters and routes", () => {
    expect(withHtmlNavigationSuffix("asset://localhost/cache/page.html?__peek_reload=new",
      "asset://localhost/site/module.html?gdmsEmbed=1&gdmsBridge=token&tag=a&tag=b&__peek_reload=old#detail"))
      .toBe("asset://localhost/cache/page.html?__peek_reload=new&gdmsEmbed=1&gdmsBridge=token&tag=a&tag=b#detail");
  });
  it("keeps fresh resource versions when source URLs already have a query", () => {
    const result = processHtmlContent('<script src="catalog.js?version=2#boot"></script>',
      { filePath: "/site/index.html" }, path => buildAssetUrl(path) + "?__peek_reload=new");
    expect(result).toContain('src="http://asset.localhost/site/catalog.js?__peek_reload=new&amp;version=2#boot"');
  });
});
