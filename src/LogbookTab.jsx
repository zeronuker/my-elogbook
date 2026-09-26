import { useState, useEffect, Fragment } from "react";
import { getCoords } from "./airportCoords";
import {
  MONTHS, EMPTY_ROW, makeMonthRows, DEFAULT_ROWS,
  parseHHMM, toHHMM, calcFlightTimes,
} from "./logbookCalculations";
import {
  CREW_RANK_ORDER, COLUMN_SCALE, timeCols,
  thStyle, thSubStyle, tdStyle,
} from "./logbookConstants";

const crewRankIndex = (position) => {
  const i = CREW_RANK_ORDER.indexOf((position || "").toUpperCase());
  return i === -1 ? CREW_RANK_ORDER.length : i;
};
const sortCrewByRank = (crew) => [...crew].sort((a, b) => {
  const diff = crewRankIndex(a.position) - crewRankIndex(b.position);
  return diff !== 0 ? diff : (a.position || "").toUpperCase().localeCompare((b.position || "").toUpperCase());
});

const isEmptyStaticRow = row => !row.type && !row.markings && !row.captain && !row.cap;
const rowHasData = row => row && Object.keys(EMPTY_ROW()).some(k => !!row[k]);

export default function LogbookTab({
  data, settings, selectedMonth, selectedYear,
  editingCell, setEditingCell,
  expandedRowIdx, setExpandedRowIdx,
  confirmDeleteRowIdx, setConfirmDeleteRowIdx,
  pulseRowId, setActivePopup,
  updateCell, deleteRow, addSector, findDutyLogMatch,
}) {
  const [revealedAutoCols, setRevealedAutoCols] = useState(() => new Set());
  const [openedRowIds, setOpenedRowIds] = useState(() => new Set());
  const [confirmedLongFlights, setConfirmedLongFlights] = useState(() => new Set());

  const monthKey = `${selectedMonth}-${selectedYear}`;

  // ── Per-month state ──
  const rowsPerPage = Number(settings.rowsPerPage) || DEFAULT_ROWS;
  // rowsPerPage is a visual default for new/empty months only — not a hard minimum.
  // Users can delete rows below rowsPerPage; storedRows is always the truth.
  const storedRows = data[monthKey] || makeMonthRows(selectedMonth, selectedYear, rowsPerPage);
  const rows = storedRows;

  const duplicatePreviousRow = (rowIdx) => {
    const prevRow = rows[rowIdx - 1];
    if (!prevRow) return;
    updateCell(rowIdx, "type", prevRow.type);
    updateCell(rowIdx, "markings", prevRow.markings);
    updateCell(rowIdx, "captain", prevRow.captain);
    updateCell(rowIdx, "cap", prevRow.cap);
    // Never overwrite a date/departure already typed in by hand — same rule
    // the multi-sector auto-fill above already follows.
    const row = rows[rowIdx];
    if (!row.date) updateCell(rowIdx, "date", prevRow.date);
    if (!row.departure) updateCell(rowIdx, "departure", prevRow.arrival);
  };

  const colScale = COLUMN_SCALE[settings.columnDensity] ?? COLUMN_SCALE.default;
  const cw = (base) => Math.round(base * colScale);

  const columns = [
    { key: "date",      label: "DATE",                        minWidth: cw(36),  group: null },
    { key: "type",      label: "TYPE",                        minWidth: cw(36),  group: "AIRCRAFT" },
    { key: "markings",  label: "MARKINGS",                    minWidth: cw(58),  group: "AIRCRAFT" },
    { key: "captain",   label: "CAPTAIN",                     minWidth: cw(60), fixedWidth: cw(60), wrap: true, group: null },
    { key: "cap",         label: "HOLDER\nOPERATING\nCAPACITY", minWidth: cw(58), group: null, type: "select", options: ["","P1","P2","P1 U/S"] },
    { key: "pilotFlying", label: "PILOT\nFLYING",              minWidth: cw(46), group: null, type: "checkbox" },
    { key: "departure",   label: "DEP",                         minWidth: cw(30), group: "SECTORS" },
    { key: "arrival",   label: "ARR",                         minWidth: cw(30),  group: "SECTORS" },
    { key: "std",       label: "STD\n(UTC)",                  minWidth: cw(38),  group: null },
    { key: "sta",       label: "STA\n(UTC)",                  minWidth: cw(38),  group: null },
    { key: "dayP1",     label: "P1",                          minWidth: cw(30),  group: "DAY" },
    { key: "dayP1US",   label: "P1 U/S",                      minWidth: cw(42),  group: "DAY" },
    { key: "dayP2",     label: "P2",                          minWidth: cw(30),  group: "DAY" },
    { key: "nightP1",   label: "P1",                          minWidth: cw(30),  group: "NIGHT" },
    { key: "nightP1US", label: "P1 U/S",                      minWidth: cw(42),  group: "NIGHT" },
    { key: "nightP2",   label: "P2",                          minWidth: cw(30),  group: "NIGHT" },
    { key: "total",     label: "TOTAL",                       minWidth: cw(42),  group: null },
  ];

  const autoCalcCols = ["total","dayP1","dayP1US","dayP2","nightP1","nightP1US","nightP2"];

  // ── Auto-hide empty auto-calculated columns (per month) ────────────────
  // Only DAY/NIGHT × P1, P1 U/S, P2 are ever auto-hidden — TOTAL and every
  // manually-entered column are always visible. A column collapses to a stub
  // only once the viewed month is fully in the past (never the active month)
  // and every row that month is blank in that field. Revealing a stub is a
  // session-only peek (not persisted) — it resets back to hidden on reload.
  const STUBABLE_AUTO_CALC_COLS = ["dayP1","dayP1US","dayP2","nightP1","nightP1US","nightP2"];
  const nowRealDate = new Date();
  const isPastMonth = selectedYear < nowRealDate.getFullYear()
    || (selectedYear === nowRealDate.getFullYear() && selectedMonth < nowRealDate.getMonth());
  // DAY/NIGHT P1/P1 U/S/P2 are never written to the row itself — they're always
  // computed live from STD/STA/HOC, same as the table displays. Computed once per
  // month here (rather than per column/row/call-site) and reused by every check below.
  const monthComputedFT = rows.map(r => calcFlightTimes(r, settings.dayNightMethod, selectedYear, selectedMonth));
  const isAutoCalcStub = (key) => {
    if (settings.autoHideEmptyCols === false) return false;
    if (!STUBABLE_AUTO_CALC_COLS.includes(key)) return false;
    if (!isPastMonth) return false;
    if (revealedAutoCols.has(`${monthKey}:${key}`)) return false;
    return monthComputedFT.every(ft => !ft[key]);
  };
  const toggleAutoCalcReveal = (key) => {
    const tag = `${monthKey}:${key}`;
    setRevealedAutoCols(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  };

  // HOC/long-flight warning banner spans the whole auto-calc region (6 stubable cols + TOTAL) —
  // none of these are ever omitted (only visually narrowed), so this is always 7.
  const autoCalcVisibleCount = autoCalcCols.length;
  // Totals-row label colSpan: # + DATE + solo/group cols before time cols (none of these are ever hidden)
  const totalsLabelColSpan = 2 + ["type","markings","captain","cap","pilotFlying","departure","arrival","std","sta"].length;

  const totalsRowMins = rows.reduce((acc, r) => {
    const ft = calcFlightTimes(r, settings.dayNightMethod, selectedYear, selectedMonth);
    acc.dayP1     += parseHHMM(ft.dayP1);
    acc.dayP1US   += parseHHMM(ft.dayP1US);
    acc.dayP2     += parseHHMM(ft.dayP2);
    acc.nightP1   += parseHHMM(ft.nightP1);
    acc.nightP1US += parseHHMM(ft.nightP1US);
    acc.nightP2   += parseHHMM(ft.nightP2);
    return acc;
  }, { dayP1: 0, dayP1US: 0, dayP2: 0, nightP1: 0, nightP1US: 0, nightP2: 0 });
  const totalsRow = {
    dayP1:     toHHMM(totalsRowMins.dayP1)     || "00:00",
    dayP1US:   toHHMM(totalsRowMins.dayP1US)   || "00:00",
    dayP2:     toHHMM(totalsRowMins.dayP2)     || "00:00",
    nightP1:   toHHMM(totalsRowMins.nightP1)   || "00:00",
    nightP1US: toHHMM(totalsRowMins.nightP1US) || "00:00",
    nightP2:   toHHMM(totalsRowMins.nightP2)   || "00:00",
    total:     toHHMM(totalsRowMins.dayP1 + totalsRowMins.dayP1US + totalsRowMins.dayP2 + totalsRowMins.nightP1 + totalsRowMins.nightP1US + totalsRowMins.nightP2) || "00:00",
  };

  // ── Sync #root width to logbook table's actual rendered width ─────
  useEffect(() => {
    // Reset first so table can overflow freely and give true scrollWidth
    document.documentElement.style.removeProperty('--logbook-root-w');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const table = document.querySelector('#root table');
      if (!table) return;
      // +50 = content wrapper padding (24px×2) + root border (1px×2)
      document.documentElement.style.setProperty('--logbook-root-w', `${table.scrollWidth + 50}px`);
    }));
  }, [colScale, revealedAutoCols, monthKey]);

  return (
    <div style={{ overflowX: "auto" }}>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "auto" }}>
        {(() => {
          // The 6 DAY/NIGHT × P1 / P1 U/S / P2 columns collapse to a narrow,
          // clickable stub once their month has closed out and every row is
          // blank in that field (see isAutoCalcStub). Every other column, and
          // both group headers, always render at full size — nothing is ever
          // omitted from the table, so header/body/totals stay aligned.
          const autoCalcSubTh = (key, label, color) => {
            if (isAutoCalcStub(key)) {
              return (
                <th
                  key={key}
                  onClick={() => toggleAutoCalcReveal(key)}
                  title="Empty this month — click to reveal"
                  style={{
                    ...thSubStyle,
                    width: 18, minWidth: 18, maxWidth: 18, padding: "6px 0",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ writingMode: "vertical-rl", textOrientation: "mixed", fontSize: 9, letterSpacing: "0.04em", whiteSpace: "nowrap", color: "var(--elb-txt-muted, #4a6a8a)" }}>{label}</span>
                </th>
              );
            }
            const isRevealed = revealedAutoCols.has(`${monthKey}:${key}`)
              && STUBABLE_AUTO_CALC_COLS.includes(key) && isPastMonth && monthComputedFT.every(ft => !ft[key]);
            return (
              <th
                key={key}
                onClick={isRevealed ? () => toggleAutoCalcReveal(key) : undefined}
                title={isRevealed ? "Empty this month — click to hide again" : undefined}
                style={{
                  ...thSubStyle,
                  color,
                  cursor: isRevealed ? "pointer" : "default",
                  borderBottom: isRevealed ? "1px dashed rgba(234,179,8,0.6)" : thSubStyle.borderBottom,
                }}
              >{label}</th>
            );
          };

          return (
            <thead>
              <tr style={{ background: "var(--elb-thead, #0b1320)" }}>
                <th rowSpan={2} style={thStyle}>#</th>
                <th rowSpan={2} style={{ ...thStyle, lineHeight: 1.4 }}>
                  <span style={{ display: "block" }}>DATE</span>
                  <span style={{ display: "block", fontSize: "var(--elb-hint-sz)", color: "#2a5a7a" }}>(UTC)</span>
                </th>
                <th colSpan={2} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>AIRCRAFT</th>
                <th key="captain" rowSpan={2} style={thStyle}>CAPTAIN</th>
                <th key="cap" rowSpan={2} style={{ ...thStyle, lineHeight: 1.4 }}>
                  <span style={{ display: "block" }}>HOLDER</span>
                  <span style={{ display: "block" }}>OPERATING</span>
                  <span style={{ display: "block" }}>CAPACITY</span>
                </th>
                <th key="pilotFlying" rowSpan={2} style={{ ...thStyle, lineHeight: 1.4 }}>
                  <span style={{ display: "block" }}>PILOT</span>
                  <span style={{ display: "block" }}>FLYING</span>
                </th>
                <th colSpan={2} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>SECTORS</th>
                <th key="std" rowSpan={2} style={{ ...thStyle, lineHeight: 1.4 }}>
                  <span style={{ display: "block" }}>STD</span>
                  <span style={{ display: "block", fontSize: "var(--elb-hint-sz)", color: "#2a5a7a" }}>(UTC)</span>
                </th>
                <th key="sta" rowSpan={2} style={{ ...thStyle, lineHeight: 1.4 }}>
                  <span style={{ display: "block" }}>STA</span>
                  <span style={{ display: "block", fontSize: "var(--elb-hint-sz)", color: "#2a5a7a" }}>(UTC)</span>
                </th>
                {/* Group headers always stay full-size and horizontal — never shrink,
                    rotate, or reduce colSpan — regardless of how many of their 3
                    sub-columns are currently stubbed. */}
                <th colSpan={3} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", color: "#f5c542", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>☀ DAY</th>
                <th colSpan={3} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", color: "#7ab8d4", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>☾ NIGHT</th>
                <th key="total" rowSpan={2} style={{ ...thStyle }}>TOTAL</th>
              </tr>
              <tr style={{ background: "var(--elb-thead, #0b1320)" }}>
                <th style={thSubStyle}>TYPE</th>
                <th style={thSubStyle}>MARKINGS</th>
                <th style={thSubStyle}>DEP</th>
                <th style={thSubStyle}>ARR</th>
                {autoCalcSubTh("dayP1",     "P1",     "#22c55e")}
                {autoCalcSubTh("dayP1US",   "P1 U/S", "#ef4444")}
                {autoCalcSubTh("dayP2",     "P2",     "#eab308")}
                {autoCalcSubTh("nightP1",   "P1",     "#4fc3f7")}
                {autoCalcSubTh("nightP1US", "P1 U/S", "#ef4444")}
                {autoCalcSubTh("nightP2",   "P2",     "#4fc3f7")}
              </tr>
            </thead>
          );
        })()}

        <tbody>
          {rows.map((row, rowIdx) => {
            const isEven = rowIdx % 2 === 0;
            const hasStdSta = row.std && row.sta;
            const hasCap = row.cap && ["P1","P2","P1 U/S"].includes(row.cap);
            const needsCapWarning = hasStdSta && !hasCap;
            const rawFlightMins = hasStdSta ? (() => {
              const toM = t => { const [h,m] = t.trim().split(":").map(Number); return h*60+m; };
              let s = toM(row.std), e = toM(row.sta);
              if (e <= s) e += 1440;
              return e - s;
            })() : 0;
            const isLongFlight = hasCap && rawFlightMins > 18 * 60;
            const longFlightConfirmed = confirmedLongFlights.has(row.id);
            const needsLongFlightWarning = isLongFlight && !longFlightConfirmed;
            const allowLong = isLongFlight && longFlightConfirmed;
            // Non-blocking overlap check: same date, overlapping STD–STA window as another row this month
            const hasOverlap = hasStdSta && row.date && rows.some((other, oIdx) => {
              if (oIdx === rowIdx || String(other.date) !== String(row.date) || !other.std || !other.sta) return false;
              let s1 = parseHHMM(row.std), e1 = parseHHMM(row.sta);
              if (e1 <= s1) e1 += 1440;
              let s2 = parseHHMM(other.std), e2 = parseHHMM(other.sta);
              if (e2 <= s2) e2 += 1440;
              return s1 < e2 && s2 < e1;
            });
            const computedFT = calcFlightTimes(row, settings.dayNightMethod, selectedYear, selectedMonth, allowLong);
            const computedTotalMins = ["dayP1","dayP1US","dayP2","nightP1","nightP1US","nightP2"].reduce((s, k) => s + parseHHMM(computedFT[k] || ""), 0);
            const computedTotal = computedTotalMins ? toHHMM(computedTotalMins) : "";
            const capColors = {
              "P1":    { color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.3)" },
              "P2":    { color: "#eab308", bg: "rgba(234,179,8,0.12)",  border: "rgba(234,179,8,0.3)" },
              "P1 U/S":{ color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)" },
            };
            const capStyle = capColors[row.cap] || null;
            const dynMode = settings.dayNightMethod === "sunrise";
            // Route (sun) method needs BOTH endpoints — highlight either when its
            // coordinates aren't in the database (the calc falls back in that case).
            const isDepUnknown = dynMode && row.departure && !getCoords(row.departure);
            const isArrUnknown = dynMode && row.arrival   && !getCoords(row.arrival);

            const hasRemarks = row.remarks && row.remarks.trim().length > 0;
            const hasSignal = hasRemarks || row.autoland;
            const baseRowBg = isEven ? "var(--elb-bg2, #0d1520)" : "var(--elb-bg3, #0a1018)";
            const rowBg = hasSignal ? "rgba(168,85,247,0.07)" : baseRowBg;
            const rowTitle = hasRemarks && row.autoland ? "Has remarks · Autoland logged"
              : hasRemarks ? "Has remarks"
              : row.autoland ? "Autoland logged"
              : undefined;
            const isExpanded = expandedRowIdx === rowIdx;

            return (
              <Fragment key={`${monthKey}-${row.id}`}>
              <tr
                title={rowTitle}
                data-search-row={row.id}
                style={{
                  background: rowBg,
                  borderLeft: hasSignal ? "3px solid #a855f7" : "3px solid transparent",
                  transition: "background 0.15s, border-color 0.15s",
                  animation: pulseRowId === row.id ? "row-pulse 3.5s ease-out" : undefined,
                }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--elb-rowhover, #122030)"}
                onMouseLeave={e => e.currentTarget.style.background = rowBg}
              >
                {/* ── ROW # + PANEL TRIGGER ── single tap expands the inline detail panel below */}
                <td style={{ ...tdStyle, padding: 0, textAlign: "center" }}>
                  <button
                    onClick={() => {
                      setOpenedRowIds(ids => ids.has(row.id) ? ids : new Set(ids).add(row.id));
                      setExpandedRowIdx(prev => prev === rowIdx ? null : rowIdx);
                      setConfirmDeleteRowIdx(null);
                    }}
                    title={isExpanded ? "Close" : "Remarks / autoland / delete"}
                    style={{
                      width: "100%", minHeight: 30, background: "transparent", border: "none",
                      cursor: "pointer", color: "#6f93b8", fontSize: 18, fontWeight: 700,
                      fontFamily: "'Courier New',monospace",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
                      padding: "4px 2px",
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = "#4fc3f7"}
                    onMouseLeave={e => e.currentTarget.style.color = "#6f93b8"}
                  >
                    <span style={{
                      display: "inline-block", minWidth: 20, padding: "2px 0", borderRadius: 3,
                      background: "rgba(79,195,247,0.14)", border: "1px solid rgba(79,195,247,0.4)",
                      color: "#e8ecf5", fontSize: 14,
                    }}>{rowIdx + 1}</span>
                    <span style={{ fontSize: 9, transition: "transform 0.18s ease", transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)" }}>▾</span>
                  </button>
                </td>
                {(() => {
                  const cells = [];
                  let skipAutoCalc = false;
                  // Anchor the HOC warning banner to the FIRST auto-calc column in
                  // DISPLAY order (dayP1 → … → total). Must walk `columns` (table
                  // order), not `autoCalcCols` (which lists "total" first) — otherwise
                  // the banner anchors at TOTAL and its colSpan spills past the table.
                  const firstAutoCalcVisible = columns.find(c => autoCalcCols.includes(c.key))?.key;
                  for (let ci = 0; ci < columns.length; ci++) {
                    const col = columns[ci];

                    const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.field === col.key;
                    const isTime = timeCols.includes(col.key);
                    const isAutoCalc = autoCalcCols.includes(col.key);
                    const isNumericEntry = isTime || col.key === "date";

                    if (needsCapWarning && firstAutoCalcVisible && col.key === firstAutoCalcVisible) {
                      skipAutoCalc = true;
                      cells.push(
                        <td key="hoc-warning" colSpan={autoCalcVisibleCount} style={{ ...tdStyle, background: "rgba(249,115,22,0.06)", borderLeft: "2px solid rgba(249,115,22,0.4)", textAlign: "center", color: "#f97316", fontSize: 11, fontStyle: "italic", letterSpacing: "0.05em", padding: "6px 10px", whiteSpace: "nowrap" }}>
                          ⚠ HOLDER OPERATING CAPACITY required to auto calculate
                        </td>
                      );
                      continue;
                    }

                    if (needsLongFlightWarning && firstAutoCalcVisible && col.key === firstAutoCalcVisible) {
                      skipAutoCalc = true;
                      cells.push(
                        <td key="long-flight-warning" colSpan={autoCalcVisibleCount} style={{ ...tdStyle, background: "rgba(234,179,8,0.06)", borderLeft: "2px solid rgba(234,179,8,0.4)", textAlign: "center", color: "#eab308", fontSize: 11, letterSpacing: "0.05em", padding: "4px 10px", whiteSpace: "nowrap" }}>
                          ⚠ {toHHMM(rawFlightMins)} BLOCK TIME — IS THIS CORRECT?
                          <button
                            onClick={() => setConfirmedLongFlights(prev => new Set([...prev, row.id]))}
                            style={{ marginLeft: 10, padding: "1px 8px", fontSize: 10, letterSpacing: "0.06em", background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.5)", color: "#eab308", borderRadius: 3, cursor: "pointer", fontFamily: "inherit", fontStyle: "normal" }}
                          >YES</button>
                          <button
                            onClick={() => { updateCell(rowIdx, "std", ""); updateCell(rowIdx, "sta", ""); }}
                            style={{ marginLeft: 5, padding: "1px 8px", fontSize: 10, letterSpacing: "0.06em", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)", color: "#ef4444", borderRadius: 3, cursor: "pointer", fontFamily: "inherit", fontStyle: "normal" }}
                          >NO</button>
                        </td>
                      );
                      continue;
                    }

                    if (skipAutoCalc && ["dayP1US","dayP2","nightP1","nightP1US","nightP2","total"].includes(col.key)) {
                      continue;
                    }

                    // Auto-hidden empty column: render a narrow collapsed cell instead
                    // of the value — matches the stub width in the header above. Dark
                    // wash, not amber — amber means "warning" elsewhere (P2, HOC missing,
                    // overlap conflicts); empty isn't a warning, so it just reads as dimmer.
                    if (isAutoCalcStub(col.key)) {
                      cells.push(
                        <td
                          key={col.key}
                          style={{
                            ...tdStyle,
                            width: 18, minWidth: 18, maxWidth: 18, padding: 0,
                            background: "repeating-linear-gradient(-45deg, rgba(0,0,0,0.32), rgba(0,0,0,0.32) 3px, transparent 3px, transparent 7px)",
                          }}
                        />
                      );
                      continue;
                    }

                    let displayVal = "";
                    if (col.key === "total") displayVal = computedTotal || "";
                    else if (isAutoCalc) displayVal = computedFT[col.key] || "";
                    else if (col.key === "date") {
                      const d = parseInt(row.date);
                      if (!d) displayVal = row.date || "";
                      else {
                        const fmt = settings.dateFormat || "D";
                        if (fmt === "DD") displayVal = String(d).padStart(2, "0");
                        else if (fmt === "DD MMM") displayVal = String(d).padStart(2, "0") + " " + MONTHS[selectedMonth].slice(0, 3).toUpperCase();
                        else displayVal = String(d);
                      }
                    }
                    else if (timeCols.includes(col.key)) {
                      displayVal = row[col.key] ? toHHMM(parseHHMM(row[col.key])) : "";
                    }
                    else displayVal = row[col.key] || "";

                    if (col.key === "pilotFlying") {
                      const isPF = row.pilotFlying === "YES";
                      cells.push(
                        <td key={col.key} style={{ ...tdStyle, textAlign: "center", padding: "4px", minWidth: col.minWidth }}>
                          <input
                            type="checkbox"
                            checked={isPF}
                            onChange={e => updateCell(rowIdx, "pilotFlying", e.target.checked ? "YES" : "")}
                            title="Pilot Flying (marks T/O & LDG for recency)"
                            style={{
                              accentColor: "#4fc3f7",
                              width: 15, height: 15,
                              cursor: "pointer",
                              verticalAlign: "middle",
                            }}
                          />
                        </td>
                      );
                      continue;
                    }

                    if (col.key === "cap") {
                      cells.push(
                        <td key={col.key} style={{ ...tdStyle, background: "transparent", minWidth: col.minWidth, padding: "2px 4px", textAlign: "center" }}>
                          <select
                            value={row[col.key] || ""}
                            onChange={e => updateCell(rowIdx, col.key, e.target.value)}
                            style={{
                              background: capStyle ? capStyle.bg : "transparent",
                              border: capStyle ? `1px solid ${capStyle.border}` : "none",
                              borderRadius: 4,
                              color: capStyle ? capStyle.color : "#7ab8d4",
                              fontFamily: "'Courier New', monospace",
                              fontSize: 13,
                              fontWeight: capStyle ? 700 : 400,
                              width: "auto",
                              cursor: "pointer",
                              outline: "none",
                              padding: "2px 6px",
                            }}
                          >
                            {["","P1","P2","P1 U/S"].map(opt => (
                              <option key={opt} value={opt} style={{ background: "var(--elb-bg2, #0d1520)", color: "var(--elb-txt, #c8d6e5)" }}>
                                {opt || "—"}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                      continue;
                    }

                    const isAfterSta = ["dayP1","dayP1US","dayP2","nightP1","nightP1US","nightP2","total"].includes(col.key);
                    cells.push(
                      <td
                        key={col.key}
                        onClick={() => !isAutoCalc && !isAfterSta && setEditingCell({ rowIdx, field: col.key })}
                        style={{
                          ...tdStyle,
                          textAlign: "center",
                          color: isAutoCalc
                            ? (col.key === "dayP1" || col.key === "nightP1" ? "#22c55e"
                              : col.key === "dayP2" || col.key === "nightP2" ? "#eab308"
                              : col.key === "dayP1US" || col.key === "nightP1US" ? "#ef4444"
                              : "#4fc3f7")
                            : col.key.startsWith("day") ? "#c8a800"
                            : col.key.startsWith("night") ? "#5a96b8"
                            : "#9bbcd4",
                          background: isAutoCalc
                            ? (col.key === "total" ? "rgba(79,195,247,0.04)" : "transparent")
                            : "transparent",
                          cursor: isAutoCalc || isAfterSta ? "default" : "text",
                          padding: isEditing ? "0" : "5px 7px",
                          minWidth: col.minWidth,
                          width: col.fixedWidth ? col.fixedWidth : undefined,
                          maxWidth: col.fixedWidth ? col.fixedWidth : undefined,
                          fontWeight: isAutoCalc ? 700 : 400,
                          whiteSpace: col.wrap ? "normal" : "nowrap",
                          wordBreak: col.wrap ? "break-word" : "normal",
                          overflow: col.wrap ? "visible" : "hidden",
                        }}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            defaultValue={row[col.key]}
                            inputMode={isNumericEntry ? "numeric" : undefined}
                            onChange={isTime ? (e => {
                              let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                              if (v.length > 2) v = v.slice(0, 2) + ":" + v.slice(2);
                              e.target.value = v;
                            }) : undefined}
                            onBlur={e => { updateCell(rowIdx, col.key, e.target.value.toUpperCase()); setEditingCell(null); }}
                            onKeyDown={e => {
                              if (e.key === "Tab") {
                                e.preventDefault();
                                updateCell(rowIdx, col.key, e.target.value.toUpperCase());
                                const tabbableCols = columns.filter(c => (c.key !== "total" && c.type !== "select" && c.type !== "checkbox")).map(c => c.key);
                                const staIdx = tabbableCols.indexOf("sta");
                                const currentIdx = tabbableCols.indexOf(col.key);
                                if (col.key === "sta") {
                                  const nextRowIdx = rowIdx + 1;
                                  if (nextRowIdx < rows.length) setEditingCell({ rowIdx: nextRowIdx, field: tabbableCols[0] });
                                  else setEditingCell(null);
                                } else if (currentIdx < staIdx) {
                                  setEditingCell({ rowIdx, field: tabbableCols[currentIdx + 1] });
                                } else {
                                  const nextRowIdx = rowIdx + 1;
                                  if (nextRowIdx < rows.length) setEditingCell({ rowIdx: nextRowIdx, field: tabbableCols[0] });
                                  else setEditingCell(null);
                                }
                              }
                              if (e.key === "Enter") { updateCell(rowIdx, col.key, e.target.value.toUpperCase()); setEditingCell(null); }
                              if (e.key === "Escape") setEditingCell(null);
                            }}
                            style={{
                              width: "100%", background: "var(--cb-surface-2, #1b2340)", border: "none",
                              borderBottom: "1px solid var(--cb-accent, #4fc3f7)", color: "var(--cb-ink, #e8ecf5)",
                              fontFamily: "var(--elb-font, 'Courier New', monospace)", fontSize: 13,
                              padding: "6px 8px", outline: "none", boxSizing: "border-box",
                              textTransform: "uppercase",
                            }}
                            placeholder={isTime ? "00:00" : ""}
                          />
                        ) : (
                          ((col.key === "departure" && isDepUnknown) || (col.key === "arrival" && isArrUnknown))
                            ? <span title="Airport not in coordinates database — Route (sun) day/night falls back for this sector" style={{ color: "rgba(155,188,212,0.6)", background: "rgba(155,188,212,0.1)", border: "1px solid rgba(155,188,212,0.35)", borderRadius: 3, padding: "2px 6px" }}>{displayVal}</span>
                            : ((col.key === "std" || col.key === "sta") && hasOverlap)
                            ? <span title="Overlaps another flight logged on this date — check for a duty conflict" style={{ color: "#eab308", background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.35)", borderRadius: 3, padding: "2px 6px" }}>{displayVal}</span>
                            : <span style={{ opacity: displayVal ? 1 : 0.2 }}>{displayVal || "—"}</span>
                        )}
                      </td>
                    );
                  }
                  return cells;
                })()}
              </tr>
              <tr>
                <td colSpan={columns.length + 1} style={{ padding: 0, border: "none" }}>
                  <div style={{
                    display: "grid",
                    gridTemplateRows: isExpanded ? "1fr" : "0fr",
                    transition: settings.panelExpandAnimation !== false ? "grid-template-rows 0.22s ease" : "none",
                  }}>
                    <div style={{ overflow: "hidden" }}>
                      {(isExpanded || openedRowIds.has(row.id)) && (() => {
                        const prevRow = rowIdx > 0 ? rows[rowIdx - 1] : null;
                        const canDuplicate = !!prevRow && isEmptyStaticRow(row);
                        const canDelete = rows.length > 1;
                        const isConfirmingDelete = confirmDeleteRowIdx === rowIdx;
                        const dutyLogMatch = settings.dutyLogSyncCode ? findDutyLogMatch(row) : null;
                        return (
                          <div style={{
                            padding: "12px 16px 16px 44px", background: "var(--elb-bg, #0a0d12)", borderBottom: "1px solid var(--elb-bdr, #1e3a5f)",
                            textAlign: "left", display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "14px 32px",
                            maxWidth: 820,
                          }}>
                            <div style={{ flex: "1 1 340px", maxWidth: 420 }}>
                              {canDuplicate && (
                                <>
                                  <button
                                    onClick={() => duplicatePreviousRow(rowIdx)}
                                    style={{
                                      display: "inline-flex", alignItems: "center", gap: 6,
                                      background: "rgba(79,195,247,0.08)", border: "1px solid rgba(79,195,247,0.4)",
                                      color: "#4fc3f7", fontFamily: "'Courier New',monospace", fontSize: 11,
                                      letterSpacing: "0.06em", padding: "7px 12px", borderRadius: 4, cursor: "pointer",
                                      marginBottom: 4,
                                    }}
                                  >⧉ DUPLICATE PREVIOUS ROW</button>
                                  <div style={{ fontSize: 10.5, color: "#4a6a8a", margin: "0 0 12px" }}>
                                    Pulls date, type, registration, captain &amp; cap from the row above; departure = its arrival.
                                  </div>
                                </>
                              )}
                              <textarea
                                key={`remarks-${row.id}`}
                                defaultValue={row.remarks}
                                onBlur={e => { e.target.style.borderColor = "var(--elb-bdr, #1e3a5f)"; updateCell(rowIdx, "remarks", e.target.value.trim()); }}
                                onFocus={e => { e.target.style.borderColor = "#4fc3f7"; e.target.style.minHeight = "66px"; }}
                                placeholder="Enter remarks for this sector..."
                                rows={hasRemarks ? 3 : 1}
                                style={{
                                  width: "100%", background: "var(--cb-surface-1, #141a2e)", border: "1px solid var(--elb-bdr, #1e3a5f)",
                                  borderRadius: 4, color: "var(--cb-ink, #e8ecf5)", fontFamily: "'Courier New',monospace",
                                  fontSize: 12.5, padding: "9px 10px", resize: "vertical", outline: "none",
                                  boxSizing: "border-box", lineHeight: 1.6, minHeight: hasRemarks ? 66 : 30,
                                  transition: "min-height 0.15s ease", marginBottom: 14,
                                }}
                              />
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <input
                                  type="checkbox"
                                  checked={row.autoland || false}
                                  onChange={e => updateCell(rowIdx, "autoland", e.target.checked)}
                                  style={{ width: 14, height: 14, cursor: "pointer", accentColor: "#a855f7" }}
                                />
                                <label style={{ fontSize: 10.5, color: "#c8d6e5", letterSpacing: "0.08em", cursor: "pointer" }}>AUTOLAND</label>
                                <button
                                  onClick={() => setActivePopup("rec-autoland")}
                                  title="View regulatory reference"
                                  style={{
                                    width: 14, height: 14, borderRadius: "50%",
                                    background: "transparent", border: "1px solid var(--elb-bdr, #1e3a5f)",
                                    color: "#4a6a8a", fontFamily: "Georgia,serif",
                                    fontStyle: "italic", fontWeight: 700, fontSize: 10,
                                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                                    padding: 0, lineHeight: 1, flexShrink: 0,
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#4fc3f7"; e.currentTarget.style.color = "#4fc3f7"; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--elb-bdr, #1e3a5f)"; e.currentTarget.style.color = "#4a6a8a"; }}
                                >i</button>
                              </div>
                            </div>

                            {settings.dutyLogSyncCode && (
                              <div style={{ flex: "1 1 280px", maxWidth: 340, paddingLeft: 28, borderLeft: "1px solid var(--elb-bdr, #1e3a5f)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                                  <span style={{ fontSize: 10.5, letterSpacing: "0.1em", color: "#7c87a3", textTransform: "uppercase" }}>Duty Log</span>
                                  {dutyLogMatch ? (
                                    <span style={{ fontSize: 9.5, letterSpacing: "0.08em", padding: "2px 8px", borderRadius: 20, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.35)", color: "#34d399" }}>
                                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
                                      Linked{dutyLogMatch.sector.fltNo ? ` · FLT ${dutyLogMatch.sector.fltNo}` : ""}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 9.5, letterSpacing: "0.08em", padding: "2px 8px", borderRadius: 20, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(124,135,163,0.08)", border: "1px solid var(--elb-bdr, #1e3a5f)", color: "#7c87a3" }}>
                                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
                                      No match
                                    </span>
                                  )}
                                </div>
                                {dutyLogMatch ? (
                                  <>
                                    <div style={{ fontSize: 9, letterSpacing: "0.08em", color: "#4a6a8a", textTransform: "uppercase", marginBottom: 8 }}>Crew</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                      {(dutyLogMatch.log.crew || []).length > 0 ? sortCrewByRank(dutyLogMatch.log.crew).map((c, ci) => (
                                        <div key={ci} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12 }}>
                                          <span style={{ color: "var(--cb-ink, #e8ecf5)" }}>{c.name}</span>
                                          <span style={{ color: "#7c87a3", fontSize: 9.5, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{(c.position || "").toUpperCase()}</span>
                                        </div>
                                      )) : (
                                        <div style={{ fontSize: 11, color: "#4a6a8a" }}>No crew listed</div>
                                      )}
                                    </div>
                                    <div style={{ marginTop: 12, fontSize: 10, color: "#4a6a8a" }}>
                                      Sourced from Duty Log entry · {dutyLogMatch.isoDate} · sector remark + duty notes merge into Remarks, crew list is read-only display
                                    </div>
                                  </>
                                ) : (
                                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(124,135,163,0.05)", border: "1px dashed var(--elb-bdr, #1e3a5f)", borderRadius: 4, fontSize: 11, color: "#7c87a3" }}>
                                    No duty log entry found for this date/route. Check it was logged the same way in Duty Log.
                                  </div>
                                )}
                              </div>
                            )}

                            {canDelete && (
                              <div style={{ flex: "1 1 100%", marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--elb-bdr, #1e3a5f)" }}>
                                {isConfirmingDelete ? (
                                  <div style={{
                                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                                    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.4)",
                                    borderRadius: 4, padding: "8px 11px", fontSize: 11, color: "#c8d6e5",
                                  }}>
                                    <span>Delete this row? Can't be undone.</span>
                                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                      <button
                                        onClick={() => setConfirmDeleteRowIdx(null)}
                                        style={{ fontFamily: "'Courier New',monospace", fontSize: 10.5, padding: "5px 9px", borderRadius: 3, cursor: "pointer", background: "transparent", border: "1px solid var(--elb-bdr, #1e3a5f)", color: "#7c87a3" }}
                                      >Cancel</button>
                                      <button
                                        onClick={() => { deleteRow(rowIdx); setConfirmDeleteRowIdx(null); setExpandedRowIdx(null); }}
                                        style={{ fontFamily: "'Courier New',monospace", fontSize: 10.5, padding: "5px 9px", borderRadius: 3, cursor: "pointer", background: "#ef4444", border: "1px solid #ef4444", color: "#fff", fontWeight: 700 }}
                                      >Delete</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                    <button
                                      onClick={() => {
                                        if (rowHasData(row)) setConfirmDeleteRowIdx(rowIdx);
                                        else { deleteRow(rowIdx); setExpandedRowIdx(null); }
                                      }}
                                      style={{
                                        background: "transparent", border: "1px solid rgba(239,68,68,0.4)", color: "#ef4444",
                                        fontFamily: "'Courier New',monospace", fontSize: 10.5, letterSpacing: "0.08em",
                                        padding: "7px 12px", borderRadius: 4, cursor: "pointer",
                                      }}
                                    >🗑 DELETE ROW</button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </td>
              </tr>
              </Fragment>
            );
          })}

          {/* ── TOTALS ROW ── */}
          <tr style={{ background: "var(--elb-bginput, #0b1828)", borderTop: "2px solid var(--elb-bdr, #1e3a5f)" }}>
            <td colSpan={totalsLabelColSpan} style={{ ...tdStyle, color: "#4fc3f7", fontSize: 12, letterSpacing: "0.12em", fontWeight: 700 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <button
                  onClick={addSector}
                  title="Add sector row"
                  style={{
                    width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                    background: "rgba(39,174,96,0.9)", border: "1px solid #27ae60",
                    color: "#fff", cursor: "pointer", fontSize: 16, fontWeight: 900,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#27ae60"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(39,174,96,0.9)"}
                >+</button>
                <span style={{ flex: 1, textAlign: "right" }}>MONTHLY TOTALS →</span>
              </div>
            </td>
            {/* DAY/NIGHT/TOTAL totals — narrow stub cells match the header/body columns above */}
            {["dayP1","dayP1US","dayP2","nightP1","nightP1US","nightP2","total"]
              .map(k => isAutoCalcStub(k) ? (
                <td key={k} style={{
                  ...tdStyle,
                  width: 18, minWidth: 18, maxWidth: 18, padding: 0,
                  background: "repeating-linear-gradient(-45deg, rgba(0,0,0,0.32), rgba(0,0,0,0.32) 3px, transparent 3px, transparent 7px)",
                }} />
              ) : (
                <td key={k} style={{
                  ...tdStyle,
                  textAlign: "center",
                  color: k === "total" ? "#4fc3f7"
                    : (k === "dayP1" || k === "nightP1") ? "#22c55e"
                    : (k === "dayP2" || k === "nightP2") ? "#eab308"
                    : (k === "dayP1US" || k === "nightP1US") ? "#ef4444"
                    : "#4fc3f7",
                  fontWeight: 700,
                  fontSize: 14,
                }}>
                  {totalsRow[k]}
                </td>
              ))}
          </tr>

        </tbody>
      </table>
    </div>
  );
}
