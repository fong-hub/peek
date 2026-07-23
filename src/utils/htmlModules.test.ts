import { describe, expect, it } from "vitest";
import { cacheLocalModuleGraph } from "@/utils/htmlModules";

describe("HTML module graph cache", () => {
  it("rewrites nested and cyclic module imports to stable cache URLs", async () => {
    const sources = new Map([
      ["/site/app.js", 'import { mount } from "./module.js"; mount();'],
      ["/site/module.js", 'import "./app.js"; export const mount = () => true;'],
    ]);
    const written = new Map<string, string>();

    const entryUrl = await cacheLocalModuleGraph(
      "/site/app.js",
      { filePath: "/site/index.html", rootPath: "/site" },
      async (path) => {
        const source = sources.get(path);
        if (!source) throw new Error(`Missing fixture ${path}`);
        return source;
      },
      async (path) => `/cache/${path.endsWith("app.js") ? "app" : "module"}.js`,
      async (path, content) => {
        written.set(path, content);
        return path;
      },
      (path) => `asset://localhost${path}`
    );

    expect(entryUrl).toMatch(/^asset:\/\/localhost\/cache\/app\.js\?v=/);
    expect(written.get("/site/app.js")).toMatch(
      /from "asset:\/\/localhost\/cache\/module\.js\?v=/
    );
    expect(written.get("/site/module.js")).toMatch(
      /import "asset:\/\/localhost\/cache\/app\.js\?v=/
    );
  });

  it("uses supplied source for an inline module entry", async () => {
    const written = new Map<string, string>();

    await cacheLocalModuleGraph(
      "/site/index.html#inline-0",
      { filePath: "/site/index.html", rootPath: "/site" },
      async (path) => {
        if (path === "/site/helper.js") return "export const ready = true;";
        throw new Error(`Unexpected read ${path}`);
      },
      async (path) => `/cache/${path.includes("inline") ? "inline" : "helper"}.js`,
      async (path, content) => {
        written.set(path, content);
        return path;
      },
      (path) => `asset://localhost${path}`,
      'import { ready } from "./helper.js"; window.ready = ready;'
    );

    expect(written.get("/site/index.html#inline-0")).toContain(
      'from "asset://localhost/cache/helper.js?v='
    );
  });
});
