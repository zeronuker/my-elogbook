// The route map as a list of drawing primitives, shared by the image, PDF and interactive exports.
// Pure: flights and coastline data go in, items come out, so Node can test it. Sizes are in "units"
// where the page is W units wide (an A3 page's millimetres); each writer scales to its own output.
export const W = 420;
const rad = d => d * Math.PI / 180;
const mer = lat => Math.log(Math.tan(Math.PI / 4 + rad(Math.max(-85, Math.min(85, lat))) / 2));
const unmer = y => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;
const nf = n => Math.round(n).toLocaleString("en-GB");

// Colours from RouteMapModal: the ocean/land pair, and routes that run magenta (departure) to yellow or amber (arrival).
export const PAL = {
  dark: { ocean: "#060a10", land: "#16263b", border: "#2a4a6a", grid: "#0f1b2b", gridTxt: "#4a6a8a", ink: "#e8ecf5", ink2: "#b8c0d4", dim: "#7c87a3",
          plate: "#0a1020", plateLine: "#3FE0C5", dot: "#3FE0C5", ring: "#060a10", dep: [236, 72, 153], arr: [250, 204, 21] },
  light: { ocean: "#d6dde3", land: "#f3f4f6", border: "#b9c3cf", grid: "#c4ced8", gridTxt: "#7a8794", ink: "#0a1020", ink2: "#3a4258", dim: "#6b7488",
           plate: "#ffffff", plateLine: "#0b8a78", dot: "#0b6b5d", ring: "#ffffff", dep: [236, 72, 153], arr: [245, 158, 11] },
};
const hex = c => "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

// Points along the great circle between two airports, as [lat, lon].
export function greatCirclePoints(lat1, lon1, lat2, lon2, n = 160) {
  const φ1 = rad(lat1), λ1 = rad(lon1), φ2 = rad(lat2), λ2 = rad(lon2);
  const d = 2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2));
  if (d < 1e-9) return [[lat1, lon1]];
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    pts.push([Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI, Math.atan2(y, x) * 180 / Math.PI]);
  }
  return pts;
}

const fmtDate = d => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).toUpperCase();
const hm = m => nf(Math.floor(m / 60)) + " h " + String(m % 60).padStart(2, "0") + " min";

// The stats panel, one entry per line. Each writer draws these its own way.
export function panelRows(stats, routes, first, last, airportCount) {
  const top = [...routes].sort((a, b) => b.n - a.n).slice(0, 6);
  return [
    { k: "eb", s: "ROUTE MAP" },
    { k: "big", s: fmtDate(first) + " - " + fmtDate(last) },
    { k: "txt", s: `${stats.flights} flights  |  ${routes.length} routes  |  ${airportCount} airports` },
    { k: "head", s: "FLIGHT TIME" },
    { k: "num", big: hm(stats.totalMins), small: "total" },
    { k: "bar", day: stats.dayMins, night: stats.nightMins, dayCol: "#f5c542", nightCol: "#3B8DFF", l: "Day " + nf(stats.dayMins / 60) + " h", r: "Night " + nf(stats.nightMins / 60) + " h" },
    { k: "head", s: "DISTANCE (APPROX., GREAT-CIRCLE)" },
    { k: "num", big: nf(stats.km / 1.852) + " nm", small: nf(stats.km) + " km" },
    { k: "kv", a: "Longest route  " + stats.longest.a + " - " + stats.longest.b, b: nf(stats.longest.km / 1.852) + " nm" },
    { k: "kv", a: "Busiest airport  " + stats.busiest.icao, b: stats.busiest.n + " movements" },
    ...(stats.countries.length ? [{ k: "head", s: "COUNTRIES VISITED  " + stats.countries.length }, { k: "wrap", s: stats.countries.join(", ") }] : []),
    { k: "head", s: "MOST FLOWN" },
    ...top.map(r => ({ k: "kv", a: r.a + " - " + r.b, b: r.n + " flights  " + nf(Math.floor(r.mins / 60)) + " h" })),
    ...(stats.types.length ? [{ k: "head", s: "AIRCRAFT TYPES" }, ...stats.types.map(([t, m]) => ({ k: "kv", a: t, b: nf(Math.round(m / 60)) + " h" }))] : []),
    { k: "gap" },
    { k: "leg" },
  ];
}

const ROW_H = { eb: 5, big: 7, txt: 4.6, head: 8, num: 9, bar: 8, kv: 4.4, leg: 9, gap: 2 };
const PANEL_W = 104, PANEL_PAD = 5;

function wrapText(str, max) {
  const out = [];
  let line = "";
  for (const t of str.split(" ")) {
    if ((line + " " + t).trim().length > max) { out.push(line); line = t; } else line = (line + " " + t).trim();
  }
  if (line) out.push(line);
  return out;
}

// Lays the panel out with its top-left at 0,0 and returns { items, w, h } in panel units.
function layoutPanel(rows, c, maxN) {
  const items = [];
  rows.forEach(r => { if (r.k === "wrap") { r.lines = wrapText(r.s, 62); r.h = r.lines.length * 3.6 + 1; } else r.h = ROW_H[r.k]; });
  const h = rows.reduce((t, r) => t + r.h, 0) + PANEL_PAD * 2;
  items.push({ t: "rect", x: 0, y: 0, w: PANEL_W, h, fill: c.plate, stroke: c.plateLine, sw: 0.3, alpha: 0.92 });
  let y = PANEL_PAD;
  const x0 = PANEL_PAD, x1 = PANEL_W - PANEL_PAD;
  for (const r of rows) {
    if (r.k === "eb") items.push({ t: "text", x: x0, y: y + 2.6, s: r.s, fs: 2.6, fill: c.plateLine, bold: true, ls: 0.5 });
    else if (r.k === "big") items.push({ t: "text", x: x0, y: y + 5, s: r.s, fs: 4, fill: c.ink, bold: true });
    else if (r.k === "txt") items.push({ t: "text", x: x0, y: y + 3.4, s: r.s, fs: 2.7, fill: c.ink2 });
    else if (r.k === "head") {
      items.push({ t: "line", pts: [[x0, y + 2.2], [x1, y + 2.2]], stroke: c.grid, sw: 0.2 });
      items.push({ t: "text", x: x0, y: y + 6.4, s: r.s, fs: 2.2, fill: c.dim, bold: true, ls: 0.4 });
    } else if (r.k === "num") {
      items.push({ t: "text", x: x0, y: y + 6.4, s: r.big, fs: 5.6, fill: c.ink, bold: true });
      items.push({ t: "text", x: x1, y: y + 6.4, s: r.small, fs: 2.6, fill: c.ink2, right: true });
    } else if (r.k === "bar") {
      const bw = x1 - x0, dw = bw * r.day / Math.max(1, r.day + r.night);
      items.push({ t: "rect", x: x0, y: y + 0.6, w: dw, h: 2, fill: r.dayCol });
      items.push({ t: "rect", x: x0 + dw, y: y + 0.6, w: bw - dw, h: 2, fill: r.nightCol });
      items.push({ t: "text", x: x0, y: y + 6.4, s: r.l, fs: 2.4, fill: c.ink2 });
      items.push({ t: "text", x: x1, y: y + 6.4, s: r.r, fs: 2.4, fill: c.ink2, right: true });
    } else if (r.k === "kv") {
      items.push({ t: "text", x: x0, y: y + 3.2, s: r.a, fs: 2.8, fill: c.ink });
      items.push({ t: "text", x: x1, y: y + 3.2, s: r.b, fs: 2.8, fill: c.ink2, right: true });
    } else if (r.k === "wrap") r.lines.forEach((ln, i) => items.push({ t: "text", x: x0, y: y + 2.8 + i * 3.6, s: ln, fs: 2.4, fill: c.ink2 }));
    else if (r.k === "leg") {
      items.push({ t: "text", x: x0, y: y + 3, s: "LINE WIDTH = TIMES FLOWN", fs: 2.1, fill: c.dim, bold: true, ls: 0.3 });
      [1, 10, 30, 60].forEach((n, i) => {
        const lx = x0 + i * 22;
        items.push({ t: "line", pts: [[lx, y + 6.4], [lx + 9, y + 6.4]], stroke: hex(mix(c.dep, c.arr, 0.5)), sw: routeWidth(n, maxN), round: true });
        items.push({ t: "text", x: lx + 11, y: y + 7.4, s: String(n), fs: 2.4, fill: c.ink2 });
      });
    }
    y += r.h;
  }
  return { items, w: PANEL_W, h };
}

// Moves and scales panel items to where the panel sits on the page.
function placePanel(items, px, py, s) {
  return items.map(i => {
    const o = { ...i };
    if (o.x != null) o.x = px + o.x * s;
    if (o.y != null) o.y = py + o.y * s;
    if (o.pts) o.pts = o.pts.map(p => [px + p[0] * s, py + p[1] * s]);
    for (const k of ["w", "h", "fs", "sw", "ls"]) if (o[k] != null) o[k] *= s;
    return o;
  });
}

export const routeWidth = (n, maxN) => 0.22 + 0.95 * Math.sqrt(n / maxN);

// geo: { land: [{ pts: [[lon, lat]...], b: [minLon, maxLon, minLat, maxLat] }], borders: [same shape] }
// flights: { dep, arr, from, to, dayMins, nightMins, type, date: "YYYY-MM-DD" }; stats: computeStats() or null for no panel.
export function buildScene({ flights, stats, geo, theme = "dark", aspect = W / 297, geoMargin = 5 }) {
  const c = PAL[theme] || PAL.dark;
  const airports = new Map(), routeMap = new Map();
  let first = null, last = null;
  for (const f of flights) {
    for (const [code, p] of [[f.dep, f.from], [f.arr, f.to]]) {
      const a = airports.get(code) || { icao: code, lat: p.lat, lon: p.lon, n: 0 };
      a.n++;
      airports.set(code, a);
    }
    const [a, b] = f.dep < f.arr ? [f.dep, f.arr] : [f.arr, f.dep];
    const r = routeMap.get(a + "-" + b) || { key: a + "-" + b, a, b, n: 0, mins: 0 };
    r.n++;
    r.mins += f.dayMins + f.nightMins;
    routeMap.set(r.key, r);
    if (f.date) { if (!first || f.date < first) first = f.date; if (!last || f.date > last) last = f.date; }
  }
  if (!routeMap.size) return null;
  const H = W / aspect;
  const apList = [...airports.values()].sort((a, b) => b.n - a.n);

  // The map is cut at the widest empty stretch of longitude, so a Pacific crossing stays in one piece.
  const lons = apList.map(a => a.lon).sort((x, y) => x - y);
  let gap = -1, cut = lons[0];
  for (let i = 0; i < lons.length; i++) {
    const next = i + 1 < lons.length ? lons[i + 1] : lons[0] + 360;
    if (next - lons[i] > gap) { gap = next - lons[i]; cut = next > 180 ? next - 360 : next; }
  }
  const sl = lon => cut + (((lon - cut) % 360) + 360) % 360;

  // View: every airport with 10% padding, widened to the page shape.
  const xsr = apList.map(a => rad(sl(a.lon))), ysr = apList.map(a => mer(a.lat));
  const x0 = Math.min(...xsr), x1 = Math.max(...xsr), y0 = Math.min(...ysr), y1 = Math.max(...ysr);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let vw = Math.max((x1 - x0) * 1.2, rad(8)), vh = Math.max((y1 - y0) * 1.2, rad(8));
  if (vw / vh < aspect) vw = vh * aspect; else vh = vw / aspect;
  const vx0 = cx - vw / 2, vy1 = cy + vh / 2, S = W / vw;
  const PX = lon => (rad(lon) - vx0) * S;
  const PY = lat => (vy1 - mer(lat)) * S;
  const vLon0 = vx0 * 180 / Math.PI, vLon1 = (vx0 + vw) * 180 / Math.PI, vLat0 = unmer(vy1 - vh), vLat1 = unmer(vy1);

  const shown = (b, off) => b[1] + off >= vLon0 - geoMargin && b[0] + off <= vLon1 + geoMargin && b[3] >= vLat0 - geoMargin && b[2] <= vLat1 + geoMargin;
  const project = (shape, off) => shape.pts.map(([lo, la]) => [PX(lo + off), PY(la)]);
  const landRings = [], borderLines = [];
  for (const r of geo.land) for (const off of [-360, 0, 360]) if (shown(r.b, off)) landRings.push(project(r, off));
  for (const r of geo.borders) for (const off of [-360, 0, 360]) if (shown(r.b, off)) borderLines.push(project(r, off));

  // Routes, thickest last so the busy ones sit on top.
  const maxN = Math.max(...[...routeMap.values()].map(r => r.n));
  const routes = [...routeMap.values()].map(r => {
    const A = airports.get(r.a), B = airports.get(r.b);
    const g = greatCirclePoints(A.lat, A.lon, B.lat, B.lon);
    // keep longitude continuous along the arc, then move it to the same side of the cut as its airports
    let prev = g[0][1], delta = sl(g[0][1]) - g[0][1];
    const pts = g.map(([la, lo], i) => {
      if (i) { let d = lo - prev; while (d > 180) d -= 360; while (d < -180) d += 360; prev += d; }
      return [PX(prev + delta), PY(la)];
    });
    return { ...r, pts, w: routeWidth(r.n, maxN) };
  }).sort((a, b) => a.n - b.n);

  const out = [];
  out.push({ t: "rect", x: 0, y: 0, w: W, h: H, fill: c.ocean });
  const lonName = lo => { const v = ((Math.round(lo) + 540) % 360) - 180, a = Math.abs(v); return a === 0 || a === 180 ? `${a}°` : `${a}°${v < 0 ? "W" : "E"}`; };
  for (let lo = Math.ceil(vLon0 / 10) * 10; lo <= vLon1; lo += 10) {
    out.push({ t: "line", pts: [[PX(lo), 0], [PX(lo), H]], stroke: c.grid, sw: 0.15 });
  }
  for (let la = Math.ceil(vLat0 / 10) * 10; la <= vLat1; la += 10) out.push({ t: "line", pts: [[0, PY(la)], [W, PY(la)]], stroke: c.grid, sw: 0.15 });
  for (const r of landRings) out.push({ t: "poly", pts: r, fill: c.land });
  for (const l of borderLines) out.push({ t: "line", pts: l, stroke: c.border, sw: 0.1 });
  for (const r of landRings) out.push({ t: "poly", pts: r, stroke: c.border, sw: 0.14 });
  for (let lo = Math.ceil(vLon0 / 10) * 10; lo <= vLon1; lo += 10) out.push({ t: "text", x: PX(lo) + 1, y: H - 2, s: lonName(lo), fs: 2.4, fill: c.gridTxt });
  for (let la = Math.ceil(vLat0 / 10) * 10; la <= vLat1; la += 10) out.push({ t: "text", x: 1.5, y: PY(la) - 0.8, s: `${Math.abs(la)}°${la < 0 ? "S" : la > 0 ? "N" : ""}`, fs: 2.4, fill: c.gridTxt });
  // routes in short pieces so the magenta-to-yellow fade is the same in every format
  for (const r of routes) {
    const N = r.pts.length, step = 6;
    for (let i = 0; i < N - 1; i += step) {
      out.push({ t: "line", pts: r.pts.slice(i, Math.min(N, i + step + 1)), stroke: hex(mix(c.dep, c.arr, (i + step / 2) / (N - 1))), sw: r.w, round: true, route: r.key });
    }
  }
  const dotR = a => 0.7 + 2.3 * Math.sqrt(a.n / apList[0].n);
  const pos = new Map(apList.map(a => [a.icao, { x: PX(sl(a.lon)), y: PY(a.lat) }]));
  for (const a of [...apList].reverse()) out.push({ t: "circle", x: pos.get(a.icao).x, y: pos.get(a.icao).y, r: dotR(a), fill: c.dot, stroke: c.ring, sw: 0.25, ap: a.icao });

  // Stats panel: put it in the corner with the least on it, then keep labels off it.
  const boxes = [];
  let panel = null, rows = null;
  if (stats) {
    rows = panelRows(stats, routes, first, last, apList.length);
    const lay = layoutPanel(rows, c, maxN);
    const s = Math.min(1, 0.6 * H / lay.h), pw = lay.w * s, ph = lay.h * s, m = 8;
    const corners = [[m, H - ph - m], [W - pw - m, H - ph - m], [m, m + 4], [W - pw - m, m + 4]];
    const busy = ([px, py]) => {
      const inside = (x, y) => x >= px && x <= px + pw && y >= py && y <= py + ph;
      let score = 0;
      for (const r of routes) for (let i = 0; i < r.pts.length; i += 4) if (inside(r.pts[i][0], r.pts[i][1])) score += 1;
      for (const a of apList) if (inside(pos.get(a.icao).x, pos.get(a.icao).y)) score += 20;
      return score;
    };
    let best = corners[0], bestScore = busy(best);
    for (const k of corners.slice(1)) { const sc = busy(k); if (sc < bestScore) { best = k; bestScore = sc; } }
    panel = placePanel(lay.items, best[0], best[1], s);
    boxes.push({ x: best[0], y: best[1], w: pw, h: ph });
  }

  // Labels: busiest first, each in the first free spot around its dot.
  const labels = [];
  const hit = b => boxes.some(o => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
  for (const a of apList) {
    const r = dotR(a), fs = a.n > 100 ? 3.6 : a.n > 25 ? 2.7 : 2.2;
    const w = a.icao.length * fs * 0.62, h = fs * 0.8, { x, y } = pos.get(a.icao), g = r + 0.6;
    const cand = [[g, -g * 0.2], [-w - g, -g * 0.2], [-w / 2, -g - h], [-w / 2, g], [g, -g - h], [-w - g, -g - h], [g, g], [-w - g, g]];
    let pick = null;
    for (const [dx, dy] of cand) { const b = { x: x + dx, y: y + dy, w, h }; if (!hit(b)) { pick = b; break; } }
    const b = pick || { x: x + cand[0][0], y: y + cand[0][1], w, h };
    boxes.push(b);
    out.push({ t: "text", x: b.x, y: b.y + h * 0.88, s: a.icao, fs, fill: pick ? c.ink : c.ink2, bold: a.n > 25, label: true });
    labels.push({ s: a.icao, x: x, y: y, fs, bold: a.n > 25, n: a.n, r });
  }
  out.plateFrom = out.length;
  if (panel) out.push(...panel);
  out.push({ t: "text", x: W - 6, y: 5, s: "Coastlines and borders: Natural Earth via world-atlas (50 m)", fs: 2, fill: c.dim, right: true });

  return { W, H, items: out, pal: c, theme, labels, rows, routes, airports: apList, first, last, maxN, stats };
}
