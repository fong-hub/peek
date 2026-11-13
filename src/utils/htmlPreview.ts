import { installHtmlPreviewRuntime } from "./htmlPreviewRuntime";

export interface HtmlPreviewContext {
  filePath?: string | null;
  rootPath?: string | null;
}

export type AssetUrlBuilder = (filePath: string) => string;
export type HtmlFileReader = (filePath: string) => Promise<string>;
export type HtmlModulePreparer = (
  filePath: string,
  source?: string
) => Promise<string>;

const URL_WITH_SCHEME_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;
const EXTERNAL_SCHEME_RE =
  /^(?:https?:|data:|javascript:|mailto:|tel:|blob:|about:)/i;

function extractDirectoryPath(path: string): string {
  return path.replace(/[/\\][^/\\]*$/, "");
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

function ensureTrailingSlash(path: string): string {
  return /[/\\]$/.test(path) ? path : `${path}/`;
}

function decodeUrlPath(pathname: string): string {
  const normalizedPath = decodeURIComponent(pathname);

  if (/^\/%2f/i.test(pathname) && normalizedPath.startsWith("//")) {
    return normalizedPath.slice(1);
  }

  if (/^\/[A-Za-z]:\//.test(normalizedPath)) {
    return normalizedPath.slice(1);
  }

  return normalizedPath;
}

function isAssetUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "asset:" ||
      parsed.hostname === "asset.localhost"
    );
  } catch {
    return false;
  }
}

export function getEffectiveRootPath({
  filePath,
  rootPath,
}: HtmlPreviewContext): string | null {
  if (!filePath) {
    return rootPath ?? null;
  }

  if (!rootPath) {
    return extractDirectoryPath(filePath);
  }

  const normalizedFilePath = normalizePath(filePath);
  const normalizedRootPath = normalizePath(rootPath);

  if (
    normalizedFilePath === normalizedRootPath ||
    normalizedFilePath.startsWith(`${normalizedRootPath}/`)
  ) {
    return rootPath;
  }

  return extractDirectoryPath(filePath);
}

export function toFileUrl(path: string): string {
  const normalizedPath = path.replace(/\\/g, "/");
  const prefix = normalizedPath.startsWith("/") ? "file://" : "file:///";

  return prefix + encodeURI(normalizedPath);
}

export function fromFileUrl(url: string): string {
  const parsed = new URL(url);
  return decodeUrlPath(parsed.pathname);
}

export function fromAssetUrl(url: string): string | null {
  if (!isAssetUrl(url)) {
    return null;
  }

  const parsed = new URL(url);
  return decodeUrlPath(parsed.pathname);
}

export function resolveHtmlUrlToPath(
  rawUrl: string,
  context: HtmlPreviewContext
): string | null {
  const sanitizedUrl = rawUrl.split("#")[0].split("?")[0].trim();
  if (!sanitizedUrl) {
    return null;
  }

  if (sanitizedUrl.startsWith("file://")) {
    return fromFileUrl(sanitizedUrl);
  }

  const assetPath = fromAssetUrl(sanitizedUrl);
  if (assetPath) {
    return assetPath;
  }

  if (
    sanitizedUrl.startsWith("#") ||
    sanitizedUrl.startsWith("//") ||
    EXTERNAL_SCHEME_RE.test(sanitizedUrl)
  ) {
    return null;
  }

  if (URL_WITH_SCHEME_RE.test(sanitizedUrl) || !context.filePath) {
    return null;
  }

  const currentDir = extractDirectoryPath(context.filePath);

  if (sanitizedUrl.startsWith("/")) {
    const rootPath = getEffectiveRootPath(context) ?? currentDir;
    return fromFileUrl(
      new URL(
        sanitizedUrl.replace(/^\/+/, ""),
        toFileUrl(ensureTrailingSlash(rootPath))
      ).toString()
    );
  }

  return fromFileUrl(
    new URL(sanitizedUrl, toFileUrl(ensureTrailingSlash(currentDir))).toString()
  );
}

export function resolveHtmlResourceUrl(
  rawUrl: string,
  context: HtmlPreviewContext,
  buildAssetUrl: AssetUrlBuilder
): string {
  const localPath = resolveHtmlUrlToPath(rawUrl, context);
  if (!localPath) {
    return rawUrl;
  }

  const suffixMatch = rawUrl.trim().match(/(?:\?[^#]*)?(?:#.*)?$/);
  const result = new URL(buildAssetUrl(localPath));
  const suffix = new URL(suffixMatch?.[0] || "", "https://peek.invalid/");
  suffix.searchParams.forEach((value, key) => {
    if (key !== "__peek_reload") result.searchParams.append(key, value);
  });
  result.hash = suffix.hash;
  return result.href;
}

/** Preserve directory separators while retaining escaping for filename characters. */
export function toHtmlAssetUrl(filePath: string, buildAssetUrl: AssetUrlBuilder): string {
  const url = new URL(buildAssetUrl(filePath));
  url.pathname = filePath.replace(/\\/g, "/").split("/").map(encodeURIComponent).join("/");
  return url.href;
}

export function withHtmlNavigationSuffix(previewUrl: string, sourceUrl: string): string {
  const source = new URL(sourceUrl, "https://peek.invalid/");
  const preview = new URL(previewUrl);
  // Retain the preview cache generation as well as the author's query parameters.
  source.searchParams.forEach((value, key) => {
    if (key !== "__peek_reload") preview.searchParams.append(key, value);
  });
  preview.hash = source.hash;
  return preview.href;
}

export function rewriteCssUrls(
  cssText: string,
  context: HtmlPreviewContext,
  buildAssetUrl: AssetUrlBuilder
): string {
  let rewritten = cssText.replace(
    /url\(\s*(['"]?)([^)"']+)\1\s*\)/gi,
    (match, quote: string, value: string) => {
      if (!value || value.startsWith("#")) {
        return match;
      }

      const nextValue = resolveHtmlResourceUrl(value, context, buildAssetUrl);
      return `url(${quote}${nextValue}${quote})`;
    }
  );

  rewritten = rewritten.replace(
    /@import\s+(['"])([^"']+)\1/gi,
    (_match, quote: string, value: string) => {
      const nextValue = resolveHtmlResourceUrl(value, context, buildAssetUrl);
      return `@import ${quote}${nextValue}${quote}`;
    }
  );

  return rewritten;
}

function rewriteElementAttribute(
  element: Element,
  name: string,
  rewrite: (value: string) => string
) {
  const value = element.getAttribute(name);
  if (value !== null) {
    element.setAttribute(name, rewrite(value));
  }
}

function getBaseResourceContext(
  baseHref: string | null,
  context: HtmlPreviewContext
): HtmlPreviewContext | null {
  if (!baseHref) return context;

  const basePath = resolveHtmlUrlToPath(baseHref, context);
  if (!basePath) return null;

  const pathWithoutSuffix = baseHref.split("#")[0].split("?")[0];
  return {
    ...context,
    filePath: /[/\\]$/.test(pathWithoutSuffix)
      ? `${ensureTrailingSlash(basePath)}__peek_base__.html`
      : basePath,
  };
}

function rewriteSrcset(
  value: string,
  context: HtmlPreviewContext,
  buildAssetUrl: AssetUrlBuilder
): string {
  if (/^\s*data:/i.test(value)) return value;

  return value
    .split(",")
    .map((candidate) => {
      const match = candidate.trim().match(/^(\S+)([\s\S]*)$/);
      if (!match) return candidate;
      return resolveHtmlResourceUrl(match[1], context, buildAssetUrl) + match[2];
    })
    .join(", ");
}

function collectElements(root: ParentNode): Element[] {
  const elements = Array.from(root.querySelectorAll("*"));
  for (const element of [...elements]) {
    if (element.tagName.toLowerCase() === "template") {
      elements.push(...collectElements((element as HTMLTemplateElement).content));
    }
  }
  return elements;
}

function prependRuntime(document: Document, context: HtmlPreviewContext, resourceContext: HtmlPreviewContext | null, buildAssetUrl: AssetUrlBuilder) {
  if (!context.filePath) return;
  const script = document.createElement("script");
  script.dataset.peekRuntime = "true";
  const config = JSON.stringify({
    sourceUrl: buildAssetUrl(context.filePath),
    rootUrl: buildAssetUrl(ensureTrailingSlash(getEffectiveRootPath(context) ?? extractDirectoryPath(context.filePath))),
    resourceBaseUrl: resourceContext?.filePath
      ? buildAssetUrl(resourceContext.filePath)
      : document.querySelector("base")?.href ?? buildAssetUrl(context.filePath),
  }).replace(/</g, "\\u003c");
  script.textContent = `(${installHtmlPreviewRuntime.toString()})(${config});`;
  document.head.prepend(script);
}

function serializeHtmlDocument(document: Document): string {
  const doctype = document.doctype;
  let serializedDoctype = "";

  if (doctype) {
    const publicId = doctype.publicId ? ` PUBLIC "${doctype.publicId}"` : "";
    const systemId = doctype.systemId
      ? `${doctype.publicId ? "" : " SYSTEM"} "${doctype.systemId}"`
      : "";
    serializedDoctype = `<!DOCTYPE ${doctype.name}${publicId}${systemId}>`;
  }

  return serializedDoctype + document.documentElement.outerHTML;
}

async function inlineLocalStylesheets(
  content: string,
  context: HtmlPreviewContext,
  buildAssetUrl: AssetUrlBuilder,
  readFile: HtmlFileReader
): Promise<string> {
  const document = new DOMParser().parseFromString(content, "text/html");
  const elements = collectElements(document);
  const baseElement = elements.find((element) => element.tagName.toLowerCase() === "base");
  const resourceContext = getBaseResourceContext(
    baseElement?.getAttribute("href") ?? null,
    context
  );

  if (!resourceContext) return content;

  const stylesheetLinks = elements.filter((element) => {
    if (element.tagName.toLowerCase() !== "link") return false;
    return (element.getAttribute("rel") ?? "")
      .split(/\s+/)
      .some((rel) => rel.toLowerCase() === "stylesheet");
  });

  for (const link of stylesheetLinks) {
    const href = link.getAttribute("href");
    const cssPath = href ? resolveHtmlUrlToPath(href, resourceContext) : null;
    if (!cssPath) continue;

    try {
      const css = await readFile(cssPath);
      const style = document.createElement("style");
      for (const attribute of Array.from(link.attributes)) {
        if (!["href", "rel", "integrity", "crossorigin", "referrerpolicy"].includes(attribute.name)) {
          style.setAttribute(attribute.name, attribute.value);
        }
      }
      style.dataset.peekInlineStyle = "true";
      style.dataset.peekSource = cssPath;
      style.textContent = rewriteCssUrls(
        css,
        {
          filePath: cssPath,
          rootPath: getEffectiveRootPath(context),
        },
        buildAssetUrl
      );
      link.replaceWith(style);
    } catch {
      // Leave the original link intact so the WebView can still attempt to load it.
    }
  }

  return serializeHtmlDocument(document);
}

async function prepareLocalModuleScripts(
  content: string,
  context: HtmlPreviewContext,
  prepareModule: HtmlModulePreparer
): Promise<string> {
  const document = new DOMParser().parseFromString(content, "text/html");
  const elements = collectElements(document);
  const baseElement = elements.find((element) => element.tagName.toLowerCase() === "base");
  const resourceContext = getBaseResourceContext(
    baseElement?.getAttribute("href") ?? null,
    context
  );
  if (!resourceContext) return content;

  const moduleScripts = elements.filter(
    (element) =>
      element.tagName.toLowerCase() === "script" &&
      element.getAttribute("type")?.trim().toLowerCase() === "module"
  );

  for (const [index, script] of moduleScripts.entries()) {
    const src = script.getAttribute("src");
    const modulePath = src
      ? resolveHtmlUrlToPath(src, resourceContext)
      : resourceContext.filePath
        ? `${resourceContext.filePath}#peek-inline-${index}`
        : null;
    if (!modulePath) continue;

    try {
      script.setAttribute(
        "src",
        await prepareModule(modulePath, src ? undefined : script.textContent ?? "")
      );
      if (!src) script.textContent = "";
    } catch {
      // Keep the original script URL as a fallback for standalone modules.
    }
  }

  return serializeHtmlDocument(document);
}

export function processHtmlContent(
  content: string,
  context: HtmlPreviewContext,
  buildAssetUrl: AssetUrlBuilder
): string {
  const document = new DOMParser().parseFromString(content, "text/html");
  const elements = collectElements(document);

  const head = document.head;
  const baseElement = elements.find((element) => element.tagName.toLowerCase() === "base");
  const baseHref = baseElement?.getAttribute("href") ?? null;
  const resourceContext = getBaseResourceContext(baseHref, context);

  const resourceAttributes: Record<string, string[]> = {
    script: ["src"],
    img: ["src"],
    source: ["src"],
    audio: ["src"],
    video: ["src", "poster"],
    embed: ["src"],
    link: ["href"],
    object: ["data"],
    input: ["src"],
    track: ["src"],
  };

  for (const element of elements) {
    const tagName = element.tagName.toLowerCase();
    if (element !== baseElement && resourceContext) {
      for (const attribute of resourceAttributes[tagName] ?? []) {
        rewriteElementAttribute(element, attribute, (value) =>
          resolveHtmlResourceUrl(value, resourceContext, buildAssetUrl)
        );
      }

      if (tagName === "img" || tagName === "source") {
        rewriteElementAttribute(element, "srcset", (value) =>
          rewriteSrcset(value, resourceContext, buildAssetUrl)
        );
      }

      rewriteElementAttribute(element, "style", (value) =>
        rewriteCssUrls(value, resourceContext, buildAssetUrl)
      );

      if (tagName === "style") {
        element.textContent = rewriteCssUrls(
          element.textContent ?? "",
          resourceContext,
          buildAssetUrl
        );
      }
    }
  }

  if (baseElement && baseHref) {
    baseElement.setAttribute("href", resolveHtmlResourceUrl(baseHref, context, buildAssetUrl));
  } else if (head && context.filePath) {
    const injectedBase = document.createElement("base");
    injectedBase.href = buildAssetUrl(context.filePath);
    head.prepend(injectedBase);
  }

  prependRuntime(document, context, resourceContext, buildAssetUrl);

  return serializeHtmlDocument(document);
}

export async function prepareHtmlPreviewContent(
  content: string,
  context: HtmlPreviewContext,
  buildAssetUrl: AssetUrlBuilder,
  readFile: HtmlFileReader,
  prepareModule?: HtmlModulePreparer
): Promise<string> {
  const withLocalStyles = await inlineLocalStylesheets(
    content,
    context,
    buildAssetUrl,
    readFile
  );
  const withLocalModules = prepareModule
    ? await prepareLocalModuleScripts(withLocalStyles, context, prepareModule)
    : withLocalStyles;
  return processHtmlContent(withLocalModules, context, buildAssetUrl);
}
