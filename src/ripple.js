// Tap ripple on the LIST/CALENDAR/MAP and MONTH/YEAR buttons (see .elb-ripple in oxygen.css). Installed once from main.jsx.
const TARGETS = ".elb-viewtoggle button, .mv-seg button";

export function installRipple() {
  document.addEventListener("pointerdown", e => {
    if (e.button !== 0) return;
    const el = e.target.closest(TARGETS);
    if (!el || el.disabled) return;
    // --elb-dur is 0ms when animations are off in Settings
    if (!(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--elb-dur")) > 0)) return;
    const r = el.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2;
    const dot = document.createElement("span");
    dot.className = "elb-ripple";
    dot.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
    el.appendChild(dot);
    dot.addEventListener("animationend", () => dot.remove(), { once: true });
  }, { passive: true });
}
