// @vitest-environment happy-dom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import appIcon from "../../src-tauri/icons/128x128@2x.png";
import documentHtml from "../../index.html?raw";
import AppIcon from "./AppIcon";
import About from "./About";
import EmptyState from "./EmptyState";
import Header from "./Header";

function parseMarkup(markup: string) {
  const container = document.createElement("div");
  container.innerHTML = markup;
  return container;
}

describe("Peek app branding", () => {
  it("uses the bundled application icon without stretching or dragging", () => {
    const container = parseMarkup(renderToStaticMarkup(<AppIcon className="h-16 w-16" />));
    const icon = container.querySelector("img")!;

    expect(icon.getAttribute("src")).toBe(appIcon);
    expect(icon.alt).toBe("Peek 应用图标");
    expect(icon.width).toBe(256);
    expect(icon.height).toBe(256);
    expect(icon.getAttribute("draggable")).toBe("false");
    expect(icon.classList.contains("object-contain")).toBe(true);
    expect(icon.classList.contains("h-16")).toBe(true);
  });

  it.each([
    { name: "header", element: <Header />, size: "h-6" },
    { name: "about dialog", element: <About onClose={() => {}} />, size: "h-16" },
    { name: "welcome screen", element: <EmptyState />, size: "h-16" },
  ])("shows the same application icon in the $name", ({ element, size }) => {
    const container = parseMarkup(renderToStaticMarkup(element));
    const icons = container.querySelectorAll<HTMLImageElement>('img[alt="Peek 应用图标"]');

    expect(icons).toHaveLength(1);
    expect(icons[0].getAttribute("src")).toBe(appIcon);
    expect(icons[0].classList.contains(size)).toBe(true);
    expect([...container.querySelectorAll("span")].some((span) => span.textContent === "P")).toBe(false);
  });

  it("uses the native application icon as the favicon", () => {
    const favicon = parseMarkup(documentHtml).querySelector<HTMLLinkElement>('link[rel="icon"]')!;

    expect(favicon.getAttribute("type")).toBe("image/png");
    expect(favicon.getAttribute("href")).toBe("/src-tauri/icons/32x32.png");
  });
});
