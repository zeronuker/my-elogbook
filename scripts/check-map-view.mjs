// Checks the Logbook MAP view's sector order, return legs, routes and projection (the parts a typo would silently break).
// Run: npm run check:mapview
import assert from "node:assert/strict";
import { collectSectors, buildScene, posOn, countUpTo, toUnit, fromUnit } from "../src/mapViewData.js";

let passed = 0;
const check = (name, fn) => {
  fn();
  passed++;
  console.log("ok  ", name);
};

const P = { OPKC: { lat: 24.9065, lon: 67.1608 }, OERK: { lat: 24.9576, lon: 46.6988 }, OMDB: { lat: 25.2528, lon: 55.3644 }, NZAA: { lat: -37.0082, lon: 174.7917 }, KLAX: { lat: 33.9425, lon: -118.4081 } };
const getCoords = c => (c ? P[c.toUpperCase().trim()] || null : null);
const row = (id, date, departure, arrival, std = "") => ({ id, date, departure, arrival, std });
const data = {
  "0-2026": [row(1, "2", "OPKC", "OERK", "02:00"), row(2, "2", "OERK", "OPKC", "09:00"), row(3, "1", "OPKC", "OMDB", "05:00"), row(4, "5", "OPKC", "XXXX"), row(5, "", "", "")],
  "1-2026": [row(6, "3", "OPKC", "OERK"), row(7, "3", "OERK", "OPKC"), row(8, "3", "OPKC", "OERK")],
};

check("sectors come out in day then STD order, unknown airports are counted not drawn", () => {
  const { sectors, skipped } = collectSectors(data, 2026, 0, getCoords);
  assert.deepEqual(sectors.map(s => s.row.id), [3, 1, 2]);
  assert.deepEqual(sectors.map(s => s.si), [1, 2, 3]);
  assert.equal(skipped, 1);
});

check("a year runs month by month", () => {
  const { sectors } = collectSectors(data, 2026, null, getCoords);
  assert.deepEqual(sectors.map(s => s.row.id), [3, 1, 2, 6, 7, 8]);
});

check("a return leg is the reverse of the sector before it, and legs alternate", () => {
  const { sectors } = collectSectors(data, 2026, null, getCoords);
  // OPKC>OMDB, OPKC>OERK, OERK>OPKC (return), OPKC>OERK, OERK>OPKC (return), OPKC>OERK
  assert.deepEqual(sectors.map(s => s.isReturn), [false, false, true, false, true, false]);
  const three = [row(1, "1", "OPKC", "OERK"), row(2, "1", "OERK", "OPKC"), row(3, "1", "OPKC", "OERK")];
  const t = collectSectors({ "0-2026": three }, 2026, 0, getCoords).sectors;
  assert.deepEqual(t.map(s => s.isReturn), [false, true, false]);
});

check("a route flown both ways is one route and counts every flight", () => {
  const { sectors } = collectSectors(data, 2026, null, getCoords);
  const { routes, airports } = buildScene(sectors);
  assert.equal(routes.size, 2);
  assert.equal(routes.get("OERK-OPKC").flights.length, 5);
  assert.equal(airports.size, 3);
  assert.equal(airports.get("OPKC").flights.length, 6);
  // routes are stored alphabetically (OERK-OPKC), so OPKC>OERK is the reverse of how the route is stored
  assert.deepEqual(sectors.map(s => s.rev), [true, true, false, true, false, true]);
});

check("only sectors up to the timeline position count", () => {
  const { sectors } = collectSectors(data, 2026, null, getCoords);
  const { routes } = buildScene(sectors);
  const r = routes.get("OERK-OPKC");
  assert.equal(countUpTo(r.flights, 0), 0);
  assert.equal(countUpTo(r.flights, 2), 1);
  assert.equal(countUpTo(r.flights, 6), 5);
});

check("a flight moves from its departure to its arrival, whichever way the route is stored", () => {
  const { sectors } = collectSectors({ "0-2026": [row(1, "1", "OPKC", "OERK"), row(2, "1", "OERK", "OPKC")] }, 2026, 0, getCoords);
  buildScene(sectors);
  const [out, back] = sectors;
  const near = (p, c) => Math.hypot(p[0] - toUnit(c.lat, c.lon)[0], p[1] - toUnit(c.lat, c.lon)[1]) < 1e-6;
  assert.ok(near(posOn(out.route, out.rev, 0), P.OPKC) && near(posOn(out.route, out.rev, 1), P.OERK));
  assert.ok(near(posOn(back.route, back.rev, 0), P.OERK) && near(posOn(back.route, back.rev, 1), P.OPKC));
});

check("a route over the antimeridian stays continuous", () => {
  const { sectors } = collectSectors({ "0-2026": [row(1, "1", "NZAA", "KLAX")] }, 2026, 0, getCoords);
  const { routes } = buildScene(sectors);
  const u = routes.get("KLAX-NZAA").u;
  for (let i = 1; i < u.length; i++) assert.ok(Math.abs(u[i] - u[i - 1]) < 0.1, "no jump of a whole world width");
});

check("unit space round-trips latitude and longitude", () => {
  const [lat, lon] = fromUnit(...toUnit(24.9065, 67.1608));
  assert.ok(Math.abs(lat - 24.9065) < 1e-9 && Math.abs(lon - 67.1608) < 1e-9);
});

console.log(`\n${passed} checks passed`);
