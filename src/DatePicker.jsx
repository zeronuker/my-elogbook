import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useExitAnim } from "./useExitAnim";
import Select from "./Select";
import "./datePicker.css";

// Themed replacement for <input type="date">. Same contract: value / min / max / onChange all use "YYYY-MM-DD"
// (or "" for no date), so callers and saved data don't change. The field takes dd/mm/yyyy typed in; the calendar
// opens in a portal so scrolling modals can't clip it. className/style go on the text input.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const pad = n => String(n).padStart(2, "0");
const iso = (y, m, d) => { const t = new Date(y, m, d); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
const todayIso = () => { const t = new Date(); return iso(t.getFullYear(), t.getMonth(), t.getDate()); };
const show = v => (v ? `${v.slice(8)}/${v.slice(5, 7)}/${v.slice(0, 4)}` : "");
const mask = s => {
  const d = s.replace(/\D/g, "").slice(0, 8);
  return d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};
// "dd/mm/yyyy" -> "YYYY-MM-DD", or "" when it isn't a real calendar date
const parse = s => {
  const [d, m, y] = s.split("/").map(Number);
  const v = iso(y, m - 1, d);
  return v === `${y}-${pad(m)}-${pad(d)}` ? v : "";
};

export default function DatePicker({ value = "", onChange, min, max, className = "", style, wrapStyle, id, ...rest }) {
  const [draft, setDraft] = useState(null); // text being typed; null = show the saved value
  const [open, setOpen] = useState(false);
  const [view, setView] = useState({ y: 0, m: 0 });
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const popRef = useRef(null);
  const { mounted, closing } = useExitAnim(open);
  const bad = draft !== null && draft.length === 10; // a full date that was rejected (not real, or outside min/max)
  const ok = v => v && (!min || v >= min) && (!max || v <= max);

  const commit = (v) => { setDraft(null); onChange?.(v); };
  const onType = (e) => {
    const t = mask(e.target.value);
    const v = t.length === 10 ? parse(t) : "";
    if (ok(v)) commit(v); else setDraft(t);
  };
  const onBlur = () => {
    if (draft === "") onChange?.("");
    setDraft(null);
  };

  const openPop = () => {
    const r = wrapRef.current.getBoundingClientRect();
    const below = innerHeight - r.bottom;
    const up = below < 340 && r.top > below;
    const base = value || (max && todayIso() > max ? max : min && todayIso() < min ? min : todayIso());
    setView({ y: +base.slice(0, 4), m: +base.slice(5, 7) - 1 });
    setPos({ left: r.left, ...(up ? { bottom: innerHeight - r.top + 4 } : { top: r.bottom + 4 }) });
    setOpen(true);
  };
  const close = () => { setOpen(false); inputRef.current?.focus(); };

  useLayoutEffect(() => {
    const el = popRef.current;
    if (el && pos) el.style.left = Math.max(8, Math.min(pos.left, innerWidth - 8 - el.offsetWidth)) + "px";
  }, [mounted, pos]);

  // outside press closes (the month/year lists are portals of their own, so they count as inside);
  // page scroll or resize moves the field, so they close it too
  useEffect(() => {
    if (!open) return;
    const outside = e => {
      if (!wrapRef.current.contains(e.target) && !popRef.current?.contains(e.target) && !e.target.closest(".cbsel-list")) setOpen(false);
    };
    const away = e => { if (!popRef.current?.contains(e.target) && !e.target.closest?.(".cbsel-list")) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("scroll", away, true);
    window.addEventListener("resize", away);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("scroll", away, true);
      window.removeEventListener("resize", away);
    };
  }, [open]);

  const { y, m } = view;
  const monthOk = (yy, mm) => (!max || iso(yy, mm, 1) <= max) && (!min || iso(yy, mm + 1, 0) >= min);
  const step = (n) => { const t = new Date(y, m + n, 1); setView({ y: t.getFullYear(), m: t.getMonth() }); };
  const setYear = (yy) => setView({ y: yy, m: monthOk(yy, m) ? m : MONTHS.findIndex((_, i) => monthOk(yy, i)) });
  const nowY = new Date().getFullYear();
  const yFrom = min ? +min.slice(0, 4) : (max ? +max.slice(0, 4) : nowY) - 100;
  const yTo = max ? +max.slice(0, 4) : nowY + 10;
  const today = todayIso();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // weeks start on Monday

  return (
    <span className="cbdp" style={wrapStyle} ref={wrapRef}>
      <input
        ref={inputRef} id={id} type="text" inputMode="numeric" size={12} maxLength={10} autoComplete="off" placeholder="dd/mm/yyyy"
        className={className + (bad ? " cbdp-bad" : "")} style={{ ...style, paddingRight: 30 }}
        value={draft ?? show(value)} aria-invalid={bad || undefined}
        onChange={onType} onBlur={onBlur}
        onKeyDown={e => {
          if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); }
          else if (e.key === "ArrowDown" && e.altKey) { e.preventDefault(); if (!open) openPop(); }
        }}
        {...rest}
      />
      <button
        type="button" className="cbdp-ico" aria-label="Open calendar" aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPop())}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" /><path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </button>
      {mounted && pos && createPortal(
        <div
          ref={popRef} role="dialog" aria-label="Choose date"
          className={"cbdp-pop elb-pop" + (closing ? " elb-closing" : "")} style={pos}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}
        >
          <div className="cbdp-head">
            <button type="button" className="cbdp-nav" aria-label="Previous month" disabled={!!min && iso(y, m, 1) <= min} onClick={() => step(-1)}>&lsaquo;</button>
            <span className="cbdp-sels">
              <Select
                className="cbdp-sel" aria-label="Month" value={m} onChange={mm => setView({ y, m: mm })}
                options={MONTHS.map((label, value) => ({ value, label })).filter(o => monthOk(y, o.value))}
              />
              <Select
                className="cbdp-sel" aria-label="Year" value={y} onChange={setYear}
                options={Array.from({ length: yTo - yFrom + 1 }, (_, i) => ({ value: yTo - i, label: String(yTo - i) }))}
              />
            </span>
            <button type="button" className="cbdp-nav" aria-label="Next month" disabled={!!max && iso(y, m + 1, 1) > max} onClick={() => step(1)}>&rsaquo;</button>
          </div>
          <div className="cbdp-grid">
            {WEEKDAYS.map(w => <span key={w} className="cbdp-wd">{w}</span>)}
            {Array.from({ length: 42 }, (_, i) => {
              const v = iso(y, m, 1 - lead + i);
              return (
                <button
                  key={v} type="button" disabled={!ok(v)} onClick={() => { commit(v); close(); }}
                  className={"cbdp-d" + (+v.slice(5, 7) - 1 !== m ? " out" : "") + (v === today ? " today" : "") + (v === value ? " sel" : "")}
                >{+v.slice(8)}</button>
              );
            })}
          </div>
          <div className="cbdp-foot">
            <button type="button" className="cbdp-link" disabled={!ok(today)} onClick={() => { commit(today); close(); }}>Today</button>
            <button type="button" className="cbdp-link" onClick={() => { commit(""); close(); }}>Clear</button>
          </div>
        </div>,
        document.body
      )}
    </span>
  );
}
