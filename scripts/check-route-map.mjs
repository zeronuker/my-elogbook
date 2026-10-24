// Checks the route map export's scene and stats (the parts a typo would silently break).
// Run: npm run check:routemap
import assert from "node:assert/strict";
import { countryOf } from "../src/icaoCountries.js";
import { computeStats, greatCircleKm } from "../src/routeMapStats.js";
import { buildScene, W } from "../src/routeMapScene.js";

let passed = 0;
const check = (name, fn) => {
  fn();
  passed++;
  console.log("ok  ", name);
};

const P = {
  WMKK: { lat: 2.7456, lon: 101.7099 }, WSSS: { lat: 1.3502, lon: 103.9944 }, YPPH: { lat: -31.9403, lon: 115.9669 },
  NZAA: { lat: -37.0082, lon: 174.7917 }, KLAX: { lat: 33.9425, lon: -118.4081 },
};
const flight = (dep, arr, dayMins = 60, nightMins = 0, extra = {}) => ({ dep, arr, from: P[dep], to: P[arr], dayMins, nightMins, type: "B737-800", date: "2026-01-01", ...extra });
const noGeo = { land: [], borders: [] };

check("countries come from the code prefix, with exceptions", () => {
  assert.equal(countryOf("WMKK"), "Malaysia");
  assert.equal(countryOf("wbsb"), "Brunei");
  assert.equal(countryOf("WBGG"), "Malaysia");
  assert.equal(countryOf("YPPH"), "Australia");
  assert.equal(countryOf("KLAX"), "United States");
  assert.equal(countryOf("XXXX"), null);
});

check("stats add up hours, distance, countries and types", () => {
  const s = computeStats([flight("WMKK", "WSSS", 60, 30), flight("WSSS", "WMKK", 0, 45, { type: "a320" }), flight("WMKK", "YPPH", 300, 0)]);
  assert.equal(s.flights, 3);
  assert.equal(s.dayMins, 360);
  assert.equal(s.nightMins, 75);
  assert.equal(s.totalMins, 435);
  assert.deepEqual(s.countries, ["Australia", "Malaysia", "Singapore"]);
  assert.deepEqual(s.types, [["B737-800", 390], ["A320", 45]]);
  assert.deepEqual(s.longest.a + s.longest.b, "WMKKYPPH");
  assert.deepEqual(s.busiest, { icao: "WMKK", n: 3 });
  assert.ok(Math.abs(greatCircleKm(P.WMKK, P.WSSS) - 297) < 10, "KL to Singapore is about 297 km");
});

check("a route flown both ways is one route with both counted", () => {
  const sc = buildScene({ flights: [flight("WMKK", "WSSS"), flight("WSSS", "WMKK"), flight("WMKK", "YPPH")], stats: null, geo: noGeo });
  assert.equal(sc.routes.length, 2);
  assert.equal(sc.routes.find(r => r.key === "WMKK-WSSS").n, 2);
  assert.equal(sc.airports.length, 3);
});

check("no flights, no scene", () => {
  assert.equal(buildScene({ flights: [], stats: null, geo: noGeo }), null);
});

check("every airport lands on the page, in every shape", () => {
  for (const aspect of [16 / 9, 1, 0.8, 297 / 210, 210 / 297]) {
    const sc = buildScene({ flights: [flight("WMKK", "WSSS"), flight("WMKK", "YPPH")], stats: null, geo: noGeo, aspect });
    for (const i of sc.items.filter(x => x.t === "circle")) {
      assert.ok(i.x > 0 && i.x < W && i.y > 0 && i.y < sc.H, `${i.ap} on the page at aspect ${aspect}`);
    }
  }
});

check("a Pacific crossing stays in one piece", () => {
  const sc = buildScene({ flights: [flight("NZAA", "KLAX")], stats: null, geo: noGeo });
  for (const i of sc.items.filter(x => x.t === "circle")) assert.ok(i.x > 0 && i.x < W, `${i.ap} on the page`);
  const r = sc.routes[0].pts;
  for (let n = 1; n < r.length; n++) assert.ok(Math.abs(r[n][0] - r[n - 1][0]) < W / 4, "no jump across the page");
});

check("the stats panel stays on the page and off the airports", () => {
  const flights = [flight("WMKK", "WSSS"), flight("WMKK", "YPPH")];
  for (const aspect of [16 / 9, 1, 0.8, 297 / 210]) {
    const sc = buildScene({ flights, stats: computeStats(flights), geo: noGeo, aspect });
    const panel = sc.items.slice(sc.items.plateFrom).find(i => i.t === "rect");
    assert.ok(panel, "panel drawn");
    assert.ok(panel.x >= 0 && panel.y >= 0 && panel.x + panel.w <= W && panel.y + panel.h <= sc.H, `panel inside the page at ${aspect}`);
    for (const i of sc.items.filter(x => x.t === "circle")) {
      assert.ok(!(i.x >= panel.x && i.x <= panel.x + panel.w && i.y >= panel.y && i.y <= panel.y + panel.h), `${i.ap} not under the panel at ${aspect}`);
    }
  }
});

check("stats off means no panel and no numbers in the scene", () => {
  const sc = buildScene({ flights: [flight("WMKK", "WSSS")], stats: null, geo: noGeo });
  assert.equal(sc.rows, null);
  assert.equal(sc.items.slice(sc.items.plateFrom).filter(i => i.t === "rect").length, 0);
});

console.log(`\n${passed} checks passed`);
