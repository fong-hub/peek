import { Window } from "happy-dom";
import { afterEach, describe, expect, it } from "vitest";
import { installHtmlPreviewRuntime } from "./htmlPreviewRuntime";

const windows: Window[] = [];
function setup() {
  const page = new Window({ url: "http://asset.localhost/cache/page.html?__peek_reload=1" });
  windows.push(page);
  page.happyDOM.settings.disableIframePageLoading = true;
  page.document.head.innerHTML = '<base href="http://asset.localhost/site/index.html">';
  const messages: Record<string, string>[] = [];
  const parent = { postMessage: (data: Record<string, string>) => messages.push(data) };
  Object.defineProperty(page, "parent", { value: parent });
  page.eval(`(${installHtmlPreviewRuntime.toString()})(${JSON.stringify({
    sourceUrl: "http://asset.localhost/site/index.html",
    resourceBaseUrl: "http://asset.localhost/site/index.html",
  })})`);
  function reply(frameId: string, url: string) {
    page.dispatchEvent(new page.MessageEvent("message", {
      source: parent as never, data: { type: "peek-iframe-content", frameId, url },
    }));
  }
  return { page, messages, reply };
}

afterEach(async () => { await Promise.all(windows.splice(0).map(page => page.happyDOM.abort())); });

describe("HTML preview runtime", () => {
  it("keeps hash routing in the current preview despite a source base URL", () => {
    const { page, messages } = setup();
    page.document.body.innerHTML = '<a href="#/inventory">Inventory</a>';
    let authorHandled = false;
    page.document.addEventListener("click", () => { authorHandled = true; });
    page.document.querySelector("a")!.click();
    expect(page.location.pathname).toBe("/cache/page.html");
    expect(page.location.hash).toBe("#/inventory");
    expect(authorHandled).toBe(true);
    expect(messages).toEqual([]);
  });

  it("preserves embed parameters during fragment-only History API updates", () => {
    const { page } = setup();
    page.history.replaceState(null, "", "http://asset.localhost/cache/page.html?gdmsEmbed=1&gdmsBridge=token");
    page.history.pushState({ step: 1 }, "", "#list");
    expect(page.location.href).toBe("http://asset.localhost/cache/page.html?gdmsEmbed=1&gdmsBridge=token#list");
    page.history.replaceState({ step: 2 }, "", "#detail");
    expect(page.location.search).toBe("?gdmsEmbed=1&gdmsBridge=token");
    expect(page.history.state).toEqual({ step: 2 });
  });

  it("respects author cancellation and forwards cross-file query and hash", () => {
    const { page, messages } = setup();
    page.document.body.innerHTML = '<a href="module.html?embed=1#detail">Module</a>';
    const anchor = page.document.querySelector("a")!;
    anchor.addEventListener("click", e => e.preventDefault(), { once: true });
    anchor.click();
    expect(messages).toHaveLength(0);
    anchor.click();
    expect(messages).toEqual([{ type: "peek-navigate", url: "http://asset.localhost/site/module.html?embed=1#detail" }]);
  });

  it("rebases dynamically constructed frame URLs before a navigation starts", () => {
    const { page, messages, reply } = setup();
    const frame = page.document.createElement("iframe");
    frame.src = new URL("modules/inventory/index.html?gdmsEmbed=1&gdmsBridge=token#list", page.location.href).href;
    page.document.body.append(frame);
    expect(frame.getAttribute("src")).toBeNull();
    expect(messages[0].url).toBe("http://asset.localhost/site/modules/inventory/index.html?gdmsEmbed=1&gdmsBridge=token#list");
    reply(messages[0].frameId, "http://asset.localhost/cache/module.html?gdmsEmbed=1&gdmsBridge=token#list");
    expect(frame.src).toContain("?gdmsEmbed=1&gdmsBridge=token#list");
  });

  it("ignores stale replies after src is changed, including external navigation", () => {
    const { page, messages, reply } = setup();
    const frame = page.document.createElement("iframe");
    frame.src = "first.html";
    frame.setAttribute("src", "second.html");
    reply(messages[0].frameId, "http://asset.localhost/cache/first.html");
    expect(frame.getAttribute("src")).toBeNull();
    frame.src = "https://example.com/";
    reply(messages[1].frameId, "http://asset.localhost/cache/second.html");
    expect(frame.src).toBe("https://example.com/");
  });

  it("intercepts parser/innerHTML frames and preserves their authored URL", async () => {
    const { page, messages } = setup();
    page.document.body.innerHTML = '<iframe src="module.html?embed=1#home"></iframe>';
    await page.happyDOM.whenAsyncComplete();
    expect(messages).toHaveLength(1);
    expect(messages[0].url).toBe("http://asset.localhost/site/module.html?embed=1#home");
  });
});
