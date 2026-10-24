// Numbers for the route map's stats panel. Pure: takes flights as plain data so Node can test it.
// flight: { dep, arr, from: {lat, lon}, to: {lat, lon}, dayMins, nightMins, type }
import { countryOf } from "./icaoCountries.js";

export const greatCircleKm = (a, b) => {
  const r = d => d * Math.PI / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

export function computeStats(flights) {
  const s = { flights: flights.length, dayMins: 0, nightMins: 0, km: 0, longest: null, busiest: null, countries: [], types: [] };
  const moves = new Map(), types = new Map(), countries = new Set();
  for (const f of flights) {
    s.dayMins += f.dayMins;
    s.nightMins += f.nightMins;
    const km = greatCircleKm(f.from, f.to);
    s.km += km;
    if (!s.longest || km > s.longest.km) s.longest = { a: f.dep, b: f.arr, km };
    for (const code of [f.dep, f.arr]) {
      moves.set(code, (moves.get(code) || 0) + 1);
      const c = countryOf(code);
      if (c) countries.add(c);
    }
    const t = (f.type || "").trim().toUpperCase();
    if (t) types.set(t, (types.get(t) || 0) + f.dayMins + f.nightMins);
  }
  s.totalMins = s.dayMins + s.nightMins;
  const top = [...moves.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top) s.busiest = { icao: top[0], n: top[1] };
  s.countries = [...countries].sort();
  s.types = [...types.entries()].filter(([, m]) => m > 0).sort((a, b) => b[1] - a[1]);
  return s;
}
