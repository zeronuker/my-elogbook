import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./tooltip.css";

// Branded replacement for the browser's native title tooltips, mounted once for the whole app. While an element is
// hovered (mouse) or keyboard-focused, its title attribute is parked in data-cbtip so the browser stays quiet, then
// put back, so title keeps naming icon buttons for screen readers.
const SEL = "[title],[data-cbtip]";

export default function Tooltip() {
  const [tip, setTip] = useState(null); // { text, rect }
  const boxRef = useRef(null);

  useEffect(() => {
    let el = null;
    let timer = 0;
    const hide = () => {
      clearTimeout(timer);
      if (el && el.dataset.cbtip !== undefined) {
        if (!el.hasAttribute("title")) el.setAttribute("title", el.dataset.cbtip);
        delete el.dataset.cbtip;
      }
      el = null;
      setTip(null);
    };
    const show = (target, delay) => {
      if (target === el) return;
      hide();
      const text = target.getAttribute("title") || target.dataset.cbtip;
      if (!text) return;
      el = target;
      el.dataset.cbtip = text;
      el.removeAttribute("title");
      timer = setTimeout(() => { if (el?.isConnected) setTip({ text, rect: el.getBoundingClientRect() }); }, delay);
    };

    const over = e => {
      if (e.pointerType !== "mouse") return;
      const t = e.target.closest?.(SEL);
      if (t) show(t, 350); else hide();
    };
    const focus = e => {
      const t = e.target.closest?.(SEL);
      if (t && e.target.matches(":focus-visible")) show(t, 0);
    };
    const key = e => { if (e.key === "Escape") hide(); };
    const root = document.documentElement;

    document.addEventListener("pointerover", over);
    document.addEventListener("pointerdown", hide);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", hide);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
    root.addEventListener("pointerleave", hide);
    return () => {
      hide();
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerdown", hide);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("blur", hide);
      root.removeEventListener("pointerleave", hide);
    };
  }, []);

  // above the element, or below when there's no room; kept inside the viewport
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || !tip) return;
    const { rect: r } = tip;
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    box.style.left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8) + "px";
    box.style.top = (r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8) + "px";
  }, [tip]);

  return tip && createPortal(<div ref={boxRef} className="cbtip elb-fade" role="tooltip">{tip.text}</div>, document.body);
}
