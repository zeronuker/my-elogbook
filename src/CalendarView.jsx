import { useState, useEffect } from "react";
import { MONTHS, calcTotal, parseHHMM, toHHMM } from "./logbookCalculations";

// Month calendar for the Logbook tab — view only. Sectors are entered in the list view;
// tapping a sector hands its row to `onSelectSector`, which jumps back to the list.
//
// Each day box is a 24 h UTC timeline (left edge 00:00, right edge 24:00): one row of chips at their real
// time, then one route line per sector. Sectors never overlap and none lasts longer than 24 h, so a sector
// touches at most two days; when it does it is drawn as one bar across both boxes.

const WEEKDAYS_MON = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

// Spread far apart in hue, so sectors that follow each other (same two days) never look alike.
// 14 colours: at most 6 sectors a day over two days plus one spilling in is 13.
const PALETTE = [
  "#2DD4BF", "#FB7185", "#60A5FA", "#FBBF24", "#C084FC", "#A3E635", "#FB923C",
  "#22D3EE", "#F472B6", "#FDE047", "#818CF8", "#4ADE80", "#EF4444", "#CBD5E1",
];
const BAR_H = 20;     // chip height, px
const HEADER_H = 14;  // day-number row, px — fixed so a bar crossing into the next box stays level

function useIsNarrow() {
  const query = "(max-width: 639px)";
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return narrow;
}

// STD/STA are UTC. A sector whose STA is at or before its STD lands the next UTC day.
const toMins = t => { const [h, m] = String(t).trim().split(":").map(Number); return h * 60 + m; };
const arrivesNextDay = row => !!row.std && !!row.sta && toMins(row.sta) <= toMins(row.std);
const routeOf = row => `${row.departure || "—"}→${row.arrival || "—"}`;
const GRID_LINE = "color-mix(in srgb, var(--elb-txt, #e8f4fd) 24%, var(--elb-bg2, #0d1520))"; // lines between the day boxes
const PAD_BG = "color-mix(in srgb, var(--elb-txt, #e8f4fd) 14%, var(--elb-bg2, #0d1520))"; // days outside the month
const barBg = c => `color-mix(in srgb, ${c} 38%, var(--elb-bg2, #0d1520))`; // opaque, so overlapping halves never show a seam

export default function CalendarView({ data, settings, selectedMonth, selectedYear, onSelectSector }) {
  const narrow = useIsNarrow();
  const monthKey = `${selectedMonth}-${selectedYear}`;
  const [picked, setPicked] = useState({ key: monthKey, day: null }); // phone: day whose sectors are listed below

  const weekStart = settings.weekStart === "sunday" ? 0 : 1;
  const weekdays = weekStart === 1 ? WEEKDAYS_MON : ["SUN", ...WEEKDAYS_MON.slice(0, 6)];

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const offset = (new Date(selectedYear, selectedMonth, 1).getDay() - weekStart + 7) % 7;
  const col = day => (offset + day - 1) % 7;

  // ── Sectors of the month, plus one that left on the last day of the previous month (day 0) ──
  const sectors = [];
  let undated = 0;
  const addSector = (row, month, year, day) => {
    const total = calcTotal(row, settings.dayNightMethod, year, month);
    const over = arrivesNextDay(row);
    sectors.push({
      row, month, year, day, over, total, mins: parseHHMM(total),
      endDay: day + (over ? 1 : 0), timed: !!row.std && !!row.sta,
    });
  };
  const prevMonth = selectedMonth === 0 ? 11 : selectedMonth - 1;
  const prevYear = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
  const prevLastDay = new Date(prevYear, prevMonth + 1, 0).getDate();
  (data[`${prevMonth}-${prevYear}`] || []).forEach(row => {
    if ((row.departure || row.arrival) && parseInt(row.date, 10) === prevLastDay && arrivesNextDay(row)) addSector(row, prevMonth, prevYear, 0);
  });
  (data[monthKey] || []).forEach(row => {
    if (!row.departure && !row.arrival) return;
    const day = parseInt(row.date, 10);
    if (!day || day < 1 || day > daysInMonth) { undated++; return; }
    addSector(row, selectedMonth, selectedYear, day);
  });
  sectors.sort((a, b) => a.day - b.day || (a.row.std || "").localeCompare(b.row.std || ""));
  sectors.forEach((x, i) => { x.color = PALETTE[i % PALETTE.length]; });

  // ── What each day box shows ──
  const barsByDay = {};   // chips on the timeline row
  const linesByDay = {};  // one route line per sector (a faded one on the day it lands)
  const totalByDay = {};  // hours of every sector that LANDS that day — a spanning sector counts on its last day
  const push = (map, day, v) => { (map[day] = map[day] || []).push(v); };
  sectors.forEach(x => {
    if (x.day >= 1) push(linesByDay, x.day, { x, ghost: false });
    if (x.over && x.endDay <= daysInMonth) push(linesByDay, x.endDay, { x, ghost: true });
    if (x.endDay >= 1 && x.endDay <= daysInMonth) totalByDay[x.endDay] = (totalByDay[x.endDay] || 0) + x.mins;
    if (!x.timed) return; // no STD/STA yet — nothing to place on the timeline
    const s = toMins(x.row.std), e = toMins(x.row.sta);
    if (!x.over) push(barsByDay, x.day, { x, left: s / 14.4, w: (e - s) / 14.4 });
    else if (x.day >= 1 && col(x.day) < 6 && x.day < daysInMonth) {
      // next day box is beside this one: a single bar running across both
      push(barsByDay, x.day, { x, left: s / 14.4, w: (1440 - s + e) / 14.4, run: true });
    } else { // week row or month ends here: the bar continues at the start of the next row / month
      if (x.day >= 1) push(barsByDay, x.day, { x, left: s / 14.4, w: (1440 - s) / 14.4, flatR: true });
      if (x.endDay <= daysInMonth) push(barsByDay, x.endDay, { x, left: 0, w: e / 14.4, flatL: true });
    }
  });
  Object.values(linesByDay).forEach(list => list.sort((a, b) =>
    (a.ghost ? 0 : 1) - (b.ghost ? 0 : 1) || (a.x.row.std || "").localeCompare(b.x.row.std || "")));

  const now = new Date();
  const todayDay = now.getFullYear() === selectedYear && now.getMonth() === selectedMonth ? now.getDate() : null;
  const pickedDay = picked.key === monthKey ? picked.day : null;
  const open = x => onSelectSector(x.row, x.month, x.year);
  const tip = x => `${routeOf(x.row)}${x.timed ? ` · ${x.row.std}–${x.row.sta} UTC` : ""}${x.total ? ` · ${x.total}` : ""}${x.over ? " · arrives next day" : ""} — open in list`;

  const bar = (b, i) => {
    const c = b.x.color;
    return (
      <button
        key={`${b.x.month}-${b.x.row.id}-${i}`}
        onClick={() => open(b.x)}
        title={tip(b.x)}
        style={{
          position: "absolute", zIndex: 1, top: 0, bottom: 0, left: `${b.left}%`,
          width: b.run ? `calc(${b.w}% + 1px)` : `${b.w}%`, minWidth: 4,
          boxSizing: "border-box", padding: 0, cursor: "pointer",
          background: barBg(c), border: `1px solid ${c}`,
          borderLeft: b.flatL ? "none" : `1px solid ${c}`, borderRight: b.flatR ? "none" : `1px solid ${c}`,
          borderRadius: b.flatR ? "4px 0 0 4px" : b.flatL ? "0 4px 4px 0" : 4,
        }}
      />
    );
  };

  const line = (l, i) => (
    <button
      key={`${l.ghost ? "g" : "s"}-${l.x.month}-${l.x.row.id}-${i}`}
      onClick={() => open(l.x)}
      title={tip(l.x)}
      style={{
        display: "flex", alignItems: "center", gap: 5, width: "100%", minWidth: 0,
        padding: 0, background: "none", border: "none", cursor: "pointer", textAlign: "left",
        fontFamily: "inherit", fontSize: 11, color: "var(--elb-txt, #e8f4fd)", opacity: l.ghost ? 0.6 : 1,
      }}
    >
      <i style={{ flexShrink: 0, width: 8, height: 8, borderRadius: 2, background: l.x.color }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.ghost ? "↳ " : ""}{routeOf(l.x.row)}</span>
    </button>
  );

  const cells = [];
  // Days before the 1st: one solid block across the empty columns, with no lines between them
  if (offset > 0) cells.push(<div key="pad-start" style={{ gridColumn: `1 / span ${offset}`, minHeight: narrow ? 44 : 110, background: PAD_BG }} />);
  for (let day = 1; day <= daysInMonth; day++) {
    const lines = linesByDay[day] || [];
    const isToday = day === todayDay;
    const isPicked = day === pickedDay;
    const total = totalByDay[day];
    cells.push(
      <div
        key={day}
        onClick={narrow && lines.length ? () => setPicked({ key: monthKey, day: isPicked ? null : day }) : undefined}
        style={{
          minHeight: narrow ? 44 : 110, padding: narrow ? 4 : "5px 0", boxSizing: "border-box",
          background: isToday || isPicked ? "color-mix(in srgb, #3FE0C5 10%, var(--elb-bg2, #0d1520))" : "var(--elb-bg2, #0d1520)",
          boxShadow: isToday ? "inset 0 0 0 2px #3FE0C5" : "none",
          borderRadius: isToday ? 3 : 0,
          display: "flex", flexDirection: "column", gap: 3, minWidth: 0,
          cursor: narrow && lines.length ? "pointer" : "default",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", height: HEADER_H, fontSize: 11, padding: narrow ? 0 : "0 5px" }}>
          <span style={{ color: isToday ? "#3FE0C5" : "var(--elb-txt-muted, #3a6a8a)", fontWeight: isToday ? 700 : 400 }}>{day}</span>
          {!narrow && total > 0 && <span style={{ color: "var(--elb-txt, #e8f4fd)", fontSize: 10 }}>{toHHMM(total)}</span>}
        </div>
        {narrow ? (
          <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {lines.slice(0, 4).map((l, i) => (
              <span key={i} style={{ width: 6, height: 6, boxSizing: "border-box", borderRadius: "50%", background: l.ghost ? "transparent" : l.x.color, border: l.ghost ? `1px solid ${l.x.color}` : "none" }} />
            ))}
          </div>
        ) : (
          <>
            {/* always rendered, fixed height, so every box in a week has its chip row at the same level */}
            <div style={{ position: "relative", height: BAR_H, flexShrink: 0 }}>
              {(barsByDay[day] || []).map(bar)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 5px", marginTop: 2 }}>
              {lines.map(line)}
            </div>
          </>
        )}
      </div>
    );
  }

  // Days after the last one: the same solid block, so the final week row is complete
  const trailing = (7 - ((offset + daysInMonth) % 7)) % 7;
  if (trailing > 0) cells.push(<div key="pad-end" style={{ gridColumn: `span ${trailing}`, background: PAD_BG }} />);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 1, background: GRID_LINE, border: `1px solid ${GRID_LINE}` }}>
        {weekdays.map(d => (
          <div key={d} style={{ padding: "6px 0", textAlign: "center", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "var(--elb-txt-muted, #3a6a8a)", background: "var(--elb-bg2, #090d14)" }}>{d}</div>
        ))}
        {cells}
      </div>

      {!narrow && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--elb-txt-muted, #3a6a8a)" }}>
          Each chip row is 24 h UTC: left edge 00:00, right edge 24:00. Top right = hours of the sectors that land that day.
        </div>
      )}

      {/* Phone: sectors of the tapped day */}
      {narrow && pickedDay && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, color: "var(--elb-txt-muted, #3a6a8a)", letterSpacing: "0.1em" }}>
            {String(pickedDay).padStart(2, "0")} {MONTHS[selectedMonth].toUpperCase()}
            {totalByDay[pickedDay] > 0 && ` · ${toHHMM(totalByDay[pickedDay])}`}
          </div>
          {(linesByDay[pickedDay] || []).map((l, i) => (
            <button
              key={`${l.ghost ? "g" : "s"}-${l.x.month}-${l.x.row.id}-${i}`}
              onClick={() => open(l.x)}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                width: "100%", boxSizing: "border-box", padding: "8px 10px", cursor: "pointer", textAlign: "left",
                fontFamily: "inherit", fontSize: 13, color: "var(--elb-txt, #e8f4fd)",
                background: barBg(l.x.color), border: `1px solid ${l.x.color}`, borderRadius: 4, opacity: l.ghost ? 0.7 : 1,
              }}
            >
              <span>{l.ghost ? "↳ " : ""}{routeOf(l.x.row)}</span>
              {(l.ghost || !l.x.over) && l.x.total && <span style={{ color: "var(--elb-txt-muted, #3a6a8a)" }}>{l.x.total}</span>}
            </button>
          ))}
        </div>
      )}

      {undated > 0 && (
        <div style={{ marginTop: 10, fontSize: 11, color: "#eab308" }}>
          {undated} sector{undated > 1 ? "s" : ""} without a valid date not shown — add the date in the list view.
        </div>
      )}
    </div>
  );
}
