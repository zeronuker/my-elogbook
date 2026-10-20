// PDF export of the whole logbook, drawn page by page with jsPDF to the signed-off mockup.
// Pure on purpose: the caller passes the jsPDF constructor and the Inter fonts (base64) and gets the document back,
// so the same code runs in the browser and in the Node check script.

const PT = 25.4 / 72;   // one point in mm
const CAP = 0.3635;     // Inter: baseline offset (in em) that puts cap-height text on a line's centre
const INK = 17;
const MUTED = 51;
const GRID = 119;

const PAPERS = { a4: { w: 210, h: 297 }, letter: { w: 215.9, h: 279.4 } };
const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const KEYS = ["dayP1", "dayP1US", "dayP2", "nightP1", "nightP1US", "nightP2"];

const M = 10;      // margin on every side
const BAND = 15;   // title band
const HEAD = 9;    // column header (3.5 group row + 5.5 label row)
const FOOT = 8;
const ROW = 5.5;
// Column widths in mm for a 190 mm wide page; every other paper size scales these in proportion.
const COLS = [6.7, 8.2, 12.8, 21.6, 12.5, 9.2, 9.2, 8.2, 8.2, 10.2, 10.2, 10.2, 10.2, 10.2, 10.2, 11.6, 20.6];

// ---------- hours and dates ----------
const toMin = (s) => {
  const m = /^(\d+):(\d{1,2})$/.exec(String(s || "").trim());
  return m ? +m[1] * 60 + +m[2] : 0;
};
const fmt = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
const zero = () => Object.fromEntries(KEYS.map((k) => [k, 0]));
const add = (a, b) => Object.fromEntries(KEYS.map((k) => [k, a[k] + b[k]]));
const total = (o) => KEYS.reduce((s, k) => s + o[k], 0);
const two = (n) => String(n).padStart(2, "0");
const dmy = (d) => `${two(d.getUTCDate())}/${two(d.getUTCMonth() + 1)}/${String(d.getUTCFullYear()).slice(2)}`;
const longDate = (d) => `${two(d.getDate())} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
const dobText = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || "") ? s.split("-").reverse().join("/") : String(s || ""));

// ---------- layout ----------
export function layout(paper, orientation) {
  const land = orientation === "landscape";
  const p = PAPERS[paper] || PAPERS.a4;
  const W = land ? p.h : p.w;
  const H = land ? p.w : p.h;
  const contentW = W - 2 * M;
  const sum = COLS.reduce((a, b) => a + b, 0);
  const colW = COLS.map((w) => (w / sum) * contentW);
  const colX = [];
  colW.reduce((x, w) => (colX.push(x), x + w), M);
  const body = Math.floor((H - 2 * M - BAND - HEAD - FOOT) / ROW);
  return { W, H, land, fs: land ? 8 : 6.5, hf: land ? 6 : 5.5, contentW, colW, colX, body, perPage: body - 3 };
}

// ---------- data ----------
// rows: the logbook rows with _fullDate (UTC Date), _monthIdx and _year, sorted by date.
export function groupMonths(rows, computeFlightTimes) {
  const months = [];
  rows.forEach((row) => {
    const d = row._fullDate;
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    let m = months[months.length - 1];
    if (!m || m.year !== year || m.month !== month) {
      m = { year, month, flights: [] };
      months.push(m);
    }
    const ft = computeFlightTimes(row, row._year, row._monthIdx) || {};
    const t = zero();
    KEYS.forEach((k) => (t[k] = toMin(ft[k])));
    m.flights.push({
      d,
      day: two(d.getUTCDate()),
      type: String(row.type || "").trim(),
      mark: String(row.markings || "").trim(),
      captain: String(row.captain || "").trim(),
      hoc: String(row.cap || "").trim(),
      pf: row.pilotFlying === "YES",
      dep: String(row.departure || "").trim(),
      arr: String(row.arrival || "").trim(),
      std: String(row.std || "").trim(),
      sta: String(row.sta || "").trim(),
      t,
      rem: [row.autoland ? "AUTOLAND" : "", String(row.remarks || "").trim()].filter(Boolean).join(", "),
    });
  });
  return months;
}

// Carry-forward hours per aircraft type. Repeated types are added up (as the Flight Summary tab does).
export function carryRows(settings) {
  const by = new Map();
  ((settings && settings.carryForward) || []).forEach((cf) => {
    const type = String(cf.type || "").trim().toUpperCase();
    if (!type) return;
    if (!by.has(type)) by.set(type, { type, ...zero() });
    const r = by.get(type);
    KEYS.forEach((k) => (r[k] += toMin(cf[k])));
  });
  return [...by.values()];
}

// One sheet per page of flights. The previous total carries from the sheet before (the carry-forward hours for the first).
export function monthSheets(months, carry, perPage) {
  const sheets = [];
  let prev = carry;
  months.forEach((m) => {
    const n = Math.max(1, Math.ceil(m.flights.length / perPage));
    for (let i = 0; i < n; i++) {
      const flights = m.flights.slice(i * perPage, (i + 1) * perPage);
      const page = flights.reduce((a, f) => add(a, f.t), zero());
      const grand = add(prev, page);
      sheets.push({ kind: "month", year: m.year, month: m.month, flights, i, n, prev, page, grand });
      prev = grand;
    }
  });
  return sheets;
}

// Block heights (mm) of the profile page, measured from the mockup.
function profileGeo(L) {
  return L.land
    ? { bs: 9, H3: 6.64, TH: 5.0, RH: 5.82, FH: 7.68, CB: 4.8, DETAILS: 66.15, CERT: 26.72 }
    : { bs: 7.5, H3: 5.92, TH: 4.4, RH: 5.29, FH: 6.89, CB: 4.15, DETAILS: 60.32, CERT: 26.19 };
}
// Pack the profile blocks onto pages: details, then the carry-forward table (rows continue on the next page with the
// header repeated), then the hours summary and the certification together on the last page.
export function planProfile(L, nRows) {
  const G = profileGeo(L);
  const A = L.H - 2 * M - BAND - FOOT;
  const pad = 3;
  const gap = 4;
  const head = G.H3 + G.TH;
  const pages = [{ details: true, rows: [], total: false, tail: false }];
  let cur = pages[0];
  let used = pad + G.DETAILS;
  const fresh = () => {
    cur = { details: false, rows: [], total: false, tail: false };
    pages.push(cur);
    used = pad;
  };
  for (let i = 0; i < nRows; i++) {
    const need = (cur.rows.length ? 0 : (cur.details ? gap : 0) + head) + G.RH + (i === nRows - 1 ? G.RH : 0);
    if (used + need > A) {
      fresh();
      i--;
      continue;
    }
    used += need;
    cur.rows.push(i);
  }
  cur.total = true;
  const tail = (cur.details || cur.rows.length ? gap : 0) + head + 3 * G.RH + gap + G.CERT;
  if (used + tail > A) fresh();
  cur.tail = true;
  return pages;
}

// ---------- drawing helpers ----------
function text(doc, s, x, cy, size, style, align) {
  doc.setFont("Inter", style || "normal");
  doc.setFontSize(size);
  doc.text(String(s), x, cy + CAP * size * PT, { align: align || "center" });
}
function textLines(doc, arr, x, cy, size, style, lh) {
  const step = size * PT * (lh || 1.1);
  arr.forEach((s, i) => text(doc, s, x, cy + (i - (arr.length - 1) / 2) * step, size, style));
}
const width = (doc, s, size, style) => {
  doc.setFont("Inter", style || "normal");
  doc.setFontSize(size);
  return doc.getTextWidth(s);
};
function ellipsize(doc, s, maxW) {
  let t = s;
  while (t.length > 1 && doc.getTextWidth(t + "…") > maxW) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}
// Shrink to fit on one line (down to 75% of the size), then cut with an ellipsis.
function fitLine(doc, s, maxW, size, style) {
  const min = size * 0.75;
  for (let sz = size; sz >= min; sz -= 0.25) {
    if (width(doc, s, sz, style) <= maxW) return { s, size: sz };
  }
  width(doc, s, min, style);
  return { s: ellipsize(doc, s, maxW), size: min };
}
// Captain: one line at full size if it fits, else the smaller size, else two lines at the smaller size ending in an ellipsis.
// Remarks: always the smaller size, up to two lines.
function fitClamp(doc, s, maxW, size, style, alwaysSmall) {
  const small = size - 1.5;
  if (!alwaysSmall && width(doc, s, size, style) <= maxW) return { lines: [s], size };
  width(doc, s, small, style);
  if (doc.getTextWidth(s) <= maxW) return { lines: [s], size: small };
  const lines = doc.splitTextToSize(s, maxW);
  if (lines.length <= 2) return { lines, size: small };
  return { lines: [lines[0], ellipsize(doc, lines.slice(1).join(" "), maxW)], size: small };
}
function cell(doc, x, y, w, h, fill) {
  doc.setDrawColor(GRID);
  doc.setLineWidth(0.15);
  if (fill != null) {
    doc.setFillColor(fill);
    doc.rect(x, y, w, h, "FD");
  } else doc.rect(x, y, w, h, "S");
}
const hline = (doc, x1, x2, y, lw, gray) => {
  doc.setDrawColor(gray == null ? INK : gray);
  doc.setLineWidth(lw);
  doc.line(x1, y, x2, y);
};

// ---------- page furniture ----------
// Band: title and the pilot line on the left, up to two right-aligned lines on the right.
function drawBand(doc, L, info, title, rightLines) {
  doc.setTextColor(INK);
  text(doc, title, M, M + 9.3 - CAP * 13 * PT, 13, "bold", "left");
  text(doc, info, M, M + 13.3 - CAP * 7 * PT, 7, "normal", "left");
  rightLines.forEach((s, i) => text(doc, s, L.W - M, M + 13.3 - (rightLines.length - 1 - i) * 3.2 - CAP * 7 * PT, 7, "normal", "right"));
  hline(doc, M, L.W - M, M + BAND - 0.15, 0.3);
}
function drawFoot(doc, L, pageNo, N, legend) {
  const bottom = L.H - M - 0.5;
  doc.setTextColor(MUTED);
  if (legend) {
    const b2 = bottom - 3.6 + 2.57;
    const b1 = b2 - 3.6;
    let x = M;
    [["P1", true], [", ", false], ["P2", true], [", ", false], ["P1 U/S", true], [" = PILOT FLYING (PF)", false]].forEach(([s, bold]) => {
      doc.setFont("Inter", bold ? "bold" : "normal");
      doc.setFontSize(6);
      doc.text(s, x, b1);
      const w = doc.getTextWidth(s);
      if (bold) hline(doc, x, x + w, b1 + 0.3, 0.1, MUTED);
      x += w;
    });
    doc.setFont("Inter", "normal");
    doc.text("P1, P2, P1 U/S = PILOT MONITORING (PM, PNF)", M, b2);
  }
  text(doc, `Page ${pageNo} of ${N}`, L.W - M, bottom - 0.6 - CAP * 6 * PT, 6, "normal", "right");
}

// ---------- month page ----------
function drawMonth(doc, L, s, info, pageNo, N) {
  const { colX, colW, fs, hf } = L;
  const x0 = M;
  const right = colX[16] + colW[16];
  const yHead = M + BAND;
  const yBody = yHead + HEAD;
  const pad = (i) => (i >= 9 && i <= 15 ? 0.05 : 0.6);

  drawBand(doc, L, info, `${MONTHS[s.month]} ${s.year}`, [`PAGE ${s.i + 1} OF ${s.n} FOR ${MONTHS[s.month]}`]);

  // header
  doc.setTextColor(INK);
  const span = (a, b) => [colX[a], colX[b] + colW[b] - colX[a]];
  [[0, ["DATE"]], [3, ["CAPTAIN"]], [4, ["HOLDER", "OPERATING", "CAPACITY"]], [7, ["STD", "(UTC)"]], [8, ["STA", "(UTC)"]], [15, ["TOTAL"]], [16, ["REMARKS"]]].forEach(([i, lines]) => {
    cell(doc, colX[i], yHead, colW[i], HEAD, 230);
    textLines(doc, lines, colX[i] + colW[i] / 2, yHead + HEAD / 2, hf, "bold", 1.1);
  });
  [["AIRCRAFT", 1, 2], ["SECTORS", 5, 6], ["DAY", 9, 11], ["NIGHT", 12, 14]].forEach(([label, a, b]) => {
    const [x, w] = span(a, b);
    cell(doc, x, yHead, w, 3.5, 230);
    text(doc, label, x + w / 2, yHead + 1.75, hf, "bold");
  });
  [[1, "TYPE"], [2, "MARKINGS"], [5, "DEP"], [6, "ARR"], [9, "P1"], [10, "P1 U/S"], [11, "P2"], [12, "P1"], [13, "P1 U/S"], [14, "P2"]].forEach(([i, label]) => {
    cell(doc, colX[i], yHead + 3.5, colW[i], 5.5, 230);
    text(doc, label, colX[i] + colW[i] / 2, yHead + 3.5 + 2.75, hf, "bold");
  });

  // summary row: label across the first nine columns, hours in the next seven, optional note in the last
  const summary = (r, label, hours, note, fill) => {
    const y = yBody + r * ROW;
    cell(doc, x0, y, colX[9] - x0, ROW, fill);
    doc.setTextColor(INK);
    text(doc, label, colX[9] - 1.4, y + ROW / 2, fs, "bold", "right");
    KEYS.concat("total").forEach((k, j) => {
      const i = 9 + j;
      cell(doc, colX[i], y, colW[i], ROW, fill);
      const f = fitLine(doc, fmt(k === "total" ? total(hours) : hours[k]), colW[i] - 2 * pad(i), fs, "bold");
      text(doc, f.s, colX[i] + colW[i] / 2, y + ROW / 2, f.size, "bold");
    });
    cell(doc, colX[16], y, colW[16], ROW, fill);
    if (note) {
      const f = fitLine(doc, note, colW[16] - 1.2, fs - 1.5, "bold");
      text(doc, f.s, colX[16] + colW[16] / 2, y + ROW / 2, f.size, "bold");
    }
  };
  summary(0, "PREVIOUS TOTAL", s.prev, "", 238);

  // flights, then blank rows to fill the page
  for (let r = 0; r < L.perPage; r++) {
    const y = yBody + (r + 1) * ROW;
    const f = s.flights[r];
    for (let i = 0; i < 17; i++) cell(doc, colX[i], y, colW[i], ROW);
    if (!f) continue;
    const cy = y + ROW / 2;
    const cx = (i) => colX[i] + colW[i] / 2;
    const maxW = (i) => colW[i] - 2 * pad(i);
    doc.setTextColor(INK);
    [[0, f.day], [1, f.type], [2, f.mark], [5, f.dep], [6, f.arr], [7, f.std], [8, f.sta]].forEach(([i, v]) => {
      if (!v) return;
      const t = fitLine(doc, v, maxW(i), fs, "normal");
      text(doc, t.s, cx(i), cy, t.size, "normal");
    });
    if (f.captain) {
      const c = fitClamp(doc, f.captain, maxW(3), fs, "normal", false);
      textLines(doc, c.lines, cx(3), cy, c.size, "normal", 1);
    }
    if (f.hoc) {
      const bold = f.pf ? "bold" : "normal";
      const t = fitLine(doc, f.hoc, maxW(4), fs, bold);
      text(doc, t.s, cx(4), cy, t.size, bold);
      if (f.pf) {
        const w = width(doc, t.s, t.size, bold);
        const uy = cy + CAP * t.size * PT + 0.13 * t.size * PT;
        hline(doc, cx(4) - w / 2, cx(4) + w / 2, uy, Math.max(0.12, 0.07 * t.size * PT));
      }
    }
    KEYS.forEach((k, j) => {
      if (!f.t[k]) return;
      const i = 9 + j;
      const t = fitLine(doc, fmt(f.t[k]), maxW(i), fs, "normal");
      text(doc, t.s, cx(i), cy, t.size, "normal");
    });
    const ft = fitLine(doc, fmt(total(f.t)), maxW(15), fs, "bold");
    text(doc, ft.s, cx(15), cy, ft.size, "bold");
    if (f.rem) {
      const c = fitClamp(doc, f.rem, maxW(16), fs, "normal", true);
      textLines(doc, c.lines, cx(16), cy, c.size, "normal", 1);
    }
  }

  summary(L.perPage + 1, "TOTAL THIS PAGE", s.page, `${s.flights.length} FLIGHTS`, 238);
  summary(L.perPage + 2, "GRAND TOTAL", s.grand, "", 221);
  hline(doc, x0, right, yBody + (L.perPage + 1) * ROW, 0.4);
  hline(doc, x0, right, yBody + (L.perPage + 3) * ROW, 0.4);

  drawFoot(doc, L, pageNo, N, true);
}

// ---------- profile pages ----------
function drawDetails(doc, L, G, y, d) {
  const { bs } = G;
  const x0 = M;
  const w = L.contentW;
  doc.setTextColor(INK);
  text(doc, "PILOT DETAILS", x0, y + (G.H3 - 2.5) / 2, bs, "bold", "left");
  hline(doc, x0, x0 + w, y + G.H3 - 1.6, 0.2);
  const col = (w - 10) / 3;
  const colX = (i) => x0 + i * (col + 5);
  let yy = y + G.H3;
  const bar = (label) => {
    yy += 1.2;
    doc.setFillColor(230);
    doc.rect(x0, yy, w, G.CB, "F");
    doc.setTextColor(INK);
    text(doc, label, x0 + 1.5, yy + G.CB / 2, L.fs, "bold", "left");
    yy += G.CB;
  };
  const field = (i, span, label, value) => {
    const x = colX(i);
    const fw = span * col + (span - 1) * 5;
    doc.setTextColor(85);
    text(doc, label.toUpperCase(), x, yy + 1.27, 6, "normal", "left");
    hline(doc, x, x + fw, yy + G.FH - 0.1, 0.15, 153);
    if (value) {
      doc.setTextColor(INK);
      const f = fitLine(doc, value, fw, bs, "bold");
      text(doc, f.s, x, yy + (2.54 + G.FH - 0.15) / 2, f.size, "bold", "left");
    }
  };
  const fieldRow = (cells) => {
    yy += 1.8;
    cells.forEach((c) => field(...c));
    yy += G.FH;
  };
  bar("PILOT");
  fieldRow([[0, 2, "Full name", d.name], [2, 1, "Date of birth", d.dob]]);
  fieldRow([[0, 1, "Staff ID", d.staffId], [1, 2, "Email address", d.email]]);
  yy += 1.8;
  bar("LICENCE");
  fieldRow([[0, 1, "Licence type", d.licenceType], [1, 2, "Licence number", d.licenceNumber]]);
  yy += 1.8;
  bar("OPERATOR");
  fieldRow([[0, 1, "Airline", d.airline], [1, 1, "Default rank", d.rank], [2, 1, "Home base", d.homeBase]]);
}

// A heading with a rule under it, then a table: first column 30%, seven hours columns of 10% each.
function drawHours(doc, L, G, y, title, lines) {
  const { bs } = G;
  const x0 = M;
  const w = L.contentW;
  doc.setTextColor(INK);
  text(doc, title, x0, y + (G.H3 - 2.5) / 2, bs, "bold", "left");
  hline(doc, x0, x0 + w, y + G.H3 - 1.6, 0.2);
  const xs = [x0, x0 + 0.3 * w];
  for (let i = 1; i <= 7; i++) xs.push(x0 + 0.3 * w + i * 0.1 * w);
  const cellW = (i) => xs[i + 1] - xs[i];
  let yy = y + G.H3;
  ["AIRCRAFT TYPE", "DAY P1", "DAY P1 U/S", "DAY P2", "NIGHT P1", "NIGHT P1 U/S", "NIGHT P2", "TOTAL"].forEach((label, i) => {
    cell(doc, xs[i], yy, cellW(i), G.TH, 230);
    doc.setTextColor(INK);
    if (i === 0) text(doc, label, xs[i] + 1.4, yy + G.TH / 2, L.fs - 1, "bold", "left");
    else text(doc, label, xs[i] + cellW(i) / 2, yy + G.TH / 2, L.fs - 1, "bold");
  });
  yy += G.TH;
  lines.forEach((ln) => {
    const bold = ln.style === "sub" || ln.style === "grand";
    const fill = ln.style === "sub" ? 238 : ln.style === "grand" ? 221 : undefined;
    for (let i = 0; i < 8; i++) cell(doc, xs[i], yy, cellW(i), G.RH, fill);
    doc.setTextColor(INK);
    const lab = fitLine(doc, ln.label, cellW(0) - 2.8, bs, bold ? "bold" : "normal");
    text(doc, lab.s, xs[0] + 1.4, yy + G.RH / 2, lab.size, bold ? "bold" : "normal", "left");
    KEYS.forEach((k, j) => {
      const f = fitLine(doc, fmt(ln.hours[k]), cellW(j + 1) - 1.2, bs, bold ? "bold" : "normal");
      text(doc, f.s, xs[j + 1] + cellW(j + 1) / 2, yy + G.RH / 2, f.size, bold ? "bold" : "normal");
    });
    const tf = fitLine(doc, fmt(total(ln.hours)), cellW(7) - 1.2, bs, "bold");
    text(doc, tf.s, xs[7] + cellW(7) / 2, yy + G.RH / 2, tf.size, "bold");
    if (ln.style === "grand") {
      hline(doc, x0, x0 + w, yy, 0.4);
      hline(doc, x0, x0 + w, yy + G.RH, 0.4);
    }
    yy += G.RH;
  });
}

function drawCert(doc, L, G, y) {
  const x0 = M;
  const w = L.contentW;
  doc.setDrawColor(INK);
  doc.setLineWidth(0.4);
  doc.rect(x0 + 0.2, y + 0.2, w - 0.4, G.CERT - 0.4, "S");
  const ts = L.fs + 3;
  doc.setTextColor(INK);
  text(doc, "I CERTIFY THAT THE ENTRIES IN THIS LOGBOOK ARE TRUE AND CORRECT.", x0 + 5, y + 0.4 + 3.5 + (ts * PT * 1.25) / 2, ts, "bold", "left");
  const labelCy = y + G.CERT - 0.4 - 3 - 1.38;
  const lineY = labelCy - 1.38 - 1 - 0.15;
  hline(doc, x0 + 5, x0 + 5 + 62, lineY, 0.3);
  hline(doc, x0 + w - 5 - 38, x0 + w - 5, lineY, 0.3);
  doc.setTextColor(68);
  text(doc, "PILOT SIGNATURE", x0 + 5, labelCy, 6.5, "normal", "left");
  text(doc, "DATE", x0 + w - 5 - 38, labelCy, 6.5, "normal", "left");
}

function drawProfile(doc, L, d, plan, idx, pageNo, N, info, data) {
  const G = profileGeo(L);
  const p = plan[idx];
  drawBand(doc, L, info, "PILOT LOGBOOK", [`PROFILE & EXPERIENCE${idx > 0 ? " (CONTINUED)" : ""}`, `FLIGHTS ${dmy(data.from)} - ${dmy(data.to)}`]);
  let y = M + BAND + 3;
  const gap = 4;
  let placed = false;
  const next = (h) => {
    if (placed) y += gap;
    const top = y;
    y += h;
    placed = true;
    return top;
  };
  if (p.details) drawDetails(doc, L, G, next(G.DETAILS), d);
  if (p.rows.length || p.total) {
    const cont = p.rows.length > 0 && p.rows[0] > 0;
    const lines = p.rows.map((i) => ({ label: data.carry[i].type, hours: data.carry[i] }));
    if (p.total) lines.push({ label: "TOTAL PREVIOUS EXPERIENCE", hours: data.cf, style: "sub" });
    drawHours(doc, L, G, next(G.H3 + G.TH + lines.length * G.RH), `PREVIOUS EXPERIENCE (CARRIED FORWARD${cont ? ", CONTINUED" : ""})`, lines);
  }
  if (p.tail) {
    drawHours(doc, L, G, next(G.H3 + G.TH + 3 * G.RH), "HOURS SUMMARY", [
      { label: "PREVIOUS EXPERIENCE", hours: data.cf },
      { label: `THIS LOGBOOK (${dmy(data.from)} : ${dmy(data.to)})`, hours: data.log },
      { label: "GRAND TOTAL", hours: add(data.cf, data.log), style: "grand" },
    ]);
    drawCert(doc, L, G, next(G.CERT));
  }
  drawFoot(doc, L, pageNo, N, false);
}

// ---------- cover ----------
function drawCover(doc, L, d, data, generatedOn) {
  // double-line border with chamfered corners around the printable area
  const w = L.W - 2 * M;
  const h = L.H - 2 * M;
  const poly = (i, k, lw) => {
    const x1 = w - i;
    const y1 = h - i;
    const pts = [[i + k, i], [x1 - k, i], [x1, i + k], [x1, y1 - k], [x1 - k, y1], [i + k, y1], [i, y1 - k], [i, i + k]];
    const rel = pts.slice(1).map((p, j) => [p[0] - pts[j][0], p[1] - pts[j][1]]);
    doc.setDrawColor(INK);
    doc.setLineWidth(lw);
    doc.lines(rel, M + pts[0][0], M + pts[0][1], [1, 1], "S", true);
  };
  poly(0.4, 7, 0.8);
  poly(2.2, 7 - 0.586 * 1.8, 0.3);

  const left = M + 13;
  const inner = L.W - 2 * (M + 13);
  const top = M + 9;
  const bottom = L.H - M - 7;
  const genH = 2.99;
  const blockH = 55.3;
  const y0 = top + (bottom - genH - top - blockH) / 2;
  doc.setTextColor(INK);
  text(doc, "PILOT LOGBOOK", left, y0 + 6, 34, "bold", "left");
  hline(doc, left, left + inner, y0 + 17.5, 1);
  text(doc, d.name, left, y0 + 27 + 4.7, 22, "bold", "left");
  const cw = (inner - 12) / 3;
  const my = y0 + 45.4;
  [["Licence", [d.licenceType, d.licenceNumber].filter(Boolean).join("  ")], ["Operator", d.airline], ["Flights recorded", `${dmy(data.from)} to ${dmy(data.to)}`]].forEach(([label, value], i) => {
    const x = left + i * (cw + 6);
    doc.setTextColor(85);
    text(doc, label.toUpperCase(), x, my + 1.38, 6.5, "normal", "left");
    hline(doc, x, x + cw, my + 3.77, 0.2);
    doc.setTextColor(INK);
    const f = fitLine(doc, value, cw, 11, "bold");
    text(doc, f.s, x, my + 3.77 + 0.2 + 1.2 + 2.35, f.size, "bold", "left");
  });
  doc.setTextColor(MUTED);
  text(doc, `Generated by ClaudeBorne : ${longDate(generatedOn)}`, left, bottom - 1.5, 7, "normal", "left");
}

// ---------- build ----------
// opts: { rows, computeFlightTimes, settings, email, paper, orientation, fonts: { regular, bold }, generatedOn }
export function buildLogbookPdf(JsPDF, opts) {
  const { rows, computeFlightTimes, settings = {}, email = "", paper = "a4", orientation = "landscape", fonts, generatedOn = new Date() } = opts;
  if (!rows || !rows.length) throw new Error("No flights to export");
  const L = layout(paper, orientation);
  const doc = new JsPDF({ orientation, unit: "mm", format: paper, compress: true });
  doc.addFileToVFS("inter-400.ttf", fonts.regular);
  doc.addFont("inter-400.ttf", "Inter", "normal");
  doc.addFileToVFS("inter-700.ttf", fonts.bold);
  doc.addFont("inter-700.ttf", "Inter", "bold");

  const d = {
    name: settings.fullName || "",
    dob: dobText(settings.dateOfBirth),
    staffId: settings.staffId || "",
    email: email || "",
    licenceType: settings.licenceType || "",
    licenceNumber: settings.licenceNumber || "",
    airline: settings.airline || "",
    rank: settings.defaultRank || "",
    homeBase: settings.homeBase || "",
  };
  const info = [d.name, [d.licenceType, d.licenceNumber].filter(Boolean).join(" "), d.airline, d.homeBase && `BASE ${d.homeBase}`].filter(Boolean).join("  |  ");

  const months = groupMonths(rows, computeFlightTimes);
  const carry = carryRows(settings);
  const cf = carry.reduce((a, r) => add(a, r), zero());
  const all = months.flatMap((m) => m.flights);
  const data = { carry, cf, log: all.reduce((a, f) => add(a, f.t), zero()), from: all[0].d, to: all[all.length - 1].d };
  const plan = planProfile(L, carry.length);
  const sheets = monthSheets(months, cf, L.perPage);
  const N = 1 + plan.length + sheets.length;

  drawCover(doc, L, d, data, generatedOn);
  plan.forEach((p, i) => {
    doc.addPage(paper, orientation);
    drawProfile(doc, L, d, plan, i, 2 + i, N, info, data);
  });
  sheets.forEach((s, i) => {
    doc.addPage(paper, orientation);
    drawMonth(doc, L, s, info, 2 + plan.length + i, N);
  });
  return doc;
}
