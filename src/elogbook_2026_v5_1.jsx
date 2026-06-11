import { useState, useEffect, useRef, useMemo } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import SunCalc from "suncalc";
import { getCoords } from "./airportCoords";
import { db, auth } from "./firebase";
import { signOut } from "firebase/auth";
import { doc, setDoc, getDoc, addDoc, collection } from "firebase/firestore";
import SettingsModal, { DEFAULT_SETTINGS, ACCENT_PRESETS, ACCENT_MIGRATION, FONT_CHOICES } from "./SettingsModal";
import ExportImportModal from "./ExportImportModal";
import HowToGuideModal from "./HowToGuideModal";
import FeedbackModal from "./FeedbackModal";

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

const YEARS = Array.from({ length: new Date().getFullYear() - 2024 + 6 }, (_, i) => 2024 + i);

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

// Civil-twilight boundary for aviation night: sun centre 6° below horizon.
// Matches the ICAO/EASA definition of night (end of evening civil twilight to
// start of morning civil twilight) and is the physical basis of the CAD-6
// sunset+20 / sunrise−20 heuristic the older method approximated.
const CIVIL_TWILIGHT_RAD = -6 * Math.PI / 180;

// Module-level memo so identical (std/sta/date/dep/arr) inputs aren't recomputed
// across the many calcFlightTimes calls per render. Bounded; cleared when large.
const _routeDayNightCache = new Map();

// Most-accurate day/night split: integrate the sun's elevation along the actual
// great-circle route. Samples the aircraft's interpolated position once per minute
// (assuming constant ground speed), computes the sun's altitude at each
// position+time, and counts the minute as night when the sun is below civil
// twilight (−6°). Requires BOTH departure and arrival coordinates; falls back to
// the departure-anchored method (or fixed UTC) when coordinates are missing.
function calcDayNightRoute(std, sta, dayStr, depIcao, arrIcao, year, monthIdx) {
  if (!std || !sta) return { day: 0, night: 0 };
  const dep = getCoords(depIcao);
  const arr = getCoords(arrIcao);
  // Need both endpoints to interpolate a route. Degrade gracefully.
  if (!dep || !arr) {
    return dep
      ? calcDayNightDynamic(std, sta, dayStr, depIcao, year, monthIdx)
      : calcDayNight(std, sta);
  }

  const key = `${std}|${sta}|${dayStr}|${depIcao}|${arrIcao}|${year}|${monthIdx}`;
  const cached = _routeDayNightCache.get(key);
  if (cached) return cached;

  const toM = t => { const [h, m] = t.trim().split(":").map(Number); return h * 60 + m; };
  let stdM = toM(std), staM = toM(sta);
  if (staM <= stdM) staM += 1440;
  const totalMins = staM - stdM;
  if (totalMins <= 0 || totalMins > 18 * 60) return { day: 0, night: 0 };

  const D     = parseInt(dayStr) || 1;
  const depMs = Date.UTC(year, monthIdx, D) + stdM * 60000;

  // Great-circle interpolation (spherical linear interp) between endpoints.
  const toRad = d => d * Math.PI / 180;
  const lat1 = toRad(dep.lat), lon1 = toRad(dep.lon);
  const lat2 = toRad(arr.lat), lon2 = toRad(arr.lon);
  const dSig = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
  ));
  const interp = (f) => {
    if (dSig < 1e-9) return { lat: dep.lat, lon: dep.lon };
    const A = Math.sin((1 - f) * dSig) / Math.sin(dSig);
    const B = Math.sin(f * dSig)       / Math.sin(dSig);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1)                  + B * Math.sin(lat2);
    return {
      lat: Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI,
      lon: Math.atan2(y, x) * 180 / Math.PI,
    };
  };

  // Sample each 1-minute slice at its midpoint (mid-point Riemann sum).
  let nightMins = 0;
  for (let i = 0; i < totalMins; i++) {
    const f = (i + 0.5) / totalMins;
    const t = new Date(depMs + (i + 0.5) * 60000);
    const p = interp(f);
    if (SunCalc.getPosition(t, p.lat, p.lon).altitude < CIVIL_TWILIGHT_RAD) nightMins++;
  }
  const result = { day: totalMins - nightMins, night: nightMins };

  if (_routeDayNightCache.size > 2000) _routeDayNightCache.clear();
  _routeDayNightCache.set(key, result);
  return result;
}

function calcFlightTimes(row, method, year, monthIdx) {
  const { day, night } = method === "sunrise"
    ? calcDayNightRoute(row.std, row.sta, row.date, row.departure, row.arrival, year, monthIdx)
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
function getAllSectors(data, dutyBufferMins = 90, dayNightMethod = "fixed") {
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
      const flightMins = parseHHMM(calcTotal(row, dayNightMethod, year, monthIdx));
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
        arrival: row.arrival,
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

// ─── Theme CSS variable injection (v6 — aliases --elb-* to --cb-* tokens) ─────

const FONT_FAMILIES = {
  courier:   "'Courier New', Courier, monospace",
  jetbrains: "'JetBrains Mono', monospace",
  ibmplex:   "'IBM Plex Mono', monospace",
  roboto:    "'Roboto Mono', monospace",
  space:     "'Space Mono', monospace",
};

const DENSITY_PAD = {
  compact:  "3px 6px",
  default:  "6px 8px",
  relaxed:  "10px 8px",
};

const COLUMN_SCALE = {
  narrow:  0.75,
  default: 1.0,
  wide:    1.35,
};

// Resolve accent preset → single color value
function resolveAccent(settings) {
  const presetId = settings.accentPreset
    || ACCENT_MIGRATION[settings.accentColor]
    || "gradient";
  const preset = ACCENT_PRESETS.find(p => p.id === presetId) || ACCENT_PRESETS[0];
  const single = preset.single;
  const isGrad = preset.colors.length > 1;
  const grad = isGrad
    ? `linear-gradient(135deg, ${preset.colors.join(", ")})`
    : single;
  const dim = single + "4d"; // ~30% opacity
  return { accent: single, grad, dim };
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

function makeThemeCss(settings = {}) {
  const isDark   = (settings.theme || "dark") === "dark";
  const fontSize = Math.min(18, Math.max(12, Number(settings.fontSize) || 14));
  const rowPad   = DENSITY_PAD[settings.tableDensity] || DENSITY_PAD.default;
  const fontFamily = FONT_FAMILIES[settings.fontType] || FONT_FAMILIES.courier;
  const { accent, grad, dim } = resolveAccent(settings);

  // CB surface / ink / line tokens — mirrors brand.css values
  const surf = isDark
    ? { s0:"#0a1020", s1:"#141a2e", s2:"#1b2340", s3:"#232c4d",
        ink:"#e8ecf5", ink2:"#b8c0d4", inkD:"#7c87a3",
        line:"rgba(255,255,255,0.07)", line2:"rgba(255,255,255,0.12)" }
    : { s0:"#f4f6fb", s1:"#ffffff", s2:"#ebeef7", s3:"#dfe3f0",
        ink:"#0a1020", ink2:"#3a4258", inkD:"#6b7488",
        line:"rgba(10,16,32,0.08)", line2:"rgba(10,16,32,0.16)" };

  return `
    :root {
      /* ── ClaudeBorne brand tokens ── */
      --cb-surface-0:${surf.s0};--cb-surface-1:${surf.s1};
      --cb-surface-2:${surf.s2};--cb-surface-3:${surf.s3};
      --cb-ink:${surf.ink};--cb-ink-2:${surf.ink2};--cb-ink-dim:${surf.inkD};
      --cb-line:${surf.line};--cb-line-2:${surf.line2};
      --cb-accent:${accent};
      --cb-accent-rgb:${hexToRgb(accent)};
      --cb-grad:${grad};
      --cb-font-body:${fontFamily};
      --cb-font-mono:${fontFamily};
      --fs:${(fontSize / 14).toFixed(4)};
      --cell-pad:${rowPad};

      /* ── Legacy --elb-* aliases → CB tokens ── */
      --elb-bg:var(--cb-surface-0);
      --elb-bg2:var(--cb-surface-1);
      --elb-bg3:var(--cb-surface-2);
      --elb-bghd:var(--cb-surface-1);
      --elb-bgalt:var(--cb-surface-2);
      --elb-thead:var(--cb-surface-2);
      --elb-bginput:var(--cb-surface-2);
      --elb-rowhover:var(--cb-surface-3);
      --elb-acc:var(--cb-accent);
      --elb-acc2:#3B8DFF;
      --elb-accdim:${dim};
      --elb-accent:var(--cb-accent);
      --elb-border:var(--cb-line-2);
      --elb-bdr:var(--cb-line-2);
      --elb-border2:var(--cb-line);
      --elb-bdr2:var(--cb-line);
      --elb-border3:var(--cb-line);
      --elb-bdr3:var(--cb-line);
      --elb-border4:var(--cb-line);
      --elb-bdr4:var(--cb-line);
      --elb-txt:var(--cb-ink);
      --elb-txt-muted:var(--cb-ink-2);
      --elb-txt-dim:var(--cb-ink-dim);
      --elb-txt-bright:var(--cb-ink);
      --elb-muted:var(--cb-ink-2);
      --elb-dim:var(--cb-ink-dim);
      --elb-bright:var(--cb-ink);
      --elb-font:var(--cb-font-mono);
      --elb-td-sz:calc(${fontSize}px * var(--fs,1));
      --elb-th-sz:calc(${Math.max(10, fontSize - 1)}px * var(--fs,1));
      --elb-ths-sz:calc(${Math.max(9, fontSize - 2)}px * var(--fs,1));
      --elb-desc-sz:calc(${Math.max(11, fontSize)}px * var(--fs,1));
      --elb-hint-sz:calc(${Math.max(10, fontSize - 1)}px * var(--fs,1));
      --elb-row-pad:${rowPad};
    }
  `;
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ELogbook2026({ user, onLogout, onDeleteAccount, onReauthAndDelete, userProvider }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(initialData);
  const [editingCell, setEditingCell] = useState(null);
  const [activeTab, setActiveTab] = useState("logbook");
  const [saveStatus, setSaveStatus] = useState("idle");
  const [saveError, setSaveError] = useState(""); // stores last error message for display
  const [lastSaveTime, setLastSaveTime] = useState(""); // Format: "DD MMM YYYY • HH:MM:SS"
  const [refreshStatus, setRefreshStatus] = useState("idle");
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | error
  const [lastSyncTime, setLastSyncTime] = useState("");
  const [syncConflict, setSyncConflict] = useState(null); // { cloudData } when conflict detected
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cloudNewerBanner, setCloudNewerBanner] = useState(false);

  // ── PWA update prompt + manual check ──
  const swRegistrationRef = useRef(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateChecked, setUpdateChecked] = useState(false);
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      swRegistrationRef.current = registration;
    },
  });

  const checkForUpdate = async () => {
    if (!swRegistrationRef.current) return;
    setCheckingUpdate(true);
    setUpdateChecked(false);
    try {
      await swRegistrationRef.current.update();
    } catch (e) {
      console.error('SW update check failed:', e);
    }
    // Give needRefresh state a moment to propagate before showing result
    setTimeout(() => {
      setCheckingUpdate(false);
      setUpdateChecked(true);
      setTimeout(() => setUpdateChecked(false), 4000);
    }, 1000);
  };
  // ── NEW ──
  const [activePopup, setActivePopup] = useState(null); // popup id string or null
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const settingsRef = useRef(DEFAULT_SETTINGS); // always mirrors latest settings for use in async closures
  const dataRef = useRef(initialData()); // initialised to match data state — prevents {} being written if a save fires before first effect run
  const dataLoadedRef = useRef(false); // true only after a successful loadData — prevents saving initialData() over real data
  const localDirtyRef = useRef(false); // true if local data changed since last cloud sync — used for conflict detection
  const saveChipDebounceRef = useRef(null); // debounce: saving → saved (1 s after last keystroke)
  const saveChipFadeRef     = useRef(null); // saved → fading (after 2 s display)
  const saveChipIdleRef     = useRef(null); // fading → idle (after 0.5 s fade)
  const [migrating, setMigrating] = useState(false); // true while pulling existing data from Firestore on first load
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState(null); // null → SettingsModal defaults to "profile"
  const [hiddenColsToastVisible, setHiddenColsToastVisible] = useState(false); // toast above table (transient, 5s auto-fade)
  const prevHiddenColsCountRef = useRef(null); // tracks hidden-col count to detect "just hid a column"
  const hiddenColsToastTimerRef = useRef(null);
  const [previewSettings, setPreviewSettings] = useState(null); // live preview while settings modal is open
  const [exportImportOpen, setExportImportOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [remarksModal, setRemarksModal] = useState(null); // { rowIdx, draft }
  const [grandTotalDate, setGrandTotalDate] = useState(() => new Date().toISOString().split("T")[0]);
  // Branded confirmation modal (replaces window.confirm)
  const [confirmDialog, setConfirmDialog] = useState(null); // { title, body, resolve }
  const confirmResolveRef = useRef(null);

  // Show a branded confirm dialog; returns Promise<boolean>
  const showConfirm = (title, body) => new Promise(resolve => {
    confirmResolveRef.current = resolve;
    setConfirmDialog({ title, body });
  });
  const handleConfirmYes = () => {
    setConfirmDialog(null);
    confirmResolveRef.current?.(true);
  };
  const handleConfirmNo = () => {
    setConfirmDialog(null);
    confirmResolveRef.current?.(false);
  };

  // ── Data loading — triggered by user prop from App.jsx ──
  // useEffect on user prop replaces onAuthStateChanged listener — App.jsx owns auth state.
  // dataLoadedRef guards against re-loading on token-refresh re-renders (user ref changes hourly).
  useEffect(() => {
    if (user) {
      if (!dataLoadedRef.current) {
        loadData(user.uid);
        loadProfile(user.uid);
      }
    } else {
      dataLoadedRef.current = false;
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps


  // ── Handle import — called directly by ExportImportModal ──
  // Returns true on success. Throws on save failure so the modal can show a specific error.
  const handleImport = async (importedData) => {
    dataLoadedRef.current = true; // import replaces data — treat as loaded
    setData(importedData);
    const ok = saveData(importedData);
    if (!ok) throw new Error("Local save failed — data is loaded in app. Use SAVE NOW to retry.");
  };

  // ── Helper: apply a Firestore docData snapshot to React state ──
  const applyDocData = (docData) => {
    const raw = docData.logbookData;
    // Guard: {} is truthy in JS — never overwrite local state with an empty map
    if (raw && Object.keys(raw).length > 0) {
      const normalized = {};
      Object.keys(raw).forEach(key => {
        const [mIdx] = key.split("-").map(Number);
        normalized[key] = normalizeMonthRows(raw[key], mIdx, null);
      });
      setData(normalized);
    }
    if (docData.settings) {
      const merged = { ...DEFAULT_SETTINGS, ...docData.settings };
      if (!Array.isArray(merged.carryForward) || !merged.carryForward.some(r => r.type)) {
        merged.carryForward = DEFAULT_SETTINGS.carryForward;
      }
      settingsRef.current = merged;
      setSettings(merged);
    }
  };

  // ── localStorage helpers ──
  const lsKey            = (uid) => `elb_data_${uid}`;
  const lsSettingsKey    = (uid) => `elb_settings_${uid}`;
  const lsSaveKey        = (uid) => `elb_last_local_save_${uid}`;
  const lsSyncDisplayKey = (uid) => `elb_last_sync_display_${uid}`;

  // ── Background cloud timestamp check ──
  // Silently fetches Firestore updatedAt and compares to local lastSyncedAt.
  // Shows cloud-newer banner if cloud is ahead. Never modifies local data.
  const runCloudCheck = async (uid) => {
    if (!navigator.onLine) return;
    try {
      const ref  = doc(db, "users", uid, "logbook", "data");
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const cloudUpdatedAt = snap.data().updatedAt ? new Date(snap.data().updatedAt).getTime() : 0;
        const lastSyncedAt   = localStorage.getItem(lsSaveKey(uid));
        const lastSyncedMs   = lastSyncedAt ? new Date(lastSyncedAt).getTime() : 0;
        if (cloudUpdatedAt > lastSyncedMs && cloudUpdatedAt > 0 && lastSyncedMs > 0) {
          setCloudNewerBanner(true);
        }
      }
    } catch (err) {
      console.warn("Background cloud check failed:", err);
    }
  };

  // ── Load data — localStorage first, Firestore fallback (migration) ──
  const loadData = async (uid) => {
    try {
      const localRaw      = localStorage.getItem(lsKey(uid));
      const localSettings = localStorage.getItem(lsSettingsKey(uid));

      if (localRaw) {
        // Local data exists — use it directly (instant, no network)
        const parsed = JSON.parse(localRaw);
        applyDocData({
          logbookData: parsed,
          settings: localSettings ? JSON.parse(localSettings) : null,
        });
        dataLoadedRef.current = true;

        // Restore last sync display timestamp so toolbar shows it even offline
        const storedSyncDisplay = localStorage.getItem(lsSyncDisplayKey(uid));
        if (storedSyncDisplay) setLastSyncTime(storedSyncDisplay);

        // Background cloud check — runs silently, shows banner if cloud is newer
        runCloudCheck(uid);
        return;
      }

      // No local data — first load or new device — pull from Firestore
      setMigrating(true);
      const ref  = doc(db, "users", uid, "logbook", "data");
      const snap = await getDoc(ref);
      dataLoadedRef.current = true;
      if (snap.exists()) {
        const docData = snap.data();
        applyDocData(docData);
        // Persist to localStorage so future loads are instant
        if (docData.logbookData) localStorage.setItem(lsKey(uid), JSON.stringify(docData.logbookData));
        if (docData.settings)    localStorage.setItem(lsSettingsKey(uid), JSON.stringify(docData.settings));
        const now = new Date();
        const syncIso = now.toISOString();
        const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        const displayStr = `${dateStr} · ${timeStr}`;
        localStorage.setItem(lsSaveKey(uid), syncIso);
        localStorage.setItem(lsSyncDisplayKey(uid), displayStr);
        setLastSyncTime(displayStr);
        localDirtyRef.current = false;
      }
      setMigrating(false);
    } catch (err) {
      console.error("Load error:", err);
      dataLoadedRef.current = true;
      setMigrating(false);
    }
  };

  // ── Load profile data and merge into settings (migration fallback) ──
  const loadProfile = async (uid) => {
    try {
      const profileRef = doc(db, "users", uid, "profile", "data");
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        const profileData = profileSnap.data();
        const updated = {
          ...settingsRef.current,
          // logbook/data settings take priority; profile/data is migration fallback only
          fullName: settingsRef.current.fullName || profileData.fullName || "",
          airline: settingsRef.current.airline || profileData.airline || profileData.organization || "",
          licenceNumber: settingsRef.current.licenceNumber || profileData.licenceNumber || "",
          licenceType: settingsRef.current.licenceType || profileData.licenceType || "ATPL(A)",
        };
        settingsRef.current = updated;
        setSettings(updated);
      }
    } catch (profileErr) {
      console.error("Profile load error:", profileErr);
    }
  };

  // ── Warn before tab close if localStorage save errored ──
  useEffect(() => {
    const handler = (e) => {
      if (saveStatus === "error") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus]);

  // ── Track online/offline status + cloud check on reconnect ──
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      // Run cloud check when connection is restored — banner appears if cloud is ahead
      if (user?.uid) runCloudCheck(user.uid);
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cloud check on app resume (tab/PWA comes back to foreground) ──
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && user?.uid && navigator.onLine) {
        runCloudCheck(user.uid);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keep settingsRef in sync so saveData never reads a stale closure ──
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // ── Keep dataRef in sync ──
  useEffect(() => { dataRef.current = data; }, [data]);

  // ── Save-on-change: write to localStorage on every data update ──
  // localStorage is synchronous and instant — no network, no interval needed.
  // Skip until dataLoadedRef is true to avoid overwriting real data with empty initialData().
  useEffect(() => {
    if (!dataLoadedRef.current) return;
    saveData(data);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync data-theme attribute on <html> for brand.css dark/light tokens ──
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme || "dark";
  }, [settings.theme]);

  // ── One-time accent migration: legacy hex → preset id ──
  useEffect(() => {
    if (!settings.accentPreset && settings.accentColor) {
      const migrated = ACCENT_MIGRATION[settings.accentColor] || "gradient";
      const next = { ...settings, accentPreset: migrated };
      settingsRef.current = next;
      setSettings(next);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save settings to localStorage ──
  const saveSettings = (next) => {
    settingsRef.current = next;
    setSettings(next);
    if (!user) return;
    try {
      localStorage.setItem(lsSettingsKey(user.uid), JSON.stringify(next));
    } catch (e) {
      console.error("Settings save error:", e);
    }
  };

  // ── Refresh with animation ──
  // Re-fetches data from Firestore (one-time getDoc).
  const refreshData = async () => {
    if (!user || refreshStatus === "refreshing") return;
    setRefreshStatus("refreshing");
    const start = Date.now();
    await loadData(user.uid);
    // Minimum 800ms spinner so the animation is visible
    const elapsed = Date.now() - start;
    if (elapsed < 800) await new Promise(r => setTimeout(r, 800 - elapsed));
    setRefreshStatus("refreshed");
    setTimeout(() => setRefreshStatus("idle"), 2500);
  };

  // ── Sync local data to/from Firestore (manual, user-triggered) ──
  // 1. PULL: fetch Firestore document and compare updatedAt timestamp with last local sync.
  // 2. If Firestore is newer → show conflict modal (user chooses Keep Local or Keep Cloud).
  // 3. If no conflict → PUSH local data to Firestore.
  const syncData = async () => {
    if (!user || syncStatus === "syncing" || !isOnline) return;
    setSyncStatus("syncing");
    try {
      const ref = doc(db, "users", user.uid, "logbook", "data");
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Sync timed out")), 15000)
      );

      // PULL — check if Firestore has newer data than last sync
      const snap = await Promise.race([getDoc(ref), timeoutPromise]);
      if (snap.exists()) {
        const cloudData      = snap.data();
        const cloudUpdatedAt = cloudData.updatedAt ? new Date(cloudData.updatedAt).getTime() : 0;
        const lastSyncedAt   = localStorage.getItem(lsSaveKey(user.uid));
        const lastSyncedMs   = lastSyncedAt ? new Date(lastSyncedAt).getTime() : 0;

        if (cloudUpdatedAt > lastSyncedMs && cloudUpdatedAt > 0 && lastSyncedMs > 0) {
          if (localDirtyRef.current) {
            // Cloud is newer AND local has unsaved changes — genuine conflict, let user decide
            setSyncStatus("idle");
            setSyncConflict({ cloudData });
            return;
          } else {
            // Cloud is newer but local has no changes since last sync — silent pull
            applyDocData(cloudData);
            if (cloudData.logbookData) localStorage.setItem(lsKey(user.uid), JSON.stringify(cloudData.logbookData));
            if (cloudData.settings)    localStorage.setItem(lsSettingsKey(user.uid), JSON.stringify(cloudData.settings));
            const now = new Date();
            const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
            const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
            const displayStr = `${dateStr} · ${timeStr}`;
            localStorage.setItem(lsSaveKey(user.uid), now.toISOString());
            localStorage.setItem(lsSyncDisplayKey(user.uid), displayStr);
            setLastSyncTime(displayStr);
            setCloudNewerBanner(false);
            localDirtyRef.current = false;
            setSyncStatus("synced");
            setTimeout(() => setSyncStatus("idle"), 3000);
            return;
          }
        }
      }

      // No conflict — PUSH local data to Firestore
      const cleanData = {};
      Object.keys(dataRef.current).forEach(monthKey => {
        const rows = dataRef.current[monthKey];
        if (!Array.isArray(rows)) return;
        cleanData[monthKey] = rows.map((row, idx) => ({ ...row, id: idx + 1 }));
      });
      const settingsToSave = sanitizeForFirestore(settingsRef.current);
      await Promise.race([
        setDoc(ref, { logbookData: cleanData, settings: settingsToSave, updatedAt: new Date().toISOString() }, { merge: true }),
        timeoutPromise,
      ]);

      // Record sync timestamp
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const displayStr = `${dateStr} · ${timeStr}`;
      localStorage.setItem(lsSaveKey(user.uid), now.toISOString());
      localStorage.setItem(lsSyncDisplayKey(user.uid), displayStr);
      setLastSyncTime(displayStr);
      localDirtyRef.current = false;
      setCloudNewerBanner(false);
      setSyncStatus("synced");
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch (e) {
      console.error("Sync error:", e);
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 5000);
    }
  };

  // ── Conflict resolution: Keep Local — push local data over cloud ──
  const resolveKeepLocal = async () => {
    setSyncConflict(null);
    await syncData();
  };

  // ── Conflict resolution: Keep Cloud — pull cloud data into local ──
  const resolveKeepCloud = () => {
    if (!syncConflict?.cloudData) return;
    applyDocData(syncConflict.cloudData);
    const { logbookData, settings: cloudSettings } = syncConflict.cloudData;
    if (logbookData) localStorage.setItem(lsKey(user.uid), JSON.stringify(logbookData));
    if (cloudSettings) localStorage.setItem(lsSettingsKey(user.uid), JSON.stringify(cloudSettings));
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const displayStr = `${dateStr} · ${timeStr}`;
    localStorage.setItem(lsSaveKey(user.uid), now.toISOString());
    localStorage.setItem(lsSyncDisplayKey(user.uid), displayStr);
    setLastSyncTime(displayStr);
    localDirtyRef.current = false;
    setCloudNewerBanner(false);
    setSyncConflict(null);
    setSyncStatus("synced");
    setTimeout(() => setSyncStatus("idle"), 3000);
  };

  // ── Save data to Firestore ──
  // Strip NaN, Infinity, and undefined — Firestore rejects all three
  const sanitizeForFirestore = (val) => {
    if (Array.isArray(val)) return val.map(sanitizeForFirestore);
    if (val !== null && typeof val === "object") {
      const out = {};
      for (const [k, v] of Object.entries(val)) {
        if (v === undefined) continue;
        out[k] = sanitizeForFirestore(v);
      }
      return out;
    }
    if (typeof val === "number" && !isFinite(val)) return 0; // NaN / Infinity → 0
    return val;
  };

  const saveData = (dataOverride) => {
    if (!user) return true;
    // Never save before loadData has completed — prevents overwriting real data with initialData() empty rows
    if (!dataLoadedRef.current) return false;

    // ── Visual: show SAVING... immediately, transition to SAVED after 1s of no edits ──
    // The actual localStorage write is instant — this is purely for user feedback.
    setSaveStatus("saving");
    clearTimeout(saveChipDebounceRef.current);
    clearTimeout(saveChipFadeRef.current);
    clearTimeout(saveChipIdleRef.current);
    saveChipDebounceRef.current = setTimeout(() => {
      setSaveStatus("saved");
      saveChipFadeRef.current = setTimeout(() => {
        setSaveStatus("fading");
        saveChipIdleRef.current = setTimeout(() => setSaveStatus("idle"), 500);
      }, 2000);
    }, 1000);

    try {
      // Regenerate IDs sequentially for each month to prevent duplicates
      const cleanData = {};
      const dataToSave = dataOverride || dataRef.current;
      Object.keys(dataToSave).forEach(monthKey => {
        const rows = dataToSave[monthKey];
        if (!Array.isArray(rows)) return;
        cleanData[monthKey] = rows.map((row, idx) => ({ ...row, id: idx + 1 }));
      });

      // Write to localStorage — instant, no network required
      // NOTE: lsSaveKey is intentionally NOT updated here — it tracks cloud sync time only,
      // not local save time. Updating it here would fool the conflict detection into thinking
      // local data is newer than Firestore, suppressing the cloud-newer banner.
      localStorage.setItem(lsKey(user.uid), JSON.stringify(cleanData));
      localStorage.setItem(lsSettingsKey(user.uid), JSON.stringify(settingsRef.current));

      // Mark local as dirty — used by conflict detection to distinguish Scenario 1 vs 2
      localDirtyRef.current = true;

      const now = new Date();
      const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setLastSaveTime(`${dateStr} • ${timeStr}`);
      return true;
    } catch (e) {
      console.error("Save error:", e);
      setSaveError(e?.message || "Unknown error");
      setSaveStatus("error");
      return false;
    }
  };

  // ── Sign Out ──
  const handleSignOut = async () => {
    await signOut(auth);
    setData(initialData());
  };


  // ── Hooks must be declared before any early returns ──────────────────────
  const dutyBufferMins = settings.useStandardFormula === false
    ? 0
    : (Number(settings.preFlightBuffer) || 0) + (Number(settings.postFlightBuffer) || 0);

  const allSectors = useMemo(() => getAllSectors(data, dutyBufferMins, settings.dayNightMethod), [data, dutyBufferMins, settings.dayNightMethod]);

  const GT_KEYS = ["dayP1", "dayP1US", "dayP2", "nightP1", "nightP1US", "nightP2"];
  const { grandTotals, gtSum } = useMemo(() => {
    const gtCutoff = new Date(grandTotalDate + "T23:59:59");
    const gtByType = {};
    (settings.carryForward || []).forEach(cf => {
      const t = (cf.type || "").trim().toUpperCase();
      if (!t) return;
      if (!gtByType[t]) gtByType[t] = { dayP1:0, dayP1US:0, dayP2:0, nightP1:0, nightP1US:0, nightP2:0 };
      GT_KEYS.forEach(k => { gtByType[t][k] += parseHHMM(cf[k] || ""); });
    });
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
    const totals = Object.entries(gtByType)
      .map(([type, t]) => ({ type, ...t }))
      .sort((a, b) => a.type.localeCompare(b.type));
    const sum = GT_KEYS.reduce((acc, k) => {
      acc[k] = totals.reduce((s, r) => s + r[k], 0);
      return acc;
    }, {});
    return { grandTotals: totals, gtSum: sum };
  }, [data, grandTotalDate, settings.carryForward, settings.dayNightMethod]);

  const summaryByMonth = useMemo(() =>
    MONTHS.map((_, i) => {
      const mRows = data[`${i}-${selectedYear}`] || makeMonthRows(i, selectedYear);
      const filled = mRows.filter(r => r.date || r.type || r.sectors).length;
      const sum = (key) => mRows.reduce((acc, r) => acc + parseHHMM(calcFlightTimes(r, settings.dayNightMethod, selectedYear, i)[key]), 0);
      return {
        filled,
        dp1:  toHHMM(sum("dayP1"))     || "00:00",
        dp1u: toHHMM(sum("dayP1US"))   || "00:00",
        dp2:  toHHMM(sum("dayP2"))     || "00:00",
        np1:  toHHMM(sum("nightP1"))   || "00:00",
        np1u: toHHMM(sum("nightP1US")) || "00:00",
        np2:  toHHMM(sum("nightP2"))   || "00:00",
        tot:  toHHMM(mRows.reduce((acc, r) => acc + parseHHMM(calcTotal(r, settings.dayNightMethod, selectedYear, i)), 0)) || "00:00",
      };
    }),
  [data, selectedYear, settings.dayNightMethod]);

  // ── Loading screen ──
  // Inject theme CSS vars early so loading/login screens are also themed
  const themeCss = makeThemeCss(previewSettings || settings);

  if (!user) {
    return (
      <>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=JetBrains+Mono:wght@400;700&family=Space+Mono:wght@400;700&family=Roboto+Mono:wght@400;700&display=swap" />
        <style>{themeCss}</style>
        <div style={{ background: "var(--elb-bg, #0a0d12)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--elb-font, 'Courier New', monospace)", color: "var(--elb-acc, #4fc3f7)" }}>
        <div style={{ textAlign: "center" }}>
          <img src="/brand/icons/icon-72.png" alt="ClaudeBorne" width="36" height="36" style={{ marginBottom: 12, display: "block", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 13, letterSpacing: "0.2em" }}>LOADING eLOGBOOK...</div>
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

  const updateCell = async (rowIdx, field, value) => {
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
        const confirmed = await showConfirm(
          `Add aircraft type "${normalized}"?`,
          `This is a new aircraft type not found in your logbook. Adding it creates a separate recency tracker for takeoff & landing recency and autoland recency. Flights logged on other types will not count toward this type's currency.`
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
      // Normalise date input: strip month/year if user types "15/05" or "15/05/2026" — store only the day number
      // The month is already encoded in the month key; day number is all that's needed.
      if (field === "date" && normalizedValue) {
        const parts = normalizedValue.split("/");
        if (parts.length >= 2) {
          // "15/05" → "15",  "15/05/2026" → "15"
          normalizedValue = parts[0].replace(/^0+/, "") || parts[0]; // strip leading zeros except "0"
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

  const timeCols = ["dayP1","dayP1US","dayP2","nightP1","nightP1US","nightP2","total","std","sta"];
  const autoCalcCols = ["total","dayP1","dayP1US","dayP2","nightP1","nightP1US","nightP2"];

  // ── Column visibility helpers ────────────────────────────────────────
  // All columns are now toggleable — including DAY/NIGHT time cols and TOTAL.
  // (Previously dayP1, dayP1US, dayP2, nightP1, nightP1US, nightP2 and total were
  // forced-visible; users can now hide any of them.)
  const hiddenCols    = new Set(settings.hiddenColumns || []);
  const hiddenColsCount = hiddenCols.size;
  const isColVisible  = (key) => !hiddenCols.has(key);
  const unhideColumn  = (key) => {
    const next = { ...settings, hiddenColumns: (settings.hiddenColumns || []).filter(k => k !== key) };
    setSettings(next);
    saveSettings(next);
  };
  // Open Settings on the Appearance tab — used by the hidden-columns badge & toast
  const openSettingsOnAppearance = () => {
    setSettingsInitialTab("appearance");
    setSettingsOpen(true);
  };

  // Hidden-columns toast: shows when (a) the page mounts with hidden columns,
  // or (b) the user just hid a new column. Auto-fades after 5s; user can also dismiss.
  useEffect(() => {
    const prev = prevHiddenColsCountRef.current;
    prevHiddenColsCountRef.current = hiddenColsCount;
    // Show on first run if any hidden, or whenever count increases
    const shouldShow = (prev === null && hiddenColsCount > 0) || (prev !== null && hiddenColsCount > prev);
    if (!shouldShow) {
      // If everything is unhidden, immediately hide the toast as well
      if (hiddenColsCount === 0) setHiddenColsToastVisible(false);
      return;
    }
    setHiddenColsToastVisible(true);
    if (hiddenColsToastTimerRef.current) clearTimeout(hiddenColsToastTimerRef.current);
    hiddenColsToastTimerRef.current = setTimeout(() => setHiddenColsToastVisible(false), 5000);
    return () => {
      if (hiddenColsToastTimerRef.current) clearTimeout(hiddenColsToastTimerRef.current);
    };
  }, [hiddenColsCount]);
  // Number of visible auto-calc columns (for HOC warning colSpan)
  const autoCalcVisibleCount = ["dayP1","dayP1US","dayP2","nightP1","nightP1US","nightP2","total"].filter(isColVisible).length;
  // Totals-row label colSpan: # + DATE + visible solo/group cols before time cols
  const totalsLabelColSpan = 2 + ["type","markings","captain","cap","pilotFlying","departure","arrival","std","sta"].filter(isColVisible).length;

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
      // Use arrival airport coords for landing classification; fall back to departure if arrival unknown
      const landingIcao = (sector.arrival && getCoords(sector.arrival)) ? sector.arrival : sector.departure;
      const { day, night } = calcDayNightDynamic(sector.std, sector.sta, String(sector.date.getDate()), landingIcao, sector.date.getFullYear(), sector.date.getMonth());
      return day > night;
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
        @keyframes spin      { from { transform: rotate(0deg);   } to { transform: rotate(360deg); } }
        @keyframes fadeIn    { from { opacity: 0;                } to { opacity: 1;                } }
        @keyframes blink     { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes popIn     { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
        @keyframes cb-pulse  { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(0.75); } }
        @keyframes save-pulse { 0% { opacity:0; text-shadow: 0 0 12px rgba(34,197,94,0.9); }
                                40% { opacity:1; text-shadow: 0 0 8px rgba(34,197,94,0.6); }
                                100% { opacity:1; text-shadow: none; } }
        ${themeCss}
        /* ── Topbar responsive ── */
        .elb-topbar {
          overflow: hidden;
        }
        .elb-topbar-brand {
          flex: 0 1 auto;
          min-width: 0;
          overflow: hidden;
        }
        .elb-topbar-right {
          flex: 0 0 auto;
          min-width: 0;
        }
        .elb-topbar-usertext {
          min-width: 0;
          overflow: hidden;
        }
        .elb-topbar-username {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
          display: block;
        }
        @media (max-width: 640px) {
          .elb-topbar { padding: 0 12px !important; }
          .elb-topbar-caam { display: none; }
          .elb-topbar-username { max-width: clamp(80px, 32vw, 180px); }
        }
      `}</style>

      {/* ── TOPBAR ── */}
      <div className="elb-topbar" style={{
        background: "var(--cb-surface-0, #0a1020)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "0 24px",
        height: 52,
        display: "flex",
        alignItems: "center",
        gap: 0,
        flexShrink: 0,
      }}>
        {/* LEFT: Brand */}
        <div className="elb-topbar-brand" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src="/brand/icons/icon-72.png" alt="ClaudeBorne" width="44" height="44" style={{ flexShrink: 0, display: "block" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{
              fontFamily: "'Tourney', system-ui, sans-serif",
              fontWeight: 700, fontSize: 13, letterSpacing: "0.22em", lineHeight: 1,
              background: "linear-gradient(135deg,#3FE0C5 0%,#3B8DFF 55%,#5B6BFF 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>CLAUDEBORNE</span>
            <span style={{
              fontFamily: "'JetBrains Mono','Courier New',monospace",
              fontSize: 9, letterSpacing: "0.18em", color: "rgba(255,255,255,0.30)", lineHeight: 1, textAlign: "left",
            }}>ELOGBOOK · V6.10</span>
          </div>
          <span className="elb-topbar-caam" style={{
            marginLeft: 6,
            fontFamily: "'JetBrains Mono','Courier New',monospace",
            fontSize: 9, letterSpacing: "0.14em", color: "rgba(255,255,255,0.28)",
            border: "1px solid rgba(255,255,255,0.10)", padding: "3px 8px", whiteSpace: "nowrap",
          }}>CAAM · MCAR 2016</span>
        </div>

        {/* RIGHT: User info + avatar */}
        <div className="elb-topbar-right" style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto" }}>
          <div className="elb-topbar-usertext" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <span className="elb-topbar-username" style={{
              fontFamily: "'Tourney',system-ui,sans-serif",
              fontWeight: 700, fontSize: 12, letterSpacing: "0.14em",
              color: "var(--elb-txt,#e8f4fd)", lineHeight: 1,
            }}>
              {(settings.fullName || user.displayName || user.email || "").toUpperCase()}
            </span>
            {(settings.airline || settings.licenceType || settings.licenceNumber) && (
              <span style={{
                fontFamily: "'JetBrains Mono','Courier New',monospace",
                fontSize: 9, letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.30)", lineHeight: 1,
              }}>
                {[settings.airline, [settings.licenceType, settings.licenceNumber].filter(Boolean).join("/")].filter(Boolean).join(" · ").toUpperCase()}
              </span>
            )}
          </div>
          {user.photoURL ? (
            <img src={user.photoURL} alt="avatar" style={{ width: 30, height: 30, borderRadius: "50%", border: "1.5px solid #3FE0C5", flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg,#3FE0C5 0%,#3B8DFF 55%,#5B6BFF 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Tourney',system-ui,sans-serif", fontWeight: 700, fontSize: 14, color: "#0a1020",
            }}>
              {(settings.fullName || user.displayName || user.email || "?")[0].toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* ── PAGE HEADER ── */}
      <div style={{
        background: "linear-gradient(135deg, var(--elb-bghd,#0d1117) 0%, var(--elb-bgalt,#161d2a) 100%)",
        borderBottom: "1px solid var(--elb-bdr,#1e3a5f)",
        padding: "18px 24px",
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16,
        flexShrink: 0,
      }}>
        {/* LEFT: Title */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.22em", lineHeight: 1 }}>
            <span style={{ fontFamily: "'Tourney',system-ui,sans-serif", fontWeight: 700, fontSize: 36, letterSpacing: "0.02em", color: "var(--elb-txt,#e8f4fd)" }}>{MONTHS[selectedMonth]}</span>
            <span style={{ fontFamily: "'Tourney',system-ui,sans-serif", fontWeight: 700, fontSize: 36, letterSpacing: "0.02em", background: "linear-gradient(135deg,#3FE0C5 0%,#3B8DFF 55%,#5B6BFF 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{selectedYear}</span>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono','Courier New',monospace", fontSize: 10, letterSpacing: "0.2em", color: "var(--elb-acc,#4fc3f7)", textTransform: "uppercase", margin: "5px 0 6px", textAlign: "left" }}>
            FLIGHT RECORDS
          </div>
          <div style={{ fontSize: 12, color: "var(--elb-txt-muted,#5a7a9a)", letterSpacing: "0.04em", textAlign: "left" }}>
            Compliant with CAD 1901 · MCAR 2016 Part 69 &amp; Part 74
          </div>
        </div>

        {/* RIGHT: Controls */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          {/* Period row (right-aligned) */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "'JetBrains Mono','Courier New',monospace", fontSize: 9, letterSpacing: "0.18em", color: "var(--elb-txt-muted,#4a6a8a)" }}>SELECT PERIOD</span>
            <select value={selectedMonth} onChange={e => handleMonthChange(Number(e.target.value))} style={selectStyle}>
              {MONTHS.map((m, i) => <option key={i} value={i}>{m.toUpperCase()}</option>)}
            </select>
            <select value={selectedYear} onChange={e => handleYearChange(Number(e.target.value))} style={{ ...selectStyle, minWidth: 90 }}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {/* Icon buttons row */}
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
            {refreshStatus === "refreshing" && (
              <span style={{ fontSize: 11, color: "#f5c542", letterSpacing: "0.1em", fontWeight: 700 }}>REFRESHING...</span>
            )}
            {/* Offline indicator */}
            {!isOnline && (
              <span style={{ fontSize: 11, color: "#f5c542", letterSpacing: "0.1em", fontWeight: 700, background: "rgba(245,197,66,0.1)", border: "1px solid rgba(245,197,66,0.3)", borderRadius: 3, padding: "2px 8px" }}>
                ✈ OFFLINE
              </span>
            )}
            {/* Sync status chips */}
            {isOnline && syncStatus === "synced" && (
              <span style={{ fontSize: 11, color: "#22c55e", letterSpacing: "0.1em", fontWeight: 700 }}>✓ SYNCED</span>
            )}
            {isOnline && syncStatus === "error" && (
              <span style={{ fontSize: 11, color: "#ef4444", letterSpacing: "0.1em", fontWeight: 700 }}>✗ SYNC FAILED</span>
            )}
            {isOnline && lastSyncTime && syncStatus === "idle" && (
              <span style={{ fontSize: 10, color: "#3a6a8a", letterSpacing: "0.08em", fontStyle: "italic" }}>
                SYNCED · {lastSyncTime}
              </span>
            )}
              {/* SYNC button */}
              <button
                onClick={syncData}
                disabled={syncStatus === "syncing" || !isOnline}
                title={!isOnline ? "Offline — connect to sync" : syncStatus === "syncing" ? "Syncing…" : "Sync to cloud"}
                style={{
                  ...iconBtnStyle,
                  color: !isOnline ? "#2a4a6a" : syncStatus === "synced" ? "#22c55e" : syncStatus === "error" ? "#ef4444" : syncStatus === "syncing" ? "#f5c542" : "#3FE0C5",
                  borderColor: !isOnline ? "#1e3a5f" : syncStatus === "synced" ? "#22c55e" : syncStatus === "error" ? "#ef4444" : syncStatus === "syncing" ? "#f5c542" : "#1e3a5f",
                  opacity: (syncStatus === "syncing" || !isOnline) ? 0.4 : 1,
                  cursor: (syncStatus === "syncing" || !isOnline) ? "not-allowed" : "pointer",
                }}
              >
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ animation: syncStatus === "syncing" ? "spin 1s linear infinite" : "none" }}
                >
                  <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
              </button>
              {/* Export/Import */}
              <button onClick={() => setExportImportOpen(true)} title="Export / Import" style={iconBtnStyle}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                onClick={() => { setSettingsInitialTab(null); setSettingsOpen(true); }}
                title={hiddenColsCount > 0 ? `Settings · ${hiddenColsCount} hidden column${hiddenColsCount > 1 ? "s" : ""}` : "Settings"}
                style={{
                  ...iconBtnStyle,
                  color: settingsOpen ? "#4fc3f7" : "#3FE0C5",
                  borderColor: settingsOpen ? "#4fc3f7" : "#1e3a5f",
                  background: settingsOpen ? "rgba(79,195,247,0.1)" : "transparent",
                  position: "relative",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                {hiddenColsCount > 0 && (
                  <span style={{
                    position: "absolute", top: -4, right: -4,
                    background: "#3FE0C5", color: "#0a0d12",
                    borderRadius: "50%", minWidth: 14, height: 14,
                    fontSize: 9, fontWeight: 700, lineHeight: "14px",
                    textAlign: "center", padding: "0 3px",
                    border: "1px solid var(--elb-bg, #0a0d12)",
                    fontFamily: "'JetBrains Mono','Courier New',monospace",
                  }}>{hiddenColsCount}</span>
                )}
              </button>
              {/* Sign Out */}
              <button
                onClick={onLogout}
                title="Sign out"
                style={{
                  ...iconBtnStyle,
                  color: "#3FE0C5",
                  borderColor: "var(--elb-border, #1e3a5f)",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--elb-border, #1e3a5f)"; e.currentTarget.style.color = "#3FE0C5"; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          {/* Save chip — right-aligned, purely visual, does not affect actual save behaviour */}
          <div style={{ display: "flex", justifyContent: "flex-end", minHeight: 18 }}>
            {saveStatus === "saving" && (
              <span style={{
                fontSize: 10, fontStyle: "italic", letterSpacing: "0.10em",
                color: "#f5c542", display: "flex", alignItems: "center", gap: 5,
              }}>
                <span style={{ display: "inline-block", animation: "spin 0.7s linear infinite", fontSize: 12 }}>↻</span>
                SAVING...
              </span>
            )}
            {(saveStatus === "saved" || saveStatus === "fading") && lastSaveTime && (
              <span style={{
                fontSize: 10, fontStyle: "italic", fontWeight: 700, letterSpacing: "0.10em",
                color: "#22c55e", display: "flex", alignItems: "center", gap: 5,
                animation: saveStatus === "saved" ? "save-pulse 0.6s ease-out" : "none",
                opacity: saveStatus === "fading" ? 0 : 1,
                transition: saveStatus === "fading" ? "opacity 0.5s ease" : "none",
              }}>
                ✓ SAVED TO LOCAL STORAGE &nbsp;{lastSaveTime}
              </span>
            )}
            {saveStatus === "error" && (
              <span style={{
                fontSize: 10, fontStyle: "italic", letterSpacing: "0.10em",
                color: "#ef4444", cursor: "pointer",
              }} onClick={() => saveData(data)} title="Click to retry">
                ✕ SAVE ERROR · RETRY
              </span>
            )}
          </div>
          </div>
        </div>

        {/* ── TABS ── */}
        <div style={{ display: "flex", gap: 0, alignItems: "center", borderBottom: "1px solid var(--elb-border, #1e3a5f)" }}>
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
              textAlign: "left",
            }}>
              <div style={{ lineHeight: 1.6 }}>
                <span style={{ color: "#4fc3f7", fontWeight: 700 }}>
                  {MONTHS[selectedMonth].toUpperCase()} {selectedYear} —
                </span>
                {" "}Click any cell to enter data. Date field accepts day number only (e.g. 15). Time fields accept HH:MM (e.g. 02:30) or HHMM (e.g. 0230) format. TOTAL auto-calculates from Day + Night columns. ({rows.length} rows)
              </div>
            </div>

            {/* Hidden-columns reminder toast — appears transiently when a column is hidden
                (or on page load if any are hidden), auto-fades after 5s. Click the strip
                to manage visibility in Settings → Appearance. The gear icon also carries a
                persistent count badge while hidden cols > 0. */}
            {hiddenColsToastVisible && hiddenColsCount > 0 && (
              <div
                onClick={openSettingsOnAppearance}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 10, margin: "0 0 10px 0", padding: "6px 12px",
                  background: "rgba(63,224,197,0.06)",
                  border: "1px solid rgba(63,224,197,0.22)",
                  borderRadius: 4, cursor: "pointer",
                  fontFamily: "'JetBrains Mono','Courier New',monospace",
                  fontSize: 11, color: "#3FE0C5", letterSpacing: "0.08em",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(63,224,197,0.12)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(63,224,197,0.06)"}
                title="Open Settings → Appearance to manage column visibility"
              >
                <span>
                  👁 {hiddenColsCount} column{hiddenColsCount > 1 ? "s" : ""} hidden — click to manage in Settings
                </span>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (hiddenColsToastTimerRef.current) clearTimeout(hiddenColsToastTimerRef.current);
                    setHiddenColsToastVisible(false);
                  }}
                  title="Dismiss"
                  style={{
                    background: "transparent", border: "none", color: "#3FE0C5",
                    cursor: "pointer", fontSize: 14, padding: "0 4px", lineHeight: 1,
                    opacity: 0.6,
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                  onMouseLeave={e => e.currentTarget.style.opacity = "0.6"}
                >✕</button>
              </div>
            )}

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "auto" }}>
              {(() => {
                // Solo th helper (rowSpan=2) — hidden columns are not rendered at all.
                // Hidden columns are also skipped in the body row, keeping alignment intact.
                const soloTh = (key, content, extraStyle = {}) => isColVisible(key)
                  ? <th key={key} rowSpan={2} style={{ ...thStyle, ...extraStyle }}>{content}</th>
                  : null;

                // Dynamic colSpan for sub-grouped headers — skip group entirely if all subs hidden
                const aircraftSpan = (isColVisible("type") ? 1 : 0) + (isColVisible("markings") ? 1 : 0);
                const sectorsSpan  = (isColVisible("departure") ? 1 : 0) + (isColVisible("arrival") ? 1 : 0);
                const daySpan      = (isColVisible("dayP1") ? 1 : 0) + (isColVisible("dayP1US") ? 1 : 0) + (isColVisible("dayP2") ? 1 : 0);
                const nightSpan    = (isColVisible("nightP1") ? 1 : 0) + (isColVisible("nightP1US") ? 1 : 0) + (isColVisible("nightP2") ? 1 : 0);

                return (
                  <thead>
                    <tr style={{ background: "var(--elb-thead, #0b1320)" }}>
                      <th rowSpan={2} style={thStyle}>#</th>
                      <th rowSpan={2} style={thStyle}>DATE</th>
                      {/* AIRCRAFT group — colSpan reflects visible sub-cols; omitted when both hidden */}
                      {aircraftSpan > 0 && (
                        <th colSpan={aircraftSpan} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>AIRCRAFT</th>
                      )}
                      {/* Solo columns */}
                      {soloTh("captain", "CAPTAIN")}
                      {isColVisible("cap") && (
                        <th key="cap" rowSpan={2} style={{ ...thStyle, lineHeight: 1.4 }}>
                          <span style={{ display: "block" }}>HOLDER</span>
                          <span style={{ display: "block" }}>OPERATING</span>
                          <span style={{ display: "block" }}>CAPACITY</span>
                        </th>
                      )}
                      {isColVisible("pilotFlying") && (
                        <th key="pilotFlying" rowSpan={2} style={{ ...thStyle, lineHeight: 1.4 }}>
                          <span style={{ display: "block" }}>PILOT</span>
                          <span style={{ display: "block" }}>FLYING</span>
                        </th>
                      )}
                      {/* SECTORS group — colSpan reflects visible sub-cols; omitted when both hidden */}
                      {sectorsSpan > 0 && (
                        <th colSpan={sectorsSpan} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>SECTORS</th>
                      )}
                      {/* STD / STA */}
                      {isColVisible("std") && (
                        <th key="std" rowSpan={2} style={{ ...thStyle, lineHeight: 1.4 }}>
                          <span style={{ display: "block" }}>STD</span>
                          <span style={{ display: "block", fontSize: "var(--elb-hint-sz)", color: "#2a5a7a" }}>(UTC)</span>
                        </th>
                      )}
                      {isColVisible("sta") && (
                        <th key="sta" rowSpan={2} style={{ ...thStyle, lineHeight: 1.4 }}>
                          <span style={{ display: "block" }}>STA</span>
                          <span style={{ display: "block", fontSize: "var(--elb-hint-sz)", color: "#2a5a7a" }}>(UTC)</span>
                        </th>
                      )}
                      {/* DAY group — colSpan reflects visible sub-cols; omitted when all hidden */}
                      {daySpan > 0 && (
                        <th colSpan={daySpan} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", color: "#f5c542", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>☀ DAY</th>
                      )}
                      {/* NIGHT group — colSpan reflects visible sub-cols; omitted when all hidden */}
                      {nightSpan > 0 && (
                        <th colSpan={nightSpan} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", color: "#7ab8d4", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>☾ NIGHT</th>
                      )}
                      {/* TOTAL */}
                      {soloTh("total", "TOTAL")}
                      {/* Action cols */}
                      <th rowSpan={2} style={{ ...thStyle, background: "var(--elb-bg, #0a0d12)", border: "none" }}></th>
                      <th rowSpan={2} style={{ ...thStyle, background: "var(--elb-bg, #0a0d12)", border: "none", width: 28, minWidth: 28 }}></th>
                    </tr>
                    <tr style={{ background: "var(--elb-thead, #0b1320)" }}>
                      {/* AIRCRAFT sub-headers */}
                      {isColVisible("type")     && <th style={thSubStyle}>TYPE</th>}
                      {isColVisible("markings") && <th style={thSubStyle}>MARKINGS</th>}
                      {/* SECTORS sub-headers */}
                      {isColVisible("departure")&& <th style={thSubStyle}>DEP</th>}
                      {isColVisible("arrival")  && <th style={thSubStyle}>ARR</th>}
                      {/* DAY sub-headers */}
                      {isColVisible("dayP1")    && <th style={{ ...thSubStyle, color: "#22c55e" }}>P1</th>}
                      {isColVisible("dayP1US")  && <th style={{ ...thSubStyle, color: "#ef4444" }}>P1 U/S</th>}
                      {isColVisible("dayP2")    && <th style={{ ...thSubStyle, color: "#eab308" }}>P2</th>}
                      {/* NIGHT sub-headers */}
                      {isColVisible("nightP1")  && <th style={{ ...thSubStyle, color: "#4fc3f7" }}>P1</th>}
                      {isColVisible("nightP1US")&& <th style={{ ...thSubStyle, color: "#ef4444" }}>P1 U/S</th>}
                      {isColVisible("nightP2")  && <th style={{ ...thSubStyle, color: "#4fc3f7" }}>P2</th>}
                    </tr>
                  </thead>
                );
              })()}

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
                  // Route (sun) method needs BOTH endpoints — highlight either when its
                  // coordinates aren't in the database (the calc falls back in that case).
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
                        // Anchor the HOC warning banner to the FIRST visible auto-calc column.
                        // Previously hard-coded to "dayP1" — now that dayP1 itself can be hidden,
                        // we find the first auto-calc col the user hasn't hidden.
                        const firstAutoCalcVisible = autoCalcCols.find(k => !hiddenCols.has(k));
                        for (let ci = 0; ci < columns.length; ci++) {
                          const col = columns[ci];

                          // Hidden column: skip rendering entirely. Header rows above skip
                          // the matching <th> with the same condition, so column alignment
                          // is preserved without any placeholder cell.
                          if (hiddenCols.has(col.key)) continue;

                          const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.field === col.key;
                          const isTime = timeCols.includes(col.key);
                          const isAutoCalc = autoCalcCols.includes(col.key);

                          if (needsCapWarning && firstAutoCalcVisible && col.key === firstAutoCalcVisible) {
                            skipAutoCalc = true;
                            cells.push(
                              <td key="hoc-warning" colSpan={autoCalcVisibleCount} style={{ ...tdStyle, background: "rgba(249,115,22,0.06)", borderLeft: "2px solid rgba(249,115,22,0.4)", textAlign: "center", color: "#f97316", fontSize: 11, fontStyle: "italic", letterSpacing: "0.05em", padding: "6px 10px", whiteSpace: "nowrap" }}>
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
                  <td colSpan={totalsLabelColSpan} style={{ ...tdStyle, color: "#4fc3f7", fontSize: 12, letterSpacing: "0.12em", fontWeight: 700, textAlign: "right" }}>
                    MONTHLY TOTALS →
                  </td>
                  {/* DAY/NIGHT/TOTAL totals — filter to visible columns only */}
                  {["dayP1","dayP1US","dayP2","nightP1","nightP1US","nightP2","total"]
                    .filter(k => !hiddenCols.has(k))
                    .map(k => (
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
                      <th colSpan={3} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", color: "#f5c542", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>☀ DAY</th>
                      <th colSpan={3} style={{ ...thStyle, borderBottom: "1px solid #1a3050", textAlign: "center", color: "#7ab8d4", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>☾ NIGHT</th>
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
                          <td key={k} style={{ ...tdStyle, textAlign: "center", color: col, fontWeight: 700 }}>
                            {total || "—"}
                          </td>
                        );
                      })}
                      <td style={{ ...tdStyle, textAlign: "center", color: "#4fc3f7", fontWeight: 700 }}>
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
                        <th colSpan={3} style={{ ...thStyle, borderBottom: "1px solid var(--elb-bdr2, #1a3050)", textAlign: "center", color: "#f5c542", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>☀ DAY</th>
                        <th colSpan={3} style={{ ...thStyle, borderBottom: "1px solid var(--elb-bdr2, #1a3050)", textAlign: "center", color: "#7ab8d4", fontSize: "var(--elb-th-sz)", letterSpacing: "0.15em" }}>☾ NIGHT</th>
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
              alignItems: "flex-start",
              justifyContent: "flex-start",
              gap: 12,
              flexWrap: "wrap",
              background: FTL_BG[bannerCls],
              border: `1px solid ${FTL_BORDER[bannerCls]}`,
              borderLeft: `3px solid ${FTL_COLOR[bannerCls]}`,
            }}>
              <div style={{ fontSize: 18, flexShrink: 0, paddingTop: 1 }}>{bannerInfo.icon}</div>
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: FTL_COLOR[bannerCls], textAlign: "left" }}>
                  {bannerInfo.label}
                </div>
                <div style={{ fontSize: "var(--elb-desc-sz)", color: "var(--elb-txt-muted, #4a6a8a)", marginTop: 3, letterSpacing: "0.04em", lineHeight: 1.5, textAlign: "left" }}>
                  {bannerInfo.text}
                </div>
                <div style={{ marginTop: 6, fontSize: "var(--elb-hint-sz)", color: "var(--elb-txt-muted, #4a6a8a)", letterSpacing: "0.1em", textAlign: "left" }}>
                  AS OF {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}
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
              marginBottom: 16, borderLeft: "2px solid #1a3050", paddingLeft: 8, textAlign: "left",
            }}>
              Each sector with <span style={{ color: "#4fc3f7" }}>PILOT FLYING ✓</span> counts as 1 takeoff and 1 landing.
              Day / night is determined by <span style={{ color: "#4fc3f7" }}>STD</span> (takeoff) and{" "}
              <span style={{ color: "#4fc3f7" }}>STA</span> (landing) {settings.dayNightMethod === "sunrise" ? "using sunrise/sunset times at the departure airport" : "UTC times — civil day = 23:30–11:30 UTC, civil night = 11:30–23:30 UTC"}.
            </div>

            {/* Recency grid for all aircraft types */}
            {aircraftTypes.length === 0 ? (
              <div style={{
                background: "var(--elb-bg2, #0d1520)", border: "1px solid var(--cb-line, rgba(255,255,255,0.07))", borderRadius: 4,
                padding: 24, textAlign: "center", color: "var(--elb-txt-muted, #4a6a8a)",
                fontSize: 11, letterSpacing: "0.12em",
              }}>
                NO AIRCRAFT TYPES IN LOGBOOK
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
                {aircraftTypes.map(type => {
                  const recency = allRecencyByType[type];
                  const overallOk = recency.dayTakeoffs90 >= 3 && recency.dayLandings90 >= 3 && recency.nightTakeoffs90 >= 3 && recency.nightLandings90 >= 3;
                  const anyRed = recency.dayTakeoffs90 < 3 || recency.dayLandings90 < 3 || recency.nightTakeoffs90 < 3 || recency.nightLandings90 < 3;
                  const borderCol = anyRed ? "#ef4444" : "#22c55e";
                  const dotCol = anyRed ? "#ef4444" : "#22c55e";

                  const recencyCards = [
                    { label: "☀ DAY TAKEOFFS",   count: recency.dayTakeoffs90,   expiry: recency.dayTOExpiry   },
                    { label: "☀ DAY LANDINGS",   count: recency.dayLandings90,   expiry: recency.dayLdgExpiry  },
                    { label: "☾ NIGHT TAKEOFFS", count: recency.nightTakeoffs90, expiry: recency.nightTOExpiry },
                    { label: "☾ NIGHT LANDINGS", count: recency.nightLandings90, expiry: recency.nightLdgExpiry},
                  ];

                  return (
                    <div key={type} style={{
                      background: "var(--elb-bg2, #0d1520)", border: "1px solid var(--cb-line, rgba(255,255,255,0.07))",
                      borderLeft: `3px solid ${borderCol}`, borderRadius: 4, padding: 16,
                    }}>
                      {/* Type badge + status dot */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                        <div style={{ textAlign: "left" }}>
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
              background: "var(--elb-bg2, #0d1520)", border: "1px solid var(--cb-line, rgba(255,255,255,0.07))",
              borderLeft: `3px solid ${autolandCurrent ? "#22c55e" : "#ef4444"}`, borderRadius: 4, padding: 16,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ textAlign: "left" }}>
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
                  background: autolandCurrent ? "#22c55e" : "#ef4444",
                  boxShadow: `0 0 6px ${autolandCurrent ? "#22c55e" : "#ef4444"}`,
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
              textAlign: "left",
            }}>
              <span style={{ color: "#4fc3f7" }}>⚠ DISCLAIMER:</span> The information displayed is for{" "}
              <span style={{ color: "#4fc3f7" }}>references only</span> and is solely based on logbook data.
              Compliance with <span style={{ color: "#4fc3f7" }}>CAD 1901</span> and{" "}
              <span style={{ color: "#4fc3f7" }}>MCAR 2016 Part 69 &amp; Part 74</span> remains the users responsibility.
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
              background: "var(--cb-surface-1, #141a2e)",
              border: "1px solid var(--cb-line-2, #1e3a5f)",
              borderTop: "2px solid var(--cb-accent, #4fc3f7)",
              borderRadius: 6,
              padding: "20px 22px 18px",
              maxWidth: 520, width: "100%",
              boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
              animation: "popIn 0.15s ease",
              fontFamily: "var(--elb-font, 'Courier New', monospace)",
              textAlign: "left",
            }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: "var(--elb-hint-sz)", letterSpacing: "0.16em", color: "var(--cb-accent, #4fc3f7)", marginBottom: 5 }}>{rowLabel}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cb-ink, #e8ecf5)", letterSpacing: "0.07em" }}>REMARKS</div>
                </div>
                <button
                  onClick={() => setRemarksModal(null)}
                  style={{
                    background: "transparent", border: "1px solid var(--cb-line-2, #1e3a5f)", borderRadius: 3,
                    color: "var(--cb-ink-2, #7c87a3)", fontFamily: "var(--elb-font, 'Courier New', monospace)", fontSize: 12,
                    width: 22, height: 22, cursor: "pointer", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--cb-line-2, #1e3a5f)"; e.currentTarget.style.color = "var(--cb-ink-2, #7c87a3)"; }}
                >✕</button>
              </div>
              <div style={{ height: 1, background: "var(--cb-line-2, #1e3a5f)", marginBottom: 14 }} />
              {/* Textarea */}
              <textarea
                value={remarksModal.draft}
                onChange={e => setRemarksModal(prev => ({ ...prev, draft: e.target.value }))}
                placeholder="Enter remarks for this sector..."
                rows={6}
                autoFocus
                style={{
                  width: "100%",
                  background: "var(--cb-surface-0, #0a1020)",
                  border: "1px solid var(--cb-line-2, #1e3a5f)",
                  borderRadius: 4,
                  color: "var(--cb-ink, #e8ecf5)",
                  fontFamily: "var(--elb-font, 'Courier New', monospace)",
                  fontSize: 13,
                  padding: "10px 12px",
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                  lineHeight: 1.6,
                }}
                onFocus={e => e.target.style.borderColor = "var(--cb-accent, #4fc3f7)"}
                onBlur={e => e.target.style.borderColor = "var(--cb-line-2, #1e3a5f)"}
              />
              {/* Autoland Checkbox */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={remarksModal.autoland || false}
                  onChange={e => setRemarksModal(prev => ({ ...prev, autoland: e.target.checked }))}
                  style={{
                    width: 14, height: 14, cursor: "pointer", accentColor: "var(--cb-accent, #4fc3f7)",
                  }}
                />
                <label style={{ fontSize: 11, color: "var(--cb-ink-2, #b8c0d4)", letterSpacing: "0.08em", cursor: "pointer", userSelect: "none" }}>AUTOLAND</label>
              </div>
              {/* Action buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
                <button
                  onClick={() => setRemarksModal(null)}
                  style={{
                    background: "transparent", border: "1px solid var(--cb-line-2, #1e3a5f)", borderRadius: 4,
                    color: "var(--cb-ink-dim, #7c87a3)", fontFamily: "var(--elb-font, 'Courier New', monospace)",
                    fontSize: 11, letterSpacing: "0.12em", padding: "6px 16px", cursor: "pointer",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--cb-accent, #4fc3f7)"; e.currentTarget.style.color = "var(--cb-accent, #4fc3f7)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--cb-line-2, #1e3a5f)"; e.currentTarget.style.color = "var(--cb-ink-dim, #7c87a3)"; }}
                >CANCEL</button>
                <button
                  onClick={() => {
                    updateCell(remarksModal.rowIdx, "remarks", remarksModal.draft.trim());
                    updateCell(remarksModal.rowIdx, "autoland", remarksModal.autoland);
                    setRemarksModal(null);
                  }}
                  style={{
                    background: "rgba(var(--cb-accent-rgb, 79,195,247), 0.08)",
                    border: "1px solid var(--cb-accent, #4fc3f7)", borderRadius: 4,
                    color: "var(--cb-accent, #4fc3f7)", fontFamily: "var(--elb-font, 'Courier New', monospace)",
                    fontSize: 11, letterSpacing: "0.12em", padding: "6px 20px", cursor: "pointer",
                    boxShadow: "0 0 8px rgba(79,195,247,0.15)",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(79,195,247,0.15)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(79,195,247,0.08)"}
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
              background: "var(--cb-surface-1, #141a2e)",
              border: "1px solid var(--cb-line-2, #1e3a5f)",
              borderTop: "2px solid var(--cb-accent, #4fc3f7)",
              borderRadius: 6,
              padding: "20px 22px 18px",
              maxWidth: 480, width: "100%",
              boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
              animation: "popIn 0.15s ease",
              fontFamily: "var(--elb-font, 'Courier New', monospace)",
            }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "var(--elb-hint-sz)", letterSpacing: "0.16em", color: "var(--cb-accent, #4fc3f7)", marginBottom: 5, textAlign: "left" }}>{p.para}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cb-ink, #e8ecf5)", letterSpacing: "0.07em", lineHeight: 1.45, textAlign: "left" }}>{p.title}</div>
                </div>
                <button
                  onClick={() => setActivePopup(null)}
                  style={{
                    background: "transparent", border: "1px solid var(--cb-line-2, #1e3a5f)", borderRadius: 3,
                    color: "var(--cb-ink-dim, #7c87a3)", fontFamily: "var(--elb-font, 'Courier New', monospace)", fontSize: 12,
                    width: 22, height: 22, cursor: "pointer", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--cb-line-2, #1e3a5f)"; e.currentTarget.style.color = "var(--cb-ink-dim, #7c87a3)"; }}
                >✕</button>
              </div>
              <div style={{ height: 1, background: "var(--cb-line-2, #1e3a5f)", marginBottom: 14 }} />
              {/* Body */}
              <div
                style={{ fontSize: "var(--elb-desc-sz)", color: "var(--cb-ink-2, #b8c0d4)", lineHeight: 1.9, letterSpacing: "0.03em", textAlign: "left" }}
                dangerouslySetInnerHTML={{ __html: p.body }}
              />
              {/* Note */}
              {p.note && (
                <div
                  style={{
                    marginTop: 14, padding: "9px 12px",
                    background: "rgba(79,195,247,0.06)",
                    borderLeft: "2px solid var(--cb-accent, #4fc3f7)",
                    borderRadius: "0 3px 3px 0",
                    fontSize: "var(--elb-hint-sz)", color: "var(--cb-ink-2, #b8c0d4)", lineHeight: 1.75, letterSpacing: "0.03em", textAlign: "left",
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
          onClick={e => { if (e.target === e.currentTarget) { setSaveStatus("idle"); setSaveError(""); } }}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.72)",
            zIndex: 3000,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <div style={{
            background: "var(--cb-surface-1, #141a2e)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderTop: "2px solid #ef4444",
            borderRadius: 6,
            padding: "20px 22px 18px",
            maxWidth: 420, width: "100%",
            boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
            animation: "popIn 0.15s ease",
            fontFamily: "var(--elb-font, 'Courier New', monospace)",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: "var(--elb-hint-sz)", letterSpacing: "0.16em", color: "#ef4444", marginBottom: 5 }}>SAVE ERROR</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cb-ink, #e8ecf5)", letterSpacing: "0.07em" }}>SAVE FAILED</div>
              </div>
              <button
                onClick={() => { setSaveStatus("idle"); setSaveError(""); }}
                style={{
                  background: "transparent", border: "1px solid var(--cb-line-2, #1e3a5f)", borderRadius: 3,
                  color: "var(--cb-ink-dim, #7c87a3)", fontFamily: "var(--elb-font, 'Courier New', monospace)", fontSize: 12,
                  width: 22, height: 22, cursor: "pointer", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--cb-line-2, #1e3a5f)"; e.currentTarget.style.color = "var(--cb-ink-dim, #7c87a3)"; }}
              >✕</button>
            </div>
            <div style={{ height: 1, background: "rgba(239,68,68,0.2)", marginBottom: 14 }} />
            {/* Message */}
            <div style={{ fontSize: 13, color: "var(--cb-ink-2, #b8c0d4)", lineHeight: 1.7, marginBottom: 14 }}>
              Could not save to the cloud. Your local changes are preserved — use Retry to try again.
              {saveError && (
                <div style={{ marginTop: 8, fontSize: 11, color: "var(--cb-ink-dim, #7c87a3)", fontFamily: "var(--elb-font, 'Courier New', monospace)", letterSpacing: "0.05em" }}>
                  {saveError}
                </div>
              )}
            </div>
            {/* Action Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => { setSaveStatus("idle"); setSaveError(""); }}
                style={{
                  background: "transparent", border: "1px solid var(--cb-line-2, #1e3a5f)", borderRadius: 4,
                  color: "var(--cb-ink-dim, #7c87a3)", fontFamily: "var(--elb-font, 'Courier New', monospace)",
                  fontSize: 11, letterSpacing: "0.12em", padding: "6px 16px", cursor: "pointer",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--cb-accent, #4fc3f7)"; e.currentTarget.style.color = "var(--cb-accent, #4fc3f7)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--cb-line-2, #1e3a5f)"; e.currentTarget.style.color = "var(--cb-ink-dim, #7c87a3)"; }}
              >DISMISS</button>
              <button
                onClick={() => { setSaveStatus("dirty"); saveData(data); }}
                style={{
                  background: "rgba(239,68,68,0.10)", border: "1px solid #ef4444", borderRadius: 4,
                  color: "#ef4444", fontFamily: "var(--elb-font, 'Courier New', monospace)",
                  fontSize: 11, letterSpacing: "0.12em", padding: "6px 20px", cursor: "pointer",
                  fontWeight: 700,
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.18)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.10)"}
              >↺ RETRY</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SETTINGS MODAL ── */}
      <SettingsModal
        open={settingsOpen}
        initialTab={settingsInitialTab}
        onClose={() => { setSettingsOpen(false); setPreviewSettings(null); setSettingsInitialTab(null); }}
        settings={settings}
        onSave={saveSettings}
        onPreview={setPreviewSettings}
        userEmail={user?.email}
        onDeleteAccount={onDeleteAccount}
        onReauthAndDelete={onReauthAndDelete}
        userProvider={userProvider}
        onFeedback={() => setFeedbackOpen(true)}
        onGuide={() => setGuideOpen(true)}
        needRefresh={needRefresh}
        updateServiceWorker={updateServiceWorker}
        checkForUpdate={checkForUpdate}
        checkingUpdate={checkingUpdate}
        updateChecked={updateChecked}
      />

      {/* ── BRANDED CONFIRM DIALOG (replaces window.confirm) ── */}
      {confirmDialog && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 3000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          fontFamily: "var(--elb-font, 'Courier New', monospace)",
        }}>
          <div style={{
            background: "var(--elb-bg2, #141a2e)", border: "1px solid var(--elb-border, #1a3050)",
            borderTop: "2px solid var(--elb-acc, #3FE0C5)", borderRadius: 4,
            width: "100%", maxWidth: 420, padding: "24px 24px 20px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.85)",
          }}>
            <div style={{ fontSize: "var(--elb-th-sz)", letterSpacing: "0.1em", color: "var(--elb-acc, #3FE0C5)", marginBottom: 8 }}>
              CONFIRM ACTION
            </div>
            <div style={{ fontSize: "var(--elb-td-sz)", fontWeight: 700, color: "var(--elb-txt, #e8ecf5)", marginBottom: 12, letterSpacing: "0.04em" }}>
              {confirmDialog.title}
            </div>
            <div style={{ fontSize: "var(--elb-hint-sz)", color: "var(--elb-txt-muted, #b8c0d4)", lineHeight: 1.7, marginBottom: 20 }}>
              {confirmDialog.body}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={handleConfirmNo} style={{
                background: "transparent", border: "1px solid var(--elb-border, #1a3050)",
                color: "var(--elb-txt-muted, #b8c0d4)", fontFamily: "inherit",
                fontSize: "var(--elb-hint-sz)", letterSpacing: "0.1em", padding: "7px 18px",
                cursor: "pointer", borderRadius: 3,
              }}>CANCEL</button>
              <button onClick={handleConfirmYes} style={{
                background: "rgba(63,224,197,0.1)", border: "1px solid var(--elb-acc, #3FE0C5)",
                color: "var(--elb-acc, #3FE0C5)", fontFamily: "inherit",
                fontSize: "var(--elb-hint-sz)", letterSpacing: "0.1em", padding: "7px 18px",
                cursor: "pointer", borderRadius: 3, fontWeight: 700,
              }}>CONFIRM</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EXPORT/IMPORT MODAL ── */}
      <ExportImportModal
        open={exportImportOpen}
        onClose={() => setExportImportOpen(false)}
        monthData={data}
        settings={settings}
        user={user}
        onImport={handleImport}
        computeFlightTimes={(row, year, monthIdx) => calcFlightTimes(row, settings.dayNightMethod, year, monthIdx)}
      />

      {/* ── FEEDBACK MODAL ── */}
      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        user={user}
      />

      {/* ── HOW-TO GUIDE MODAL ── */}
      <HowToGuideModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
      />

      {/* ── CLOUD NEWER BANNER ── */}
      {/* Shown on app open when cloud has newer data than last sync on this device */}
      {cloudNewerBanner && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 3500,
          background: "linear-gradient(135deg, rgba(59,141,255,0.15), rgba(63,224,197,0.10))",
          borderBottom: "1px solid rgba(63,224,197,0.3)",
          padding: "10px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, flexWrap: "wrap",
          fontFamily: "var(--elb-font, 'Courier New', monospace)",
          backdropFilter: "blur(8px)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14 }}>☁</span>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--elb-acc, #3FE0C5)" }}>
                CLOUD HAS NEWER DATA
              </span>
              <span style={{ fontSize: 11, color: "var(--cb-ink-dim, #7c87a3)", letterSpacing: "0.04em", marginLeft: 10 }}>
                Another device synced after your last sync on this device
              </span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={syncData}
              style={{
                background: "var(--elb-acc, #3FE0C5)", color: "#0a0f1e",
                border: "none", borderRadius: 4,
                fontFamily: "var(--elb-font, 'Courier New', monospace)",
                fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
                padding: "5px 14px", cursor: "pointer",
              }}
            >SYNC NOW</button>
            <button
              onClick={() => setCloudNewerBanner(false)}
              style={{
                background: "transparent", border: "1px solid rgba(63,224,197,0.3)", borderRadius: 4,
                color: "var(--cb-ink-dim, #7c87a3)",
                fontFamily: "var(--elb-font, 'Courier New', monospace)",
                fontSize: 11, letterSpacing: "0.08em",
                padding: "5px 12px", cursor: "pointer",
              }}
            >DISMISS</button>
          </div>
        </div>
      )}

      {/* ── SYNC CONFLICT MODAL ── */}
      {/* Shown when Firestore has newer data than this device's last sync */}
      {syncConflict && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 4000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          fontFamily: "var(--elb-font, 'Courier New', monospace)",
        }}>
          <div style={{
            background: "var(--cb-surface-1, #141a2e)",
            border: "1px solid rgba(245,197,66,0.3)", borderTop: "2px solid #f5c542",
            borderRadius: 6, padding: "20px 22px 18px",
            maxWidth: 420, width: "100%",
            boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
          }}>
            <div style={{ fontSize: 10, letterSpacing: "0.16em", color: "#f5c542", marginBottom: 5 }}>SYNC CONFLICT</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cb-ink, #e8ecf5)", letterSpacing: "0.07em", marginBottom: 12 }}>
              CLOUD HAS NEWER DATA
            </div>
            <div style={{ height: 1, background: "rgba(245,197,66,0.2)", marginBottom: 14 }} />
            <div style={{ fontSize: 13, color: "var(--cb-ink-2, #b8c0d4)", lineHeight: 1.7, marginBottom: 18 }}>
              Another device synced to the cloud after your last sync. Choose which version to keep.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={resolveKeepCloud}
                style={{
                  background: "transparent", border: "1px solid var(--cb-line-2, #1e3a5f)", borderRadius: 4,
                  color: "var(--cb-ink-dim, #7c87a3)", fontFamily: "var(--elb-font, 'Courier New', monospace)",
                  fontSize: 11, letterSpacing: "0.12em", padding: "6px 16px", cursor: "pointer",
                }}
              >☁ KEEP CLOUD</button>
              <button
                onClick={resolveKeepLocal}
                style={{
                  background: "rgba(245,197,66,0.10)", border: "1px solid #f5c542", borderRadius: 4,
                  color: "#f5c542", fontFamily: "var(--elb-font, 'Courier New', monospace)",
                  fontSize: 11, letterSpacing: "0.12em", padding: "6px 20px", cursor: "pointer", fontWeight: 700,
                }}
              >💾 KEEP LOCAL</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PWA UPDATE PROMPT ── */}
      {/* Only shown when a new service worker is waiting AND saves are not pending */}
      {needRefresh && saveStatus !== "saving" && (
        <div style={{
          position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
          background: "var(--cb-surface-1, #141a2e)",
          border: "1px solid var(--elb-acc, #3FE0C5)", borderRadius: 6,
          padding: "12px 18px", zIndex: 5000,
          display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          fontFamily: "var(--elb-font, 'Courier New', monospace)",
          maxWidth: "calc(100vw - 40px)",
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--elb-acc, #3FE0C5)", marginBottom: 2 }}>
              UPDATE AVAILABLE
            </div>
            <div style={{ fontSize: 11, color: "var(--cb-ink-dim, #7c87a3)", letterSpacing: "0.04em" }}>
              A new version of C·B eLogBook is ready
            </div>
          </div>
          <button
            onClick={() => updateServiceWorker(true)}
            style={{
              background: "var(--elb-acc, #3FE0C5)", color: "#0a0f1e",
              border: "none", borderRadius: 4,
              fontFamily: "var(--elb-font, 'Courier New', monospace)",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
              padding: "6px 14px", cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            UPDATE
          </button>
        </div>
      )}

      {/* ── MIGRATION OVERLAY ── */}
      {/* Shown once on first load when pulling existing data from Firestore into localStorage */}
      {migrating && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(10,16,32,0.92)", zIndex: 5000,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--elb-font, 'Courier New', monospace)",
        }}>
          <div style={{ textAlign: "center", color: "var(--elb-acc, #3FE0C5)" }}>
            <img src="/brand/icons/icon-72.png" alt="ClaudeBorne" width="40" height="40" style={{ display: "block", margin: "0 auto 14px" }} />
            <div style={{ fontSize: 13, letterSpacing: "0.18em", marginBottom: 8 }}>MIGRATING YOUR DATA</div>
            <div style={{ fontSize: 11, letterSpacing: "0.1em", color: "#7c87a3" }}>
              One-time setup · Your logbook is moving to local storage
            </div>
          </div>
        </div>
      )}

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
        <span>eLOGBOOK v6.10 · CAAM</span>
        <span>CAD 1901 · MCAR 2016 Part 69 &amp; Part 74</span>
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
  color: "#3FE0C5",
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
