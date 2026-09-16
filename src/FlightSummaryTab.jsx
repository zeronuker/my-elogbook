import { useState, useMemo } from "react";
import { MONTHS, calcFlightTimes, parseHHMM, toHHMM, makeMonthRows } from "./logbookCalculations";
import { thStyle, thSubStyle, tdStyle } from "./logbookConstants";

export default function FlightSummaryTab({ data, settings, selectedMonth, selectedYear, setSelectedMonth, setSelectedYear, setActiveTab }) {
  const [periodPreset, setPeriodPreset] = useState("asof"); // "12m" | "month" | "asof" | "custom"
  const [periodCustomFrom, setPeriodCustomFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [periodCustomTo, setPeriodCustomTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [periodIncludeCF, setPeriodIncludeCF] = useState(true);
  const [periodWarning, setPeriodWarning] = useState("");

  const GT_KEYS = ["dayP1", "dayP1US", "dayP2", "nightP1", "nightP1US", "nightP2"];

  const todayStr = new Date().toISOString().split("T")[0];
  const earliestLogDateStr = useMemo(() => {
    let earliest = null;
    Object.entries(data).forEach(([key, rows]) => {
      const [monthStr, yearStr] = key.split("-");
      const monthIdx = parseInt(monthStr), year = parseInt(yearStr);
      if (isNaN(monthIdx) || isNaN(year) || !Array.isArray(rows)) return;
      rows.forEach(row => {
        const day = parseInt(row.date?.split('/')[0]);
        if (!day || !row.type) return;
        const d = new Date(year, monthIdx, day);
        if (!earliest || d < earliest) earliest = d;
      });
    });
    return earliest ? earliest.toISOString().split("T")[0] : todayStr;
  }, [data, todayStr]);

  // Resolves the active preset (or custom inputs) into a clamped { from, to } range.
  const periodRange = useMemo(() => {
    let from, to;
    if (periodPreset === "12m") {
      const d = new Date(); d.setMonth(d.getMonth() - 12);
      from = d.toISOString().split("T")[0];
      to = todayStr;
    } else if (periodPreset === "month") {
      const now = new Date();
      from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      to = todayStr;
    } else if (periodPreset === "asof") {
      from = earliestLogDateStr;
      to = todayStr;
    } else {
      from = periodCustomFrom;
      to = periodCustomTo;
    }
    if (from < earliestLogDateStr) from = earliestLogDateStr;
    if (to > todayStr) to = todayStr;
    if (from > to) from = to;
    return { from, to };
  }, [periodPreset, periodCustomFrom, periodCustomTo, earliestLogDateStr, todayStr]);

  const handlePeriodFromChange = (val) => {
    if (val < earliestLogDateStr || val > todayStr) {
      setPeriodWarning(`No entries before ${earliestLogDateStr} or after today.`);
      val = val < earliestLogDateStr ? earliestLogDateStr : todayStr;
    } else {
      setPeriodWarning("");
    }
    setPeriodCustomFrom(val);
  };
  const handlePeriodToChange = (val) => {
    if (val < earliestLogDateStr || val > todayStr) {
      setPeriodWarning(`No entries before ${earliestLogDateStr} or after today.`);
      val = val < earliestLogDateStr ? earliestLogDateStr : todayStr;
    } else {
      setPeriodWarning("");
    }
    setPeriodCustomTo(val);
  };

  const { periodTotals, periodSum } = useMemo(() => {
    const fromDate = new Date(periodRange.from + "T00:00:00");
    const toDate = new Date(periodRange.to + "T23:59:59");
    const byType = {};
    if (periodIncludeCF) {
      (settings.carryForward || []).forEach(cf => {
        const t = (cf.type || "").trim().toUpperCase();
        if (!t) return;
        if (!byType[t]) byType[t] = { dayP1:0, dayP1US:0, dayP2:0, nightP1:0, nightP1US:0, nightP2:0 };
        GT_KEYS.forEach(k => { byType[t][k] += parseHHMM(cf[k] || ""); });
      });
    }
    Object.entries(data).forEach(([key, rows]) => {
      const [monthStr, yearStr] = key.split("-");
      const monthIdx = parseInt(monthStr), year = parseInt(yearStr);
      if (isNaN(monthIdx) || isNaN(year) || !Array.isArray(rows)) return;
      rows.forEach(row => {
        const day = parseInt(row.date?.split('/')[0]);
        if (!day || !row.type) return;
        const d = new Date(year, monthIdx, day);
        if (d < fromDate || d > toDate) return;
        const t = (row.type || "").trim().toUpperCase();
        if (!t) return;
        if (!byType[t]) byType[t] = { dayP1:0, dayP1US:0, dayP2:0, nightP1:0, nightP1US:0, nightP2:0 };
        const ft = calcFlightTimes(row, settings.dayNightMethod, year, monthIdx);
        GT_KEYS.forEach(k => { byType[t][k] += parseHHMM(ft[k] || ""); });
      });
    });
    const totals = Object.entries(byType)
      .map(([type, t]) => ({ type, ...t }))
      .sort((a, b) => a.type.localeCompare(b.type));
    const sum = GT_KEYS.reduce((acc, k) => {
      acc[k] = totals.reduce((s, r) => s + r[k], 0);
      return acc;
    }, {});
    return { periodTotals: totals, periodSum: sum };
  }, [data, periodRange.from, periodRange.to, periodIncludeCF, settings.carryForward, settings.dayNightMethod]);

  const summaryByMonth = useMemo(() =>
    MONTHS.map((_, i) => {
      const mRows = data[`${i}-${selectedYear}`] || makeMonthRows(i, selectedYear);
      const filled = mRows.filter(r => r.date || r.type).length;
      const mins = mRows.reduce((acc, r) => {
        const ft = calcFlightTimes(r, settings.dayNightMethod, selectedYear, i);
        acc.dayP1     += parseHHMM(ft.dayP1);
        acc.dayP1US   += parseHHMM(ft.dayP1US);
        acc.dayP2     += parseHHMM(ft.dayP2);
        acc.nightP1   += parseHHMM(ft.nightP1);
        acc.nightP1US += parseHHMM(ft.nightP1US);
        acc.nightP2   += parseHHMM(ft.nightP2);
        return acc;
      }, { dayP1: 0, dayP1US: 0, dayP2: 0, nightP1: 0, nightP1US: 0, nightP2: 0 });
      return {
        filled,
        dp1:  toHHMM(mins.dayP1)     || "00:00",
        dp1u: toHHMM(mins.dayP1US)   || "00:00",
        dp2:  toHHMM(mins.dayP2)     || "00:00",
        np1:  toHHMM(mins.nightP1)   || "00:00",
        np1u: toHHMM(mins.nightP1US) || "00:00",
        np2:  toHHMM(mins.nightP2)   || "00:00",
        tot:  toHHMM(mins.dayP1 + mins.dayP1US + mins.dayP2 + mins.nightP1 + mins.nightP1US + mins.nightP2) || "00:00",
      };
    }),
  [data, selectedYear, settings.dayNightMethod]);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "#4fc3f7", letterSpacing: "0.15em" }}>
            {selectedYear} ANNUAL OVERVIEW — ALL MONTHS
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 800 }}>
            <thead>
              <tr style={{ background: "var(--elb-bg2, #0b1320)" }}>
                <th rowSpan={2} style={{ ...thStyle, width: "1%", minWidth: 80 }}>MONTH</th>
                <th rowSpan={2} style={{ ...thStyle, width: "1%", minWidth: 55 }}>SECTORS</th>
                <th colSpan={3} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", color: "#f5c542", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>☀ DAY</th>
                <th colSpan={3} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", color: "#7ab8d4", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>☾ NIGHT</th>
                <th rowSpan={2} style={{ ...thStyle, width: "1%" }}>TOTAL</th>
              </tr>
              <tr style={{ background: "var(--elb-bg2, #0b1320)" }}>
                <th style={{ ...thSubStyle, width: "1%", color: "#22c55e" }}>P1</th>
                <th style={{ ...thSubStyle, width: "1%", color: "#ef4444" }}>P1 U/S</th>
                <th style={{ ...thSubStyle, width: "1%", color: "#eab308" }}>P2</th>
                <th style={{ ...thSubStyle, width: "1%", color: "#22c55e" }}>P1</th>
                <th style={{ ...thSubStyle, width: "1%", color: "#ef4444" }}>P1 U/S</th>
                <th style={{ ...thSubStyle, width: "1%", color: "#eab308" }}>P2</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((m, i) => {
                const { filled, dp1, dp1u, dp2, np1, np1u, np2, tot } = summaryByMonth[i];
                const isSelected = i === selectedMonth;
                return (
                  <tr
                    key={i}
                    onClick={() => { setSelectedMonth(i); setSelectedYear(selectedYear); setActiveTab("logbook"); }}
                    style={{
                      background: isSelected ? "rgba(79,195,247,0.08)" : i % 2 === 0 ? "var(--elb-bg2, #0d1520)" : "var(--elb-bg3, #0a1018)",
                      cursor: "pointer",
                      borderLeft: isSelected ? "3px solid var(--elb-acc, #4fc3f7)" : "3px solid transparent",
                    }}
                  >
                    <td style={{ ...tdStyle, width: "1%", minWidth: 80, textAlign: "center", color: isSelected ? "#4fc3f7" : "#9bbcd4", fontWeight: isSelected ? 700 : 400 }}>{m.toUpperCase()}</td>
                    <td style={{ ...tdStyle, width: "1%", minWidth: 55, textAlign: "center", color: "#9bbcd4" }}>{filled || "—"}</td>
                    <td style={{ ...tdStyle, width: "1%", textAlign: "center", color: "#22c55e" }}>{dp1  === "00:00" ? "—" : dp1}</td>
                    <td style={{ ...tdStyle, width: "1%", textAlign: "center", color: "#ef4444" }}>{dp1u === "00:00" ? "—" : dp1u}</td>
                    <td style={{ ...tdStyle, width: "1%", textAlign: "center", color: "#eab308" }}>{dp2  === "00:00" ? "—" : dp2}</td>
                    <td style={{ ...tdStyle, width: "1%", textAlign: "center", color: "#22c55e" }}>{np1  === "00:00" ? "—" : np1}</td>
                    <td style={{ ...tdStyle, width: "1%", textAlign: "center", color: "#ef4444" }}>{np1u === "00:00" ? "—" : np1u}</td>
                    <td style={{ ...tdStyle, width: "1%", textAlign: "center", color: "#eab308" }}>{np2  === "00:00" ? "—" : np2}</td>
                    <td style={{ ...tdStyle, width: "1%", textAlign: "center", color: "#4fc3f7", fontWeight: 700 }}>{tot === "00:00" ? "—" : tot}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "var(--elb-bginput, #0b1828)", borderTop: "2px solid var(--elb-bdr, #1e3a5f)" }}>
                <td style={{ ...tdStyle, width: "1%", minWidth: 80, textAlign: "center", color: "#4fc3f7", fontWeight: 700 }}>ANNUAL TOTAL</td>
                <td style={{ ...tdStyle, width: "1%", minWidth: 55, textAlign: "center", color: "#4fc3f7", fontWeight: 700 }}>
                  {summaryByMonth.reduce((acc, m) => acc + m.filled, 0) || "—"}
                </td>
                {[
                  { k: "dayP1",   key: "dp1"  },
                  { k: "dayP1US", key: "dp1u" },
                  { k: "dayP2",   key: "dp2"  },
                  { k: "nightP1", key: "np1"  },
                  { k: "nightP1US", key: "np1u" },
                  { k: "nightP2", key: "np2"  },
                ].map(({ k, key }) => {
                  const total = toHHMM(summaryByMonth.reduce((acc, m) => acc + parseHHMM(m[key]), 0));
                  const col = (k === "dayP1" || k === "nightP1") ? "#22c55e"
                    : (k === "dayP2" || k === "nightP2") ? "#eab308"
                    : "#ef4444";
                  return (
                    <td key={k} style={{ ...tdStyle, width: "1%", textAlign: "center", color: col, fontWeight: 700 }}>
                      {total || "—"}
                    </td>
                  );
                })}
                <td style={{ ...tdStyle, width: "1%", textAlign: "center", color: "#4fc3f7", fontWeight: 700 }}>
                  {toHHMM(summaryByMonth.reduce((acc, m) => acc + parseHHMM(m.tot), 0)) || "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div style={{ fontSize: 12, color: "#3a5a7a", marginTop: 10 }}>
          Click any month row to jump to its logbook page.
        </div>
      </div>

      {/* ── GRAND TOTAL HOURS IN PERIOD ── */}
      <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--elb-bdr3, #0f1820)" }}>
        <div style={{ fontSize: 13, letterSpacing: "0.15em", color: "#4fc3f7", marginBottom: 14 }}>
          GRAND TOTAL HOURS IN PERIOD :
        </div>

        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {[
            { key: "12m",    label: "LAST 12 MONTHS" },
            { key: "month",  label: "CURRENT MONTH" },
            { key: "asof",   label: "AS OF TODAY" },
            { key: "custom", label: "CUSTOM" },
          ].map(p => {
            const active = periodPreset === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => { setPeriodPreset(p.key); setPeriodWarning(""); }}
                style={{
                  background: active ? "rgba(79,195,247,0.14)" : "rgba(79,195,247,0.08)",
                  border: active ? "1px solid #4fc3f7" : "1px solid #1e3a5f",
                  borderRadius: 3, color: active ? "#4fc3f7" : "var(--elb-txt-muted, #4a6a8a)",
                  fontFamily: "var(--elb-font, 'Courier New', monospace)",
                  fontSize: 10, letterSpacing: "0.1em", padding: "3px 8px",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {p.label}
              </button>
            );
          })}

          <span style={{ width: 1, height: 18, background: "#1e3a5f", margin: "0 4px" }} />

          <button
            type="button"
            role="switch"
            aria-checked={periodIncludeCF}
            onClick={() => setPeriodIncludeCF(v => !v)}
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <span style={{ position: "relative", width: 30, height: 16, background: periodIncludeCF ? "#4fc3f7" : "#1e3a5f", borderRadius: 8, display: "inline-block", transition: "background 0.15s" }}>
              <span style={{ position: "absolute", top: 2, left: periodIncludeCF ? 16 : 2, width: 12, height: 12, background: "#0a0d12", borderRadius: "50%", transition: "left 0.15s" }} />
            </span>
            <span style={{ fontSize: "var(--elb-hint-sz)", letterSpacing: "0.1em", color: periodIncludeCF ? "#4fc3f7" : "var(--elb-txt-muted, #4a6a8a)" }}>
              + CARRY FORWARD
            </span>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 6 }}>
          {periodPreset === "custom" ? (
            <>
              <span style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--elb-txt-muted, #4a6a8a)" }}>FROM</span>
              <input
                type="date"
                value={periodCustomFrom}
                min={earliestLogDateStr}
                max={todayStr}
                onChange={e => handlePeriodFromChange(e.target.value)}
                style={{
                  background: "transparent", border: "none", borderBottom: "1px dashed #4fc3f7",
                  color: "#4fc3f7", fontFamily: "var(--elb-font, 'Courier New', monospace)",
                  fontSize: 13, letterSpacing: "0.1em", fontWeight: 700,
                  cursor: "pointer", padding: "0 0 2px 0", outline: "none",
                  colorScheme: "dark",
                }}
              />
              <span style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--elb-txt-muted, #4a6a8a)" }}>TO</span>
              <input
                type="date"
                value={periodCustomTo}
                min={earliestLogDateStr}
                max={todayStr}
                onChange={e => handlePeriodToChange(e.target.value)}
                style={{
                  background: "transparent", border: "none", borderBottom: "1px dashed #4fc3f7",
                  color: "#4fc3f7", fontFamily: "var(--elb-font, 'Courier New', monospace)",
                  fontSize: 13, letterSpacing: "0.1em", fontWeight: 700,
                  cursor: "pointer", padding: "0 0 2px 0", outline: "none",
                  colorScheme: "dark",
                }}
              />
            </>
          ) : (
            <>
              <span style={{ fontSize: 11, letterSpacing: "0.1em", color: "var(--elb-txt-muted, #4a6a8a)" }}>RANGE</span>
              <span style={{ fontSize: 13, letterSpacing: "0.1em", color: "#4fc3f7", fontWeight: 700 }}>
                {periodRange.from} — {periodRange.to}
              </span>
            </>
          )}
        </div>

        {periodWarning && (
          <div style={{ fontSize: 11, color: "#eab308", letterSpacing: "0.04em", marginBottom: 14 }}>
            {periodWarning}
          </div>
        )}

        {periodTotals.length === 0 ? (
          <div style={{ color: "#2a4a6a", fontSize: "var(--elb-desc-sz)", letterSpacing: "0.08em", padding: "16px 0" }}>
            No logbook entries{periodIncludeCF ? " or carry-forward hours" : ""} found in this period.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
              <thead>
                <tr style={{ background: "var(--elb-thead, #0b1320)" }}>
                  <th rowSpan={2} style={{ ...thStyle, width: "1%", minWidth: 90 }}>AIRCRAFT TYPE</th>
                  <th colSpan={3} style={{ ...thStyle, borderBottom: "1px solid var(--elb-bdr2, #1a3050)", textAlign: "center", color: "#f5c542", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>☀ DAY</th>
                  <th colSpan={3} style={{ ...thStyle, borderBottom: "1px solid var(--elb-bdr2, #1a3050)", textAlign: "center", color: "#7ab8d4", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>☾ NIGHT</th>
                  <th rowSpan={2} style={{ ...thStyle, width: "1%" }}>TOTAL</th>
                </tr>
                <tr style={{ background: "var(--elb-thead, #0b1320)" }}>
                  <th style={{ ...thSubStyle, width: "1%", color: "#22c55e" }}>P1</th>
                  <th style={{ ...thSubStyle, width: "1%", color: "#ef4444" }}>P1 U/S</th>
                  <th style={{ ...thSubStyle, width: "1%", color: "#eab308" }}>P2</th>
                  <th style={{ ...thSubStyle, width: "1%", color: "#22c55e" }}>P1</th>
                  <th style={{ ...thSubStyle, width: "1%", color: "#ef4444" }}>P1 U/S</th>
                  <th style={{ ...thSubStyle, width: "1%", color: "#eab308" }}>P2</th>
                </tr>
              </thead>
              <tbody>
                {periodTotals.map((row, i) => {
                  const rowTotal = toHHMM(GT_KEYS.reduce((s, k) => s + row[k], 0));
                  const colMap = { dayP1:"#22c55e", dayP1US:"#ef4444", dayP2:"#eab308", nightP1:"#22c55e", nightP1US:"#ef4444", nightP2:"#eab308" };
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? "var(--elb-bg2, #0d1520)" : "var(--elb-bg3, #0a1018)" }}>
                      <td style={{ ...tdStyle, width: "1%", minWidth: 90, textAlign: "center", color: "#9bbcd4" }}>
                        {row.type}
                      </td>
                      {GT_KEYS.map(k => (
                        <td key={k} style={{ ...tdStyle, width: "1%", textAlign: "center", color: row[k] ? colMap[k] : "#2a4a6a" }}>
                          {row[k] ? toHHMM(row[k]) : "—"}
                        </td>
                      ))}
                      <td style={{ ...tdStyle, width: "1%", textAlign: "center", color: "#4fc3f7", fontWeight: 700 }}>
                        {rowTotal || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--elb-bginput, #0b1828)", borderTop: "2px solid var(--elb-bdr, #1e3a5f)" }}>
                  <td style={{ ...tdStyle, width: "1%", minWidth: 90, textAlign: "center", color: "#4fc3f7", fontWeight: 700 }}>GRAND TOTAL</td>
                  {GT_KEYS.map(k => {
                    const colMap = { dayP1:"#22c55e", dayP1US:"#ef4444", dayP2:"#eab308", nightP1:"#22c55e", nightP1US:"#ef4444", nightP2:"#eab308" };
                    return (
                      <td key={k} style={{ ...tdStyle, width: "1%", textAlign: "center", color: colMap[k], fontWeight: 700 }}>
                        {periodSum[k] ? toHHMM(periodSum[k]) : "—"}
                      </td>
                    );
                  })}
                  <td style={{ ...tdStyle, width: "1%", textAlign: "center", color: "#4fc3f7", fontWeight: 700 }}>
                    {toHHMM(GT_KEYS.reduce((s, k) => s + periodSum[k], 0)) || "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
