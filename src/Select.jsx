import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useExitAnim } from "./useExitAnim";
import "./select.css";

// Themed replacement for <select>. `options` is [{ value, label }]; onChange gets the chosen option's value as-is
// (number stays a number). The trigger takes className/style like the old <select>; the list opens in a portal so
// scrolling modals can't clip it.
export default function Select({ value, onChange, options, disabled, className = "", style, id, ...rest }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const typed = useRef({ s: "", t: 0 });
  const { mounted, closing } = useExitAnim(open);
  const listId = useId();
  const sel = options.findIndex(o => o.value === value);

  const openList = () => {
    const r = btnRef.current.getBoundingClientRect();
    const cs = getComputedStyle(btnRef.current);
    const below = innerHeight - r.bottom;
    const up = below < 240 && r.top > below;
    setPos({
      left: r.left, minWidth: r.width,
      ...(up ? { bottom: innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
      maxHeight: Math.max(120, Math.min(260, (up ? r.top : below) - 12)),
      fontFamily: cs.fontFamily, fontSize: cs.fontSize, letterSpacing: cs.letterSpacing,
    });
    setActive(Math.max(sel, 0));
    setOpen(true);
  };
  const pick = (i) => {
    onChange?.(options[i].value);
    setOpen(false);
    btnRef.current.focus();
  };

  // keep a wide list inside the viewport
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && pos) el.style.left = Math.max(8, Math.min(pos.left, innerWidth - 8 - el.offsetWidth)) + "px";
  }, [mounted, pos]);

  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  // outside press closes; page scroll/resize moves the trigger, so they close it too (scrolling the list itself doesn't)
  useEffect(() => {
    if (!open) return;
    const outside = e => { if (!btnRef.current.contains(e.target) && !listRef.current?.contains(e.target)) setOpen(false); };
    const away = e => { if (!listRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("scroll", away, true);
    window.addEventListener("resize", away);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("scroll", away, true);
      window.removeEventListener("resize", away);
    };
  }, [open]);

  const onKeyDown = (e) => {
    const k = e.key;
    if (k === "Escape") {
      if (open) { e.stopPropagation(); setOpen(false); } // closes the list, not the dialog behind it
    } else if (k === "Tab") {
      setOpen(false);
    } else if (k === "ArrowDown" || k === "ArrowUp") {
      e.preventDefault();
      if (!open) openList();
      else setActive(a => (a + (k === "ArrowDown" ? 1 : -1) + options.length) % options.length);
    } else if ((k === "Home" || k === "End") && open) {
      e.preventDefault();
      setActive(k === "Home" ? 0 : options.length - 1);
    } else if (k === "Enter" || k === " ") {
      e.preventDefault();
      if (open) pick(active); else openList();
    } else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const t = typed.current; // type-to-jump: letters typed within 600ms build one prefix
      t.s = (Date.now() - t.t > 600 ? "" : t.s) + k.toLowerCase();
      t.t = Date.now();
      const i = options.findIndex(o => String(o.label).toLowerCase().startsWith(t.s));
      if (i > -1) { if (open) setActive(i); else onChange?.(options[i].value); }
    }
  };

  return (
    <>
      <button
        ref={btnRef} type="button" id={id} disabled={disabled}
        className={"cbsel-btn " + className} style={style}
        role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        {...rest}
      >
        <span className="cbsel-label">{sel > -1 ? options[sel].label : ""}</span>
        <svg className="cbsel-cv" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M1 3l4 4 4-4" /></svg>
      </button>
      {mounted && pos && createPortal(
        <ul
          ref={listRef} id={listId} role="listbox"
          className={"cbsel-list elb-pop" + (closing ? " elb-closing" : "")}
          style={pos}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
        >
          {options.map((o, i) => (
            <li
              key={String(o.value)} id={`${listId}-${i}`} role="option"
              aria-selected={i === sel} className={i === active ? "act" : undefined}
              onMouseMove={() => active !== i && setActive(i)}
              onClick={() => pick(i)}
            >{o.label}</li>
          ))}
        </ul>,
        document.body
      )}
    </>
  );
}
