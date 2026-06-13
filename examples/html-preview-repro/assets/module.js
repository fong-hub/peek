export function mountStatus(element) {
  if (!element) {
    return;
  }

  element.textContent = "module loaded";
  document.body.setAttribute("data-status", "module-ready");
}
