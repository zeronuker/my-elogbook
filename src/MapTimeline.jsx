import { useEffect, useMemo, useRef } from "react";
import { MONTHS } from "./logbookCalculations";

// The timeline under the Logbook map: play, speed, follow, a rail with one tick per sector, and a readout
// (date on a departure board, route typed in letter by letter).

const MON3 = MONTHS.map(m => m.slice(0, 3).toUpperCase());
const pad2 = n => String(n).padStart(2, "0");
const PLANE = "M8 0L-2 -1.6L-3 -6L-5 -6L-4 -1.4L-8 -1.2L-9 -3L-10.5 -3L-9.5 0L-10.5 3L-9 3L-8 1.2L-4 1.4L-5 6L-3 6L-2 1.6Z";

// Split-flap readout: a cell rolls down to its new character whenever it changes.
function Flap({ text }) {
  const ref = useRef(null);
  useEffect(() => {
    const host = ref.current;
    const cs = host.children;
    while (cs.length > text.length) host.lastChild.remove();
    while (cs.length < text.length) { const c = document.createElement("span"); c.className = "c"; host.appendChild(c); }
    [...text].forEach((ch, i) => {
      const c = cs[i];
      c.classList.toggle("sp", ch === " ");
      if (c.dataset.v === ch) return;
      c.dataset.v = ch;
      c.querySelectorAll(".o").forEach(x => x.remove());
      const old = c.querySelector(".n");
      if (old) { old.className = "o"; setTimeout(() => old.remove(), 320); }
      const n = document.createElement("span");
      n.className = "n";
      n.textContent = ch.trim();
      c.appendChild(n);
    });
  }, [text]);
  return <div ref={ref} className="mv-flap" aria-label={text} />;
}

// Route readout. An outbound sector is typed left to right (departure, arrow, arrival). A return leg (the reverse of
// the sector before it) is typed right to left with a left arrow, so the airports stay where they were.
// While playing, the typing is squeezed to fit inside 80% of the sector; a sector too short to read (< 350 ms) just swaps.
function RouteReadout({ sector, avail }) {
  const ref = useRef(null);
  const availRef = useRef(avail);
  useEffect(() => { availRef.current = avail; }, [avail]);
  useEffect(() => {
    const host = ref.current, f = sector;
    const n = f ? f.dep.length + 1 + f.arr.length : 0, full = 450 + 130 * n;
    const instant = availRef.current < 350;
    const k = instant ? 0 : Math.min(1, availRef.current * 0.8 / full);
    host.querySelectorAll(".rt:not(.out)").forEach(o => {
      if (instant) { o.remove(); return; }
      o.style.setProperty("--k", k);
      o.classList.add("out");
      setTimeout(() => o.remove(), 470 * k);
    });
    if (!f) return;
    const rev = f.isReturn, a = rev ? f.arr : f.dep, b = rev ? f.dep : f.arr;
    const chars = [...a, rev ? "←" : "→", ...b];
    const r = document.createElement("span");
    r.className = instant ? "rt" : "rt in";
    r.style.setProperty("--k", k);
    chars.forEach((c, j) => {
      const t = document.createElement("i");
      t.textContent = c;
      if (j === a.length) t.className = "ar";
      t.style.animationDelay = instant ? "0ms" : `${k * (450 + (rev ? chars.length - 1 - j : j) * 130)}ms`;
      r.appendChild(t);
    });
    host.appendChild(r);
  }, [sector]);
  return <span ref={ref} className="mv-route" aria-live="polite" />;
}

// Speed button: the old value rolls out, the new one rolls in.
function SpeedButton({ speed, onClick }) {
  const ref = useRef(null);
  const first = useRef(true);
  useEffect(() => {
    const b = ref.current;
    if (first.current) { first.current = false; return; }
    b.querySelectorAll(".o").forEach(x => x.remove());
    const old = b.querySelector(".n");
    if (old) { old.className = "o"; setTimeout(() => old.remove(), 300); }
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = `${speed}×`;
    b.appendChild(n);
    b.classList.remove("bump");
    void b.offsetWidth;
    b.classList.add("bump");
  }, [speed]);
  return (
    <button ref={ref} className="mv-btn spd" onClick={onClick} aria-label={`Playback speed ${speed}×`} title="Playback speed">
      <span className="n">{speed}{"×"}</span>
    </button>
  );
}

export default function MapTimeline({ sectors, cut, playing, speed, follow, scope, avail, onPlay, onSpeed, onFollow, onScrub }) {
  const total = sectors.length;
  const frac = total ? cut / total : 0;

  // Period labels under the rail (day numbers in a month, month names in a year), thinned so they never touch.
  const labels = useMemo(() => {
    const out = [];
    let last = -1;
    sectors.forEach((s, i) => {
      const p = sectors[i - 1];
      if (p && (scope === "month" ? p.day === s.day : p.month === s.month)) return;
      const at = (i + 0.5) / sectors.length;
      if (last >= 0 && at - last < 0.05) return;
      last = at;
      out.push({ at, i: i + 1, text: scope === "month" ? pad2(s.day) : MON3[s.month] });
    });
    return out;
  }, [sectors, scope]);

  const cur = cut > 0 ? sectors[cut - 1] : null;
  const shown = cur || sectors[0];
  const date = !total ? "NO FLIGHTS" : `${pad2(shown.day)} ${MON3[shown.month]} ${shown.year}`;

  return (
    <div className={"mv-tl" + (total ? "" : " off")}>
      <button className="mv-btn sq play" onClick={onPlay} aria-label={playing ? "Pause timeline" : "Play timeline"}>
        {playing
          ? <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true"><path d="M1 1h3.5v12H1zM7.5 1H11v12H7.5z" fill="currentColor" /></svg>
          : <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true"><path d="M1 1l10 6-10 6z" fill="currentColor" /></svg>}
      </button>
      <SpeedButton speed={speed} onClick={onSpeed} />
      <button className={"mv-btn sq" + (follow ? " on" : "")} onClick={onFollow} aria-pressed={follow} aria-label="Follow the aircraft" title="Follow the aircraft">
        <svg width="16" height="16" viewBox="-8 -8 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <circle r="4.2" /><path d="M0-8V-5M0 5V8M-8 0H-5M5 0H8" /><circle r="1" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <div className="mv-rail">
        <svg className="mv-ticks" viewBox={`0 0 ${Math.max(total, 1)} 9`} preserveAspectRatio="none" aria-hidden="true">
          {sectors.map((s, i) => <rect key={i} x={i + 0.15} y={0} width={0.7} height={9} className={i < cut ? "on" : undefined} />)}
        </svg>
        <div className="mv-line"><i style={{ width: `${frac * 100}%` }} /></div>
        <div className="mv-labs">
          {labels.map(l => <b key={l.i} className={l.i <= cut ? "on" : undefined} style={{ left: `${l.at * 100}%` }}>{l.text}</b>)}
        </div>
        <div className="mv-jet" style={{ left: `calc(7px + (100% - 14px) * ${frac})` }}>
          <svg width="22" height="14" viewBox="-11 -7 22 14" aria-hidden="true"><path d={PLANE} fill="var(--mv-acc)" /></svg>
        </div>
        <input
          className="mv-range" type="range" min={0} max={total} step={1} value={cut}
          onChange={e => onScrub(+e.target.value)}
          aria-label="Timeline: show sectors up to this one"
        />
      </div>
      <div className="mv-info">
        <Flap text={date} />
        <RouteReadout sector={cur} avail={avail} />
      </div>
    </div>
  );
}
