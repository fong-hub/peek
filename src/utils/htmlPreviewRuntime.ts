/** Runs inside the preview, before any author scripts. Keep this function self-contained. */
export function installHtmlPreviewRuntime(config: {
  sourceUrl: string;
  resourceBaseUrl: string;
  rootUrl?: string;
}) {
  const sourceUrl = new URL(config.sourceUrl);
  const documentDirectory = new URL(".", location.href);
  const sourceDirectory = new URL(".", sourceUrl);
  const pending = new Map<string, { frame: HTMLIFrameElement; url: string }>();
  const loaded = new WeakMap<HTMLIFrameElement, string>();
  const relays = new Map<string, { target: Window; frameId: string }>();
  let sequence = 0;
  const namespace = Math.random().toString(36).slice(2);
  const nextId = () => `peek-${namespace}-${++sequence}`;
  const nativeSetAttribute = Element.prototype.setAttribute;
  const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "src")!;

  // Fragment-only history updates must keep the live preview URL and its query.
  // Otherwise <base href=source> silently drops embed tokens and changes directories.
  for (const method of ["pushState", "replaceState"] as const) {
    const native = history[method];
    history[method] = function (data: unknown, unused: string, url?: string | URL | null) {
      const target = typeof url === "string" && url.startsWith("#")
        ? new URL(url, location.href).href : url;
      return native.call(this, data, unused, target);
    };
  }

  function localUrl(raw: string): string | null {
    if (!raw || /^(?:#|data:|blob:|about:|javascript:|mailto:|tel:|\/\/)/i.test(raw)) return null;
    try {
      const url = raw.startsWith("/") && config.rootUrl
        ? new URL(raw.slice(1), config.rootUrl)
        : new URL(raw, config.resourceBaseUrl);
      const local = url.protocol === "file:" || url.protocol === "asset:" ||
        url.hostname === "asset.localhost" ||
        (url.protocol === sourceUrl.protocol && url.host === sourceUrl.host);
      if (!local) return null;
      // Pages commonly construct frame URLs with new URL(entry, location.href).
      // The preview document lives in cache; map that directory back to its source.
      if (url.protocol === documentDirectory.protocol && url.host === documentDirectory.host &&
          url.pathname.startsWith(documentDirectory.pathname)) {
        return new URL(url.pathname.slice(documentDirectory.pathname.length) + url.search + url.hash,
          sourceDirectory).href;
      }
      return url.href;
    } catch {
      return null;
    }
  }

  function requestFrame(frame: HTMLIFrameElement, raw: string): boolean {
    // A newer src wins even when the older read finishes later.
    for (const [id, item] of pending) if (item.frame === frame) pending.delete(id);
    const url = localUrl(raw);
    if (!url) return false;
    const frameId = nextId();
    pending.set(frameId, { frame, url });
    loaded.delete(frame);
    frame.removeAttribute("src");
    window.parent.postMessage({ type: "peek-iframe-navigate", frameId, url }, "*");
    return true;
  }

  Object.defineProperty(HTMLIFrameElement.prototype, "src", {
    ...srcDescriptor,
    set(value: string) {
      if (!requestFrame(this, String(value))) srcDescriptor.set!.call(this, value);
    },
  });
  HTMLIFrameElement.prototype.setAttribute = function (name: string, value: string) {
    if (name.toLowerCase() === "src" && requestFrame(this, String(value))) return;
    nativeSetAttribute.call(this, name, value);
  };

  function inspect(node: Node) {
    if (!(node instanceof Element)) return;
    const frames = node instanceof HTMLIFrameElement ? [node] : Array.from(node.querySelectorAll("iframe"));
    for (const frame of frames) {
      const raw = frame.getAttribute("src");
      if (raw && raw !== loaded.get(frame)) requestFrame(frame, raw);
    }
  }
  // Handles parser-created frames as well as innerHTML; property writes are intercepted synchronously above.
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "attributes") inspect(record.target);
      for (const node of record.addedNodes) inspect(node);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });

  window.addEventListener("message", event => {
    const data = event.data;
    if (!data || typeof data !== "object") return;
    if (event.source === window.parent && data.type === "peek-iframe-content") {
      const relay = relays.get(data.frameId);
      if (relay) {
        relays.delete(data.frameId);
        relay.target.postMessage({ ...data, frameId: relay.frameId }, "*");
        return;
      }
      const item = pending.get(data.frameId);
      if (!item || typeof data.url !== "string") return;
      pending.delete(data.frameId);
      loaded.set(item.frame, data.url);
      nativeSetAttribute.call(item.frame, "src", data.url);
      return;
    }
    const child = Array.from(document.querySelectorAll("iframe")).find(frame => frame.contentWindow === event.source);
    if (!child?.contentWindow) return;
    if (data.type === "peek-iframe-navigate" && typeof data.url === "string") {
      const frameId = nextId();
      relays.set(frameId, { target: child.contentWindow, frameId: data.frameId });
      window.parent.postMessage({ ...data, frameId }, "*");
    } else if (data.type === "peek-navigate" && typeof data.url === "string") {
      window.parent.postMessage(data, "*");
    }
  });

  // Run after author handlers on the document. Hash routing belongs to the page;
  // assigning location.hash avoids the injected <base> navigating out of the preview.
  window.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target.closest("a") : null;
    if (!target || target.hasAttribute("download") || (target.target && target.target !== "_self")) return;
    const raw = target.getAttribute("href");
    if (!raw) return;
    if (raw.startsWith("#")) {
      event.preventDefault();
      location.hash = raw;
      return;
    }
    const url = localUrl(raw);
    if (url) {
      event.preventDefault();
      window.parent.postMessage({ type: "peek-navigate", url }, "*");
    }
  });

  window.addEventListener("submit", event => {
    if (event.defaultPrevented || !(event.target instanceof HTMLFormElement)) return;
    const form = event.target;
    const url = localUrl(form.getAttribute("action") || form.action);
    if (url) {
      event.preventDefault();
      window.parent.postMessage({ type: "peek-navigate", url }, "*");
    }
  });
}
