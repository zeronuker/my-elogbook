import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./mapView.css";
import { getCoords } from "./airportCoords";
import { MONTHS } from "./logbookCalculations";
import { MAP_COLORS, ROUTE_COLOR_ARR, defaultBasemap, createBasePanes, mountBasemap, lerpColor } from "./mapBase";
import { collectSectors, buildScene, posOn, countUpTo, ease, routeWidth, fromUnit } from "./mapViewData";
import MapTimeline from "./MapTimeline";
import { useExitAnim } from "./useExitAnim";

// Logbook MAP view: where you flew in a month or a year. Leaflet draws the basemap; one canvas on top draws the routes,
// airports, labels and the aircraft. The engine below (plain functions over one mutable object `E`) runs playback, the
// follow camera and drawing from a single animation frame loop.

const MON3 = MONTHS.map(m => m.slice(0, 3).toUpperCase());
const pad2 = n => String(n).padStart(2, "0");
const PLANE = new Path2D("M8 0L-2 -1.6L-3 -6L-5 -6L-4 -1.4L-8 -1.2L-9 -3L-10.5 -3L-9.5 0L-10.5 3L-9 3L-8 1.2L-4 1.4L-5 6L-3 6L-2 1.6Z");
const MINT = "#3FE0C5";
const FOLLOW_SAY = {
  cruise: "Follow: close at take-off, wide en route, close on approach",
  frame: "Follow: frames each whole sector",
  zoom: "Follow: close zoom on the aircraft",
  pan: "Follow: keeps your zoom",
};
const SPEEDS = [0.25, 0.5, 1, 2];
const HOLD_MS = 1000;   // after you stop touching the map, follow takes the camera back

const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable — the choice just isn't remembered */ } },
};

// ── engine ──────────────────────────────────────────────────────────────────

const request = E => { if (!E.raf) E.raf = requestAnimationFrame(t => frame(E, t)); };
const sectorMs = E => Math.min(1300, Math.max(200, 30000 / Math.max(1, E.sectors.length))) / E.speed;

function setCut(E, n) {
  E.cut = n;
  E.ui.setCut(n);
  E.labelDirty = true;
  request(E);
}
function clearFlyers(E) { E.flyers = []; E.pending.clear(); }
function stopPlay(E) { E.pl = null; E.ui.setPlaying(false); }
function startPlay(E) {
  if (!E.sectors.length) return;
  if (E.cut >= E.sectors.length) setCut(E, 0);
  E.pl = { next: E.cut + 1, end: 0 };
  E.ui.setPlaying(true);
  request(E);
}

// A sector starts: the aircraft leaves. A route's first flight keeps the route itself hidden until it lands.
function fire(E, s, now, dur) {
  const r = s.route;
  const first = countUpTo(r.flights, s.si - 1) === 0;
  if (first) E.pending.add(r);
  E.flyers.push({ s, r, rev: s.rev, t0: now, dur, life: dur * 1.35, first, landed: false });
}
function landed(E, F, now) {
  if (F.landed) return;
  F.landed = true;
  if (E.pending.delete(F.r)) F.r.fadeAt = now;
}

const rangeOf = r => {
  if (!r.bb) r.bb = [Math.min(...r.u), Math.max(...r.u), Math.min(...r.v), Math.max(...r.v)];
  return r.bb;
};

// The camera where everything in the period fits.
function fitView(E) {
  const { w, h } = E.view || { w: 800, h: 500 };
  const fit0 = Math.log2(w / 256);
  if (!E.scene.routes.size) return { u: 0.5, v: 0.4, z: Math.max(1, fit0) };
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  E.scene.routes.forEach(r => { const b = rangeOf(r); u0 = Math.min(u0, b[0]); u1 = Math.max(u1, b[1]); v0 = Math.min(v0, b[2]); v1 = Math.max(v1, b[3]); });
  const pad = w < 640 ? 34 : 56;
  const z = Math.log2(Math.min((w - 2 * pad) / (Math.max(u1 - u0, 1e-6) * 256), (h - 2 * pad) / (Math.max(v1 - v0, 1e-6) * 256)));
  return { u: (u0 + u1) / 2, v: (v0 + v1) / 2, z: Math.max(1, fit0, Math.min(z, fit0 + 2.8)) };
}

// Moves the camera. Leaflet's own flyTo moves the view the same way, frame by frame.
function camTo(E, u, v, z) {
  const map = E.map;
  if (!E.camBusy) { E.camBusy = true; map._moveStart(true, false); }
  const [lat, lng] = fromUnit(u, v);
  // { pinch: true } is what a pinch-zoom passes: it makes the tile layer re-anchor on every move, not only when the zoom changes
  map._move(L.latLng(lat, lng), Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), z)), { pinch: true });
  E.camMoved = true;
}
function flyTo(E, to, animate) {
  const map = E.map;
  const z0 = map.getZoom(), S = 256 * 2 ** z0, c = map.project(map.getCenter(), z0);
  if (!animate) { const [lat, lng] = fromUnit(to.u, to.v); map.setView([lat, lng], to.z, { animate: false }); E.tween = null; return; }
  E.tween = { t0: performance.now(), dur: 750, u0: c.x / S, v0: c.y / S, z0, ...to };
  request(E);
}

// Follow: every frame the camera eases toward a target. It is the aircraft (PAN, CLOSE), the whole sector (FRAME), or
// close at both ends and wide in the middle (CRUISE). Anything you do to the map hands control to you; a second after you
// stop, it eases back.
function followCam(E, now) {
  const dt = Math.min(64, now - (E.lastCam || now) || 16);
  E.lastCam = now;
  if (!E.follow || now < E.idleUntil) return;
  let F = null;
  E.flyers.forEach(f => { if (now >= f.t0 && (!F || f.t0 > F.t0)) F = f; });
  if (!F || !E.view) return;
  const { w, h } = E.view, map = E.map;
  const z = map.getZoom(), S = 256 * 2 ** z, c = map.project(map.getCenter(), z), cu = c.x / S, cv = c.y / S;
  const fit0 = Math.log2(w / 256), close = fit0 + Math.log2(6);
  const u = Math.max(0, Math.min(1, (now - F.t0) / F.dur));
  const p = posOn(F.r, F.rev, ease(u)), k = Math.round(cu - p[0]);   // the copy of the world nearest the camera
  const pu = p[0] + k, pv = p[1];
  const style = E.followStyle;
  let tu = pu, tv = pv, tz = z;
  if (style === "frame" || style === "cruise") {
    const b = rangeOf(F.r), pad = w < 640 ? 50 : 90;
    const fz = Math.max(fit0, Math.min(fit0 + Math.log2(12),
      Math.log2(Math.min((w - 2 * pad) / (Math.max(b[1] - b[0], 1e-6) * 256), (h - 2 * pad) / (Math.max(b[3] - b[2], 1e-6) * 256)))));
    const bu = (b[0] + b[1]) / 2 + k, bv = (b[2] + b[3]) / 2;
    if (style === "frame") { tu = bu; tv = bv; tz = fz; }
    else {
      const wide = ease(Math.min(1, Math.min(u, 1 - u) / 0.35));   // 0 at take-off and landing, 1 mid-flight
      tu = pu + (bu - pu) * wide; tv = pv + (bv - pv) * wide; tz = close + (Math.min(fz, close) - close) * wide;
    }
  } else if (style === "zoom") tz = close;
  // quick for short sectors, slower to start when easing back after you let go
  const tau = Math.max(60, Math.min(style === "frame" ? 380 : 260, F.dur * 0.14)) + Math.max(0, 400 - (now - E.idleUntil));
  const al = 1 - Math.exp(-dt / tau);
  camTo(E, cu + (tu - cu) * al, cv + (tv - cv) * al, z + (tz - z) * al);
}

// ── labels: greedy, most-flown first. Each name tries 16 spots around its dot and takes the first that clears every
//    other name, every airport dot, every visible route line and the zoom buttons.
const SPOTS = [0, 180, -90, 90, -45, 45, -135, 135].flatMap(a => [[a, 7], [a, 15]]);
function segHit(a, b, c, d, x0, y0, x1, y1) {
  if (Math.max(a, c) < x0 || Math.min(a, c) > x1 || Math.max(b, d) < y0 || Math.min(b, d) > y1) return false;
  let t0 = 0, t1 = 1;
  const dx = c - a, dy = d - b, p = [-dx, dx, -dy, dy], q = [a - x0, x1 - a, b - y0, y1 - b];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; }
    else {
      const t = q[i] / p[i];
      if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
      else { if (t < t0) return false; if (t < t1) t1 = t; }
    }
  }
  return true;
}
const copies = (E, u, v, pad = 10) => {
  const { S, ox, oy, w, h } = E.view, out = [];
  for (let k = -2; k <= 2; k++) {
    const x = (u + k) * S - ox, y = v * S - oy;
    if (x > -pad && x < w + pad && y > -pad && y < h + pad) out.push([x, y]);
  }
  return out;
};
function layoutLabels(E) {
  E.labelDirty = false;
  E.lastLayout = performance.now();
  E.labels = new Map();
  if (!E.view) return;
  const { S, ox, oy, w, h } = E.view, ctx = E.ctx;
  ctx.font = '11px "Courier New", monospace';
  const aps = [...E.scene.airports.values()].map(a => ({ a, n: countUpTo(a.flights, E.cut) })).filter(x => x.n > 0).sort((x, y) => y.n - x.n);
  const dots = [];
  aps.forEach(({ a }) => copies(E, a.u, a.v, 40).forEach(([x, y]) => dots.push([x, y])));
  const segs = [];
  E.scene.routes.forEach(r => {
    if (!countUpTo(r.flights, E.cut) || E.pending.has(r)) return;
    for (let k = -2; k <= 2; k++) {
      for (let i = 0; i < r.u.length - 1; i += 6) {
        const j = Math.min(i + 6, r.u.length - 1);
        segs.push([(r.u[i] + k) * S - ox, r.v[i] * S - oy, (r.u[j] + k) * S - ox, r.v[j] * S - oy]);
      }
    }
  });
  const rects = [];
  aps.forEach(({ a }) => {
    const at = copies(E, a.u, a.v)[0];
    if (!at) return;
    const tw = ctx.measureText(a.icao).width, th = 12;
    const near = segs.filter(s => Math.min(s[0], s[2]) < at[0] + 120 && Math.max(s[0], s[2]) > at[0] - 120 && Math.min(s[1], s[3]) < at[1] + 120 && Math.max(s[1], s[3]) > at[1] - 120);
    for (const [deg, r] of SPOTS) {
      const cs = Math.cos(deg * Math.PI / 180), sn = Math.sin(deg * Math.PI / 180);
      const cx = at[0] + r * cs, cy = at[1] + r * sn;
      const x0 = cs > 0.3 ? cx : cs < -0.3 ? cx - tw : cx - tw / 2;
      const y0 = sn > 0.3 ? cy : sn < -0.3 ? cy - th : cy - th / 2;
      const x1 = x0 + tw, y1 = y0 + th;
      if (x0 < 4 || y0 < 4 || x1 > w - 4 || y1 > h - 4) continue;
      if (x1 > w - 56 && y0 < 150) continue;                                      // zoom and fit buttons
      if (rects.some(q => x0 < q[2] + 2 && x1 > q[0] - 2 && y0 < q[3] + 2 && y1 > q[1] - 2)) continue;
      if (dots.some(d => d[0] > x0 - 5 && d[0] < x1 + 5 && d[1] > y0 - 5 && d[1] < y1 + 5)) continue;
      if (near.some(s => segHit(s[0], s[1], s[2], s[3], x0 - 2, y0 - 2, x1 + 2, y1 + 2))) continue;
      rects.push([x0, y0, x1, y1]);
      E.labels.set(a.icao, { dx: x0 - at[0], dy: y0 - at[1] });
      return;
    }
  });
}

// ── drawing ──
function draw(E, now) {
  const { map, ctx, canvas } = E;
  const size = map.getSize(), d = E.dpr;
  if (canvas.width !== Math.round(size.x * d) || canvas.height !== Math.round(size.y * d)) {
    canvas.width = Math.round(size.x * d);
    canvas.height = Math.round(size.y * d);
  }
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.clearRect(0, 0, size.x, size.y);
  const z = map.getZoom(), S = 256 * 2 ** z, c = map.project(map.getCenter(), z);
  const ox = c.x - size.x / 2, oy = c.y - size.y / 2, w = size.x, h = size.y;
  E.view = { S, ox, oy, w, h };
  const { colors, scene, cut } = E;
  const ramp = E.animate ? Math.min(1, (now - E.rampT0) / 600) : 1;
  const sel = E.sel;
  const hasSel = !!sel;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // routes
  scene.routes.forEach(r => {
    const n = countUpTo(r.flights, cut);
    if (!n || E.pending.has(r)) return;
    const on = !hasSel || (sel.t === "r" && sel.k === r.key) || (sel.t === "a" && (sel.k === r.a || sel.k === r.b));
    const fade = r.fadeAt ? Math.min(1, (now - r.fadeAt) / 350) : 1;
    const b = rangeOf(r);
    ctx.lineWidth = routeWidth(n) + (hasSel && on && sel.t === "r" ? 1 : 0);
    ctx.globalAlpha = ramp * fade * (on ? 0.92 : 0.12);
    for (let k = -2; k <= 2; k++) {
      const x0 = (b[0] + k) * S - ox, x1 = (b[1] + k) * S - ox, y0 = b[2] * S - oy, y1 = b[3] * S - oy;
      if (x1 < -10 || x0 > w + 10 || y1 < -10 || y0 > h + 10) continue;
      const ax = (r.u[0] + k) * S - ox, ay = r.v[0] * S - oy, bx = (r.u[r.u.length - 1] + k) * S - ox, by = r.v[r.v.length - 1] * S - oy;
      if (Math.hypot(bx - ax, by - ay) < 1) ctx.strokeStyle = lerpColor(0.5, E.arrColor);
      else {
        const g = ctx.createLinearGradient(ax, ay, bx, by);
        g.addColorStop(0, lerpColor(0, E.arrColor));
        g.addColorStop(1, lerpColor(1, E.arrColor));
        ctx.strokeStyle = g;
      }
      ctx.beginPath();
      for (let i = 0; i < r.u.length; i++) {
        const x = (r.u[i] + k) * S - ox, y = r.v[i] * S - oy;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  });

  // airports and their names
  if (E.labelDirty && now - E.lastLayout > 200) layoutLabels(E);
  ctx.font = '11px "Courier New", monospace';
  ctx.textBaseline = "top";
  scene.airports.forEach(a => {
    if (!countUpTo(a.flights, cut)) return;
    const on = !hasSel || (sel.t === "a" && sel.k === a.icao) || (sel.t === "r" && sel.k.split("-").includes(a.icao));
    const lab = E.labels.get(a.icao);
    copies(E, a.u, a.v, 60).forEach(([x, y]) => {
      ctx.globalAlpha = ramp * (on ? 1 : 0.3);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = MINT;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = colors.dotRing;
      ctx.stroke();
      if (hasSel && sel.t === "a" && sel.k === a.icao) {
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = MINT;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      if (lab) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = colors.ocean;
        ctx.strokeText(a.icao, x + lab.dx, y + lab.dy);
        ctx.fillStyle = E.isLight ? "#0a1020" : "#e8ecf5";
        ctx.fillText(a.icao, x + lab.dx, y + lab.dy);
      }
    });
  });

  // aircraft: a bright line grows behind the plane, then cools away once it has landed
  E.flyers = E.flyers.filter(F => {
    const age = now - F.t0, u = age / F.dur;
    if (u < 0) return true;
    if (age >= F.life) { landed(E, F, now); return false; }
    const moving = u < 1;
    if (!moving) landed(E, F, now);
    const s = ease(Math.min(1, u));
    const k = Math.round((ox + w / 2) / S - posOn(F.r, F.rev, s)[0]);   // the copy of the world on screen
    const at = t => { const p = posOn(F.r, F.rev, t); return [(p[0] + k) * S - ox, p[1] * S - oy]; };
    ctx.globalAlpha = ramp * (moving ? 1 : 1 - (age - F.dur) / (F.life - F.dur));
    ctx.strokeStyle = E.flyColor;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    for (let i = 0; i <= 28; i++) { const q = at(s * i / 28); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
    ctx.stroke();
    if (moving) {
      const p = at(s), q = s >= 0.99 ? at(s - 0.01) : at(Math.min(1, s + 0.01));
      const ang = Math.atan2(s >= 0.99 ? p[1] - q[1] : q[1] - p[1], s >= 0.99 ? p[0] - q[0] : q[0] - p[0]);
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(p[0], p[1]);
      ctx.rotate(ang);
      ctx.scale(0.85, 0.85);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = E.isLight ? "#0a1020" : colors.ocean;
      ctx.lineWidth = 0.9;
      ctx.fill(PLANE);
      ctx.stroke(PLANE);
      ctx.restore();
    }
    return true;
  });
  ctx.globalAlpha = 1;
}

function frame(E, now) {
  E.raf = 0;
  if (!E.map) return;
  E.inFrame = true;
  E.camMoved = false;
  // the next sector leaves when the previous one has landed
  if (E.pl && now >= E.pl.end) {
    if (E.pl.next > E.sectors.length) stopPlay(E);
    else {
      const i = E.pl.next++, dur = sectorMs(E);
      E.pl.end = now + dur;
      fire(E, E.sectors[i - 1], now, dur);
      setCut(E, i);
    }
  }
  if (E.tween) {
    const T = E.tween, u = Math.min(1, (now - T.t0) / T.dur), e = ease(u);
    camTo(E, T.u0 + (T.u - T.u0) * e, T.v0 + (T.v - T.v0) * e, T.z0 + (T.z - T.z0) * e);
    if (u >= 1) E.tween = null;
  } else followCam(E, now);
  if (E.camMoved && now - E.lastLayout > 600) E.labelDirty = true;
  draw(E, now);
  if (!E.camMoved && E.camBusy) { E.camBusy = false; E.map.fire("viewreset"); E.map._moveEnd(true); }   // viewreset: tiles settle on the final view and stale ones go
  E.inFrame = false;
  const ramping = E.animate && now - E.rampT0 < 600;
  if (E.pl || E.flyers.length || E.tween || E.camMoved || ramping || E.labelDirty) request(E);
}

// ── hit testing: the airport or route under the pointer ──
function pick(E, x, y) {
  if (!E.view) return null;
  const { S, ox, oy } = E.view;
  let best = null, bd = 10;
  E.scene.airports.forEach(a => {
    const n = countUpTo(a.flights, E.cut);
    if (!n) return;
    copies(E, a.u, a.v, 20).forEach(([ax, ay]) => {
      const d = Math.hypot(ax - x, ay - y);
      if (d < bd) { bd = d; best = { t: "a", k: a.icao, n }; }
    });
  });
  if (best) return best;
  bd = 7;
  E.scene.routes.forEach(r => {
    const n = countUpTo(r.flights, E.cut);
    if (!n || E.pending.has(r)) return;
    for (let k = -2; k <= 2; k++) {
      for (let i = 1; i < r.u.length; i++) {
        const ax = (r.u[i - 1] + k) * S - ox, ay = r.v[i - 1] * S - oy, bx = (r.u[i] + k) * S - ox, by = r.v[i] * S - oy;
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
        const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
        const d = Math.hypot(ax + dx * t - x, ay + dy * t - y);
        if (d < bd) { bd = d; best = { t: "r", k: r.key, n }; }
      }
    }
  });
  return best;
}

// ── component ───────────────────────────────────────────────────────────────

export default function MapView({ data, year, monthIdx, theme, followStyle = "cruise", animate = true, onOpenSector }) {
  const isLight = theme === "light";
  const colors = MAP_COLORS[isLight ? "light" : "dark"];
  const acc = isLight ? "#0b8a78" : MINT;
  const [scope, setScope] = useState(() => store.get("elb_map_scope", "month") === "year" ? "year" : "month");
  const [speed, setSpeed] = useState(() => { const s = Number(store.get("elb_map_speed", "0.5")); return SPEEDS.includes(s) ? s : 0.5; });
  const [follow, setFollow] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(() => navigator.onLine);
  const mapEl = useRef(null), canvasEl = useRef(null), tipEl = useRef(null), toastTimer = useRef(0);

  const { sectors, skipped, scene } = useMemo(() => {
    const { sectors, skipped } = collectSectors(data, year, scope === "year" ? null : monthIdx, getCoords);
    return { sectors, skipped, scene: buildScene(sectors) };
  }, [data, year, monthIdx, scope]);

  // A new period starts with everything on the map and nothing selected.
  const [period, setPeriod] = useState(sectors);
  const [cut, setCutState] = useState(sectors.length);
  if (period !== sectors) { setPeriod(sectors); setCutState(sectors.length); setSelected(null); }

  const R = useRef({
    map: null, ctx: null, canvas: null, view: null, dpr: 1, raf: 0, flyers: [], pending: new Set(), pl: null, tween: null,
    labels: new Map(), labelDirty: true, lastLayout: 0, idleUntil: 0, lastCam: 0, camBusy: false, camMoved: false, inFrame: false,
    rampT0: 0, fitted: false, ui: {},
  });

  // What the engine reads: always the latest props and state.
  useLayoutEffect(() => {
    const E = R.current;
    E.sectors = sectors; E.scene = scene; E.cut = cut; E.speed = speed; E.follow = follow; E.followStyle = followStyle;
    E.sel = selected; E.colors = colors; E.isLight = isLight; E.animate = animate;
    E.arrColor = ROUTE_COLOR_ARR[isLight ? "light" : "dark"]; E.flyColor = isLight ? "#f59e0b" : "#ffe27a";
    E.ui = { setCut: setCutState, setPlaying };
  }, [sectors, scene, cut, speed, follow, followStyle, selected, colors, isLight, animate]);

  // The map, once.
  useEffect(() => {
    const E = R.current;
    const map = L.map(mapEl.current, {
      zoomSnap: 0, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, worldCopyJump: true,
      attributionControl: false, zoomControl: false, minZoom: 1, maxZoom: 19, wheelPxPerZoomLevel: 90,
    }).setView([20, 0], 2);
    createBasePanes(map);
    L.control.zoom({ position: "topright" }).addTo(map);
    // fit all routes: a button under the zoom buttons
    const Fit = L.Control.extend({
      onAdd() {
        const bar = L.DomUtil.create("div", "leaflet-bar leaflet-control");
        const a = L.DomUtil.create("a", "mv-fit", bar);
        a.href = "#";
        a.title = "Fit all routes";
        a.setAttribute("role", "button");
        a.setAttribute("aria-label", "Fit all routes");
        a.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9"/></svg>';
        L.DomEvent.disableClickPropagation(bar);
        L.DomEvent.on(a, "click", ev => {
          L.DomEvent.preventDefault(ev);
          E.idleUntil = performance.now() + HOLD_MS;
          flyTo(E, fitView(E), E.animate);
        });
        return bar;
      },
    });
    new Fit({ position: "topright" }).addTo(map);
    E.map = map;
    E.canvas = canvasEl.current;
    E.ctx = E.canvas.getContext("2d");
    E.dpr = window.devicePixelRatio || 1;
    const redraw = () => { E.labelDirty = true; if (!E.inFrame) request(E); };
    map.on("moveend zoomend resize", redraw);
    map.on("move", () => { if (!E.inFrame) request(E); });
    // touching the map hands the camera to you
    const box = map.getContainer();
    const hold = () => { E.idleUntil = Infinity; E.tween = null; };
    const release = () => { if (E.idleUntil === Infinity) E.idleUntil = performance.now() + HOLD_MS; };
    const wheel = () => { E.idleUntil = performance.now() + HOLD_MS; E.tween = null; };
    box.addEventListener("pointerdown", hold);
    box.addEventListener("wheel", wheel, { passive: true });
    document.addEventListener("pointerup", release);
    document.addEventListener("pointercancel", release);
    // hover tooltip and click to select
    const tip = tipEl.current;
    map.on("mousemove", e => {
      const hit = pick(E, e.containerPoint.x, e.containerPoint.y);
      box.style.cursor = hit ? "pointer" : "";
      if (!hit) { tip.style.display = "none"; return; }
      tip.replaceChildren();
      const b = document.createElement("b");
      b.textContent = hit.t === "a" ? hit.k : hit.k.replace("-", " - ");
      tip.append(b, ` · ${hit.n} ${hit.t === "a" ? "movement" : "flight"}${hit.n === 1 ? "" : "s"}`);
      tip.style.display = "block";
      const bw = E.view.w;
      tip.style.left = `${Math.min(e.containerPoint.x + 14, bw - tip.offsetWidth - 8)}px`;
      tip.style.top = `${Math.max(8, e.containerPoint.y - 34)}px`;
    });
    map.on("mouseout", () => { tip.style.display = "none"; });
    map.on("click", e => { const hit = pick(E, e.containerPoint.x, e.containerPoint.y); setSelected(hit ? { t: hit.t, k: hit.k } : null); });
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(mapEl.current);
    request(E);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(E.raf);
      E.raf = 0;
      document.removeEventListener("pointerup", release);
      document.removeEventListener("pointercancel", release);
      map.remove();
      E.map = null;
      E.fitted = false;
    };
  }, []);

  // Basemap: CARTO for the theme, or the bundled outline when offline.
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  const baseKey = online ? defaultBasemap(isLight) : "vector";
  // updateWhenZooming: false keeps the tile level steady while follow zooms, so tiles are not thrown away mid-flight
  useEffect(() => mountBasemap(R.current.map, baseKey, colors, { updateWhenZooming: false }), [baseKey, colors]);

  // A new period: stop, clear what was in the air, fade the routes in and fly the camera to fit them.
  useEffect(() => {
    const E = R.current;
    stopPlay(E);
    clearFlyers(E);
    E.rampT0 = performance.now();
    E.labelDirty = true;
    const first = !E.fitted;
    E.fitted = true;
    if (first) E.view = { w: E.map.getSize().x, h: E.map.getSize().y };
    flyTo(E, fitView(E), animate && !first);
    request(E);
  }, [sectors, scene, animate]);

  useEffect(() => { request(R.current); }, [theme, followStyle, selected]);

  // a selected item that is no longer on the map (scrubbed back) clears itself
  const selData = useMemo(() => {
    const it = selected && (selected.t === "a" ? scene.airports.get(selected.k) : scene.routes.get(selected.k));
    const flights = it ? it.flights.filter(f => f.si <= cut) : [];
    return flights.length ? { selected, flights } : null;
  }, [selected, scene, cut]);
  if (selected && !selData) setSelected(null);
  const selExit = useExitAnim(!!selData, selData); // keeps the panel (and its last content) mounted while it fades out
  const toastExit = useExitAnim(!!toast, toast);
  const sp = selExit.payload;

  const say = msg => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const changeScope = s => { setScope(s); store.set("elb_map_scope", s); };
  const avail = playing ? sectorMs({ sectors, speed }) : Infinity;
  const period_ = scope === "year" ? String(year) : `${MONTHS[monthIdx]} ${year}`;
  const meta = `${period_} · ${sectors.length} sector${sectors.length === 1 ? "" : "s"} · ${scene.airports.size} airport${scene.airports.size === 1 ? "" : "s"}${skipped ? ` · ${skipped} not shown (airport not in the list)` : ""}`;

  return (
    <div className="mv" style={{ "--mv-acc": acc }}>
      <div className="mv-bar">
        <div className="mv-seg" role="group" aria-label="Map period">
          {["month", "year"].map(s => (
            <button key={s} aria-pressed={scope === s} onClick={() => changeScope(s)}>{s.toUpperCase()}</button>
          ))}
        </div>
        <span className="mv-meta">{meta}</span>
      </div>
      <div className="mv-box" style={{ background: colors.ocean }}>
        <div ref={mapEl} className="mv-map" />
        <canvas ref={canvasEl} className="mv-canvas" />
        <div ref={tipEl} className="mv-tip" />
        {!sectors.length && (
          <div className="mv-empty elb-fade">
            <b>NO FLIGHTS</b>
            <span>{skipped ? `${skipped} sector${skipped === 1 ? "" : "s"} in ${period_} can't be drawn because an airport isn't in the list.` : `Nothing logged for ${period_}.`}</span>
          </div>
        )}
        {selExit.mounted && (
          <div className={"mv-sel" + (selExit.closing ? " elb-closing" : "")}>
            <header>
              <div>
                <b>{sp.selected.t === "a" ? sp.selected.k : sp.selected.k.replace("-", " - ")}</b>
                <small>{sp.flights.length} {sp.selected.t === "a" ? "movement" : "flight"}{sp.flights.length === 1 ? "" : "s"} · tap one to open it in the list</small>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Close">{"×"}</button>
            </header>
            <ul>
              {sp.flights.map(f => (
                <li key={`${f.month}-${f.row.id}`}>
                  <button onClick={() => onOpenSector(f.row, f.month, f.year)}>
                    <span className="d">{pad2(f.day)} {MON3[f.month]}</span>
                    <span>{f.dep} {"→"} {f.arr}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {toastExit.mounted && <div className={"mv-toast" + (toastExit.closing ? " elb-closing" : "")} role="status">{toastExit.payload}</div>}
      </div>
      <MapTimeline
        sectors={sectors} cut={cut} playing={playing} speed={speed} follow={follow} scope={scope} avail={avail}
        onPlay={() => (R.current.pl ? stopPlay(R.current) : startPlay(R.current))}
        onSpeed={() => { const n = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; setSpeed(n); store.set("elb_map_speed", String(n)); }}
        onFollow={() => { const on = !follow; setFollow(on); R.current.idleUntil = 0; say(on ? FOLLOW_SAY[followStyle] : "Follow off"); request(R.current); }}
        onScrub={n => { const E = R.current; stopPlay(E); clearFlyers(E); setCut(E, n); }}
      />
    </div>
  );
}
