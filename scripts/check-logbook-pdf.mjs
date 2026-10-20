// Checks the PDF export's totals and pagination (the parts a typo would silently break).
// Run: npm run check:pdf
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import { buildLogbookPdf, carryRows, groupMonths, layout, monthSheets, planProfile } from "../src/logbookPdf.js";

const require = createRequire(import.meta.url);
const { jsPDF } = require("jspdf");

let passed = 0;
const check = (name, fn) => {
  fn();
  passed++;
  console.log("ok  ", name);
};

// A flight row as the modal passes it in: day-only date, hours from computeFlightTimes.
const row = (y, m, d, hours = {}, extra = {}) => ({
  date: String(d), type: "A320", markings: "XX-ABC", captain: "SELF", cap: "P1", pilotFlying: "", departure: "WSSS", arrival: "WMKK",
  std: "01:00", sta: "02:00", remarks: "", autoland: false,
  _fullDate: new Date(Date.UTC(y, m, d)), _monthIdx: m, _year: y, _hours: hours, ...extra,
});
const hoursOf = (r) => r._hours;
const sum = (rows, key) => rows.reduce((s, r) => s + (r._hours[key] ? +r._hours[key].split(":")[0] * 60 + +r._hours[key].split(":")[1] : 0), 0);

check("rows per page: A4 25/41, Letter 26/38 (landscape/portrait)", () => {
  assert.equal(layout("a4", "landscape").perPage, 25);
  assert.equal(layout("letter", "landscape").perPage, 26);
  assert.equal(layout("a4", "portrait").perPage, 41);
  assert.equal(layout("letter", "portrait").perPage, 38);
});

check("months come from each flight's own date, not the month it is stored under", () => {
  const rows = [row(2026, 8, 30, { dayP1: "1:00" }), row(2026, 9, 1, { dayP1: "2:00" }, { _monthIdx: 8 })];
  const months = groupMonths(rows, hoursOf);
  assert.deepEqual(months.map((m) => [m.year, m.month, m.flights.length]), [[2026, 8, 1], [2026, 9, 1]]);
  assert.equal(months[1].flights[0].day, "01");
});

check("a month longer than a page continues on the next, and totals carry across pages", () => {
  const rows = Array.from({ length: 38 }, (_, i) => row(2026, 8, 1 + (i % 28), { dayP1: "1:30", nightP2: "0:20" }));
  const carry = { dayP1: 600, dayP1US: 0, dayP2: 0, nightP1: 0, nightP1US: 0, nightP2: 0 };
  const sheets = monthSheets(groupMonths(rows, hoursOf), carry, 25);
  assert.equal(sheets.length, 2);
  assert.deepEqual(sheets.map((s) => s.flights.length), [25, 13]);
  assert.equal(sheets[0].prev.dayP1, 600);
  assert.equal(sheets[1].prev.dayP1, sheets[0].grand.dayP1);
  assert.equal(sheets[0].page.dayP1, 25 * 90);
  assert.equal(sheets[1].page.dayP1, 13 * 90);
  assert.equal(sheets[1].grand.dayP1, 600 + 38 * 90);
  assert.equal(sheets[1].grand.nightP2, 38 * 20);
});

check("previous total of a later month is the grand total of the one before", () => {
  const rows = [row(2026, 7, 5, { dayP2: "3:00" }), row(2026, 8, 5, { dayP2: "4:00" }), row(2026, 9, 5, { dayP2: "1:30" })];
  const zero = { dayP1: 0, dayP1US: 0, dayP2: 0, nightP1: 0, nightP1US: 0, nightP2: 0 };
  const sheets = monthSheets(groupMonths(rows, hoursOf), zero, 25);
  assert.deepEqual(sheets.map((s) => s.prev.dayP2), [0, 180, 420]);
  assert.equal(sheets[2].grand.dayP2, sum(rows, "dayP2"));
});

check("carry-forward: repeated aircraft types are added up, blank types are skipped", () => {
  const rows = carryRows({
    carryForward: [
      { type: "a320", dayP1: "100:30", nightP2: "5:00" },
      { type: " A320 ", dayP1: "50:45" },
      { type: "", dayP1: "999:00" },
      { type: "B738", dayP2: "10:00" },
    ],
  });
  assert.deepEqual(rows.map((r) => r.type), ["A320", "B738"]);
  assert.equal(rows[0].dayP1, 100 * 60 + 30 + 50 * 60 + 45);
  assert.equal(rows[0].nightP2, 300);
});

check("profile pages: nothing is lost or repeated, summary and certification stay together on the last page", () => {
  for (const [paper, orient] of [["a4", "landscape"], ["letter", "landscape"], ["a4", "portrait"], ["letter", "portrait"]]) {
    for (const n of [0, 1, 2, 5, 12, 16, 40]) {
      const plan = planProfile(layout(paper, orient), n);
      const seen = plan.flatMap((p) => p.rows);
      assert.deepEqual(seen, Array.from({ length: n }, (_, i) => i), `${paper} ${orient} ${n}: every type exactly once, in order`);
      assert.equal(plan.filter((p) => p.details).length, 1);
      assert.equal(plan.filter((p) => p.total).length, 1);
      assert.equal(plan.filter((p) => p.tail).length, 1);
      assert.ok(plan[plan.length - 1].tail, `${paper} ${orient} ${n}: summary and certification on the last page`);
      if (n > 0) {
        const lastTable = plan.map((p) => p.rows.length > 0).lastIndexOf(true);
        assert.ok(plan[lastTable].total, `${paper} ${orient} ${n}: the total row sits under the last carry-forward row`);
      }
    }
  }
});

check("profile pages: the cases the mockup shows (A4 landscape)", () => {
  const L = layout("a4", "landscape");
  assert.equal(planProfile(L, 2).length, 1);
  assert.equal(planProfile(L, 5).length, 2);
  assert.deepEqual(planProfile(L, 5)[0].rows, [0, 1, 2, 3, 4]);
  assert.ok(planProfile(L, 16)[0].rows.length < 16, "16 types: the table itself continues");
  assert.equal(planProfile(layout("a4", "portrait"), 16).length, 1);
});

check("builds a PDF for every paper and orientation with the expected page count", () => {
  const fonts = {
    regular: fs.readFileSync(new URL("../public/fonts/inter/inter-pdf-400.ttf", import.meta.url)).toString("base64"),
    bold: fs.readFileSync(new URL("../public/fonts/inter/inter-pdf-700.ttf", import.meta.url)).toString("base64"),
  };
  const rows = Array.from({ length: 38 }, (_, i) => row(2026, 8, 1 + (i % 28), { dayP1: "1:30" }, { captain: i === 3 ? "MUHAMMAD ALEXANDER HAZIQ BIN ABDULLAH AL-RASHID" : "SELF", remarks: i === 5 ? "x ".repeat(80) : "", autoland: i === 7 }));
  const settings = { fullName: "SAMPLE PILOT", licenceType: "ATPL(A)", licenceNumber: "SMP-1", carryForward: [{ type: "A320", dayP1: "10:00" }] };
  for (const [paper, orientation] of [["a4", "landscape"], ["letter", "landscape"], ["a4", "portrait"], ["letter", "portrait"]]) {
    const L = layout(paper, orientation);
    const doc = buildLogbookPdf(jsPDF, { rows, computeFlightTimes: hoursOf, settings, email: "a@b.c", paper, orientation, fonts });
    const expected = 1 + planProfile(L, 1).length + Math.ceil(38 / L.perPage);
    assert.equal(doc.getNumberOfPages(), expected, `${paper} ${orientation}`);
  }
});

check("refuses to build an empty logbook", () => {
  assert.throws(() => buildLogbookPdf(jsPDF, { rows: [], computeFlightTimes: hoursOf, paper: "a4", orientation: "landscape", fonts: {} }), /No flights/);
});

console.log(`\n${passed} checks passed`);
