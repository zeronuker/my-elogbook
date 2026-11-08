// Pure data and geometry behind the Logbook MAP view (no React, no Leaflet) — kept apart so it can be checked on its own.
import { greatCirclePoints } from "./routeMapScene.js";

// ── Web Mercator in "unit space": the whole world is 1 x 1, so a point is the same at every zoom
//    and screen x = u * 256 * 2^zoom - origin.
const MAX_LAT = 85.0511;
export function toUnit(lat, lon) {
  const φ = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI / 180;
  return [(lon + 180) / 360, (1 - Math.log(Math.tan(φ) + 1 / Math.cos(φ)) / Math.PI) / 2];
}
export function fromUnit(u, v) {
  return [Math.atan(Math.sinh(Math.PI * (1 - 2 * v))) * 180 / Math.PI, u * 360 - 180];
}

// ── Sectors in logged order ──
// One entry per logged sector in the period (a month, or a whole year when monthIdx is null). Sectors on one day keep
// their STD order; none overlap in time, so the timeline plays them one at a time. `skipped` counts sectors that could
// not be drawn because an airport code isn't in the coordinates list (getCoords is passed in so this file stays free of the big JSON).
export function collectSectors(data, year, monthIdx, getCoords) {
  const months = monthIdx == null ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] : [monthIdx];
  const sectors = [];
  let skipped = 0;
  months.forEach(month => {
    const rows = [];
    (data[`${month}-${year}`] || []).forEach(row => {
      if (!row.departure || !row.arrival) return;
      const from = getCoords(row.departure), to = getCoords(row.arrival);
      if (!from || !to) { skipped++; return; }
      rows.push({
        row, month, year, day: parseInt(row.date, 10) || 0, from, to,
        dep: row.departure.toUpperCase().trim(), arr: row.arrival.toUpperCase().trim(),
      });
    });
    rows.sort((a, b) => a.day - b.day || (a.row.std || "").localeCompare(b.row.std || ""));
    sectors.push(...rows);
  });
  sectors.forEach((s, i) => { s.si = i + 1; });
  // A return leg is the reverse of the sector before it. The leg after a return is outbound again, so legs alternate.
  sectors.forEach((s, i) => {
    const p = sectors[i - 1];
    s.isReturn = !!p && !p.isReturn && p.dep === s.arr && p.arr === s.dep;
  });
  return { sectors, skipped };
}

// ── Routes and airports ──
// A route is one airport pair, flown either way. Its points follow the great circle, with the longitude unwrapped so
// the line never jumps across the antimeridian; the map draws it again shifted by ±360° where it is panned that far.
function makeRoute(key, a, b, from, to) {
  const ll = greatCirclePoints(from.lat, from.lon, to.lat, to.lon, 96);
  let prev = ll[0][1];
  const u = new Float64Array(ll.length), v = new Float64Array(ll.length), cum = new Float64Array(ll.length);
  ll.forEach(([lat, lon], i) => {
    let d = lon - prev;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    prev += d;
    [u[i], v[i]] = toUnit(lat, prev);
    if (i) cum[i] = cum[i - 1] + Math.hypot(u[i] - u[i - 1], v[i] - v[i - 1]);
  });
  return { key, a, b, u, v, cum, len: cum[cum.length - 1], flights: [] };
}

export function buildScene(sectors) {
  const routes = new Map(), airports = new Map();
  sectors.forEach(s => {
    const [a, b] = s.dep < s.arr ? [s.dep, s.arr] : [s.arr, s.dep];
    const key = `${a}-${b}`;
    let r = routes.get(key);
    if (!r) {
      const [from, to] = s.dep === a ? [s.from, s.to] : [s.to, s.from];
      r = makeRoute(key, a, b, from, to);
      routes.set(key, r);
    }
    s.route = r;
    s.rev = s.dep !== r.a;   // flown from the route's second airport to its first
    r.flights.push(s);
    [[s.dep, s.from], [s.arr, s.to]].forEach(([icao, c]) => {
      let ap = airports.get(icao);
      if (!ap) {
        const [u, v] = toUnit(c.lat, c.lon);
        ap = { icao, u, v, flights: [] };
        airports.set(icao, ap);
      }
      if (ap.flights[ap.flights.length - 1] !== s) ap.flights.push(s);
    });
  });
  return { routes, airports };
}

// Position along a route as a fraction s (0 = departure of the sector, 1 = arrival); `rev` flips the direction.
export function posOn(route, rev, s) {
  const { u, v, cum, len } = route;
  if (!len) return [u[0], v[0]];
  const d = (rev ? 1 - s : s) * len;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const t = (d - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
  return [u[i - 1] + (u[i] - u[i - 1]) * t, v[i - 1] + (v[i] - v[i - 1]) * t];
}

// How many of a route's (or airport's) flights are shown with `cut` sectors played.
export const countUpTo = (flights, cut) => {
  let n = 0;
  while (n < flights.length && flights[n].si <= cut) n++;
  return n;
};

export const ease = u => u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;

// Route line width in px for n flights on it.
export const routeWidth = n => Math.min(4.5, 1.1 + Math.sqrt(n) * 0.55);
