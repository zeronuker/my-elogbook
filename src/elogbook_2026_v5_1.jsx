import { useState, useEffect } from "react";
import { db, auth, googleProvider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

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

const DEFAULT_ROWS = 15;

function makeMonthRows(monthIdx, year, count = DEFAULT_ROWS) {
  return Array.from({ length: count }, (_, idx) => ({ id: idx + 1, ...EMPTY_ROW() }));
}

// Ensure every month has at least DEFAULT_ROWS rows (trim excess, pad if short)
function normalizeMonthRows(rows, monthIdx, year) {
  if (!Array.isArray(rows)) return makeMonthRows(monthIdx, year);
  // If rows came from old data with days-in-month count, trim to DEFAULT_ROWS
  // but preserve any extra rows added by "Add Sector"
  // Heuristic: only trim if the excess rows are all empty (legacy padding)
  let result = [...rows];
  while (result.length > DEFAULT_ROWS) {
    const last = result[result.length - 1];
    const isEmpty = Object.keys(EMPTY_ROW()).every(k => !last[k]);
    if (isEmpty) result.pop();
    else break;
  }
  // Pad up to DEFAULT_ROWS if too short
  while (result.length < DEFAULT_ROWS) {
    result.push({ id: result.length + 1, ...EMPTY_ROW() });
  }
  return result;
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
  const ft = calcFlightTimes(row);
  const sum = ["dayP1","dayP1US","dayP2","nightP1","nightP1US","nightP2"]
    .reduce((acc, k) => acc + parseHHMM(ft[k]), 0);
  return sum ? toHHMM(sum) : "";
}

// Day time: 0730–1930 (in minutes from midnight)
// Night time: everything outside that window
// Handles overnight flights (STA < STD crosses midnight)
function calcDayNight(std, sta) {
  if (!std || !sta) return { day: 0, night: 0 };

  const toMins = t => {
    const [h, m] = t.trim().split(":").map(Number);
    return h * 60 + m;
  };

  const DAY_START = toMins("07:30");  // 450
  const DAY_END   = toMins("19:30");  // 1170
  const FULL_DAY  = 24 * 60;         // 1440

  let stdM = toMins(std);
  let staM = toMins(sta);

  // Handle overnight: if STA <= STD, add 24h to STA
  if (staM <= stdM) staM += FULL_DAY;

  const totalMins = staM - stdM;

  // Calculate day minutes: intersection of [stdM, staM] with [DAY_START, DAY_END]
  // For overnight flights, also check [DAY_START + 1440, DAY_END + 1440]
  let dayMins = 0;

  // First day window
  dayMins += Math.max(0, Math.min(staM, DAY_END) - Math.max(stdM, DAY_START));

  // Second day window (for overnight flights that extend into next day's daytime)
  if (staM > FULL_DAY) {
    dayMins += Math.max(0, Math.min(staM, DAY_END + FULL_DAY) - Math.max(stdM, DAY_START + FULL_DAY));
  }

  dayMins = Math.max(0, dayMins);
  const nightMins = Math.max(0, totalMins - dayMins);

  return { day: dayMins, night: nightMins };
}

// Returns computed day/night values based on STD, STA and capacity
function calcFlightTimes(row) {
  const { day, night } = calcDayNight(row.std, row.sta);
  const cap = row.cap;
  const result = { dayP1: "", dayP1US: "", dayP2: "", nightP1: "", nightP1US: "", nightP2: "" };

  if (!cap || (!day && !night)) return result;

  if (cap === "P1") {
    result.dayP1   = day   ? toHHMM(day)   : "";
    result.nightP1 = night ? toHHMM(night) : "";
  } else if (cap === "P2") {
    result.dayP2   = day   ? toHHMM(day)   : "";
    result.nightP2 = night ? toHHMM(night) : "";
  } else if (cap === "P1 U/S") {
    result.dayP1US   = day   ? toHHMM(day)   : "";
    result.nightP1US = night ? toHHMM(night) : "";
  }

  return result;
}

function sumColumn(rows, key) {
  const total = rows.reduce((acc, r) => acc + parseHHMM(r[key]), 0);
  return total ? toHHMM(total) : "00:00";
}

export default function ELogbook2026() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(initialData);
  const [editingCell, setEditingCell] = useState(null);
  const [activeTab, setActiveTab] = useState("logbook");
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const [refreshStatus, setRefreshStatus] = useState("idle"); // idle | refreshing | refreshed

  // ── Auth listener ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) await loadData(u.uid);
    });
    return unsub;
  }, []);

  // ── Auto-save every 5 minutes after login ──
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      saveData();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, data]);

  // ── Load data from Firestore ──
  const loadData = async (uid) => {
    try {
      const ref = doc(db, "users", uid, "logbook", "data");
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const raw = snap.data().logbookData;
        // Normalize every month's rows to enforce DEFAULT_ROWS baseline
        const normalized = {};
        Object.keys(raw).forEach(key => {
          const [mIdx] = key.split("-").map(Number);
          normalized[key] = normalizeMonthRows(raw[key], mIdx, null);
        });
        setData(normalized);
      }
    } catch (e) {
      console.error("Load error:", e);
    }
  };

  // ── Refresh with animation ──
  const refreshData = async () => {
    if (!user || refreshStatus === "refreshing") return;
    setRefreshStatus("refreshing");
    try {
      await loadData(user.uid);
      setRefreshStatus("refreshed");
      setTimeout(() => setRefreshStatus("idle"), 2500);
    } catch (e) {
      setRefreshStatus("idle");
    }
  };

  // ── Save data to Firestore ──
  const saveData = async () => {
    if (!user) return;
    setSaveStatus("saving");
    try {
      const ref = doc(db, "users", user.uid, "logbook", "data");
      await setDoc(ref, { logbookData: data, updatedAt: new Date().toISOString() });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (e) {
      console.error("Save error:", e);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  // ── Google Sign In ──
  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error("Sign in error:", e);
    }
  };

  // ── Sign Out ──
  const handleSignOut = async () => {
    await signOut(auth);
    setData(initialData());
  };

  // ── Loading screen ──
  if (authLoading) {
    return (
      <div style={{ background: "#0a0d12", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Courier New', monospace", color: "#4fc3f7" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>✈</div>
          <div style={{ fontSize: 11, letterSpacing: "0.2em" }}>LOADING eLOGBOOK...</div>
        </div>
      </div>
    );
  }

  // ── Login screen ──
  if (!user) {
    return (
      <div style={{ background: "#0a0d12", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Courier New', monospace", color: "#c8d6e5" }}>
        <div style={{ textAlign: "center", padding: 40, border: "1px solid #1e3a5f", borderRadius: 8, background: "#0d1520", maxWidth: 380 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✈</div>
          <div style={{ fontSize: 13, letterSpacing: "0.2em", color: "#4fc3f7", marginBottom: 4 }}>eLOGBOOK V5.1</div>
          <div style={{ fontSize: 10, color: "#5a7a9a", letterSpacing: "0.1em", marginBottom: 8 }}>CAA MALAYSIA · MCAR 2016</div>
          <div style={{ fontSize: 9, color: "#3a5a7a", marginBottom: 32 }}>Compliant with CAD 1901 • MCAR 2016 Part 7 & 8 • ICAO Annex 1</div>
          <button
            onClick={handleSignIn}
            style={{
              background: "linear-gradient(135deg, #0d2a3a, #0a1f30)",
              border: "1px solid #4fc3f7",
              borderRadius: 6,
              color: "#4fc3f7",
              fontFamily: "'Courier New', monospace",
              fontSize: 11,
              letterSpacing: "0.15em",
              padding: "12px 28px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 10,
              margin: "0 auto",
              boxShadow: "0 0 16px rgba(79,195,247,0.2)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.5 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.6l6.2 5.2C36.9 40.2 44 35 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
            SIGN IN WITH GOOGLE
          </button>
          <div style={{ fontSize: 9, color: "#2a4a6a", marginTop: 20 }}>
            Your logbook data is private and linked to your Google account
          </div>
        </div>
      </div>
    );
  }

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

  const deleteRow = (rowIdx) => {
    setData(prev => {
      const current = prev[monthKey] || makeMonthRows(selectedMonth, selectedYear);
      const newRows = current.filter((_, i) => i !== rowIdx);
      const finalRows = newRows.length > 0 ? newRows : [{ id: 1, ...EMPTY_ROW() }];
      return { ...prev, [monthKey]: finalRows };
    });
  };

  const addSector = () => {
    setData(prev => {
      const current = prev[monthKey] || makeMonthRows(selectedMonth, selectedYear);
      const newId = (current[current.length - 1]?.id || current.length) + 1;
      return { ...prev, [monthKey]: [...current, { id: newId, ...EMPTY_ROW() }] };
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
    { key: "std",       label: "STD\n(UTC)",                  minWidth: 38,  group: null },
    { key: "sta",       label: "STA\n(UTC)",                  minWidth: 38,  group: null },
    { key: "dayP1",     label: "P1",                          minWidth: 30,  group: "DAY" },
    { key: "dayP1US",   label: "P1 U/S",                      minWidth: 42,  group: "DAY" },
    { key: "dayP2",     label: "P2",                          minWidth: 30,  group: "DAY" },
    { key: "nightP1",   label: "P1",                          minWidth: 30,  group: "NIGHT" },
    { key: "nightP1US", label: "P1 U/S",                      minWidth: 42,  group: "NIGHT" },
    { key: "nightP2",   label: "P2",                          minWidth: 30,  group: "NIGHT" },
    { key: "total",     label: "TOTAL",                       minWidth: 42,  group: null },
  ];

  const timeCols = ["dayP1","dayP1US","dayP2","nightP1","nightP1US","nightP2","total","std","sta"];
  const autoCalcCols = ["total","dayP1","dayP1US","dayP2","nightP1","nightP1US","nightP2"];

  const totalsRow = {
    dayP1:     toHHMM(rows.reduce((acc, r) => acc + parseHHMM(calcFlightTimes(r).dayP1), 0)) || "00:00",
    dayP1US:   toHHMM(rows.reduce((acc, r) => acc + parseHHMM(calcFlightTimes(r).dayP1US), 0)) || "00:00",
    dayP2:     toHHMM(rows.reduce((acc, r) => acc + parseHHMM(calcFlightTimes(r).dayP2), 0)) || "00:00",
    nightP1:   toHHMM(rows.reduce((acc, r) => acc + parseHHMM(calcFlightTimes(r).nightP1), 0)) || "00:00",
    nightP1US: toHHMM(rows.reduce((acc, r) => acc + parseHHMM(calcFlightTimes(r).nightP1US), 0)) || "00:00",
    nightP2:   toHHMM(rows.reduce((acc, r) => acc + parseHHMM(calcFlightTimes(r).nightP2), 0)) || "00:00",
    total:     toHHMM(rows.reduce((acc, r) => acc + parseHHMM(calcTotal(r)), 0)) || "00:00",
  };

  return (
    <div style={{
      background: "#0a0d12",
      minHeight: "100vh",
      fontFamily: "'Courier New', Courier, monospace",
      color: "#c8d6e5",
    }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

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

          {/* Right side: user info + period selector */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            {/* User info + sign out */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {user.photoURL && <img src={user.photoURL} alt="avatar" style={{ width: 22, height: 22, borderRadius: "50%", border: "1px solid #1e3a5f" }} />}
              <span style={{ fontSize: 9, color: "#4a6a8a", letterSpacing: "0.1em" }}>{user.displayName || user.email}</span>
              <button onClick={handleSignOut} style={{ background: "transparent", border: "1px solid #1e3a5f", borderRadius: 3, color: "#3a6a8a", fontFamily: "'Courier New', monospace", fontSize: 8, padding: "2px 8px", cursor: "pointer", letterSpacing: "0.1em" }}>
                SIGN OUT
              </button>
            </div>
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
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
              {/* Refresh status label */}
              {refreshStatus === "refreshing" && (
                <span style={{ fontSize: 9, color: "#f5c542", letterSpacing: "0.1em", fontWeight: 700 }}>REFRESHING...</span>
              )}
              {refreshStatus === "refreshed" && (
                <span style={{ fontSize: 9, color: "#4fc77a", letterSpacing: "0.1em", fontWeight: 700 }}>✓ REFRESHED</span>
              )}
              {/* Refresh */}
              <button
                onClick={refreshData}
                title="Refresh data from cloud"
                style={{
                  ...iconBtnStyle,
                  color: refreshStatus === "refreshed" ? "#4fc77a" : refreshStatus === "refreshing" ? "#f5c542" : "#3a6a8a",
                  borderColor: refreshStatus === "refreshed" ? "#4fc77a" : refreshStatus === "refreshing" ? "#f5c542" : "#1e3a5f",
                }}
              >
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ animation: refreshStatus === "refreshing" ? "spin 1s linear infinite" : "none" }}
                >
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
              </button>
              {/* Export (dummy) */}
              <button
                onClick={() => {}}
                title="Export (coming soon)"
                style={iconBtnStyle}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
              {/* Settings (dummy) */}
              <button
                onClick={() => {}}
                title="Settings (coming soon)"
                style={iconBtnStyle}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>
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

            {/* Table + side-buttons flex wrapper — defined first so info bar can match width */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>

            {/* Info bar sits above the table only, same width as table */}
            <div style={{ flex: "1 1 auto", minWidth: 0 }}>
            <div style={{
              background: "rgba(79,195,247,0.06)",
              border: "1px solid rgba(79,195,247,0.18)",
              borderLeft: "3px solid #4fc3f7",
              borderRadius: "0 4px 4px 0",
              padding: "7px 14px",
              marginBottom: 14,
              fontSize: 10,
              color: "#7ab8d4",
              display: "flex",
              alignItems: "center",
              gap: 10,
              overflow: "hidden",
            }}>
              {/* Auto-save icon — only shown when active */}
              {saveStatus === "saving" && (
                <span title="Auto-saving..." style={{ display: "flex", alignItems: "center", gap: 4, color: "#f5c542", fontWeight: 700, flexShrink: 0 }}>
                  <svg style={{ animation: "spin 1s linear infinite" }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                  </svg>
                  <span style={{ fontSize: 9, letterSpacing: "0.1em" }}>SAVING...</span>
                </span>
              )}
              {saveStatus === "saved" && (
                <span title="Saved" style={{ display: "flex", alignItems: "center", gap: 4, color: "#4fc77a", fontWeight: 700, flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                  </svg>
                  <span style={{ fontSize: 9, letterSpacing: "0.1em" }}>SAVED</span>
                </span>
              )}
              {saveStatus === "error" && (
                <span title="Save error" style={{ display: "flex", alignItems: "center", gap: 4, color: "#f74f4f", fontWeight: 700, flexShrink: 0 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span style={{ fontSize: 9, letterSpacing: "0.1em" }}>SAVE ERROR</span>
                </span>
              )}
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <span style={{ color: "#4fc3f7", fontWeight: 700 }}>
                  {MONTHS[selectedMonth].toUpperCase()} {selectedYear} —
                </span>
                {" "}Click any cell to enter data. Time fields format: HH:MM (e.g. 02:30). TOTAL auto-calculates from Day + Night columns. ({rows.length} rows)
              </div>
            </div>{/* close info bar div */}

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
                  <th rowSpan={2} style={{ ...thStyle, lineHeight: 1.4 }}>
                    <span style={{ display: "block" }}>STD</span>
                    <span style={{ display: "block", fontSize: 7, color: "#2a5a7a" }}>(UTC)</span>
                  </th>

                  {/* STA rowspan */}
                  <th rowSpan={2} style={{ ...thStyle, lineHeight: 1.4 }}>
                    <span style={{ display: "block" }}>STA</span>
                    <span style={{ display: "block", fontSize: 7, color: "#2a5a7a" }}>(UTC)</span>
                  </th>

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
                  {/* DEL col */}
                  <th rowSpan={2} style={{ ...thStyle, width: 28, minWidth: 28 }}></th>
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
                  const computedFT = calcFlightTimes(row);
                  const isEven = rowIdx % 2 === 0;
                  const isLastRow = rowIdx === rows.length - 1;

                  // HOC validation: if STD and STA are filled but cap is not selected
                  const hasStdSta = row.std && row.sta;
                  const hasCap = row.cap && ["P1","P2","P1 U/S"].includes(row.cap);
                  const needsCapWarning = hasStdSta && !hasCap;

                  // HOC color scheme
                  const capColors = {
                    "P1":    { color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.3)" },
                    "P2":    { color: "#eab308", bg: "rgba(234,179,8,0.12)",  border: "rgba(234,179,8,0.3)" },
                    "P1 U/S":{ color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)" },
                  };
                  const capStyle = capColors[row.cap] || null;

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
                      {(() => {
                        const cells = [];
                        let skipAutoCalc = false;

                        for (let ci = 0; ci < columns.length; ci++) {
                          const col = columns[ci];
                          const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.field === col.key;
                          const isTime = timeCols.includes(col.key);
                          const isAutoCalc = autoCalcCols.includes(col.key);

                          // HOC warning: render a single colspan=7 cell starting at dayP1
                          if (needsCapWarning && col.key === "dayP1") {
                            skipAutoCalc = true;
                            cells.push(
                              <td
                                key="hoc-warning"
                                colSpan={7}
                                style={{
                                  ...tdStyle,
                                  background: "rgba(249,115,22,0.06)",
                                  borderLeft: "2px solid rgba(249,115,22,0.4)",
                                  textAlign: "center",
                                  color: "#f97316",
                                  fontSize: 9,
                                  fontStyle: "italic",
                                  letterSpacing: "0.05em",
                                  padding: "5px 10px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                ⚠ HOLDER OPERATING CAPACITY required to auto calculate
                              </td>
                            );
                            continue;
                          }

                          // Skip the remaining auto-calc cols after colspan warning
                          if (skipAutoCalc && ["dayP1US","dayP2","nightP1","nightP1US","nightP2","total"].includes(col.key)) {
                            continue;
                          }

                          // Get display value
                          let displayVal = "";
                          if (col.key === "total") displayVal = computedTotal || "";
                          else if (isAutoCalc) displayVal = computedFT[col.key] || "";
                          else displayVal = row[col.key] || "";

                          // Cap cell with color coding
                          if (col.key === "cap") {
                            cells.push(
                              <td
                                key={col.key}
                                style={{
                                  ...tdStyle,
                                  background: "transparent",
                                  minWidth: col.minWidth,
                                  padding: "2px 4px",
                                  textAlign: "center",
                                }}
                              >
                                <select
                                  value={row[col.key] || ""}
                                  onChange={e => updateCell(rowIdx, col.key, e.target.value)}
                                  style={{
                                    background: capStyle ? capStyle.bg : "transparent",
                                    border: capStyle ? `1px solid ${capStyle.border}` : "none",
                                    borderRadius: 4,
                                    color: capStyle ? capStyle.color : "#7ab8d4",
                                    fontFamily: "'Courier New', monospace",
                                    fontSize: 11,
                                    fontWeight: capStyle ? 700 : 400,
                                    width: "auto",
                                    cursor: "pointer",
                                    outline: "none",
                                    padding: "2px 6px",
                                  }}
                                >
                                  {["","P1","P2","P1 U/S"].map(opt => (
                                    <option key={opt} value={opt} style={{ background: "#0d1520", color: "#c8d6e5" }}>
                                      {opt || "—"}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            );
                            continue;
                          }

                          // Regular cell
                          cells.push(
                            <td
                              key={col.key}
                              onClick={() => !isAutoCalc && setEditingCell({ rowIdx, field: col.key })}
                              style={{
                                ...tdStyle,
                                textAlign: isTime ? "center" : "left",
                                color: isAutoCalc
                                  ? (col.key === "dayP1" || col.key === "nightP1" ? "#22c55e"
                                    : col.key === "dayP2" || col.key === "nightP2" ? "#eab308"
                                    : col.key === "dayP1US" || col.key === "nightP1US" ? "#ef4444"
                                    : "#4fc3f7") // total
                                  : col.key.startsWith("day") ? "#c8a800"
                                  : col.key.startsWith("night") ? "#5a96b8"
                                  : "#9bbcd4",
                                background: isAutoCalc
                                  ? (col.key === "total" ? "rgba(79,195,247,0.04)" : "transparent")
                                  : "transparent",
                                cursor: isAutoCalc ? "default" : "text",
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
                                  onBlur={e => { updateCell(rowIdx, col.key, e.target.value); setEditingCell(null); }}
                                  onKeyDown={e => {
                                    if (e.key === "Tab") {
                                      e.preventDefault();
                                      updateCell(rowIdx, col.key, e.target.value);
                                      const tabbableCols = columns.filter(c => c.key !== "total" && c.type !== "select").map(c => c.key);
                                      const currentIdx = tabbableCols.indexOf(col.key);
                                      if (currentIdx < tabbableCols.length - 1) {
                                        setEditingCell({ rowIdx, field: tabbableCols[currentIdx + 1] });
                                      } else {
                                        const nextRowIdx = rowIdx + 1;
                                        if (nextRowIdx < rows.length) setEditingCell({ rowIdx: nextRowIdx, field: tabbableCols[0] });
                                        else setEditingCell(null);
                                      }
                                    }
                                    if (e.key === "Enter") { updateCell(rowIdx, col.key, e.target.value); setEditingCell(null); }
                                    if (e.key === "Escape") setEditingCell(null);
                                  }}
                                  style={{
                                    width: "100%", background: "#0f2035", border: "none",
                                    borderBottom: "1px solid #4fc3f7", color: "#e8f4fd",
                                    fontFamily: "'Courier New', monospace", fontSize: 11,
                                    padding: "5px 7px", outline: "none", boxSizing: "border-box",
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
                        }
                        return cells;
                      })()}

                      {/* Delete button — aligned td */}
                      <td style={{ ...tdStyle, textAlign: "center", padding: "3px 2px", width: 28, minWidth: 28 }}>
                        <button
                          onClick={() => deleteRow(rowIdx)}
                          title="Delete row"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#2a1a1a",
                            cursor: "pointer",
                            fontSize: 13,
                            padding: "2px 4px",
                            borderRadius: 3,
                            lineHeight: 1,
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = "#c0392b"}
                          onMouseLeave={e => e.currentTarget.style.color = "#2a1a1a"}
                        >✕</button>
                      </td>
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
                      color: k === "total" ? "#4fc3f7"
                        : (k === "dayP1" || k === "nightP1") ? "#22c55e"
                        : (k === "dayP2" || k === "nightP2") ? "#eab308"
                        : (k === "dayP1US" || k === "nightP1US") ? "#ef4444"
                        : "#4fc3f7",
                      fontWeight: 700,
                      fontSize: 12,
                    }}>
                      {totalsRow[k]}
                    </td>
                  ))}
                  <td style={tdStyle} />
                </tr>

                {/* ── SAVE NOW row ── */}
                <tr style={{ background: "#0a0d12" }}>
                  <td colSpan={19} style={{ padding: "8px 10px", borderTop: "1px solid #0f1820", textAlign: "right" }}>
                    <button
                      onClick={saveData}
                      disabled={saveStatus === "saving"}
                      style={{
                        background: saveStatus === "saved" ? "linear-gradient(135deg, #0d3a1a, #0a2a12)"
                                  : saveStatus === "error"  ? "linear-gradient(135deg, #3a0d0d, #2a0a0a)"
                                  : "linear-gradient(135deg, #0d2a3a, #0a1f30)",
                        border: `1px solid ${saveStatus === "saved" ? "#4fc77a" : saveStatus === "error" ? "#f74f4f" : "#4fc3f7"}`,
                        borderRadius: 4,
                        color: saveStatus === "saved" ? "#4fc77a" : saveStatus === "error" ? "#f74f4f" : "#4fc3f7",
                        fontFamily: "'Courier New', monospace",
                        fontSize: 10,
                        letterSpacing: "0.15em",
                        padding: "6px 20px",
                        cursor: saveStatus === "saving" ? "wait" : "pointer",
                        boxShadow: "0 0 8px rgba(79,195,247,0.2)",
                        opacity: saveStatus === "saving" ? 0.7 : 1,
                      }}
                    >
                      {saveStatus === "saving" ? "⏳ SAVING..." : saveStatus === "saved" ? "✅ SAVED!" : saveStatus === "error" ? "❌ ERROR" : "💾 SAVE NOW"}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            </div>{/* end flex: "1 1 auto" table wrapper */}

            {/* Add sector button — floats below table on the right */}
            <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 8 }}>
              <button
                onClick={addSector}
                title="Add sector row"
                style={{
                  background: "rgba(39,174,96,0.15)",
                  border: "1px solid #27ae60",
                  borderRadius: "50%",
                  color: "#27ae60",
                  cursor: "pointer",
                  fontSize: 18,
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  fontWeight: 700,
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(39,174,96,0.3)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(39,174,96,0.15)"}
              >+</button>
            </div>

            </div>{/* end outer flex wrapper */}
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
                    {/* Row 1: group headers */}
                    <tr style={{ background: "#0b1320" }}>
                      <th rowSpan={2} style={thStyle}>MONTH</th>
                      <th rowSpan={2} style={thStyle}>SECTORS</th>
                      <th colSpan={3} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", color: "#f5c542", fontSize: 9, letterSpacing: "0.15em" }}>DAY</th>
                      <th colSpan={3} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", color: "#7ab8d4", fontSize: 9, letterSpacing: "0.15em" }}>NIGHT</th>
                      <th rowSpan={2} style={thStyle}>TOTAL</th>
                    </tr>
                    {/* Row 2: sub-headers */}
                    <tr style={{ background: "#0b1320" }}>
                      <th style={{ ...thSubStyle, color: "#22c55e" }}>P1</th>
                      <th style={{ ...thSubStyle, color: "#ef4444" }}>P1 U/S</th>
                      <th style={{ ...thSubStyle, color: "#eab308" }}>P2</th>
                      <th style={{ ...thSubStyle, color: "#22c55e" }}>P1</th>
                      <th style={{ ...thSubStyle, color: "#ef4444" }}>P1 U/S</th>
                      <th style={{ ...thSubStyle, color: "#eab308" }}>P2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MONTHS.map((m, i) => {
                      const key = `${i}-${selectedYear}`;
                      const mRows = data[key] || makeMonthRows(i, selectedYear);
                      const filled = mRows.filter(r => r.date || r.type || r.sectors).length;
                      const dp1  = toHHMM(mRows.reduce((acc, r) => acc + parseHHMM(calcFlightTimes(r).dayP1), 0)) || "00:00";
                      const dp1u = toHHMM(mRows.reduce((acc, r) => acc + parseHHMM(calcFlightTimes(r).dayP1US), 0)) || "00:00";
                      const dp2  = toHHMM(mRows.reduce((acc, r) => acc + parseHHMM(calcFlightTimes(r).dayP2), 0)) || "00:00";
                      const np1  = toHHMM(mRows.reduce((acc, r) => acc + parseHHMM(calcFlightTimes(r).nightP1), 0)) || "00:00";
                      const np1u = toHHMM(mRows.reduce((acc, r) => acc + parseHHMM(calcFlightTimes(r).nightP1US), 0)) || "00:00";
                      const np2  = toHHMM(mRows.reduce((acc, r) => acc + parseHHMM(calcFlightTimes(r).nightP2), 0)) || "00:00";
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
                          <td style={{ ...tdStyle, textAlign: "center", color: "#22c55e" }}>{dp1  === "00:00" ? "—" : dp1}</td>
                          <td style={{ ...tdStyle, textAlign: "center", color: "#ef4444" }}>{dp1u === "00:00" ? "—" : dp1u}</td>
                          <td style={{ ...tdStyle, textAlign: "center", color: "#eab308" }}>{dp2  === "00:00" ? "—" : dp2}</td>
                          <td style={{ ...tdStyle, textAlign: "center", color: "#22c55e" }}>{np1  === "00:00" ? "—" : np1}</td>
                          <td style={{ ...tdStyle, textAlign: "center", color: "#ef4444" }}>{np1u === "00:00" ? "—" : np1u}</td>
                          <td style={{ ...tdStyle, textAlign: "center", color: "#eab308" }}>{np2  === "00:00" ? "—" : np2}</td>
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
                            return acc + mRows.reduce((a2, r) => a2 + parseHHMM(calcFlightTimes(r)[k]), 0);
                          }, 0)
                        );
                        const col = (k === "dayP1" || k === "nightP1") ? "#22c55e"
                          : (k === "dayP2" || k === "nightP2") ? "#eab308"
                          : "#ef4444";
                        return (
                          <td key={k} style={{ ...tdStyle, textAlign: "center", color: col, fontWeight: 700 }}>
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

const iconBtnStyle = {
  background: "transparent",
  border: "1px solid #1e3a5f",
  borderRadius: 4,
  color: "#3a6a8a",
  cursor: "pointer",
  padding: "5px 7px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "color 0.15s, border-color 0.15s",
};

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
