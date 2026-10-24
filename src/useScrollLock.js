import { useEffect } from "react";

// Stops the page behind an open window from scrolling. Counted, so stacked windows
// (Settings → Feedback) keep the page locked until the last one closes. Pass the window's
// "still showing" flag (`mounted`, not `open`) so the lock also holds through the exit animation.
// Hiding a classic scrollbar widens the page, so its width is added back as padding while locked
// (phones and overlay scrollbars have none, so nothing is added there).
let locks = 0;
let previous = { overflow: "", paddingRight: "" };

export function useScrollLock(active) {
  useEffect(() => {
    if (!active) return;
    if (locks++ === 0) {
      const { style } = document.body;
      previous = { overflow: style.overflow, paddingRight: style.paddingRight };
      const bar = window.innerWidth - document.documentElement.clientWidth;
      if (bar > 0) style.paddingRight = `${(parseFloat(getComputedStyle(document.body).paddingRight) || 0) + bar}px`;
      style.overflow = "hidden";
    }
    return () => {
      if (--locks === 0) {
        document.body.style.overflow = previous.overflow;
        document.body.style.paddingRight = previous.paddingRight;
      }
    };
  }, [active]);
}
