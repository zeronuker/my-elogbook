import { useState } from "react";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const EMPTY_ROW = () => ({
  date: "",
  type: "",
  markings: "",
  captain: "",
  cap: "",
  sectors: "",
  departure: "",
  arrival: "",
  std: "",
  sta: "",
  dayP1: "",
  dayP1US: "",
  dayP2: "",
  nightP1: "",
  nightP1US: "",
  nightP2: "",
  total: "",
  remarks: "",
});

const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

function getDaysInMonth(monthIdx, year) {
  return new Date(year, monthIdx + 1, 0).getDate();
}

function makeMonthRows(monthIdx, year) {
  const days = getDaysInMonth(monthIdx, year);
  return Array.from({ length: days }, (_, idx) => ({ id: idx + 1, ...EMPTY_ROW() }));
}

const initialData = () => {
  const d = {};
  MONTHS.forEach((m, i) => {
    YEARS.forEach(y => {
      d[`${i}-${y}`] = makeMonthRows(i, y);
    });
  });
  return d;
};

function parseHHMM(val) {
  if (!val || !val.trim()) return 0;
  const parts = val.trim().split(":");
  if (parts.length === 2) {
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    return h * 60 + m;
  }
  return 0;
}

function toHHMM(mins) {
  if (!mins) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

function calcTotal(row) {
  const sum = ["dayP1","dayP1US","dayP2","nightP1","nightP1US","nightP2"]
    .reduce((acc, k) => acc + parseHHMM(row[k]), 0);
  return sum ? toHHMM(sum) : "";
}

function sumColumn(rows, key) {
  const total = rows.reduce((acc, r) => acc + parseHHMM(r[key]), 0);
  return total ? toHHMM(total) : "00:00";
}

export default function ELogbook2026() {
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [data, setData] = useState(initialData);
  const [editingCell, setEditingCell] = useState(null); // {rowIdx, field}
  const [activeTab, setActiveTab] = useState("logbook");

  const monthKey = `${selectedMonth}-${selectedYear}`;
  const rows = data[monthKey] || makeMonthRows(selectedMonth, selectedYear);

  const updateCell = (rowIdx, field, value) => {
    setData(prev => {
      const current = prev[monthKey] || makeMonthRows(selectedMonth, selectedYear);
      const newRows = current.map((r, i) =>
        i === rowIdx ? { ...r, [field]: value } : r
      );
      return { ...prev, [monthKey]: newRows };
    });
  };

  const handleMonthChange = (newMonthIdx) => {
    setSelectedMonth(newMonthIdx);
    setEditingCell(null);
  };

  const handleYearChange = (newYear) => {
    setSelectedYear(newYear);
    setEditingCell(null);
  };

  // Column definitions — minWidth sets the header-label minimum; columns grow with data
  // captain is fixed at 60px with text wrapping
  const columns = [
    { key: "date",      label: "DATE",                        minWidth: 36,  group: null },
    { key: "type",      label: "TYPE",                        minWidth: 36,  group: "AIRCRAFT" },
    { key: "markings",  label: "MARKINGS",                    minWidth: 58,  group: "AIRCRAFT" },
    { key: "captain",   label: "CAPTAIN",                     minWidth: 60, fixedWidth: 60, wrap: true, group: null },
    { key: "cap",       label: "HOLDER\nOPERATING\nCAPACITY", minWidth: 58,  group: null, type: "select", options: ["","P1","P2","P1 U/S"] },
    { key: "departure", label: "DEP",                         minWidth: 30,  group: "SECTORS" },
    { key: "arrival",   label: "ARR",                         minWidth: 30,  group: "SECTORS" },
    { key: "std",       label: "STD",                         minWidth: 38,  group: null },
    { key: "sta",       label: "STA",                         minWidth: 38,  group: null },
    { key: "dayP1",     label: "P1",                          minWidth: 30,  group: "DAY" },
    { key: "dayP1US",   label: "P1 U/S",                      minWidth: 42,  group: "DAY" },
    { key: "dayP2",     label: "P2",                          minWidth: 30,  group: "DAY" },
    { key: "nightP1",   label: "P1",                          minWidth: 30,  group: "NIGHT" },
    { key: "nightP1US", label: "P1 U/S",                      minWidth: 42,  group: "NIGHT" },
    { key: "nightP2",   label: "P2",                          minWidth: 30,  group: "NIGHT" },
    { key: "total",     label: "TOTAL",                       minWidth: 42,  group: null },
  ];

  const timeCols = ["dayP1","dayP1US","dayP2","nightP1","nightP1US","nightP2","total"];

  const totalsRow = {
    dayP1:     sumColumn(rows, "dayP1"),
    dayP1US:   sumColumn(rows, "dayP1US"),
    dayP2:     sumColumn(rows, "dayP2"),
    nightP1:   sumColumn(rows, "nightP1"),
    nightP1US: sumColumn(rows, "nightP1US"),
    nightP2:   sumColumn(rows, "nightP2"),
    total:     toHHMM(rows.reduce((acc, r) => acc + parseHHMM(calcTotal(r)), 0)) || "00:00",
  };

  return (
    <div style={{
      background: "#0a0d12",
      minHeight: "100vh",
      fontFamily: "'Courier New', Courier, monospace",
      color: "#c8d6e5",
    }}>

      {/* ── HEADER ── */}
      <div style={{
        background: "linear-gradient(135deg, #0d1117 0%, #161d2a 100%)",
        borderBottom: "1px solid #1e3a5f",
        padding: "18px 24px 0",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, textAlign: "left" }}>
  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 20, color: "#4fc3f7" }}>✈</span>
              <span style={{ fontSize: 11, letterSpacing: "0.25em", color: "#4fc3f7", textTransform: "uppercase" }}>
                eLOGBOOK V5.1 · CAAM / MCAR 2016
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#7ab8d4", marginBottom: 2 }}>
              eLOGBOOK v5.1 · CAA MALAYSIA / MCAR 2016
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#e8f4fd", letterSpacing: "0.05em" }}>
              {MONTHS[selectedMonth].toUpperCase()} {selectedYear} — FLIGHT RECORDS
            </div>
            <div style={{ fontSize: 10, color: "#5a7a9a", marginTop: 3 }}>
              Compliant with CAD 1901 • MCAR 2016 Part 7 (FTL) • Part 8 (Licensing) • ICAO Annex 1
            </div>
          </div>

          {/* Month + Year selectors */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <div style={{ fontSize: 9, color: "#4a6a8a", letterSpacing: "0.15em" }}>SELECT PERIOD</div>
            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={selectedMonth}
                onChange={e => handleMonthChange(Number(e.target.value))}
                style={selectStyle}
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i}>{m.toUpperCase()}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={e => handleYearChange(Number(e.target.value))}
                style={{ ...selectStyle, minWidth: 90 }}
              >
                {YEARS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0 }}>
          {[
            { id: "logbook",  label: "📋 LOGBOOK" },
            { id: "summary",  label: "📊 MONTHLY SUMMARY" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              background: activeTab === tab.id ? "#0a0d12" : "transparent",
              border: "none",
              borderTop: activeTab === tab.id ? "2px solid #4fc3f7" : "2px solid transparent",
              borderLeft: "1px solid " + (activeTab === tab.id ? "#1e3a5f" : "transparent"),
              borderRight: "1px solid " + (activeTab === tab.id ? "#1e3a5f" : "transparent"),
              color: activeTab === tab.id ? "#4fc3f7" : "#5a7a9a",
              padding: "7px 18px",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "'Courier New', monospace",
              marginBottom: activeTab === tab.id ? "-1px" : 0,
            }}>{tab.label}</button>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: "18px 24px" }}>

        {/* ── LOGBOOK TAB ── */}
        {activeTab === "logbook" && (
          <div style={{ overflowX: "auto" }}>
            <div style={{
              background: "rgba(79,195,247,0.06)",
              border: "1px solid rgba(79,195,247,0.18)",
              borderLeft: "3px solid #4fc3f7",
              borderRadius: "0 4px 4px 0",
              padding: "8px 14px",
              marginBottom: 14,
              fontSize: 10,
              color: "#7ab8d4",
            }}>
              <span style={{ color: "#4fc3f7", fontWeight: 700 }}>
                {MONTHS[selectedMonth].toUpperCase()} {selectedYear} —
              </span>
              {" "}Click any cell to enter data. Time fields format: HH:MM (e.g. 02:30). TOTAL auto-calculates from Day + Night columns. ({rows.length} days)
            </div>

            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 11,
              tableLayout: "auto",
            }}>

              {/* ── THEAD: two rows matching screen3 ── */}
              <thead>
                {/* Row 1: group labels */}
                <tr style={{ background: "#0b1320" }}>
                  <th rowSpan={2} style={thStyle}>#</th>

                  {/* DATE — rowspan */}
                  <th rowSpan={2} style={thStyle}>DATE</th>

                  {/* AIRCRAFT group — spans TYPE + MARKINGS */}
                  <th colSpan={2} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", color: "#4fc3f7", fontSize: 9, letterSpacing: "0.15em" }}>
                    AIRCRAFT
                  </th>

                  {/* CAPTAIN rowspan */}
                  <th rowSpan={2} style={thStyle}>CAPTAIN</th>

                  {/* HOC rowspan */}
                  <th rowSpan={2} style={{ ...thStyle, lineHeight: 1.4 }}>
                    <span style={{ display: "block" }}>HOLDER</span>
                    <span style={{ display: "block" }}>OPERATING</span>
                    <span style={{ display: "block" }}>CAPACITY</span>
                  </th>

                  {/* SECTORS group — spans DEP + ARR */}
                  <th colSpan={2} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", color: "#4fc3f7", fontSize: 9, letterSpacing: "0.15em" }}>
                    SECTORS
                  </th>

                  {/* STD rowspan */}
                  <th rowSpan={2} style={thStyle}>STD</th>

                  {/* STA rowspan */}
                  <th rowSpan={2} style={thStyle}>STA</th>

                  {/* DAY group */}
                  <th colSpan={3} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", color: "#f5c542", fontSize: 9, letterSpacing: "0.15em" }}>
                    DAY
                  </th>

                  {/* NIGHT group */}
                  <th colSpan={3} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", color: "#7ab8d4", fontSize: 9, letterSpacing: "0.15em" }}>
                    NIGHT
                  </th>

                  {/* TOTAL rowspan */}
                  <th rowSpan={2} style={thStyle}>TOTAL</th>
                </tr>

                {/* Row 2: sub-headers */}
                <tr style={{ background: "#0b1320" }}>
                  {/* AIRCRAFT sub */}
                  <th style={thSubStyle}>TYPE</th>
                  <th style={thSubStyle}>MARKINGS</th>
                  {/* SECTORS sub */}
                  <th style={thSubStyle}>DEP</th>
                  <th style={thSubStyle}>ARR</th>
                  {/* DAY sub */}
                  <th style={{ ...thSubStyle, color: "#c8a800" }}>P1</th>
                  <th style={{ ...thSubStyle, color: "#c8a800" }}>P1 U/S</th>
                  <th style={{ ...thSubStyle, color: "#c8a800" }}>P2</th>
                  {/* NIGHT sub */}
                  <th style={{ ...thSubStyle, color: "#5a96b8" }}>P1</th>
                  <th style={{ ...thSubStyle, color: "#5a96b8" }}>P1 U/S</th>
                  <th style={{ ...thSubStyle, color: "#5a96b8" }}>P2</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, rowIdx) => {
                  const computedTotal = calcTotal(row);
                  const isEven = rowIdx % 2 === 0;
                  return (
                    <tr
                      key={row.id}
                      style={{
                        background: isEven ? "#0d1520" : "#0a1018",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "#122030"}
                      onMouseLeave={e => e.currentTarget.style.background = isEven ? "#0d1520" : "#0a1018"}
                    >
                      {/* Row number */}
                      <td style={{ ...tdStyle, color: "#2a4a6a", textAlign: "center", fontSize: 9 }}>{rowIdx + 1}</td>

                      {/* All data columns */}
                      {columns.map(col => {
                        const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.field === col.key;
                        const isTime = timeCols.includes(col.key);
                        const isAutoCalc = col.key === "total";
                        const displayVal = isAutoCalc ? (computedTotal || "") : (row[col.key] || "");

                        return (
                          <td
                            key={col.key}
                            onClick={() => !isAutoCalc && col.key !== "cap" && setEditingCell({ rowIdx, field: col.key })}
                            style={{
                              ...tdStyle,
                              textAlign: isTime ? "center" : "left",
                              color: isAutoCalc
                                ? "#4fc3f7"
                                : col.key.startsWith("day") ? "#c8a800"
                                : col.key.startsWith("night") ? "#5a96b8"
                                : "#9bbcd4",
                              background: isAutoCalc ? "rgba(79,195,247,0.04)" : "transparent",
                              cursor: isAutoCalc ? "default" : col.key === "cap" ? "pointer" : "text",
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
                            {col.key === "cap" ? (
                              <select
                                value={row[col.key] || ""}
                                onChange={e => updateCell(rowIdx, col.key, e.target.value)}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "#c8d6e5",
                                  fontFamily: "'Courier New', monospace",
                                  fontSize: 11,
                                  width: "100%",
                                  cursor: "pointer",
                                  outline: "none",
                                }}
                              >
                                {["","P1","P2","P1 U/S"].map(opt => (
                                  <option key={opt} value={opt} style={{ background: "#0d1520" }}>
                                    {opt || "—"}
                                  </option>
                                ))}
                              </select>
                            ) : isEditing ? (
  <input
    autoFocus
                                defaultValue={row[col.key]}
                                onBlur={e => {
                                  updateCell(rowIdx, col.key, e.target.value);
                                  setEditingCell(null);
                                }}
                                onKeyDown={e => {
                                  if (e.key === "Enter" || e.key === "Tab") {
                                    updateCell(rowIdx, col.key, e.target.value);
                                    setEditingCell(null);
                                  }
                                  if (e.key === "Escape") setEditingCell(null);
                                }}
                                style={{
                                  width: "100%",
                                  background: "#0f2035",
                                  border: "none",
                                  borderBottom: "1px solid #4fc3f7",
                                  color: "#e8f4fd",
                                  fontFamily: "'Courier New', monospace",
                                  fontSize: 11,
                                  padding: "5px 7px",
                                  outline: "none",
                                  boxSizing: "border-box",
                                }}
                                placeholder={isTime ? "00:00" : ""}
                              />
                            ) : (
                              <span style={{ opacity: displayVal ? 1 : 0.2 }}>
                                {displayVal || (isTime ? "—" : "—")}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* ── TOTALS ROW ── */}
                <tr style={{ background: "#0b1828", borderTop: "2px solid #1e3a5f" }}>
                  <td colSpan={10} style={{ ...tdStyle, color: "#4fc3f7", fontSize: 10, letterSpacing: "0.12em", fontWeight: 700, textAlign: "right" }}>
                    MONTHLY TOTALS →
                  </td>
                  {["dayP1","dayP1US","dayP2","nightP1","nightP1US","nightP2","total"].map(k => (
                    <td key={k} style={{
                      ...tdStyle,
                      textAlign: "center",
                      color: k === "total" ? "#4fc3f7" : k.startsWith("day") ? "#f5c542" : "#7ab8d4",
                      fontWeight: 700,
                      fontSize: 12,
                    }}>
                      {totalsRow[k]}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>

            {/* Save button */}
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => {}}
                style={{
                  background: "linear-gradient(135deg, #0d2a3a, #0a1f30)",
                  border: "1px solid #4fc3f7",
                  borderRadius: 4,
                  color: "#4fc3f7",
                  fontFamily: "'Courier New', monospace",
                  fontSize: 10,
                  letterSpacing: "0.15em",
                  padding: "6px 20px",
                  cursor: "pointer",
                  boxShadow: "0 0 8px rgba(79,195,247,0.2)",
                }}
              >
                💾 SAVE NOW
              </button>
            </div>
          </div>
        )}

        {/* ── SUMMARY TAB ── */}
        {activeTab === "summary" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, color: "#4fc3f7", letterSpacing: "0.15em", marginBottom: 16 }}>
                {selectedYear} ANNUAL OVERVIEW — ALL MONTHS
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 800 }}>
                  <thead>
                    <tr style={{ background: "#0b1320" }}>
                      {["MONTH","SECTORS","DAY P1","DAY P1 U/S","DAY P2","NIGHT P1","NIGHT P1 U/S","NIGHT P2","TOTAL"].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MONTHS.map((m, i) => {
                      const key = `${i}-${selectedYear}`;
                      const mRows = data[key] || makeMonthRows(i, selectedYear);
                      const filled = mRows.filter(r => r.date || r.type || r.sectors).length;
                      const dp1  = sumColumn(mRows, "dayP1");
                      const dp1u = sumColumn(mRows, "dayP1US");
                      const dp2  = sumColumn(mRows, "dayP2");
                      const np1  = sumColumn(mRows, "nightP1");
                      const np1u = sumColumn(mRows, "nightP1US");
                      const np2  = sumColumn(mRows, "nightP2");
                      const tot  = toHHMM(mRows.reduce((acc, r) => acc + parseHHMM(calcTotal(r)), 0)) || "00:00";
                      const isSelected = i === selectedMonth;
                      return (
                        <tr
                          key={i}
                          onClick={() => { setSelectedMonth(i); setActiveTab("logbook"); }}
                          style={{
                            background: isSelected ? "rgba(79,195,247,0.08)" : i % 2 === 0 ? "#0d1520" : "#0a1018",
                            cursor: "pointer",
                            borderLeft: isSelected ? "3px solid #4fc3f7" : "3px solid transparent",
                          }}
                        >
                          <td style={{ ...tdStyle, color: isSelected ? "#4fc3f7" : "#9bbcd4", fontWeight: isSelected ? 700 : 400 }}>
                            {m.toUpperCase()}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "center", color: "#9bbcd4" }}>{filled || "—"}</td>
                          <td style={{ ...tdStyle, textAlign: "center", color: "#c8a800" }}>{dp1 === "00:00" ? "—" : dp1}</td>
                          <td style={{ ...tdStyle, textAlign: "center", color: "#c8a800" }}>{dp1u === "00:00" ? "—" : dp1u}</td>
                          <td style={{ ...tdStyle, textAlign: "center", color: "#c8a800" }}>{dp2 === "00:00" ? "—" : dp2}</td>
                          <td style={{ ...tdStyle, textAlign: "center", color: "#5a96b8" }}>{np1 === "00:00" ? "—" : np1}</td>
                          <td style={{ ...tdStyle, textAlign: "center", color: "#5a96b8" }}>{np1u === "00:00" ? "—" : np1u}</td>
                          <td style={{ ...tdStyle, textAlign: "center", color: "#5a96b8" }}>{np2 === "00:00" ? "—" : np2}</td>
                          <td style={{ ...tdStyle, textAlign: "center", color: "#4fc3f7", fontWeight: 700 }}>{tot === "00:00" ? "—" : tot}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Annual grand total */}
                  <tfoot>
                    <tr style={{ background: "#0b1828", borderTop: "2px solid #1e3a5f" }}>
                      <td style={{ ...tdStyle, color: "#4fc3f7", fontWeight: 700 }}>ANNUAL TOTAL</td>
                      <td style={{ ...tdStyle, textAlign: "center", color: "#4fc3f7", fontWeight: 700 }}>
                        {Object.values(MONTHS).reduce((acc, _, i) => {
                          const mRows = data[`${i}-${selectedYear}`] || makeMonthRows(i, selectedYear);
                          return acc + mRows.filter(r => r.date || r.type || r.sectors).length;
                        }, 0) || "—"}
                      </td>
                      {["dayP1","dayP1US","dayP2","nightP1","nightP1US","nightP2"].map(k => {
                        const total = toHHMM(
                          MONTHS.reduce((acc, _, i) => {
                            const mRows = data[`${i}-${selectedYear}`] || makeMonthRows(i, selectedYear);
                            return acc + parseHHMM(sumColumn(mRows, k));
                          }, 0)
                        );
                        return (
                          <td key={k} style={{ ...tdStyle, textAlign: "center", color: k.startsWith("day") ? "#f5c542" : "#7ab8d4", fontWeight: 700 }}>
                            {total || "—"}
                          </td>
                        );
                      })}
                      <td style={{ ...tdStyle, textAlign: "center", color: "#4fc3f7", fontWeight: 700 }}>
                        {toHHMM(
                          MONTHS.reduce((acc, _, i) => {
                            const mRows = data[`${i}-${selectedYear}`] || makeMonthRows(i, selectedYear);
                            return acc + mRows.reduce((a2, r) => a2 + parseHHMM(calcTotal(r)), 0);
                          }, 0)
                        ) || "—"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div style={{ fontSize: 10, color: "#3a5a7a", marginTop: 10 }}>
                Click any month row to jump to its logbook page.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div style={{
        padding: "10px 24px",
        borderTop: "1px solid #111820",
        fontSize: 9,
        color: "#2a4a6a",
        letterSpacing: "0.12em",
        display: "flex",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 8,
      }}>
        <span>eLOGBOOK v5.1 · CAA MALAYSIA</span>
        <span>MCAR 2016 PART 7 &amp; 8 · ICAO ANNEX 1 FORMAT</span>
        <span>{MONTHS[selectedMonth].toUpperCase()} {selectedYear} ACTIVE</span>
      </div>
    </div>
  );
}

const selectStyle = {
  background: "#0d1520",
  border: "1px solid #1e3a5f",
  borderRadius: 4,
  color: "#4fc3f7",
  fontSize: 13,
  fontFamily: "'Courier New', monospace",
  fontWeight: 700,
  padding: "6px 10px",
  letterSpacing: "0.08em",
  cursor: "pointer",
  outline: "none",
  minWidth: 140,
};

/* ── Shared cell styles ── */
const thStyle = {
  padding: "6px 7px",
  textAlign: "center",
  color: "#3a6a8a",
  fontSize: 9,
  letterSpacing: "0.12em",
  borderBottom: "1px solid #1a3050",
  borderRight: "1px solid #111820",
  whiteSpace: "nowrap",
  fontWeight: 700,
  textTransform: "uppercase",
  lineHeight: 1.3,
};

const thSubStyle = {
  ...thStyle,
  color: "#3a6a8a",
  background: "#090d14",
  fontSize: 8,
};

const tdStyle = {
  padding: "5px 7px",
  borderBottom: "1px solid #0f1820",
  borderRight: "1px solid #0d1520",
  whiteSpace: "nowrap",
  fontSize: 11,
  overflow: "hidden",
  textOverflow: "ellipsis",
};
