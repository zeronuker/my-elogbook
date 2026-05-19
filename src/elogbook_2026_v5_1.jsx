import { useState, useEffect, useRef } from "react";
import SunCalc from "suncalc";
import { getCoords } from "./airportCoords";
import { db, auth, googleProvider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import SettingsModal, { DEFAULT_SETTINGS } from "./SettingsModal";
import ExportImportModal from "./ExportImportModal";

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
  pilotFlying: "",
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
  autoland: false,
});

const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

function getDaysInMonth(monthIdx, year) {
  return new Date(year, monthIdx + 1, 0).getDate();
}

const DEFAULT_ROWS = 15;

function makeMonthRows(monthIdx, year, count = DEFAULT_ROWS) {
  return Array.from({ length: count }, (_, idx) => ({ id: idx + 1, ...EMPTY_ROW() }));
}

function normalizeMonthRows(rows, monthIdx, year) {
  if (!Array.isArray(rows)) return makeMonthRows(monthIdx, year);
  let result = [...rows];
  while (result.length > DEFAULT_ROWS) {
    const last = result[result.length - 1];
    const isEmpty = Object.keys(EMPTY_ROW()).every(k => !last[k]);
    if (isEmpty) result.pop();
    else break;
  }
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
  const trimmed = val.trim();

  // Try HH:MM format first
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    if (parts.length === 2) {
      const h = parseInt(parts[0]) || 0;
      const m = parseInt(parts[1]) || 0;
      return h * 60 + m;
    }
  }

  // Try HHMM format (no colon)
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length >= 3) {
    // Last 2 digits are minutes, rest are hours
    const h = parseInt(digitsOnly.slice(0, -2)) || 0;
    const m = parseInt(digitsOnly.slice(-2)) || 0;
    return h * 60 + m;
  } else if (digitsOnly.length === 2) {
    // 2 digits: could be HH or MM, assume MM
    const m = parseInt(digitsOnly) || 0;
    return m;
  } else if (digitsOnly.length === 1) {
    // 1 digit: assume hours
    const h = parseInt(digitsOnly) || 0;
    return h * 60;
  }

  return 0;
}

function toHHMM(mins) {
  if (!mins && mins !== 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

// Returns true if the HH:MM time falls within civil day hours (23:30–11:30 UTC, midnight-crossing).
// Night = 11:30–23:30 UTC. Used to classify takeoffs (by STD) and landings (by STA) as day or night.
function isTimeInDay(hhmm) {
  if (!hhmm || !hhmm.trim()) return true; // default to day when unknown
  const NIGHT_START = 11 * 60 + 30;  // 11:30 = 690 min
  const NIGHT_END   = 23 * 60 + 30;  // 23:30 = 1410 min
  const mins = parseHHMM(hhmm) % (24 * 60);
  // Day = outside the night window [11:30, 23:30]
  return mins < NIGHT_START || mins > NIGHT_END;
}

function calcTotal(row, method, year, monthIdx) {
  const ft = calcFlightTimes(row, method, year, monthIdx);
  const sum = ["dayP1","dayP1US","dayP2","nightP1","nightP1US","nightP2"]
    .reduce((acc, k) => acc + parseHHMM(ft[k]), 0);
  return sum ? toHHMM(sum) : "";
}

function calcDayNight(std, sta) {
  if (!std || !sta) return { day: 0, night: 0 };
  const toMins = t => {
    const [h, m] = t.trim().split(":").map(Number);
    return h * 60 + m;
  };
  // Night window = 11:30–23:30 UTC (does NOT cross midnight — simple overlap calc)
  // Day  window = 23:30–11:30 UTC (crosses midnight — derived as totalMins − nightMins)
  const NIGHT_START = 11 * 60 + 30;  // 690 min
  const NIGHT_END   = 23 * 60 + 30;  // 1410 min
  const FULL_DAY    = 24 * 60;
  let stdM = toMins(std);
  let staM = toMins(sta);
  if (staM <= stdM) staM += FULL_DAY;
  const totalMins = staM - stdM;
  if (totalMins > 18 * 60) return { day: 0, night: 0 };
  // Overlap with night window [11:30, 23:30] — handles cross-midnight flights via +FULL_DAY second pass
  let nightMins = 0;
  nightMins += Math.max(0, Math.min(staM, NIGHT_END) - Math.max(stdM, NIGHT_START));
  if (staM > FULL_DAY) {
    nightMins += Math.max(0, Math.min(staM, NIGHT_END + FULL_DAY) - Math.max(stdM, NIGHT_START + FULL_DAY));
  }
  nightMins = Math.max(0, nightMins);
  const dayMins = Math.max(0, totalMins - nightMins);
  return { day: dayMins, night: nightMins };
}

// Dynamic day/night per CAD-6: Night = sunset+20min → sunrise−20min at departure airport
function calcDayNightDynamic(std, sta, dayStr, depIcao, year, monthIdx) {
  if (!std || !sta) return { day: 0, night: 0 };
  const coords = getCoords(depIcao);
  if (!coords) return calcDayNight(std, sta);
  const D    = parseInt(dayStr) || 1;
  const FULL = 1440;
  // Use UTC midnight as reference — avoids local-timezone offset bugs for high-UTC-offset locations
  const ref  = new Date(Date.UTC(year, monthIdx, D)).getTime();
  const toRef = dt => (dt.getTime() - ref) / 60000; // minutes from UTC midnight of departure date
  const tP   = SunCalc.getTimes(new Date(Date.UTC(year, monthIdx, D - 1)), coords.lat, coords.lon);
  const tC   = SunCalc.getTimes(new Date(Date.UTC(year, monthIdx, D)),     coords.lat, coords.lon);
  const tN   = SunCalc.getTimes(new Date(Date.UTC(year, monthIdx, D + 1)), coords.lat, coords.lon);
  // Guard against polar regions (no sunrise/sunset)
  if (!isFinite(toRef(tC.sunrise)) || !isFinite(toRef(tC.sunset))) return calcDayNight(std, sta);
  // Two night windows: [prevSunset+20, currSunrise−20] and [currSunset+20, nextSunrise−20]
  const ns1  = toRef(tP.sunset)  + 20;
  const ne1  = toRef(tC.sunrise) - 20;
  const ns2  = toRef(tC.sunset)  + 20;
  const ne2  = toRef(tN.sunrise) - 20;
  const toM  = t => { const [h, m] = t.trim().split(":").map(Number); return h * 60 + m; };
  let stdM   = toM(std), staM = toM(sta);
  if (staM <= stdM) staM += FULL;
  const totalMins = staM - stdM;
  if (totalMins > 18 * 60) return { day: 0, night: 0 };
  const ovlp = (s, e, ns, ne) => Math.max(0, Math.min(e, ne) - Math.max(s, ns));
  let nightMins = ovlp(stdM, staM, ns1, ne1) + ovlp(stdM, staM, ns2, ne2);
  nightMins = Math.round(Math.min(Math.max(0, nightMins), totalMins));
  return { day: Math.max(0, totalMins - nightMins), night: nightMins };
}

function calcFlightTimes(row, method, year, monthIdx) {
  const { day, night } = method === "sunrise"
    ? calcDayNightDynamic(row.std, row.sta, row.date, row.departure, year, monthIdx)
    : calcDayNight(row.std, row.sta);
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

// ─── FTL helpers ──────────────────────────────────────────────────────────────

// Flatten all logbook rows across all months into a list of sectors with dates.
// Only rows with a valid date + STD + STA are included.
// Duty time = flight time + (preFlightBuffer + postFlightBuffer) — defaults 75 + 15 = 90 min.
function getAllSectors(data, dutyBufferMins = 90) {
  const sectors = [];
  Object.entries(data).forEach(([key, rows]) => {
    if (!Array.isArray(rows)) return;
    const parts = key.split("-");
    const monthIdx = parseInt(parts[0]);
    const year = parseInt(parts[1]);
    if (isNaN(monthIdx) || isNaN(year)) return;
    rows.forEach(row => {
      if (!row.date || !row.std || !row.sta) return;
      const day = parseInt(row.date.split('/')[0]);
      if (!day || day < 1 || day > 31) return;
      const flightMins = parseHHMM(calcTotal(row));
      if (!flightMins) return;
      const date = new Date(year, monthIdx, day);
      date.setHours(12, 0, 0, 0); // normalise to noon to avoid DST edge cases
      sectors.push({
        date,
        flightMins,
        dutyMins: flightMins + dutyBufferMins,
        type: (row.type || "").trim().toUpperCase(),
        pilotFlying:  row.pilotFlying === "YES",
        isDayTakeoff: isTimeInDay(row.std),
        isDayLanding: isTimeInDay(row.sta),
        std: row.std,
        sta: row.sta,
        departure: row.departure,
      });
    });
  });
  return sectors;
}

// Sum `field` for sectors within the last `days` calendar days (inclusive of today).
function rollingMins(sectors, days, field, asOf) {
  const cutoff = new Date(asOf);
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return sectors
    .filter(s => s.date > cutoff && s.date <= asOf)
    .reduce((a, s) => a + s[field], 0);
}

// Sum flight minutes for the 12-month window ending on the last day of the previous calendar month.
function rolling12MonthFlightMins(sectors, asOf) {
  const endDate = new Date(asOf.getFullYear(), asOf.getMonth(), 0); // last day of prev month
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date(endDate.getFullYear() - 1, endDate.getMonth() + 1, 1);
  startDate.setHours(0, 0, 0, 0);
  return sectors
    .filter(s => s.date >= startDate && s.date <= endDate)
    .reduce((a, s) => a + s.flightMins, 0);
}

// Colour helper
function ftlCls(pct) {
  return pct >= 100 ? "red" : pct >= 90 ? "yellow" : "green";
}

const FTL_COLOR  = { green: "#22c55e", yellow: "#eab308", red: "#ef4444" };
const FTL_BG     = { green: "rgba(34,197,94,0.08)",  yellow: "rgba(234,179,8,0.08)",  red: "rgba(239,68,68,0.08)"  };
const FTL_BORDER = { green: "rgba(34,197,94,0.3)",   yellow: "rgba(234,179,8,0.3)",   red: "rgba(239,68,68,0.3)"   };

// Regulatory reference content for info-button popups
const FTL_POPUPS = {
  "ftl-28d": {
    para:  "CAD 1901 ISS01/REV01 · PARA 2.18(a)",
    title: "ABSOLUTE LIMIT — FLIGHT TIME · ANY 28 CONSECUTIVE DAYS",
    body:  `A person shall not act as a member of the flight crew of an aircraft if, at the <strong style="color:#c8d6e5">beginning of the flight</strong>, the aggregate of all previous flight times during the period of <span style="color:#4fc3f7">28 consecutive days expiring at the end of the day on which the flight begins</span> exceeds <strong style="color:#c8d6e5">100 hours</strong>.<br><br>Exception: on the 28th day a crew member may <strong style="color:#c8d6e5">depart</strong> on a single sector flight and complete that sector even if the 28-day total will exceed 100 hrs on landing. The crew member <strong style="color:#c8d6e5">cannot then operate any subsequent sectors</strong> during that day.`,
    note:  `<span style="color:#4fc3f7">Flight time</span> = block time <span style="color:#4fc3f7">STD → STA</span> per sector, summed across all sectors in the rolling 28-day window.`,
  },
  "ftl-12m": {
    para:  "CAD 1901 ISS01/REV01 · PARA 2.18(b)",
    title: "ABSOLUTE LIMIT — FLIGHT TIME · ANY 12 MONTHS",
    body:  `A person shall not act as a member of the flight crew of an aircraft if, at the <strong style="color:#c8d6e5">beginning of the flight</strong>, the aggregate of all previous flight times during the period of <span style="color:#4fc3f7">12 months expiring at the end of the previous month</span> exceeds <strong style="color:#c8d6e5">900 hours</strong>.<br><br>For augmented crew operations (or a mixture of), the operator shall establish in the Operations Manual the aggregate of flying hours applicable for this calculation.`,
    note:  `<span style="color:#4fc3f7">Flight time</span> = block time <span style="color:#4fc3f7">STD → STA</span> per sector. The 12-month window closes at the end of the <span style="color:#4fc3f7">previous calendar month</span>, not the current date.`,
  },
  "duty-7d": {
    para:  "CAD 1901 ISS01/REV01 · PARA 2.19.1(a)",
    title: "CUMULATIVE DUTY — ANY 7 CONSECUTIVE DAYS",
    body:  `The maximum duty hours for flight crew shall not exceed <span style="color:#4fc3f7">55 hours in any 7 consecutive days</span>.<br><br>This limit <strong style="color:#c8d6e5">may be increased to 60 hours</strong> when a rostered duty covering a series of duty periods, once commenced, is subject to <strong style="color:#c8d6e5">unforeseen delays</strong>. This extension is not available by prior rostering.`,
    note:  `<span style="color:#4fc3f7">Duty time</span> per sector = <span style="color:#4fc3f7">STD − 1 hr 15 min</span> (report) to <span style="color:#4fc3f7">STA + 15 min</span> (post-flight). All sectors within the 7-day window are summed.`,
  },
  "duty-14d": {
    para:  "CAD 1901 ISS01/REV01 · PARA 2.19.1(b)",
    title: "CUMULATIVE DUTY — ANY 14 CONSECUTIVE DAYS",
    body:  `The maximum duty hours for flight crew shall not exceed <span style="color:#4fc3f7">95 hours in any 14 consecutive days</span>.<br><br>This is a hard limit with no provision for extension. All duty periods within the rolling 14-day window must be summed when assessing compliance.`,
    note:  `<span style="color:#4fc3f7">Duty time</span> per sector = <span style="color:#4fc3f7">STD − 1 hr 15 min</span> (report) to <span style="color:#4fc3f7">STA + 15 min</span> (post-flight). All sectors within the 14-day window are summed.`,
  },
  "duty-28d": {
    para:  "CAD 1901 ISS01/REV01 · PARA 2.19.1(c)",
    title: "CUMULATIVE DUTY — ANY 28 CONSECUTIVE DAYS",
    body:  `The maximum duty hours for flight crew shall not exceed <span style="color:#4fc3f7">190 hours in any 28 consecutive days</span>.<br><br>This is a hard limit with no provision for extension. All duty periods within the rolling 28-day window must be summed when assessing compliance.`,
    note:  `<span style="color:#4fc3f7">Duty time</span> per sector = <span style="color:#4fc3f7">STD − 1 hr 15 min</span> (report) to <span style="color:#4fc3f7">STA + 15 min</span> (post-flight). All sectors within the 28-day window are summed.`,
  },
  "rec-tol": {
    para:  "MCAR 2016 PART 8 · SUBPART A",
    title: "TAKEOFF & LANDING RECENCY — 3 WITHIN 90 DAYS",
    body:  `A pilot shall not act as <strong style="color:#c8d6e5">Pilot-in-Command</strong> (or co-pilot performing the duties of PIC) unless they have carried out, as pilot flying, <span style="color:#4fc3f7">at least 3 takeoffs and 3 landings</span> in the <span style="color:#4fc3f7">preceding 90 days</span> on an aircraft of the same type.<br><br><strong style="color:#c8d6e5">Day and Night recency are tracked separately.</strong> A night takeoff or landing is one that occurs between the end of evening civil twilight and the beginning of morning civil twilight.`,
    note:  `Recency is <span style="color:#4fc3f7">type-specific</span>. Takeoffs and landings on a B737 do not count toward A320 recency. Use the <strong style="color:#c8d6e5">PILOT FLYING</strong> checkbox in the logbook to mark sectors where you were the handling pilot — each checked sector counts as 1 T/O and 1 LDG. Day/night is determined by STD (takeoff) and STA (landing) UTC times — civil day = 23:30–11:30 UTC, civil night = 11:30–23:30 UTC.`,
  },
  "rec-autoland": {
    para:  "MCAR 2016 PART 8 · SUBPART A",
    title: "AUTOLAND RECENCY — 3 WITHIN 6 MONTHS",
    body:  `A pilot qualified for <strong style="color:#c8d6e5">CAT III autoland operations</strong> shall maintain currency by performing <span style="color:#4fc3f7">at least 3 autoland approaches and landings within the preceding 6 months</span>.<br><br>Autoland operations may be performed on any approved aircraft type or in an approved Full Flight Simulator (FFS). Simulator autolands count toward currency if conducted in an approved FFS with a valid approval letter.`,
    note:  `Check the <span style="color:#4fc3f7">AUTOLAND checkbox</span> in the remarks window to mark sectors where a coupled autoland to touchdown was performed. Track autoland recency for all aircraft types combined — a 6-month rolling window with minimum 3 entries required.`,
  },
};

// ─── Theme CSS variable injection ─────────────────────────────────────────────
const ACCENT_PALETTE = {
  "#4fc3f7": { accent: "#4fc3f7", accent2: "#7ab8d4", accentDim: "#2a5a7a" },
  "#f5c542": { accent: "#f5c542", accent2: "#c4a030", accentDim: "#5a4a10" },
  "#22c55e": { accent: "#22c55e", accent2: "#16a34a", accentDim: "#166534" },
  "#a78bfa": { accent: "#a78bfa", accent2: "#8b5cf6", accentDim: "#4c1d95" },
  "#fb923c": { accent: "#fb923c", accent2: "#f97316", accentDim: "#7c2d12" },
  "#f472b6": { accent: "#f472b6", accent2: "#ec4899", accentDim: "#831843" },
  "#ef4444": { accent: "#ef4444", accent2: "#dc2626", accentDim: "#7f1d1d" },
  "#2dd4bf": { accent: "#2dd4bf", accent2: "#14b8a6", accentDim: "#134e4a" },
};

const FONT_FAMILIES = {
  courier:   "'Courier New', Courier, monospace",
  jetbrains: "'JetBrains Mono', monospace",
  ibmplex:   "'IBM Plex Mono', monospace",
  roboto:    "'Roboto Mono', monospace",
  space:     "'Space Mono', monospace",
};

const THEMES = {
  dark: {
    bg:        "#0a0d12", bg2:       "#0d1520", bg3:       "#0a1018",
    bgHeader:  "#0d1117", bgAlt:     "#161d2a", bgThead:   "#0b1320",
    bgInput:   "#0b1828",
    accent:    "#4fc3f7", accent2:   "#7ab8d4", accentDim: "#2a5a7a",
    border:    "#1e3a5f", border2:   "#1a3050", border3:   "#0f1820", border4: "#111820",
    text:      "#ffffff", textMuted: "#b8d6e5", textDim:   "#7a9aaa", textBright: "#ffffff",
    rowHover:  "#122030",
  },
  light: {
    bg:        "#f0f4f8", bg2:       "#e8edf4", bg3:       "#ecf1f7",
    bgHeader:  "#dde5ef", bgAlt:     "#e4eaf2", bgThead:   "#dce4ee",
    bgInput:   "#ffffff",
    accent:    "#004a78", accent2:   "#1a4a68", accentDim: "#5a9abb",
    border:    "#9ab8cc", border2:   "#a8c4d8", border3:   "#bdd0de", border4: "#c8d8e4",
    text:      "#1a2530", textMuted: "#2a4050", textDim:   "#2a4858", textBright: "#0a1520",
    rowHover:  "#dce8f4",
  },
};

const DENSITY_PAD = {
  compact:  "3px 6px",
  default:  "6px 8px",
  relaxed:  "10px 8px",
};

function makeThemeCss(settings = {}) {
  const t = THEMES[settings.theme] || THEMES.dark;
  const fontSize = Math.min(18, Math.max(12, Number(settings.fontSize) || 14));
  const rowPad = DENSITY_PAD[settings.tableDensity] || DENSITY_PAD.default;
  const ac = ACCENT_PALETTE[settings.accentColor] || ACCENT_PALETTE["#4fc3f7"];
  const fontFamily = FONT_FAMILIES[settings.fontType] || FONT_FAMILIES.courier;

  return `
    :root {
      --elb-bg:${t.bg};--elb-bg2:${t.bg2};--elb-bg3:${t.bg3};
      --elb-bghd:${t.bgHeader};--elb-bgalt:${t.bgAlt};--elb-thead:${t.bgThead};
      --elb-bginput:${t.bgInput};--elb-rowhover:${t.rowHover};
      --elb-acc:${ac.accent};--elb-acc2:${ac.accent2};--elb-accdim:${ac.accentDim};
      --elb-border:${t.border};--elb-bdr:${t.border};
      --elb-border2:${t.border2};--elb-bdr2:${t.border2};
      --elb-border3:${t.border3};--elb-bdr3:${t.border3};
      --elb-border4:${t.border4};--elb-bdr4:${t.border4};
      --elb-txt:${t.text};--elb-txt-muted:${t.textMuted};--elb-txt-dim:${t.textDim};--elb-txt-bright:${t.textBright};
      --elb-muted:${t.textMuted};--elb-dim:${t.textDim};--elb-bright:${t.textBright};
      --elb-accent:${ac.accent};
      --elb-font:${fontFamily};
      --elb-td-sz:${fontSize}px;
      --elb-th-sz:${Math.max(10, fontSize - 1)}px;
      --elb-ths-sz:${Math.max(9, fontSize - 2)}px;
      --elb-desc-sz:${Math.max(11, fontSize)}px;
      --elb-hint-sz:${Math.max(10, fontSize - 1)}px;
      --elb-row-pad:${rowPad};
    }
  `;
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ELogbook2026({ onLogout, onDeleteAccount }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(initialData);
  const [editingCell, setEditingCell] = useState(null);
  const [activeTab, setActiveTab] = useState("logbook");
  const [saveStatus, setSaveStatus] = useState("idle");
  const [lastSaveTime, setLastSaveTime] = useState(""); // Format: "DD MMM YYYY • HH:MM:SS"
  const [refreshStatus, setRefreshStatus] = useState("idle");
  // ── NEW ──
  const [activePopup, setActivePopup] = useState(null); // popup id string or null
  const [recencyType, setRecencyType] = useState("");   // selected aircraft type in recency
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const settingsRef = useRef(DEFAULT_SETTINGS); // always mirrors latest settings for use in async closures
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportImportOpen, setExportImportOpen] = useState(false);
  const [remarksModal, setRemarksModal] = useState(null); // { rowIdx, draft }
  const [grandTotalDate, setGrandTotalDate] = useState(() => new Date().toISOString().split("T")[0]);

  // ── Auth listener ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthLoading(false);
      if (u) await loadData(u.uid);
    });
    return unsub;
  }, []);

  // ── Auto-save on user-configured interval ──
  useEffect(() => {
    if (!user) return;
    const intervalMins = Number(settings.autoSaveInterval ?? 5);
    if (intervalMins === 0) return;
    const interval = setInterval(() => {
      saveData();
    }, intervalMins * 60 * 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, data, settings.autoSaveInterval]);

  // ── Handle import — called directly by ExportImportModal ──
  const handleImport = async (importedData) => {
    setData(importedData);
    await saveData(importedData);
  };

  // ── Load data from Firestore ──
  const loadData = async (uid) => {
    const ref = doc(db, "users", uid, "logbook", "data");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const docData = snap.data();
      const raw = docData.logbookData;
      if (raw) {
        const normalized = {};
        Object.keys(raw).forEach(key => {
          const [mIdx] = key.split("-").map(Number);
          normalized[key] = normalizeMonthRows(raw[key], mIdx, null);
        });
        setData(normalized);
      }
      if (docData.settings) {
        const merged = { ...DEFAULT_SETTINGS, ...docData.settings };
        // Guard: don't replace carry-forward with empty/corrupt cloud data
        if (!Array.isArray(merged.carryForward) || !merged.carryForward.some(r => r.type)) {
          merged.carryForward = DEFAULT_SETTINGS.carryForward;
        }
        settingsRef.current = merged;
        setSettings(merged);
      }
    }

    // Load profile data and merge into settings
    try {
      const profileRef = doc(db, "users", uid, "profile", "data");
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        const profileData = profileSnap.data();
        const updated = {
          ...settingsRef.current,
          fullName: profileData.fullName || settingsRef.current.fullName || "",
          airline: profileData.airline || profileData.organization || settingsRef.current.airline || "",
          licenceNumber: profileData.licenceNumber || settingsRef.current.licenceNumber || "",
          licenceType: profileData.licenceType || settingsRef.current.licenceType || "ATPL(A)"
        };
        settingsRef.current = updated;
        setSettings(updated);
      }
    } catch (profileErr) {
      console.error("Profile load error:", profileErr);
    }
  };

  // ── Keep settingsRef in sync so saveData never reads a stale closure ──
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // ── Save settings only (separate from logbook auto-save) ──
  const saveSettings = async (next) => {
    settingsRef.current = next; // update ref immediately before any async gap
    setSettings(next);
    if (!user) return;
    try {
      const ref = doc(db, "users", user.uid, "logbook", "data");
      await setDoc(ref, { settings: next, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      console.error("Settings save error:", e);
    }
  };

  // ── Refresh with animation ──
  const refreshData = async () => {
    if (!user || refreshStatus === "refreshing") return;
    setRefreshStatus("refreshing");
    const start = Date.now();
    try {
      await loadData(user.uid);
      // Ensure spinner is visible for at least 800ms
      const elapsed = Date.now() - start;
      if (elapsed < 800) await new Promise(r => setTimeout(r, 800 - elapsed));
      setRefreshStatus("refreshed");
      setTimeout(() => setRefreshStatus("idle"), 2500);
    } catch (e) {
      console.error("Refresh error:", e);
      const elapsed = Date.now() - start;
      if (elapsed < 800) await new Promise(r => setTimeout(r, 800 - elapsed));
      setRefreshStatus("error");
      setTimeout(() => setRefreshStatus("idle"), 3000);
    }
  };

  // ── Save data to Firestore ──
  const saveData = async (dataOverride) => {
    if (!user) return;
    setSaveStatus("saving");
    try {
      // Regenerate IDs sequentially for each month to prevent duplicates
      const cleanData = {};
      const dataToSave = dataOverride || data;
      Object.keys(dataToSave).forEach(monthKey => {
        cleanData[monthKey] = dataToSave[monthKey].map((row, idx) => ({
          ...row,
          id: idx + 1, // Ensure IDs are 1, 2, 3, ... in order
        }));
      });

      const ref = doc(db, "users", user.uid, "logbook", "data");

      // Create a 15-second timeout promise
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Save operation timed out after 15 seconds")), 15000)
      );

      // Race the save operation against the timeout
      await Promise.race([
        setDoc(ref, { logbookData: cleanData, settings: settingsRef.current, updatedAt: new Date().toISOString() }, { merge: true }),
        timeoutPromise
      ]);

      const now = new Date();
      const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const fullStr = `${dateStr} • ${timeStr}`;
      setLastSaveTime(fullStr);
      setSaveStatus("saved");
      // Keep "saved" status visible until next save attempt
    } catch (e) {
      console.error("Save error:", e);
      setSaveStatus("error");
      // Keep "error" status visible until successful save
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
  // Inject theme CSS vars early so loading/login screens are also themed
  const themeCss = makeThemeCss(settings);

  if (authLoading) {
    return (
      <>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Space+Mono:wght@400;700&family=Roboto+Mono:wght@400;700&display=swap" />
        <style>{themeCss}</style>
        <div style={{ background: "var(--elb-bg, #0a0d12)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--elb-font, 'Courier New', monospace)", color: "var(--elb-acc, #4fc3f7)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 26, marginBottom: 12 }}>✈</div>
          <div style={{ fontSize: 13, letterSpacing: "0.2em" }}>LOADING eLOGBOOK...</div>
        </div>
      </div>
      </>
    );
  }

  // ── Login screen ──
  if (!user) {
    return (
      <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Space+Mono:wght@400;700&family=Roboto+Mono:wght@400;700&display=swap" />
      <style>{themeCss}</style>
      <div style={{ background: "var(--elb-bg, #0a0d12)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--elb-font, 'Courier New', monospace)", color: "var(--elb-txt, #c8d6e5)" }}>
        <div style={{ textAlign: "center", padding: 40, border: "1px solid var(--elb-border, #1e3a5f)", borderRadius: 8, background: "var(--elb-bg2, #0d1520)", maxWidth: 380 }}>
          <div style={{ fontSize: 38, marginBottom: 8 }}>✈</div>
          <div style={{ fontSize: 15, letterSpacing: "0.2em", color: "var(--elb-acc, #4fc3f7)", marginBottom: 4 }}>eLOGBOOK V5.6</div>
          <div style={{ fontSize: 12, color: "var(--elb-txt-muted, #5a7a9a)", letterSpacing: "0.1em", marginBottom: 8 }}>CAA MALAYSIA · MCAR 2016</div>
          <div style={{ fontSize: 11, color: "var(--elb-txt-muted, #3a5a7a)", marginBottom: 32 }}>Compliant with CAD 1901 • MCAR 2016 Part 7 & 8 • ICAO Annex 1</div>
          <button
            onClick={handleSignIn}
            style={{
              background: "var(--elb-bg2, #0d1520)",
              border: "1px solid var(--elb-acc, #4fc3f7)",
              borderRadius: 6,
              color: "var(--elb-acc, #4fc3f7)",
              fontFamily: "var(--elb-font, 'Courier New', monospace)",
              fontSize: 13,
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
          <div style={{ fontSize: 11, color: "var(--elb-txt-muted, #2a4a6a)", marginTop: 20 }}>
            Your logbook data is private and linked to your Google account
          </div>
        </div>
      </div>
      </>
    );
  }

  // ── Per-month state ──
  const monthKey = `${selectedMonth}-${selectedYear}`;
  const rowsPerPage = Number(settings.rowsPerPage) || DEFAULT_ROWS;
  const storedRows = data[monthKey] || makeMonthRows(selectedMonth, selectedYear);
  // Display at least rowsPerPage rows; virtual extra rows become real on edit via updateCell
  const rows = storedRows.length >= rowsPerPage
    ? storedRows
    : [...storedRows, ...Array.from({ length: rowsPerPage - storedRows.length }, (_, i) => ({
        id: storedRows.length + i + 1, ...EMPTY_ROW(),
      }))];

  const updateCell = (rowIdx, field, value) => {
    // Aircraft type: normalise to uppercase and warn if genuinely new type
    if (field === "type" && value && value.trim()) {
      const normalized = value.trim().toUpperCase();
      // Build set of known types from all logbook data (already stored uppercase)
      const existingTypes = new Set(
        Object.values(data).flatMap(rows =>
          Array.isArray(rows)
            ? rows.map(r => (r.type || "").trim().toUpperCase()).filter(Boolean)
            : []
        )
      );
      if (existingTypes.size > 0 && !existingTypes.has(normalized)) {
        const confirmed = window.confirm(
          `"${normalized}" is a new aircraft type not seen in your logbook.\n\n` +
          `Adding a new aircraft type creates a separate recency tracker for takeoff & landing recency and autoland recency. ` +
          `Flights logged on other types will not count toward this type's currency.\n\n` +
          `Add "${normalized}" to your logbook?`
        );
        if (!confirmed) return;
      }
      // Proceed with normalised uppercase value
      value = normalized;
    }

    setData(prev => {
      let current = [...(prev[monthKey] || makeMonthRows(selectedMonth, selectedYear))];
      // Extend stored rows if the edited row is beyond what's been saved (virtual display rows)
      while (current.length <= rowIdx) {
        current.push({ id: current.length + 1, ...EMPTY_ROW() });
      }
      // Normalize time inputs (HHMM format) to HH:MM format
      let normalizedValue = value;
      if (timeCols.includes(field) && value && value.trim()) {
        const trimmed = value.trim();
        if (!trimmed.includes(":")) {
          // Convert HHMM to HH:MM
          const digitsOnly = trimmed.replace(/\D/g, "");
          if (digitsOnly.length >= 3) {
            const h = digitsOnly.slice(0, -2).padStart(2, "0");
            const m = digitsOnly.slice(-2).padStart(2, "0");
            normalizedValue = `${h}:${m}`;
          } else if (digitsOnly.length === 2) {
            normalizedValue = `00:${digitsOnly.padStart(2, "0")}`;
          } else if (digitsOnly.length === 1) {
            normalizedValue = `0${digitsOnly}:00`;
          }
        }
        // Reject impossible flight times (hours >= 24 or minutes >= 60)
        if (normalizedValue?.includes(":")) {
          const [hh, mm] = normalizedValue.split(":").map(Number);
          if (hh >= 24 || mm >= 60) normalizedValue = "";
        }
      }
      const AUTO_CAPTAIN_RANKS = ["Flight Examiner", "Flight Instructor", "Captain"];
      const updatedRow = { ...current[rowIdx], [field]: normalizedValue };
      if (field === "date" && normalizedValue && AUTO_CAPTAIN_RANKS.includes(settingsRef.current.defaultRank) && !updatedRow.captain) {
        updatedRow.captain = "SELF";
      }
      const newRows = current.map((r, i) => i === rowIdx ? updatedRow : r);
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
      // Next ID should be length + 1, ensuring no gaps
      const newId = current.length + 1;
      const seeded = {
        ...EMPTY_ROW(),
        type:     settings.defaultAircraftType || "",
        markings: settings.defaultMarkings     || "",
        captain:  settings.defaultCaptain      || "",
      };
      return { ...prev, [monthKey]: [...current, { id: newId, ...seeded }] };
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

  const columns = [
    { key: "date",      label: "DATE",                        minWidth: 36,  group: null },
    { key: "type",      label: "TYPE",                        minWidth: 36,  group: "AIRCRAFT" },
    { key: "markings",  label: "MARKINGS",                    minWidth: 58,  group: "AIRCRAFT" },
    { key: "captain",   label: "CAPTAIN",                     minWidth: 60, fixedWidth: 60, wrap: true, group: null },
    { key: "cap",         label: "HOLDER\nOPERATING\nCAPACITY", minWidth: 58, group: null, type: "select", options: ["","P1","P2","P1 U/S"] },
    { key: "pilotFlying", label: "PILOT\nFLYING",              minWidth: 46, group: null, type: "checkbox" },
    { key: "departure",   label: "DEP",                         minWidth: 30, group: "SECTORS" },
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
    dayP1:     toHHMM(rows.reduce((acc, r) => acc + parseHHMM(calcFlightTimes(r, settings.dayNightMethod, selectedYear, selectedMonth).dayP1), 0)) || "00:00",
    dayP1US:   toHHMM(rows.reduce((acc, r) => acc + parseHHMM(calcFlightTimes(r, settings.dayNightMethod, selectedYear, selectedMonth).dayP1US), 0)) || "00:00",
    dayP2:     toHHMM(rows.reduce((acc, r) => acc + parseHHMM(calcFlightTimes(r, settings.dayNightMethod, selectedYear, selectedMonth).dayP2), 0)) || "00:00",
    nightP1:   toHHMM(rows.reduce((acc, r) => acc + parseHHMM(calcFlightTimes(r, settings.dayNightMethod, selectedYear, selectedMonth).nightP1), 0)) || "00:00",
    nightP1US: toHHMM(rows.reduce((acc, r) => acc + parseHHMM(calcFlightTimes(r, settings.dayNightMethod, selectedYear, selectedMonth).nightP1US), 0)) || "00:00",
    nightP2:   toHHMM(rows.reduce((acc, r) => acc + parseHHMM(calcFlightTimes(r, settings.dayNightMethod, selectedYear, selectedMonth).nightP2), 0)) || "00:00",
    total:     toHHMM(rows.reduce((acc, r) => acc + parseHHMM(calcTotal(r, settings.dayNightMethod, selectedYear, selectedMonth)), 0)) || "00:00",
  };

  // ── FTL computations (live from logbook data) ──────────────────────────────
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const dutyBufferMins = settings.useStandardFormula === false
    ? 0
    : (Number(settings.preFlightBuffer) || 0) + (Number(settings.postFlightBuffer) || 0);
  const allSectors = getAllSectors(data, dutyBufferMins);

  const ft28dMins   = rollingMins(allSectors, 28,  "flightMins", today);
  const ft12mMins   = rolling12MonthFlightMins(allSectors, today);
  const duty7dMins  = rollingMins(allSectors,  7,  "dutyMins",   today);
  const duty14dMins = rollingMins(allSectors, 14,  "dutyMins",   today);
  const duty28dMins = rollingMins(allSectors, 28,  "dutyMins",   today);

  const ftlLimits = [
    { key: "ft28d", label: "ANY 28 CONSECUTIVE DAYS",           used: ft28dMins,   max: 100 * 60, popupId: "ftl-28d" },
    { key: "ft12m", label: "ANY 12 MONTHS (END OF PREV MONTH)", used: ft12mMins,   max: 900 * 60, popupId: "ftl-12m" },
  ];
  const dutyLimits = [
    { key: "duty7d",  label: "DUTY — ANY 7 CONSECUTIVE DAYS",  used: duty7dMins,  max:  55 * 60, popupId: "duty-7d"  },
    { key: "duty14d", label: "DUTY — ANY 14 CONSECUTIVE DAYS", used: duty14dMins, max:  95 * 60, popupId: "duty-14d" },
    { key: "duty28d", label: "DUTY — ANY 28 CONSECUTIVE DAYS", used: duty28dMins, max: 190 * 60, popupId: "duty-28d" },
  ];

  const allComputedLimits = [...ftlLimits, ...dutyLimits].map(l => ({
    ...l,
    rawPct: l.max ? (l.used / l.max) * 100 : 0,
    status: ftlCls(l.max ? (l.used / l.max) * 100 : 0),
  }));

  const bannerCls = allComputedLimits.some(l => l.status === "red")    ? "red"
                  : allComputedLimits.some(l => l.status === "yellow") ? "yellow"
                  : "green";

  const bannerMessages = {
    green:  { icon: "✅", label: "ALL LIMITS WITHIN RANGE — FULLY COMPLIANT",    text: "All flight time and cumulative duty limits are well within regulatory requirements. No action required at this time." },
    yellow: { icon: "⚠️", label: "APPROACHING LIMIT — ACTION REQUIRED",           text: "One or more limits are within 10% of the regulatory maximum. Monitor closely before accepting your next duty assignment." },
    red:    { icon: "🚨", label: "LIMIT EXCEEDED — REGULATORY VIOLATION",         text: "One or more regulatory limits have been exceeded. Immediate action required — notify your Chief Pilot and CAAM Operations." },
  };
  const bannerInfo = bannerMessages[bannerCls];

  const worstLimit = [...allComputedLimits]
    .filter(l => l.status === bannerCls)
    .sort((a, b) => b.rawPct - a.rawPct)[0];

  // Unique aircraft types found in logbook for recency dropdown
  const aircraftTypes = [...new Set(allSectors.map(s => s.type).filter(Boolean))].sort();

  // ── Takeoff & Landing Recency computation ────────────────────────────────
  const cutoff90 = new Date(today);
  cutoff90.setDate(today.getDate() - 90);
  cutoff90.setHours(0, 0, 0, 0);

  // Helper: determine if takeoff/landing is day or night based on settings
  const isDayTakeoffDynamic = (sector) => {
    if (settings.dayNightMethod === "sunrise") {
      const { day, night } = calcDayNightDynamic(sector.std, sector.sta, String(sector.date.getDate()), sector.departure, sector.date.getFullYear(), sector.date.getMonth());
      return day > night; // More day time = day takeoff
    }
    return sector.isDayTakeoff;
  };

  const isDayLandingDynamic = (sector) => {
    if (settings.dayNightMethod === "sunrise") {
      const { day, night } = calcDayNightDynamic(sector.std, sector.sta, String(sector.date.getDate()), sector.departure, sector.date.getFullYear(), sector.date.getMonth());
      return day > night; // More day time = day landing
    }
    return sector.isDayLanding;
  };

  // Build recency data for all aircraft types
  const getRecencyExpiry = (arr) => {
    if (arr.length < 3) return null;
    const exp = new Date(arr[arr.length - 3].date);
    exp.setDate(exp.getDate() + 90);
    return exp;
  };

  const allRecencyByType = {};
  aircraftTypes.forEach(type => {
    const allPfForType = allSectors
      .filter(s => s.type === type && s.pilotFlying && s.date <= today)
      .sort((a, b) => a.date - b.date);

    const pf90 = allPfForType.filter(s => s.date > cutoff90);

    const dayTakeoffs90   = pf90.filter(s =>  isDayTakeoffDynamic(s)).length;
    const nightTakeoffs90 = pf90.filter(s => !isDayTakeoffDynamic(s)).length;
    const dayLandings90   = pf90.filter(s =>  isDayLandingDynamic(s)).length;
    const nightLandings90 = pf90.filter(s => !isDayLandingDynamic(s)).length;

    const dayTOExpiry    = getRecencyExpiry(allPfForType.filter(s =>  isDayTakeoffDynamic(s)));
    const nightTOExpiry  = getRecencyExpiry(allPfForType.filter(s => !isDayTakeoffDynamic(s)));
    const dayLdgExpiry   = getRecencyExpiry(allPfForType.filter(s =>  isDayLandingDynamic(s)));
    const nightLdgExpiry = getRecencyExpiry(allPfForType.filter(s => !isDayLandingDynamic(s)));

    allRecencyByType[type] = {
      dayTakeoffs90, nightTakeoffs90, dayLandings90, nightLandings90,
      dayTOExpiry, nightTOExpiry, dayLdgExpiry, nightLdgExpiry
    };
  });

  // Keep backward compatibility for single-type selection (for existing code)
  const recencyData = recencyType && allRecencyByType[recencyType] ? allRecencyByType[recencyType] : {};
  const dayTakeoffs90   = recencyData.dayTakeoffs90 || 0;
  const nightTakeoffs90 = recencyData.nightTakeoffs90 || 0;
  const dayLandings90   = recencyData.dayLandings90 || 0;
  const nightLandings90 = recencyData.nightLandings90 || 0;
  const dayTOExpiry     = recencyData.dayTOExpiry || null;
  const nightTOExpiry   = recencyData.nightTOExpiry || null;
  const dayLdgExpiry    = recencyData.dayLdgExpiry || null;
  const nightLdgExpiry  = recencyData.nightLdgExpiry || null;

  const fmtRecencyDate = (d) =>
    d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase() : null;

  // ── Autoland Recency computation ──────────────────────────────────────────
  let lastAutolandDate = null;
  const autolandDates = [];
  Object.entries(data).forEach(([key, rows]) => {
    if (!Array.isArray(rows)) return;
    const parts = key.split("-");
    const monthIdx = parseInt(parts[0]);
    const year = parseInt(parts[1]);
    if (isNaN(monthIdx) || isNaN(year)) return;
    rows.forEach(row => {
      if (row.autoland && row.date) {
        const [dd] = row.date.split('/');
        const day = parseInt(dd);
        if (!day || day < 1 || day > 31) return;
        const d = new Date(year, monthIdx, day);
        d.setHours(12, 0, 0, 0);
        if (d > today) return;
        autolandDates.push(d);
        if (!lastAutolandDate || d > lastAutolandDate) {
          lastAutolandDate = d;
        }
      }
    });
  });

  // Count autolands within last 6 months
  const cutoff6m = new Date(today);
  cutoff6m.setDate(today.getDate() - 180);
  cutoff6m.setHours(0, 0, 0, 0);
  const autoland6m = autolandDates.filter(d => d > cutoff6m).length;
  const autolandCurrent = autoland6m >= 3;

  const daysSinceAutoland = lastAutolandDate
    ? Math.floor((today - lastAutolandDate) / (1000 * 60 * 60 * 24))
    : null;

  // ── Grand Total Hours computation ─────────────────────────────────────────
  const GT_KEYS = ["dayP1", "dayP1US", "dayP2", "nightP1", "nightP1US", "nightP2"];
  const gtCutoff = new Date(grandTotalDate + "T23:59:59");
  const gtByType = {};

  // Carry-forward hours from profile settings
  (settings.carryForward || []).forEach(cf => {
    const t = (cf.type || "").trim().toUpperCase();
    if (!t) return;
    if (!gtByType[t]) gtByType[t] = { dayP1:0, dayP1US:0, dayP2:0, nightP1:0, nightP1US:0, nightP2:0 };
    GT_KEYS.forEach(k => { gtByType[t][k] += parseHHMM(cf[k] || ""); });
  });

  // All logbook rows up to the cutoff date
  Object.entries(data).forEach(([key, rows]) => {
    const [monthStr, yearStr] = key.split("-");
    const month = parseInt(monthStr), year = parseInt(yearStr);
    rows.forEach(row => {
      const day = parseInt(row.date?.split('/')[0]);
      if (!day || !row.type) return;
      if (new Date(year, month, day) > gtCutoff) return;
      const t = (row.type || "").trim().toUpperCase();
      if (!t) return;
      if (!gtByType[t]) gtByType[t] = { dayP1:0, dayP1US:0, dayP2:0, nightP1:0, nightP1US:0, nightP2:0 };
      const ft = calcFlightTimes(row, settings.dayNightMethod, year, month);
      GT_KEYS.forEach(k => { gtByType[t][k] += parseHHMM(ft[k] || ""); });
    });
  });

  const grandTotals = Object.entries(gtByType)
    .map(([type, t]) => ({ type, ...t }))
    .sort((a, b) => a.type.localeCompare(b.type));

  const gtSum = GT_KEYS.reduce((acc, k) => {
    acc[k] = grandTotals.reduce((s, r) => s + r[k], 0);
    return acc;
  }, {});

  const fmtGrandTotalDate = (str) => {
    if (!str) return "—";
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d)
      .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      .toUpperCase();
  };

  // ── Render helper: FTL/Duty limit card ────────────────────────────────────
  const renderLimitCard = (l) => {
    const pct    = Math.min(l.rawPct, 100);
    const status = l.status;
    const c      = FTL_COLOR[status];
    const remaining = l.max - l.used;
    const remStr = remaining >= 0
      ? `${status === "green" ? "✓" : "⚠"} ${toHHMM(remaining) || "00:00"} REMAINING`
      : `🚨 ${toHHMM(-remaining)} OVER LIMIT`;

    return (
      <div key={l.key} style={{
        background: "var(--elb-bg2, #0d1520)",
        border: `1px solid var(--elb-border2, #0f1e2d)`,
        borderLeft: `3px solid ${c}`,
        borderRadius: 4,
        padding: 12,
        minWidth: 220,
        flex: "1 1 220px",
      }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--elb-txt-muted, #4a6a8a)", lineHeight: 1.4 }}>{l.label}</div>
          <div style={{
            width: 7, height: 7, borderRadius: "50%", marginTop: 2, flexShrink: 0,
            background: c,
            boxShadow: `0 0 6px ${c}`,
            animation: status !== "green" ? `blink ${status === "red" ? "0.8" : "1.5"}s ease infinite` : "none",
          }} />
        </div>
        {/* Numbers */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: c, fontFamily: "'Courier New',monospace" }}>
            {toHHMM(l.used) || "00:00"}
          </div>
          <div style={{ fontSize: 15, color: "var(--elb-txt-muted, #4a6a8a)" }}>&nbsp;/&nbsp;</div>
          <div style={{ fontSize: 15, color: "var(--elb-txt-muted, #4a6a8a)" }}>{toHHMM(l.max)}</div>
          <div style={{ fontSize: "var(--elb-desc-sz)", color: "var(--elb-txt-muted, #4a6a8a)", marginLeft: 2 }}>HR</div>
        </div>
        {/* Progress bar */}
        <div style={{ background: "var(--elb-bg3, #0a1018)", borderRadius: 2, height: 4, marginBottom: 8, overflow: "hidden", border: "1px solid var(--elb-border2, #0f1e2d)" }}>
          <div style={{ height: "100%", borderRadius: 2, background: c, width: `${pct.toFixed(1)}%`, transition: "width 0.4s ease" }} />
        </div>
        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.04em", color: c }}>{remStr}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: "var(--elb-hint-sz)", color: "var(--elb-txt-muted, #4a6a8a)" }}>{l.rawPct.toFixed(1)}% USED</div>
            <button
              onClick={() => setActivePopup(l.popupId)}
              title="View regulatory reference"
              style={{
                width: 16, height: 16, borderRadius: "50%",
                background: "transparent",
                border: "1px solid #1e3a55",
                color: "#2d5070",
                fontFamily: "Georgia,serif",
                fontStyle: "italic", fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: 0, lineHeight: 1,
                transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#4fc3f7"; e.currentTarget.style.color = "#4fc3f7"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e3a55"; e.currentTarget.style.color = "#2d5070"; }}
            >i</button>
          </div>
        </div>
      </div>
    );
  };

  // ── Section header helper ──────────────────────────────────────────────────
  const SectionHeader = ({ icon, title, popupId }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, marginTop: 20 }}>
      <div style={{ fontSize: "var(--elb-th-sz)", letterSpacing: "0.18em", color: "var(--elb-acc, #4fc3f7)", whiteSpace: "nowrap" }}>
        {icon} {title}
      </div>
      <div style={{ flex: 1, height: 1, background: "var(--elb-border2, #1a3050)" }} />
      {popupId && (
        <button
          onClick={() => setActivePopup(popupId)}
          title="View regulatory reference"
          style={{
            width: 16, height: 16, borderRadius: "50%",
            background: "transparent", border: "1px solid var(--elb-border, #1e3a55)",
            color: "var(--elb-txt-muted, #2d5070)", fontFamily: "Georgia,serif",
            fontStyle: "italic", fontWeight: 700, fontSize: 12,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            padding: 0, lineHeight: 1, flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--elb-acc, #4fc3f7)"; e.currentTarget.style.color = "var(--elb-acc, #4fc3f7)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--elb-border, #1e3a55)"; e.currentTarget.style.color = "var(--elb-txt-muted, #2d5070)"; }}
        >i</button>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Space+Mono:wght@400;700&family=Roboto+Mono:wght@400;700&display=swap" />
    <div style={{
      background: "var(--elb-bg, #0a0d12)",
      minHeight: "100vh",
      fontFamily: "var(--elb-font, 'Courier New', Courier, monospace)",
      color: "var(--elb-txt, #c8d6e5)",
      filter: (settings.theme === "dark" && Number(settings.brightness) > 0 && Number(settings.brightness) < 100)
        ? `brightness(${settings.brightness}%)`
        : undefined,
    }}>
      <style>{`
        @keyframes spin    { from { transform: rotate(0deg);   } to { transform: rotate(360deg); } }
        @keyframes fadeIn  { from { opacity: 0;                } to { opacity: 1;                } }
        @keyframes blink   { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes popIn   { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
        ${themeCss}
        @media (max-width: 768px) {
          .save-status-text { display: none; }
          .save-button-text { display: none; }
          .save-button { padding: 4px 8px !important; }
        }
        @media (min-width: 769px) {
          .save-button-icon { display: none; }
        }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{
        background: "linear-gradient(135deg, var(--elb-bghd, #0d1117) 0%, var(--elb-bgalt, #161d2a) 100%)",
        borderBottom: "1px solid var(--elb-bdr, #1e3a5f)",
        padding: "18px 24px 0",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 22, color: "var(--elb-acc, #4fc3f7)" }}>✈</span>
              <span style={{ fontSize: 13, letterSpacing: "0.25em", color: "var(--elb-acc, #4fc3f7)", textTransform: "uppercase" }}>
                eLOGBOOK V5.6
              </span>
            </div>
            <div style={{ fontSize: 13, color: "var(--elb-txt-muted, #7ab8d4)", marginBottom: 2 }}>
              CAAM • MCAR 2016
            </div>
            <div style={{ fontSize: 19, fontWeight: 700, color: "var(--elb-txt, #e8f4fd)", letterSpacing: "0.05em" }}>
              {MONTHS[selectedMonth].toUpperCase()} {selectedYear} — FLIGHT RECORDS
            </div>
            <div style={{ fontSize: 12, color: "var(--elb-txt-muted, #5a7a9a)", marginTop: 3 }}>
              Compliant with CAD 1901 • MCAR 2016 Part 69 & Part 74
            </div>
          </div>

          {/* Right side: user info + period selector */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {user.photoURL && <img src={user.photoURL} alt="avatar" style={{ width: 22, height: 22, borderRadius: "50%", border: "1px solid var(--elb-border, #1e3a5f)" }} />}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                <span style={{ fontSize: 11, color: "var(--elb-txt, #c8d6e5)", letterSpacing: "0.1em", fontWeight: 700 }}>
                  {settings.fullName || user.displayName || user.email}
                </span>
                {(settings.airline || settings.licenceNumber) && (
                  <span style={{ fontSize: "var(--elb-hint-sz)", color: "var(--elb-txt-muted, #4a6a8a)", letterSpacing: "0.08em" }}>
                    {[settings.airline, settings.licenceNumber].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
            </div>
            <div style={{ fontSize: "var(--elb-desc-sz)", color: "var(--elb-txt-muted, #4a6a8a)", letterSpacing: "0.15em" }}>SELECT PERIOD</div>
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
              {refreshStatus === "refreshing" && (
                <span style={{ fontSize: 11, color: "#f5c542", letterSpacing: "0.1em", fontWeight: 700 }}>REFRESHING...</span>
              )}
              {refreshStatus === "refreshed" && (
                <span style={{ fontSize: 11, color: "#22c55e", letterSpacing: "0.1em", fontWeight: 700 }}>✓ REFRESHED</span>
              )}
              {refreshStatus === "error" && (
                <span style={{ fontSize: 11, color: "#ef4444", letterSpacing: "0.1em", fontWeight: 700 }}>✗ REFRESH FAILED</span>
              )}
              {/* Refresh */}
              <button
                onClick={refreshData}
                disabled={refreshStatus === "refreshing"}
                title={refreshStatus === "refreshing" ? "Refreshing..." : "Refresh data from cloud"}
                style={{
                  ...iconBtnStyle,
                  color: refreshStatus === "refreshed" ? "#4fc77a" : refreshStatus === "error" ? "#ef4444" : refreshStatus === "refreshing" ? "#f5c542" : "#3a6a8a",
                  borderColor: refreshStatus === "refreshed" ? "#4fc77a" : refreshStatus === "error" ? "#ef4444" : refreshStatus === "refreshing" ? "#f5c542" : "#1e3a5f",
                  opacity: refreshStatus === "refreshing" ? 0.6 : 1,
                  cursor: refreshStatus === "refreshing" ? "not-allowed" : "pointer",
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
              {/* Export/Import */}
              <button onClick={() => setExportImportOpen(true)} title="Export / Import" style={iconBtnStyle}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M2 12h20"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  <polyline points="18 7 23 7 23 9"/>
                  <line x1="23" y1="8" x2="16" y2="8"/>
                  <polyline points="6 17 1 17 1 15"/>
                  <line x1="1" y1="16" x2="8" y2="16"/>
                </svg>
              </button>
              {/* Settings */}
              <button
                onClick={() => setSettingsOpen(true)}
                title="Settings"
                style={{
                  ...iconBtnStyle,
                  color: settingsOpen ? "#4fc3f7" : "#3a6a8a",
                  borderColor: settingsOpen ? "#4fc3f7" : "#1e3a5f",
                  background: settingsOpen ? "rgba(79,195,247,0.1)" : "transparent",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>
              {/* Sign Out */}
              <button
                onClick={onLogout}
                title="Sign out"
                style={{
                  ...iconBtnStyle,
                  color: "var(--elb-txt-muted, #3a6a8a)",
                  borderColor: "var(--elb-border, #1e3a5f)",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--elb-border, #1e3a5f)"; e.currentTarget.style.color = "var(--elb-txt-muted, #3a6a8a)"; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{ display: "flex", gap: 0, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 0 }}>
            {[
              { id: "logbook",  label: "📋 LOGBOOK" },
              { id: "summary",  label: "📊 FLIGHT SUMMARY" },
              { id: "ftl",      label: "⏱ LIMITS & RECENCY" },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                background: activeTab === tab.id ? "var(--elb-bg, #0a0d12)" : "transparent",
                border: "none",
                borderTop: activeTab === tab.id ? "2px solid var(--elb-acc, #4fc3f7)" : "2px solid transparent",
                borderLeft: "1px solid " + (activeTab === tab.id ? "var(--elb-border, #1e3a5f)" : "transparent"),
                borderRight: "1px solid " + (activeTab === tab.id ? "var(--elb-border, #1e3a5f)" : "transparent"),
                color: activeTab === tab.id ? "var(--elb-acc, #4fc3f7)" : "var(--elb-txt-muted, #5a7a9a)",
                padding: "7px 18px",
                fontSize: 13,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: "pointer",
                fontFamily: "var(--elb-font, 'Courier New', monospace)",
                marginBottom: activeTab === tab.id ? "-1px" : 0,
              }}>{tab.label}</button>
            ))}
          </div>
          {/* ── AUTOSAVE STATUS & SAVE NOW BUTTON ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, letterSpacing: "0.1em", flex: 1, justifyContent: "flex-end" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {saveStatus === "saving" && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#f5c542", fontWeight: 700 }}>
                  <svg style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                  </svg>
                  <span className="save-status-text">SAVING...</span>
                </span>
              )}
              {saveStatus === "saved" && lastSaveTime && (
                <span style={{ color: "#22c55e", fontWeight: 700, fontStyle: "italic" }} className="save-status-text">
                  ✓ {lastSaveTime}
                </span>
              )}
              {saveStatus === "error" && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#f74f4f", fontWeight: 700, fontStyle: "italic" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span className="save-status-text">SAVE ERROR</span>
                </span>
              )}
            </div>
            <button
              onClick={saveData}
              disabled={saveStatus === "saving"}
              title="Save data to cloud"
              className="save-button"
              style={{
                flexShrink: 0,
                background: saveStatus === "error"  ? "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.08))"
                          : "linear-gradient(135deg, var(--elb-bg2, #0d2a3a), #0a1f30)",
                border: `1px solid ${saveStatus === "error" ? "#ef4444" : "var(--elb-acc, #4fc3f7)"}`,
                borderRadius: 4,
                color: saveStatus === "error" ? "#ef4444" : "var(--elb-acc, #4fc3f7)",
                fontFamily: "'Courier New', monospace",
                fontSize: 11,
                letterSpacing: "0.15em",
                padding: "4px 12px",
                cursor: saveStatus === "saving" ? "wait" : "pointer",
                boxShadow: "0 0 8px rgba(79,195,247,0.2)",
                opacity: saveStatus === "saving" ? 0.7 : 1,
                fontWeight: 700,
              }}
            >
              <span className="save-button-text">{saveStatus === "saving" ? "⏳ SAVING" : saveStatus === "error" ? "❌ ERROR" : "💾 SAVE NOW"}</span>
              <span className="save-button-icon">{saveStatus === "saving" ? "⏳" : saveStatus === "error" ? "❌" : "💾"}</span>
            </button>
          </div>
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
              padding: "7px 14px",
              marginBottom: 14,
              fontSize: 12,
              color: "#7ab8d4",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}>
              <div style={{ lineHeight: 1.6 }}>
                <span style={{ color: "#4fc3f7", fontWeight: 700 }}>
                  {MONTHS[selectedMonth].toUpperCase()} {selectedYear} —
                </span>
                {" "}Click any cell to enter data. Time fields accept HH:MM (e.g. 02:30) or HHMM (e.g. 0230) format. TOTAL auto-calculates from Day + Night columns. ({rows.length} rows)
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "auto" }}>
              <thead>
                <tr style={{ background: "var(--elb-thead, #0b1320)" }}>
                  <th rowSpan={2} style={thStyle}>#</th>
                  <th rowSpan={2} style={thStyle}>DATE</th>
                  <th colSpan={2} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>AIRCRAFT</th>
                  <th rowSpan={2} style={thStyle}>CAPTAIN</th>
                  <th rowSpan={2} style={{ ...thStyle, lineHeight: 1.4 }}>
                    <span style={{ display: "block" }}>HOLDER</span>
                    <span style={{ display: "block" }}>OPERATING</span>
                    <span style={{ display: "block" }}>CAPACITY</span>
                  </th>
                  <th rowSpan={2} style={{ ...thStyle, lineHeight: 1.4 }}>
                    <span style={{ display: "block" }}>PILOT</span>
                    <span style={{ display: "block" }}>FLYING</span>
                  </th>
                  <th colSpan={2} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>SECTORS</th>
                  <th rowSpan={2} style={{ ...thStyle, lineHeight: 1.4 }}>
                    <span style={{ display: "block" }}>STD</span>
                    <span style={{ display: "block", fontSize: "var(--elb-hint-sz)", color: "#2a5a7a" }}>(UTC)</span>
                  </th>
                  <th rowSpan={2} style={{ ...thStyle, lineHeight: 1.4 }}>
                    <span style={{ display: "block" }}>STA</span>
                    <span style={{ display: "block", fontSize: "var(--elb-hint-sz)", color: "#2a5a7a" }}>(UTC)</span>
                  </th>
                  <th colSpan={3} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", color: "#f5c542", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>DAY</th>
                  <th colSpan={3} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", color: "#7ab8d4", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>NIGHT</th>
                  <th rowSpan={2} style={thStyle}>TOTAL</th>
                  <th rowSpan={2} style={{ ...thStyle, background: "var(--elb-bg, #0a0d12)", border: "none" }}></th>
                  <th rowSpan={2} style={{ ...thStyle, background: "var(--elb-bg, #0a0d12)", border: "none", width: 28, minWidth: 28 }}></th>
                </tr>
                <tr style={{ background: "var(--elb-thead, #0b1320)" }}>
                  <th style={thSubStyle}>TYPE</th>
                  <th style={thSubStyle}>MARKINGS</th>
                  <th style={thSubStyle}>DEP</th>
                  <th style={thSubStyle}>ARR</th>
                  <th style={{ ...thSubStyle, color: "#22c55e" }}>P1</th>
                  <th style={{ ...thSubStyle, color: "#ef4444" }}>P1 U/S</th>
                  <th style={{ ...thSubStyle, color: "#eab308" }}>P2</th>
                  <th style={{ ...thSubStyle, color: "#4fc3f7" }}>P1</th>
                  <th style={{ ...thSubStyle, color: "#ef4444" }}>P1 U/S</th>
                  <th style={{ ...thSubStyle, color: "#4fc3f7" }}>P2</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, rowIdx) => {
                  const computedTotal = calcTotal(row, settings.dayNightMethod, selectedYear, selectedMonth);
                  const computedFT = calcFlightTimes(row, settings.dayNightMethod, selectedYear, selectedMonth);
                  const isEven = rowIdx % 2 === 0;
                  const hasStdSta = row.std && row.sta;
                  const hasCap = row.cap && ["P1","P2","P1 U/S"].includes(row.cap);
                  const needsCapWarning = hasStdSta && !hasCap;
                  const capColors = {
                    "P1":    { color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.3)" },
                    "P2":    { color: "#eab308", bg: "rgba(234,179,8,0.12)",  border: "rgba(234,179,8,0.3)" },
                    "P1 U/S":{ color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)" },
                  };
                  const capStyle = capColors[row.cap] || null;
                  const dynMode = settings.dayNightMethod === "sunrise";
                  const isDepUnknown = dynMode && row.departure && !getCoords(row.departure);
                  const isArrUnknown = dynMode && row.arrival   && !getCoords(row.arrival);

                  return (
                    <tr
                      key={row.id}
                      style={{ background: isEven ? "var(--elb-bg2, #0d1520)" : "var(--elb-bg3, #0a1018)", transition: "background 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--elb-rowhover, #122030)"}
                      onMouseLeave={e => e.currentTarget.style.background = isEven ? "var(--elb-bg2, #0d1520)" : "var(--elb-bg3, #0a1018)"}
                    >
                      <td style={{ ...tdStyle, color: "#2a4a6a", textAlign: "center", fontSize: 11 }}>{rowIdx + 1}</td>
                      {(() => {
                        const cells = [];
                        let skipAutoCalc = false;
                        for (let ci = 0; ci < columns.length; ci++) {
                          const col = columns[ci];
                          const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.field === col.key;
                          const isTime = timeCols.includes(col.key);
                          const isAutoCalc = autoCalcCols.includes(col.key);

                          if (needsCapWarning && col.key === "dayP1") {
                            skipAutoCalc = true;
                            cells.push(
                              <td key="hoc-warning" colSpan={7} style={{ ...tdStyle, background: "rgba(249,115,22,0.06)", borderLeft: "2px solid rgba(249,115,22,0.4)", textAlign: "center", color: "#f97316", fontSize: 11, fontStyle: "italic", letterSpacing: "0.05em", padding: "6px 10px", whiteSpace: "nowrap" }}>
                                ⚠ HOLDER OPERATING CAPACITY required to auto calculate
                              </td>
                            );
                            continue;
                          }

                          if (skipAutoCalc && ["dayP1US","dayP2","nightP1","nightP1US","nightP2","total"].includes(col.key)) {
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
                                textAlign: isTime ? "center" : "left",
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
                                    width: "100%", background: "#0f2035", border: "none",
                                    borderBottom: "1px solid #4fc3f7", color: "#e8f4fd",
                                    fontFamily: "'Courier New', monospace", fontSize: 13,
                                    padding: "6px 8px", outline: "none", boxSizing: "border-box",
                                    textTransform: "uppercase",
                                  }}
                                  placeholder={isTime ? "00:00" : ""}
                                />
                              ) : (
                                (col.key === "departure" && isDepUnknown) || (col.key === "arrival" && isArrUnknown)
                                  ? <span style={{ color: "rgba(155,188,212,0.6)", background: "rgba(155,188,212,0.1)", border: "1px solid rgba(155,188,212,0.35)", borderRadius: 3, padding: "2px 6px" }}>{displayVal}</span>
                                  : <span style={{ opacity: displayVal ? 1 : 0.2 }}>{displayVal || "—"}</span>
                              )}
                            </td>
                          );
                        }
                        return cells;
                      })()}
                      {/* ── REMARKS BUTTON ── */}
                      <td style={{ background: "var(--elb-bg, #0a0d12)", border: "none", borderRight: "none", textAlign: "center", padding: "3px 4px" }}>
                        {(() => {
                          const hasRemarks = row.remarks && row.remarks.trim().length > 0;
                          const hasAutoland = row.autoland;
                          let stateColor, stateAltColor, stateBg;
                          if (!hasRemarks && !hasAutoland) {
                            stateColor = "#3a5a7a"; stateAltColor = "#4fc3f7"; stateBg = "rgba(79,195,247,0.08)";
                          } else if (hasRemarks && !hasAutoland) {
                            stateColor = "#b8860b"; stateAltColor = "#f5c542"; stateBg = "rgba(245,197,66,0.08)";
                          } else if (!hasRemarks && hasAutoland) {
                            stateColor = "#6d28d9"; stateAltColor = "#a855f7"; stateBg = "rgba(168,85,247,0.08)";
                          } else {
                            stateColor = "#1b6b2f"; stateAltColor = "#4fc77a"; stateBg = "rgba(79,199,122,0.08)";
                          }
                          return (
                            <button
                              onClick={() => setRemarksModal({ rowIdx, draft: row.remarks || "", autoland: row.autoland || false })}
                              title={row.remarks ? "View / edit remarks" : "Add remarks"}
                              style={{
                                background: stateColor === "#3a5a7a" ? "transparent" : stateBg,
                                border: `1px solid ${stateColor}`,
                                borderRadius: 3,
                                color: stateColor,
                                cursor: "pointer",
                                padding: "3px 6px",
                                fontFamily: "'Courier New',monospace",
                                letterSpacing: "0.05em",
                                lineHeight: 1.3,
                                display: "flex", flexDirection: "column", alignItems: "center",
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.borderColor = stateAltColor;
                                e.currentTarget.style.color = stateAltColor;
                                e.currentTarget.style.background = stateBg;
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.borderColor = stateColor;
                                e.currentTarget.style.color = stateColor;
                                e.currentTarget.style.background = stateColor === "#3a5a7a" ? "transparent" : stateBg;
                              }}
                            >
                              <span style={{ fontSize: 7, display: "block" }}>{row.remarks ? "VIEW" : "ADD"}</span>
                              <span style={{ fontSize: 7, display: "block" }}>REMARKS</span>
                            </button>
                          );
                        })()}
                      </td>
                      {/* ── DELETE BUTTON ── */}
                      <td style={{ background: "var(--elb-bg, #0a0d12)", border: "none", borderRight: "none", textAlign: "center", padding: "3px 2px", width: 28, minWidth: 28 }}>
                        <button
                          onClick={() => deleteRow(rowIdx)}
                          title="Delete row"
                          style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13, padding: "2px 4px", borderRadius: 3, lineHeight: 1 }}
                          onMouseEnter={e => e.currentTarget.style.color = "#ff6b6b"}
                          onMouseLeave={e => e.currentTarget.style.color = "#ef4444"}
                        >✕</button>
                      </td>
                    </tr>
                  );
                })}

                {/* ── TOTALS ROW ── */}
                <tr style={{ background: "var(--elb-bginput, #0b1828)", borderTop: "2px solid var(--elb-bdr, #1e3a5f)" }}>
                  <td colSpan={11} style={{ ...tdStyle, color: "#4fc3f7", fontSize: 12, letterSpacing: "0.12em", fontWeight: 700, textAlign: "right" }}>
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
                      fontSize: 14,
                    }}>
                      {totalsRow[k]}
                    </td>
                  ))}
                  <td style={{ ...tdStyle }} />
                  <td style={{ ...tdStyle, textAlign: "center", padding: "3px 4px" }}>
                    <button
                      onClick={addSector}
                      title="Add sector row"
                      style={{
                        background: "rgba(39,174,96,0.15)", border: "1px solid #27ae60", borderRadius: "50%",
                        color: "#27ae60", cursor: "pointer", fontSize: 16, width: 22, height: 22,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        padding: 0, fontWeight: 700,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(39,174,96,0.3)"}
                      onMouseLeave={e => e.currentTarget.style.background = "rgba(39,174,96,0.15)"}
                    >+</button>
                  </td>
                </tr>

              </tbody>
            </table>
          </div>
        )}

        {/* ── SUMMARY TAB ── */}
        {activeTab === "summary" && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: "#4fc3f7", letterSpacing: "0.15em", marginBottom: 16 }}>
                {selectedYear} ANNUAL OVERVIEW — ALL MONTHS
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 800 }}>
                  <thead>
                    <tr style={{ background: "var(--elb-bg2, #0b1320)" }}>
                      <th rowSpan={2} style={{ ...thStyle, width: 80, minWidth: 80, maxWidth: 80 }}>MONTH</th>
                      <th rowSpan={2} style={{ ...thStyle, width: 55, minWidth: 55, maxWidth: 55 }}>SECTORS</th>
                      <th colSpan={3} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", color: "#f5c542", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>DAY</th>
                      <th colSpan={3} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", color: "#7ab8d4", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>NIGHT</th>
                      <th rowSpan={2} style={thStyle}>TOTAL</th>
                    </tr>
                    <tr style={{ background: "var(--elb-bg2, #0b1320)" }}>
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
                          onClick={() => { setSelectedMonth(i); setSelectedYear(selectedYear); setActiveTab("logbook"); }}
                          style={{
                            background: isSelected ? "rgba(79,195,247,0.08)" : i % 2 === 0 ? "var(--elb-bg2, #0d1520)" : "var(--elb-bg3, #0a1018)",
                            cursor: "pointer",
                            borderLeft: isSelected ? "3px solid var(--elb-acc, #4fc3f7)" : "3px solid transparent",
                          }}
                        >
                          <td style={{ ...tdStyle, width: 80, minWidth: 80, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", color: isSelected ? "#4fc3f7" : "#9bbcd4", fontWeight: isSelected ? 700 : 400 }}>{m.toUpperCase()}</td>
                          <td style={{ ...tdStyle, width: 55, minWidth: 55, maxWidth: 55, textAlign: "center", color: "#9bbcd4" }}>{filled || "—"}</td>
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
                  <tfoot>
                    <tr style={{ background: "var(--elb-bginput, #0b1828)", borderTop: "2px solid var(--elb-bdr, #1e3a5f)" }}>
                      <td style={{ ...tdStyle, width: 80, minWidth: 80, maxWidth: 80, whiteSpace: "normal", wordBreak: "break-word", color: "#4fc3f7", fontWeight: 700 }}>ANNUAL TOTAL</td>
                      <td style={{ ...tdStyle, width: 55, minWidth: 55, maxWidth: 55, textAlign: "center", color: "#4fc3f7", fontWeight: 700 }}>
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
              <div style={{ fontSize: 12, color: "#3a5a7a", marginTop: 10 }}>
                Click any month row to jump to its logbook page.
              </div>
            </div>

            {/* ── GRAND TOTAL HOURS ── */}
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid var(--elb-bdr3, #0f1820)" }}>

              {/* Heading with clickable date + TODAY shortcut */}
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
                <span style={{ fontSize: 13, letterSpacing: "0.15em", color: "#4fc3f7" }}>
                  GRAND TOTAL HOURS AS OF :
                </span>

                {/* Visible date input styled to match cockpit theme */}
                <input
                  type="date"
                  value={grandTotalDate}
                  onChange={e => setGrandTotalDate(e.target.value)}
                  style={{
                    background: "transparent", border: "none", borderBottom: "1px dashed #4fc3f7",
                    color: "#4fc3f7", fontFamily: "var(--elb-font, 'Courier New', monospace)",
                    fontSize: 13, letterSpacing: "0.15em", fontWeight: 700,
                    cursor: "pointer", padding: "0 0 2px 0", outline: "none",
                    colorScheme: "dark",
                  }}
                />

                {/* TODAY shortcut */}
                <button
                  type="button"
                  title="Jump to today"
                  onClick={() => setGrandTotalDate(new Date().toISOString().split("T")[0])}
                  style={{
                    background: "rgba(79,195,247,0.08)", border: "1px solid #1e3a5f",
                    borderRadius: 3, color: "var(--elb-txt-muted, #4a6a8a)",
                    fontFamily: "var(--elb-font, 'Courier New', monospace)",
                    fontSize: 10, letterSpacing: "0.12em", padding: "3px 8px",
                    cursor: "pointer", transition: "all 0.15s", lineHeight: 1.4,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#4fc3f7"; e.currentTarget.style.color = "#4fc3f7"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e3a5f"; e.currentTarget.style.color = "#4a6a8a"; }}
                >
                  ⊙ TODAY
                </button>
              </div>

              {grandTotals.length === 0 ? (
                <div style={{ color: "#2a4a6a", fontSize: "var(--elb-desc-sz)", letterSpacing: "0.08em", padding: "16px 0" }}>
                  No logbook entries or carry-forward hours found up to this date.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                    <thead>
                      <tr style={{ background: "var(--elb-thead, #0b1320)" }}>
                        <th rowSpan={2} style={{ ...thStyle, textAlign: "left", paddingLeft: 10, minWidth: 90 }}>AIRCRAFT<br />TYPE</th>
                        <th colSpan={3} style={{ ...thStyle, borderBottom: "1px solid var(--elb-bdr2, #1a3050)", textAlign: "center", color: "#f5c542", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>DAY</th>
                        <th colSpan={3} style={{ ...thStyle, borderBottom: "1px solid var(--elb-bdr2, #1a3050)", textAlign: "center", color: "#7ab8d4", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>NIGHT</th>
                        <th rowSpan={2} style={thStyle}>TOTAL</th>
                      </tr>
                      <tr style={{ background: "var(--elb-thead, #0b1320)" }}>
                        <th style={{ ...thSubStyle, color: "#22c55e" }}>P1</th>
                        <th style={{ ...thSubStyle, color: "#ef4444" }}>P1 U/S</th>
                        <th style={{ ...thSubStyle, color: "#eab308" }}>P2</th>
                        <th style={{ ...thSubStyle, color: "#22c55e" }}>P1</th>
                        <th style={{ ...thSubStyle, color: "#ef4444" }}>P1 U/S</th>
                        <th style={{ ...thSubStyle, color: "#eab308" }}>P2</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grandTotals.map((row, i) => {
                        const rowTotal = toHHMM(GT_KEYS.reduce((s, k) => s + row[k], 0));
                        const colMap = { dayP1:"#22c55e", dayP1US:"#ef4444", dayP2:"#eab308", nightP1:"#22c55e", nightP1US:"#ef4444", nightP2:"#eab308" };
                        return (
                          <tr key={i} style={{ background: i % 2 === 0 ? "var(--elb-bg2, #0d1520)" : "var(--elb-bg3, #0a1018)" }}>
                            <td style={{ ...tdStyle, textAlign: "left", paddingLeft: 10, color: "#9bbcd4" }}>
                              {row.type}
                            </td>
                            {GT_KEYS.map(k => (
                              <td key={k} style={{ ...tdStyle, textAlign: "center", color: row[k] ? colMap[k] : "#2a4a6a" }}>
                                {row[k] ? toHHMM(row[k]) : "—"}
                              </td>
                            ))}
                            <td style={{ ...tdStyle, textAlign: "center", color: "#4fc3f7", fontWeight: 700 }}>
                              {rowTotal || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "var(--elb-bginput, #0b1828)", borderTop: "2px solid var(--elb-bdr, #1e3a5f)" }}>
                        <td style={{ ...tdStyle, textAlign: "left", paddingLeft: 10, color: "#4fc3f7", fontWeight: 700 }}>GRAND TOTAL</td>
                        {GT_KEYS.map(k => {
                          const colMap = { dayP1:"#22c55e", dayP1US:"#ef4444", dayP2:"#eab308", nightP1:"#22c55e", nightP1US:"#ef4444", nightP2:"#eab308" };
                          return (
                            <td key={k} style={{ ...tdStyle, textAlign: "center", color: colMap[k], fontWeight: 700 }}>
                              {gtSum[k] ? toHHMM(gtSum[k]) : "—"}
                            </td>
                          );
                        })}
                        <td style={{ ...tdStyle, textAlign: "center", color: "#4fc3f7", fontWeight: 700 }}>
                          {toHHMM(GT_KEYS.reduce((s, k) => s + gtSum[k], 0)) || "—"}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── FTL & RECENCY TAB ── */}
        {activeTab === "ftl" && (
          <div>

            {/* ── STATUS BANNER ── */}
            <div style={{
              borderRadius: 4,
              padding: "12px 16px",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              background: FTL_BG[bannerCls],
              border: `1px solid ${FTL_BORDER[bannerCls]}`,
              borderLeft: `3px solid ${FTL_COLOR[bannerCls]}`,
            }}>
              <div style={{ fontSize: 18, flexShrink: 0 }}>{bannerInfo.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: FTL_COLOR[bannerCls] }}>
                  {bannerInfo.label}
                </div>
                <div style={{ fontSize: "var(--elb-desc-sz)", color: "var(--elb-txt-muted, #4a6a8a)", marginTop: 3, letterSpacing: "0.04em", lineHeight: 1.5 }}>
                  {bannerInfo.text}
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", flexShrink: 0 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "var(--elb-hint-sz)", color: "var(--elb-txt-muted, #4a6a8a)", letterSpacing: "0.1em" }}>AS OF DATE</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, color: "#4fc3f7" }}>
                    {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "var(--elb-hint-sz)", color: "var(--elb-txt-muted, #4a6a8a)", letterSpacing: "0.1em" }}>WORST LIMIT</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, color: FTL_COLOR[bannerCls] }}>
                    {worstLimit ? worstLimit.label : "NONE"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "var(--elb-hint-sz)", color: "var(--elb-txt-muted, #4a6a8a)", letterSpacing: "0.1em" }}>REGULATION</div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, color: "var(--elb-txt-muted, #4a6a8a)" }}>CAD 1901</div>
                </div>
              </div>
            </div>

            {/* ── FLIGHT TIME LIMITS — Para 2.18 ── */}
            <SectionHeader icon="✈" title="FLIGHT TIME LIMITS — CAD 1901 PARA 2.18" />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              {ftlLimits.map(l => renderLimitCard({ ...l, rawPct: l.max ? (l.used / l.max) * 100 : 0, status: ftlCls(l.max ? (l.used / l.max) * 100 : 0) }))}
            </div>

            {/* ── CUMULATIVE DUTY — Para 2.19.1 ── */}
            <SectionHeader icon="📊" title="CUMULATIVE DUTY HOURS — CAD 1901 PARA 2.19.1" />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              {dutyLimits.map(l => renderLimitCard({ ...l, rawPct: l.max ? (l.used / l.max) * 100 : 0, status: ftlCls(l.max ? (l.used / l.max) * 100 : 0) }))}
            </div>

            {/* ── TAKEOFF & LANDING RECENCY ── */}
            <SectionHeader icon="🛬" title="TAKEOFF & LANDING RECENCY — 3 WITHIN 90 DAYS" popupId="rec-tol" />

            {/* Explanation note */}
            <div style={{
              fontSize: "var(--elb-hint-sz)", color: "#3a5a7a", lineHeight: 1.7, letterSpacing: "0.03em",
              marginBottom: 16, borderLeft: "2px solid #1a3050", paddingLeft: 8,
            }}>
              Each sector with <span style={{ color: "#4fc3f7" }}>PILOT FLYING ✓</span> counts as 1 takeoff and 1 landing.
              Day / night is determined by <span style={{ color: "#4fc3f7" }}>STD</span> (takeoff) and{" "}
              <span style={{ color: "#4fc3f7" }}>STA</span> (landing) {settings.dayNightMethod === "sunrise" ? "using sunrise/sunset times at the departure airport" : "UTC times — civil day = 23:30–11:30 UTC, civil night = 11:30–23:30 UTC"}.
            </div>

            {/* Recency grid for all aircraft types */}
            {aircraftTypes.length === 0 ? (
              <div style={{
                background: "var(--elb-bg2, #0d1520)", border: "1px solid #0f1e2d", borderRadius: 4,
                padding: 24, textAlign: "center", color: "var(--elb-txt-muted, #4a6a8a)",
                fontSize: 11, letterSpacing: "0.12em",
              }}>
                NO AIRCRAFT TYPES IN LOGBOOK
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
                {aircraftTypes.map(type => {
                  const data = allRecencyByType[type];
                  const overallOk = data.dayTakeoffs90 >= 3 && data.dayLandings90 >= 3 && data.nightTakeoffs90 >= 3 && data.nightLandings90 >= 3;
                  const anyRed = data.dayTakeoffs90 < 3 || data.dayLandings90 < 3 || data.nightTakeoffs90 < 3 || data.nightLandings90 < 3;
                  const borderCol = anyRed ? "#ef4444" : "#22c55e";
                  const dotCol = anyRed ? "#ef4444" : "#22c55e";

                  const recencyCards = [
                    { label: "DAY TAKEOFFS",   count: data.dayTakeoffs90,   expiry: data.dayTOExpiry   },
                    { label: "DAY LANDINGS",   count: data.dayLandings90,   expiry: data.dayLdgExpiry  },
                    { label: "NIGHT TAKEOFFS", count: data.nightTakeoffs90, expiry: data.nightTOExpiry },
                    { label: "NIGHT LANDINGS", count: data.nightLandings90, expiry: data.nightLdgExpiry},
                  ];

                  return (
                    <div key={type} style={{
                      background: "var(--elb-bg2, #0d1520)", border: "1px solid #0f1e2d",
                      borderLeft: `3px solid ${borderCol}`, borderRadius: 4, padding: 16,
                    }}>
                      {/* Type badge + status dot */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                        <div>
                          <div style={{
                            display: "inline-block", fontSize: "var(--elb-hint-sz)", letterSpacing: "0.12em",
                            padding: "2px 8px", borderRadius: 2, marginBottom: 6, fontWeight: 700,
                            background: "rgba(79,195,247,0.12)", border: "1px solid rgba(79,195,247,0.3)", color: "#4fc3f7",
                          }}>{type}</div>
                          <div style={{ fontSize: "var(--elb-desc-sz)", color: "var(--elb-txt-muted, #4a6a8a)", letterSpacing: "0.08em" }}>
                            TAKEOFF &amp; LANDING RECENCY · LAST 90 DAYS · MINIMUM 3 EACH
                          </div>
                        </div>
                        <div style={{
                          width: 7, height: 7, borderRadius: "50%", marginTop: 4, flexShrink: 0,
                          background: dotCol, boxShadow: `0 0 6px ${dotCol}`,
                          animation: anyRed ? "blink 0.8s ease infinite" : "none",
                        }} />
                      </div>

                      {/* Live recency counters */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                        {recencyCards.map(({ label, count, expiry }) => {
                          const ok = count >= 3;
                          const c  = ok ? "#22c55e" : "#ef4444";
                          const expiryStr = fmtRecencyDate(expiry);
                          const daysLeft = expiry
                            ? Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24))
                            : null;
                          return (
                            <div key={label} style={{
                              textAlign: "center", background: "var(--elb-bg3, #080b10)",
                              border: `1px solid ${ok ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                              borderTop: `2px solid ${c}`,
                              borderRadius: 3, padding: "10px 6px",
                            }}>
                              <div style={{ fontSize: "var(--elb-hint-sz)", color: "var(--elb-txt-muted, #4a6a8a)", letterSpacing: "0.1em", marginBottom: 4 }}>{label}</div>
                              <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: c, fontFamily: "'Courier New',monospace" }}>
                                {count}
                              </div>
                              <div style={{ fontSize: "var(--elb-hint-sz)", color: "#2a4a6a", marginTop: 3 }}>REQ: 3 IN 90 DAYS</div>
                              <div style={{ fontSize: "var(--elb-hint-sz)", fontWeight: 700, letterSpacing: "0.08em", color: c, marginTop: 5 }}>
                                {ok ? "✓ CURRENT" : "✗ NOT CURRENT"}
                              </div>
                              {ok && expiryStr && (
                                <div style={{ fontSize: "var(--elb-hint-sz)", color: daysLeft !== null && daysLeft <= 14 ? "#eab308" : "#3a5a7a", marginTop: 3 }}>
                                  EXP: {expiryStr}
                                  {daysLeft !== null && daysLeft <= 14 && (
                                    <span style={{ color: "#eab308" }}> ({daysLeft}d)</span>
                                  )}
                                </div>
                              )}
                              {!ok && count > 0 && (
                                <div style={{ fontSize: "var(--elb-hint-sz)", color: "#ef4444", marginTop: 3 }}>
                                  NEED {3 - count} MORE
                                </div>
                              )}
                              {!ok && count === 0 && (
                                <div style={{ fontSize: "var(--elb-hint-sz)", color: "#3a5a7a", marginTop: 3 }}>
                                  NO DATA
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── AUTOLAND RECENCY ── */}
            <SectionHeader icon="🎯" title="AUTOLAND RECENCY — 3 WITHIN 6 MONTHS · ALL TYPES" popupId="rec-autoland" />
            <div style={{
              background: "var(--elb-bg2, #0d1520)", border: "1px solid #0f1e2d",
              borderLeft: "3px solid #eab308", borderRadius: 4, padding: 16,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{
                    display: "inline-block", fontSize: "var(--elb-hint-sz)", letterSpacing: "0.12em",
                    padding: "2px 8px", borderRadius: 2, marginBottom: 6, fontWeight: 700,
                    background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)", color: "#c084fc",
                  }}>CAT III AUTOLAND</div>
                  <div style={{ fontSize: "var(--elb-desc-sz)", color: "var(--elb-txt-muted, #4a6a8a)", letterSpacing: "0.08em" }}>
                    ALL AIRCRAFT TYPES · LAST 6 MONTHS · MINIMUM 3
                  </div>
                </div>
                <div style={{ width: 7, height: 7, borderRadius: "50%", marginTop: 4,
                  background: "#eab308", boxShadow: "0 0 6px #eab308",
                  animation: "blink 1.5s ease infinite" }} />
              </div>
              {lastAutolandDate ? (
                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12,
                }}>
                  <div style={{
                    background: "var(--elb-bg3, #080b10)", border: "1px solid rgba(234,179,8,0.2)",
                    borderRadius: 3, padding: "12px 10px", textAlign: "center",
                  }}>
                    <div style={{ fontSize: "var(--elb-hint-sz)", color: "var(--elb-txt-muted, #4a6a8a)", letterSpacing: "0.1em", marginBottom: 6 }}>LAST AUTOLAND</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#4fc3f7", marginBottom: 3 }}>
                      {fmtRecencyDate(lastAutolandDate)}
                    </div>
                    <div style={{ fontSize: "var(--elb-hint-sz)", color: "#eab308", fontWeight: 700, letterSpacing: "0.08em" }}>
                      {daysSinceAutoland} DAYS AGO
                    </div>
                  </div>
                  <div style={{
                    background: "var(--elb-bg3, #080b10)", border: `1px solid ${autolandCurrent ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                    borderTop: `2px solid ${autolandCurrent ? "#22c55e" : "#ef4444"}`,
                    borderRadius: 3, padding: "12px 10px", textAlign: "center",
                  }}>
                    <div style={{ fontSize: "var(--elb-hint-sz)", color: "var(--elb-txt-muted, #4a6a8a)", letterSpacing: "0.1em", marginBottom: 6 }}>STATUS · 6 MONTHS</div>
                    <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, color: autolandCurrent ? "#22c55e" : "#ef4444", fontFamily: "'Courier New',monospace", marginBottom: 3 }}>
                      {autoland6m}
                    </div>
                    <div style={{ fontSize: "var(--elb-hint-sz)", color: "var(--elb-txt-muted, #4a6a8a)", marginBottom: 6 }}>
                      {autolandCurrent ? "REQ: 3 ✓" : "REQ: 3 — NEED " + (3 - autoland6m)}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: autolandCurrent ? "#22c55e" : "#ef4444", letterSpacing: "0.08em" }}>
                      {autolandCurrent ? "✓ CURRENT" : "✗ NOT CURRENT"}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.2)",
                  borderLeft: "3px solid rgba(234,179,8,0.5)", borderRadius: "0 4px 4px 0",
                  padding: "12px 16px",
                }}>
                  <div style={{ fontSize: "var(--elb-desc-sz)", color: "#eab308", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>
                    ⏳ NO AUTOLAND ENTRIES FOUND
                  </div>
                  <div style={{ fontSize: "var(--elb-desc-sz)", color: "var(--elb-txt-muted, #4a6a8a)", lineHeight: 1.8, letterSpacing: "0.03em" }}>
                    Check the <span style={{ color: "#4fc3f7" }}>AUTOLAND checkbox</span> in the remarks window when logging autoland landings.
                  </div>
                </div>
              )}
            </div>

            {/* ── DISCLAIMER ── */}
            <div style={{
              background: "rgba(79,195,247,0.04)", border: "1px solid rgba(79,195,247,0.1)",
              borderRadius: 4, padding: "10px 14px", marginTop: 20,
              fontSize: "var(--elb-hint-sz)", color: "var(--elb-txt-muted, #4a6a8a)", letterSpacing: "0.04em", lineHeight: 1.7,
            }}>
              <span style={{ color: "#4fc3f7" }}>⚠ DISCLAIMER:</span> This FTL display is for{" "}
              <span style={{ color: "#4fc3f7" }}>reference purposes only</span> and is based solely on
              flight data entered into this logbook. Duty time is estimated as STD − 1:15 to STA + 0:15
              per sector. It may not reflect positioning flights, simulator sessions, standby duty or
              records held elsewhere. The pilot and operator remain solely responsible for ensuring full
              compliance with <span style={{ color: "#4fc3f7" }}>CAD 1901 ISS01/REV01</span>,{" "}
              <span style={{ color: "#4fc3f7" }}>MCAR 2016 Part 7</span>, and all applicable CAAM
              regulations. Always verify with your Operations department before accepting a duty assignment.
            </div>

          </div>
        )}
      </div>

      {/* ── REMARKS POPUP ── */}
      {remarksModal !== null && (() => {
        const targetRow = rows[remarksModal.rowIdx];
        const rowLabel = `ROW ${remarksModal.rowIdx + 1}${targetRow?.date ? ` · DATE ${targetRow.date}` : ""}`;
        return (
          <div
            onClick={e => { if (e.target === e.currentTarget) setRemarksModal(null); }}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.72)",
              zIndex: 2000,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 20,
            }}
          >
            <div style={{
              background: "#0c1622",
              border: "1px solid #1a3050",
              borderTop: "2px solid #4fc3f7",
              borderRadius: 6,
              padding: "20px 22px 18px",
              maxWidth: 520, width: "100%",
              boxShadow: "0 12px 48px rgba(0,0,0,0.8)",
              animation: "popIn 0.15s ease",
              fontFamily: "'Courier New',monospace",
            }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: "var(--elb-hint-sz)", letterSpacing: "0.16em", color: "#4fc3f7", marginBottom: 5 }}>{rowLabel}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#e8f4fd", letterSpacing: "0.07em" }}>REMARKS</div>
                </div>
                <button
                  onClick={() => setRemarksModal(null)}
                  style={{
                    background: "transparent", border: "1px solid #1e3a55", borderRadius: 3,
                    color: "var(--elb-txt-muted, #4a6a8a)", fontFamily: "'Courier New',monospace", fontSize: 12,
                    width: 22, height: 22, cursor: "pointer", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e3a55"; e.currentTarget.style.color = "#4a6a8a"; }}
                >✕</button>
              </div>
              <div style={{ height: 1, background: "#1a3050", marginBottom: 14 }} />
              {/* Textarea */}
              <textarea
                value={remarksModal.draft}
                onChange={e => setRemarksModal(prev => ({ ...prev, draft: e.target.value }))}
                placeholder="Enter remarks for this sector..."
                rows={6}
                autoFocus
                style={{
                  width: "100%",
                  background: "#080f18",
                  border: "1px solid #1a3050",
                  borderRadius: 4,
                  color: "#c8d6e5",
                  fontFamily: "'Courier New',monospace",
                  fontSize: 13,
                  padding: "10px 12px",
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                  lineHeight: 1.6,
                }}
                onFocus={e => e.target.style.borderColor = "#4fc3f7"}
                onBlur={e => e.target.style.borderColor = "#1a3050"}
              />
              {/* Autoland Checkbox */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={remarksModal.autoland || false}
                  onChange={e => setRemarksModal(prev => ({ ...prev, autoland: e.target.checked }))}
                  style={{
                    width: 14, height: 14, cursor: "pointer", accentColor: "#4fc3f7",
                  }}
                />
                <label style={{ fontSize: 11, color: "#7ab8d4", letterSpacing: "0.08em", cursor: "pointer", userSelect: "none" }}>AUTOLAND</label>
              </div>
              {/* Action buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                <button
                  onClick={() => setRemarksModal(null)}
                  style={{
                    background: "transparent", border: "1px solid #1e3a5f", borderRadius: 4,
                    color: "var(--elb-txt-muted, #4a6a8a)", fontFamily: "'Courier New',monospace",
                    fontSize: 11, letterSpacing: "0.12em", padding: "6px 16px", cursor: "pointer",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#4fc3f7"; e.currentTarget.style.color = "#4fc3f7"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e3a5f"; e.currentTarget.style.color = "#4a6a8a"; }}
                >CANCEL</button>
                <button
                  onClick={() => {
                    updateCell(remarksModal.rowIdx, "remarks", remarksModal.draft.trim());
                    updateCell(remarksModal.rowIdx, "autoland", remarksModal.autoland);
                    setRemarksModal(null);
                  }}
                  style={{
                    background: "linear-gradient(135deg, #0d2a3a, #0a1f30)",
                    border: "1px solid #4fc3f7", borderRadius: 4,
                    color: "#4fc3f7", fontFamily: "'Courier New',monospace",
                    fontSize: 11, letterSpacing: "0.12em", padding: "6px 20px", cursor: "pointer",
                    boxShadow: "0 0 8px rgba(79,195,247,0.2)",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "linear-gradient(135deg, #0d3a4a, #0a2f40)"}
                  onMouseLeave={e => e.currentTarget.style.background = "linear-gradient(135deg, #0d2a3a, #0a1f30)"}
                >SAVE REMARKS</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── REGULATORY REFERENCE POPUP ── */}
      {activePopup && (() => {
        const p = FTL_POPUPS[activePopup];
        if (!p) return null;
        return (
          <div
            onClick={e => { if (e.target === e.currentTarget) setActivePopup(null); }}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.68)",
              zIndex: 1000,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 20,
            }}
          >
            <div style={{
              background: "#0c1622",
              border: "1px solid #1a3050",
              borderTop: "2px solid #4fc3f7",
              borderRadius: 6,
              padding: "20px 22px 18px",
              maxWidth: 480, width: "100%",
              boxShadow: "0 12px 48px rgba(0,0,0,0.8)",
              animation: "popIn 0.15s ease",
              fontFamily: "'Courier New',monospace",
            }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: "var(--elb-hint-sz)", letterSpacing: "0.16em", color: "#4fc3f7", marginBottom: 5 }}>{p.para}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#e8f4fd", letterSpacing: "0.07em", lineHeight: 1.45 }}>{p.title}</div>
                </div>
                <button
                  onClick={() => setActivePopup(null)}
                  style={{
                    background: "transparent", border: "1px solid #1e3a55", borderRadius: 3,
                    color: "var(--elb-txt-muted, #4a6a8a)", fontFamily: "'Courier New',monospace", fontSize: 12,
                    width: 22, height: 22, cursor: "pointer", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e3a55"; e.currentTarget.style.color = "#4a6a8a"; }}
                >✕</button>
              </div>
              <div style={{ height: 1, background: "#1a3050", marginBottom: 14 }} />
              {/* Body */}
              <div
                style={{ fontSize: "var(--elb-desc-sz)", color: "var(--elb-txt-muted, #4a6a8a)", lineHeight: 1.9, letterSpacing: "0.03em" }}
                dangerouslySetInnerHTML={{ __html: p.body }}
              />
              {/* Note */}
              {p.note && (
                <div
                  style={{
                    marginTop: 14, padding: "9px 12px",
                    background: "rgba(79,195,247,0.05)",
                    borderLeft: "2px solid rgba(79,195,247,0.25)",
                    borderRadius: "0 3px 3px 0",
                    fontSize: "var(--elb-hint-sz)", color: "var(--elb-txt-muted, #4a6a8a)", lineHeight: 1.75, letterSpacing: "0.03em",
                  }}
                  dangerouslySetInnerHTML={{ __html: p.note }}
                />
              )}
            </div>
          </div>
        );
      })()}

      {/* ── AUTOSAVE ERROR MODAL ── */}
      {saveStatus === "error" && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setSaveStatus("idle"); }}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.72)",
            zIndex: 3000,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <div style={{
            background: "#0c1622",
            border: "1px solid #3a2020",
            borderTop: "2px solid #f74f4f",
            borderRadius: 6,
            padding: "20px 22px 18px",
            maxWidth: 420, width: "100%",
            boxShadow: "0 12px 48px rgba(0,0,0,0.9)",
            animation: "popIn 0.15s ease",
            fontFamily: "'Courier New',monospace",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#f74f4f", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🚨</span> AUTOSAVE FAILED
                </div>
              </div>
              <button
                onClick={() => setSaveStatus("idle")}
                style={{
                  background: "transparent", border: "1px solid #1e3a55", borderRadius: 3,
                  color: "var(--elb-txt-muted, #4a6a8a)", fontFamily: "'Courier New',monospace", fontSize: 12,
                  width: 22, height: 22, cursor: "pointer", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e3a55"; e.currentTarget.style.color = "#4a6a8a"; }}
              >✕</button>
            </div>
            <div style={{ height: 1, background: "#1a3050", marginBottom: 14 }} />
            {/* Message */}
            <div style={{ fontSize: 13, color: "#9bbcd4", lineHeight: 1.7, marginBottom: 14 }}>
              An error occurred while saving your data to the cloud. Please check your internet connection and try refreshing the page. Your local changes are safe and will be retried.
            </div>
            {/* Action Button */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setSaveStatus("idle")}
                style={{
                  background: "transparent",
                  border: "1px solid #1e3a55",
                  borderRadius: 4,
                  color: "var(--elb-txt-muted, #4a6a8a)", fontFamily: "'Courier New',monospace",
                  fontSize: 11, letterSpacing: "0.12em", padding: "6px 18px", cursor: "pointer",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#4fc3f7"; e.currentTarget.style.color = "#4fc3f7"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e3a55"; e.currentTarget.style.color = "#4a6a8a"; }}
              >DISMISS</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SETTINGS MODAL ── */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSave={saveSettings}
        userEmail={user?.email}
        onDeleteAccount={onDeleteAccount}
      />

      {/* ── EXPORT/IMPORT MODAL ── */}
      <ExportImportModal
        open={exportImportOpen}
        onClose={() => setExportImportOpen(false)}
        monthData={data}
        settings={settings}
        user={user}
        onImport={handleImport}
      />

      {/* ── FOOTER ── */}
      <div style={{
        padding: "10px 24px",
        borderTop: "1px solid #111820",
        fontSize: 11,
        color: "#2a4a6a",
        letterSpacing: "0.12em",
        display: "flex",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 8,
      }}>
        <span>eLOGBOOK v5.5 · CAA MALAYSIA</span>
        <span>MCAR 2016 PART 7 &amp; 8 · ICAO ANNEX 1 FORMAT</span>
        <span>{MONTHS[selectedMonth].toUpperCase()} {selectedYear} ACTIVE</span>
      </div>
    </div>
    </>
  );
}

const iconBtnStyle = {
  background: "transparent",
  border: "1px solid var(--elb-border, #1e3a5f)",
  borderRadius: 4,
  color: "var(--elb-txt-muted, #3a6a8a)",
  cursor: "pointer",
  padding: "5px 7px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "color 0.15s, border-color 0.15s",
};

const selectStyle = {
  background: "var(--elb-bg2, #0d1520)",
  border: "1px solid var(--elb-border, #1e3a5f)",
  borderRadius: 4,
  color: "var(--elb-acc, #4fc3f7)",
  fontSize: 15,
  fontFamily: "'Courier New', monospace",
  fontWeight: 700,
  padding: "6px 10px",
  letterSpacing: "0.08em",
  cursor: "pointer",
  outline: "none",
  minWidth: 140,
};

const thStyle = {
  padding: "7px 8px",
  textAlign: "center",
  color: "var(--elb-txt-muted, #3a6a8a)",
  fontSize: "var(--elb-th-sz, 10px)",
  letterSpacing: "0.12em",
  borderBottom: "1px solid var(--elb-border2, #1a3050)",
  borderRight: "1px solid var(--elb-border4, #111820)",
  whiteSpace: "nowrap",
  fontWeight: 700,
  textTransform: "uppercase",
  lineHeight: 1.3,
};

const thSubStyle = {
  ...thStyle,
  color: "var(--elb-txt-muted, #3a6a8a)",
  background: "var(--elb-bg2, #090d14)",
  fontSize: "var(--elb-ths-sz, 9px)",
  fontWeight: 700,
};

const tdStyle = {
  padding: "var(--elb-row-pad, 6px 8px)",
  borderBottom: "1px solid var(--elb-border3, #0f1820)",
  borderRight: "1px solid var(--elb-bg2, #0d1520)",
  whiteSpace: "nowrap",
  fontSize: "var(--elb-td-sz, 13px)",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
