import SunCalc from "suncalc";
import { getCoords } from "./airportCoords";

export const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

export const EMPTY_ROW = () => ({
  date: "",
  type: "",
  markings: "",
  captain: "",
  cap: "",
  pilotFlying: "",
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

export const YEARS = Array.from({ length: new Date().getFullYear() - 2024 + 6 }, (_, i) => 2024 + i);

export function getDaysInMonth(monthIdx, year) {
  return new Date(year, monthIdx + 1, 0).getDate();
}

export const DEFAULT_ROWS = 15;

export function makeMonthRows(monthIdx, year, count = DEFAULT_ROWS) {
  return Array.from({ length: count }, (_, idx) => ({ id: idx + 1, ...EMPTY_ROW() }));
}

export function normalizeMonthRows(rows, monthIdx, year) {
  if (!Array.isArray(rows) || rows.length === 0) return makeMonthRows(monthIdx, year);
  let result = [...rows];
  // Trim trailing empty rows that exceed DEFAULT_ROWS (legacy cleanup only)
  while (result.length > DEFAULT_ROWS) {
    const last = result[result.length - 1];
    const isEmpty = Object.keys(EMPTY_ROW()).every(k => !last[k]);
    if (isEmpty) result.pop();
    else break;
  }
  return result;
}

export const initialData = () => {
  const d = {};
  MONTHS.forEach((m, i) => {
    YEARS.forEach(y => {
      d[`${i}-${y}`] = makeMonthRows(i, y);
    });
  });
  return d;
};

export function parseHHMM(val) {
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

export function toHHMM(mins) {
  if (!mins && mins !== 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

// Returns true if the HH:MM time falls within civil day hours (23:30–11:30 UTC, midnight-crossing).
// Night = 11:30–23:30 UTC. Used to classify takeoffs (by STD) and landings (by STA) as day or night.
export function isTimeInDay(hhmm) {
  if (!hhmm || !hhmm.trim()) return true; // default to day when unknown
  const NIGHT_START = 11 * 60 + 30;  // 11:30 = 690 min
  const NIGHT_END   = 23 * 60 + 30;  // 23:30 = 1410 min
  const mins = parseHHMM(hhmm) % (24 * 60);
  // Day = outside the night window [11:30, 23:30]
  return mins < NIGHT_START || mins > NIGHT_END;
}

export function calcTotal(row, method, year, monthIdx, allowLong = false) {
  const ft = calcFlightTimes(row, method, year, monthIdx, allowLong);
  const sum = ["dayP1","dayP1US","dayP2","nightP1","nightP1US","nightP2"]
    .reduce((acc, k) => acc + parseHHMM(ft[k]), 0);
  return sum ? toHHMM(sum) : "";
}

export function calcDayNight(std, sta, allowLong = false) {
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
  if (!allowLong && totalMins > 18 * 60) return { day: 0, night: 0 };
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
export function calcDayNightDynamic(std, sta, dayStr, depIcao, year, monthIdx, allowLong = false) {
  if (!std || !sta) return { day: 0, night: 0 };
  const coords = getCoords(depIcao);
  if (!coords) return calcDayNight(std, sta, allowLong);
  const D    = parseInt(dayStr) || 1;
  const FULL = 1440;
  // Use UTC midnight as reference — avoids local-timezone offset bugs for high-UTC-offset locations
  const ref  = new Date(Date.UTC(year, monthIdx, D)).getTime();
  const toRef = dt => (dt.getTime() - ref) / 60000; // minutes from UTC midnight of departure date
  const tP   = SunCalc.getTimes(new Date(Date.UTC(year, monthIdx, D - 1)), coords.lat, coords.lon);
  const tC   = SunCalc.getTimes(new Date(Date.UTC(year, monthIdx, D)),     coords.lat, coords.lon);
  const tN   = SunCalc.getTimes(new Date(Date.UTC(year, monthIdx, D + 1)), coords.lat, coords.lon);
  // Guard against polar regions (no sunrise/sunset)
  if (!isFinite(toRef(tC.sunrise)) || !isFinite(toRef(tC.sunset))) return calcDayNight(std, sta, allowLong);
  // Two night windows: [prevSunset+20, currSunrise−20] and [currSunset+20, nextSunrise−20]
  const ns1  = toRef(tP.sunset)  + 20;
  const ne1  = toRef(tC.sunrise) - 20;
  const ns2  = toRef(tC.sunset)  + 20;
  const ne2  = toRef(tN.sunrise) - 20;
  const toM  = t => { const [h, m] = t.trim().split(":").map(Number); return h * 60 + m; };
  let stdM   = toM(std), staM = toM(sta);
  if (staM <= stdM) staM += FULL;
  const totalMins = staM - stdM;
  if (!allowLong && totalMins > 18 * 60) return { day: 0, night: 0 };
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

// Point-in-time day/night check at a single airport, using the same civil-twilight
// threshold as calcDayNightRoute. Used to classify takeoff/landing recency so it
// agrees with the Route-Integrated flight-time totals instead of a separate
// whole-flight heuristic. Returns null if the airport's coordinates are unknown,
// so callers can fall back to the fixed-band classification.
export function isPointDay(icao, dateMs) {
  const coords = getCoords(icao);
  if (!coords) return null;
  return SunCalc.getPosition(new Date(dateMs), coords.lat, coords.lon).altitude >= CIVIL_TWILIGHT_RAD;
}

// Module-level memo so identical (std/sta/date/dep/arr) inputs aren't recomputed
// across the many calcFlightTimes calls per render. Bounded; cleared when large.
const _routeDayNightCache = new Map();

// Most-accurate day/night split: integrate the sun's elevation along the actual
// great-circle route. Samples the aircraft's interpolated position once per minute
// (assuming constant ground speed), computes the sun's altitude at each
// position+time, and counts the minute as night when the sun is below civil
// twilight (−6°). Requires BOTH departure and arrival coordinates; falls back to
// the departure-anchored method (or fixed UTC) when coordinates are missing.
export function calcDayNightRoute(std, sta, dayStr, depIcao, arrIcao, year, monthIdx, allowLong = false) {
  if (!std || !sta) return { day: 0, night: 0 };
  const dep = getCoords(depIcao);
  const arr = getCoords(arrIcao);
  // Need both endpoints to interpolate a route. Degrade gracefully.
  if (!dep || !arr) {
    return dep
      ? calcDayNightDynamic(std, sta, dayStr, depIcao, year, monthIdx, allowLong)
      : calcDayNight(std, sta, allowLong);
  }

  const key = `${std}|${sta}|${dayStr}|${depIcao}|${arrIcao}|${year}|${monthIdx}`;
  const cached = _routeDayNightCache.get(key);
  if (cached) return cached;

  const toM = t => { const [h, m] = t.trim().split(":").map(Number); return h * 60 + m; };
  let stdM = toM(std), staM = toM(sta);
  if (staM <= stdM) staM += 1440;
  const totalMins = staM - stdM;
  if (totalMins <= 0 || (!allowLong && totalMins > 18 * 60)) return { day: 0, night: 0 };

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

export function calcFlightTimes(row, method, year, monthIdx, allowLong = false) {
  const { day, night } = method === "sunrise"
    ? calcDayNightRoute(row.std, row.sta, row.date, row.departure, row.arrival, year, monthIdx, allowLong)
    : calcDayNight(row.std, row.sta, allowLong);
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

// ─── FTL helpers ──────────────────────────────────────────────────────────────

// Flatten all logbook rows across all months into a list of sectors with dates.
// Only rows with a valid date + STD + STA are included.
// Duty time = flight time + (preFlightBuffer + postFlightBuffer) — defaults 75 + 15 = 90 min.
export function getAllSectors(data, dutyBufferMins = 90, dayNightMethod = "fixed") {
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
  // Duty buffer applies once per calendar day, not once per sector — a pilot who
  // flies multiple sectors in one duty day only reports and releases once.
  const dutyBufferGiven = new Set();
  sectors.forEach(s => {
    const dayKey = s.date.toDateString();
    if (!dutyBufferGiven.has(dayKey)) {
      s.dutyMins = s.flightMins + dutyBufferMins;
      dutyBufferGiven.add(dayKey);
    } else {
      s.dutyMins = s.flightMins;
    }
  });
  return sectors;
}

// Sum `field` for sectors within the last `days` calendar days (inclusive of today).
export function rollingMins(sectors, days, field, asOf) {
  const cutoff = new Date(asOf);
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return sectors
    .filter(s => s.date > cutoff && s.date <= asOf)
    .reduce((a, s) => a + s[field], 0);
}

// Sum flight minutes for the 12-month window ending on the last day of the previous calendar month.
export function rolling12MonthFlightMins(sectors, asOf) {
  const endDate = new Date(asOf.getFullYear(), asOf.getMonth(), 0); // last day of prev month
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date(endDate.getFullYear() - 1, endDate.getMonth() + 1, 1);
  startDate.setHours(0, 0, 0, 0);
  return sectors
    .filter(s => s.date >= startDate && s.date <= endDate)
    .reduce((a, s) => a + s.flightMins, 0);
}

// Colour helper
export function ftlCls(pct) {
  return pct >= 100 ? "red" : pct >= 90 ? "yellow" : "green";
}
