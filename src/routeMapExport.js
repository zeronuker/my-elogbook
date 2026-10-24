// Route map export: one scene (routeMapScene.js), three writers. Loaded only when the user presses Export.
import { buildScene, W } from "./routeMapScene.js";
import { computeStats } from "./routeMapStats.js";
import { loadPdfFonts } from "./pdfFonts";

export const IMAGE_SIZES = { wide: [3840, 2160], square: [2160, 2160], portrait: [2160, 2700] };
export const PAPERS = { a4: [210, 297], a3: [297, 420], letter: [215.9, 279.4] };

// ── coastlines and borders (Natural Earth 50 m), loaded once ──
const boxOf = pts => {
  let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
  for (const [lo, la] of pts) { if (lo < a) a = lo; if (lo > b) b = lo; if (la < c) c = la; if (la > d) d = la; }
  return [a, b, c, d];
};
// A ring that crosses the antimeridian jumps from +179 to -179; keep it continuous instead.
function unwrapRing(ring) {
  let prev = ring[0][0];
  const out = ring.map(([lon, lat], i) => {
    if (i) { let d = lon - prev; while (d > 180) d -= 360; while (d < -180) d += 360; prev += d; return [prev, lat]; }
    return [lon, lat];
  });
  const avg = out.reduce((s, p) => s + p[0], 0) / out.length;
  const shift = Math.round(avg / 360) * 360;
  return shift ? out.map(([lo, la]) => [lo - shift, la]) : out;
}
let geoPromise = null;
export function loadGeo() {
  if (!geoPromise) {
    geoPromise = (async () => {
      const [{ feature, mesh }, land, countries] = await Promise.all([import("topojson-client"), import("world-atlas/land-50m.json"), import("world-atlas/countries-50m.json")]);
      const L = land.default, C = countries.default;
      const landFeat = feature(L, L.objects.land);
      const rings = [];
      for (const f of landFeat.features || [landFeat]) {
        const g = f.geometry || f;
        for (const poly of g.type === "Polygon" ? [g.coordinates] : g.coordinates) {
          for (const ring of poly) { const pts = unwrapRing(ring); rings.push({ pts, b: boxOf(pts) }); }
        }
      }
      const borders = [];
      for (const line of mesh(C, C.objects.countries, (a, b) => a !== b).coordinates) {
        let seg = [];
        for (let i = 0; i < line.length; i++) {
          if (i && Math.abs(line[i][0] - line[i - 1][0]) > 180) { if (seg.length > 1) borders.push({ pts: seg, b: boxOf(seg) }); seg = []; }
          seg.push(line[i]);
        }
        if (seg.length > 1) borders.push({ pts: seg, b: boxOf(seg) });
      }
      return { land: rings, borders };
    })().catch(e => { geoPromise = null; throw e; });
  }
  return geoPromise;
}

// ── image: the scene drawn straight onto a canvas ──
async function drawImage(scene, pw, ph) {
  const cv = document.createElement("canvas");
  cv.width = pw;
  cv.height = ph;
  const ctx = cv.getContext("2d");
  const k = pw / scene.W;
  try { await Promise.all([document.fonts.load("400 20px Inter"), document.fonts.load("700 20px Inter")]); } catch { /* falls back to Helvetica */ }
  ctx.lineJoin = "round";
  for (const i of scene.items) {
    ctx.globalAlpha = 1;
    if (i.t === "rect") {
      ctx.globalAlpha = i.alpha || 1;
      ctx.fillStyle = i.fill;
      ctx.fillRect(i.x * k, i.y * k, i.w * k, i.h * k);
      if (i.stroke) { ctx.strokeStyle = i.stroke; ctx.lineWidth = i.sw * k; ctx.strokeRect(i.x * k, i.y * k, i.w * k, i.h * k); }
    } else if (i.t === "poly" || i.t === "line") {
      ctx.beginPath();
      i.pts.forEach((p, n) => (n ? ctx.lineTo(p[0] * k, p[1] * k) : ctx.moveTo(p[0] * k, p[1] * k)));
      if (i.t === "poly") { ctx.closePath(); if (i.fill) { ctx.fillStyle = i.fill; ctx.fill(); } else { ctx.strokeStyle = i.stroke; ctx.lineWidth = i.sw * k; ctx.stroke(); } }
      else { ctx.strokeStyle = i.stroke; ctx.lineWidth = i.sw * k; ctx.lineCap = i.round ? "round" : "butt"; ctx.stroke(); }
    } else if (i.t === "circle") {
      ctx.beginPath();
      ctx.arc(i.x * k, i.y * k, i.r * k, 0, Math.PI * 2);
      ctx.fillStyle = i.fill; ctx.fill();
      ctx.strokeStyle = i.stroke; ctx.lineWidth = i.sw * k; ctx.stroke();
    } else if (i.t === "text") {
      ctx.font = `${i.bold ? 700 : 400} ${i.fs * k}px Inter, Helvetica, Arial, sans-serif`;
      ctx.fillStyle = i.fill;
      ctx.textAlign = i.right ? "right" : "left";
      if ("letterSpacing" in ctx) ctx.letterSpacing = (i.ls ? i.ls * k : 0) + "px";
      ctx.fillText(i.s, i.x * k, i.y * k);
    }
  }
  const blob = await new Promise(res => cv.toBlob(res, "image/png"));
  if (!blob) throw new Error("Could not create the image. Try a smaller size.");
  return blob;
}

// ── PDF: the same scene as vector drawing ──
const PT = 25.4 / 72;
const rgb = h => [1, 3, 5].map(n => parseInt(h.slice(n, n + 2), 16));
async function drawPdf(scene, paper, orient, pw) {
  const [{ jsPDF }, fonts] = await Promise.all([import("jspdf"), loadPdfFonts()]);
  const doc = new jsPDF({ orientation: orient, unit: "mm", format: paper, compress: true });
  doc.addFileToVFS("inter-400.ttf", fonts.regular);
  doc.addFont("inter-400.ttf", "Inter", "normal");
  doc.addFileToVFS("inter-700.ttf", fonts.bold);
  doc.addFont("inter-700.ttf", "Inter", "bold");
  doc.setProperties({ title: "Route map" });
  doc.setLineJoin("round");
  const k = pw / scene.W;
  const soft = doc.GState({ opacity: 0.92 }), full = doc.GState({ opacity: 1 });
  const deltas = pts => pts.slice(1).map((p, n) => [(p[0] - pts[n][0]) * k, (p[1] - pts[n][1]) * k]);
  for (const i of scene.items) {
    if (i.t === "rect") {
      doc.setFillColor(...rgb(i.fill));
      if (i.alpha) doc.setGState(soft);
      if (i.stroke) { doc.setDrawColor(...rgb(i.stroke)); doc.setLineWidth(i.sw * k); doc.rect(i.x * k, i.y * k, i.w * k, i.h * k, "FD"); }
      else doc.rect(i.x * k, i.y * k, i.w * k, i.h * k, "F");
      doc.setGState(full);
    } else if (i.t === "poly") {
      if (i.fill) { doc.setFillColor(...rgb(i.fill)); doc.lines(deltas(i.pts), i.pts[0][0] * k, i.pts[0][1] * k, [1, 1], "F", true); }
      else { doc.setDrawColor(...rgb(i.stroke)); doc.setLineWidth(i.sw * k); doc.lines(deltas(i.pts), i.pts[0][0] * k, i.pts[0][1] * k, [1, 1], "S", true); }
    } else if (i.t === "line") {
      doc.setDrawColor(...rgb(i.stroke));
      doc.setLineWidth(i.sw * k);
      doc.setLineCap(i.round ? "round" : "butt");
      doc.lines(deltas(i.pts), i.pts[0][0] * k, i.pts[0][1] * k, [1, 1], "S", false);
    } else if (i.t === "circle") {
      doc.setFillColor(...rgb(i.fill)); doc.setDrawColor(...rgb(i.stroke)); doc.setLineWidth(i.sw * k);
      doc.circle(i.x * k, i.y * k, i.r * k, "FD");
    } else if (i.t === "text") {
      doc.setFont("Inter", i.bold ? "bold" : "normal");
      doc.setFontSize(i.fs * k / PT);
      doc.setTextColor(...rgb(i.fill));
      doc.text(i.s, i.x * k, i.y * k, { align: i.right ? "right" : "left", charSpace: (i.ls || 0) * k });
    }
  }
  return doc.output("blob");
}

// ── interactive HTML: one file, no network needed ──
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const f2 = n => +n.toFixed(2);
const pts2 = pts => pts.map(p => f2(p[0]) + "," + f2(p[1])).join(" ");

function panelHtml(rows) {
  return rows.map(r => {
    if (r.k === "eb") return `<div class="eb">${esc(r.s)}</div>`;
    if (r.k === "big") return `<div class="dt">${esc(r.s)}</div>`;
    if (r.k === "txt") return `<div class="st">${esc(r.s)}</div>`;
    if (r.k === "head") return `<h4>${esc(r.s)}</h4>`;
    if (r.k === "num") return `<div class="num"><b>${esc(r.big)}</b><span>${esc(r.small)}</span></div>`;
    if (r.k === "bar") return `<div class="bar"><i style="flex:${r.day};background:${r.dayCol}"></i><i style="flex:${r.night};background:${r.nightCol}"></i></div><div class="row"><span>${esc(r.l)}</span><span>${esc(r.r)}</span></div>`;
    if (r.k === "kv") return `<div class="row"><span>${esc(r.a)}</span><span>${esc(r.b)}</span></div>`;
    if (r.k === "wrap") return `<div class="wr">${esc(r.s)}</div>`;
    return "";
  }).join("");
}

const VIEWER_CSS = `
*{box-sizing:border-box}html,body{margin:0;height:100%;background:var(--ocean);color:var(--ink);font-family:'Courier New',monospace;overflow:hidden}
#svg{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:grab;--s:1}#svg.drag{cursor:grabbing}
.land{fill:var(--land)}.coast{fill:none;stroke:var(--border);stroke-width:calc(.14px/var(--s));stroke-linejoin:round}
.bd{fill:none;stroke:var(--border);stroke-width:calc(.1px/var(--s))}.gr{fill:none;stroke:var(--grid);stroke-width:calc(.15px/var(--s))}
.rt{fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-width:calc(var(--w)*1px/var(--s))}.rg{transition:opacity .15s}
.hit{fill:none;stroke:transparent;stroke-width:calc(3px/var(--s));pointer-events:stroke}
.ap{fill:var(--dot);stroke:var(--ring);stroke-width:calc(.25px/var(--s));r:calc(var(--r)*1px/var(--s));pointer-events:all}
#svg.hl .rg{opacity:.12}#svg.hl .rg.on{opacity:1}
.lb{fill:var(--ink);pointer-events:none;paint-order:stroke;stroke:var(--ocean);stroke-width:.25em;stroke-opacity:.55;stroke-linejoin:round}.lb.b{font-weight:700}
#plate{position:absolute;left:14px;bottom:14px;width:min(330px,calc(100vw - 28px));max-height:calc(100vh - 28px);overflow:auto;background:var(--plate);border:1px solid var(--line);padding:14px 16px;opacity:.94;font-size:12px}
#plate .eb{font-size:10px;letter-spacing:.22em;color:var(--line);font-weight:700}#plate .dt{font-size:16px;font-weight:700;margin:6px 0 4px}#plate .st{color:var(--ink2)}
#plate h4{margin:12px 0 4px;font-size:10px;letter-spacing:.2em;color:var(--dim)}
#plate .row{display:flex;justify-content:space-between;gap:10px;padding:1px 0}#plate .row span:last-child{color:var(--ink2);text-align:right}
#plate .num{display:flex;justify-content:space-between;align-items:baseline}#plate .num b{font-size:20px}#plate .num span{color:var(--ink2)}
#plate .bar{display:flex;height:6px;margin:4px 0}#plate .bar i{display:block}#plate .wr{color:var(--ink2);line-height:1.5}
#tip{position:absolute;pointer-events:none;background:var(--plate);border:1px solid var(--line);padding:6px 9px;font-size:12px;display:none;white-space:nowrap}#tip b{color:var(--line)}
#btns{position:absolute;right:14px;top:14px;display:flex;flex-direction:column;gap:6px}
#btns button{width:34px;height:34px;white-space:nowrap;background:var(--plate);border:1px solid var(--line);color:var(--ink);font:700 16px 'Courier New',monospace;cursor:pointer}#btns button:hover{color:var(--line)}
#credit{position:absolute;right:14px;bottom:8px;font-size:10px;color:var(--dim)}
@media(max-width:560px){#plate{font-size:11px;padding:10px 12px;max-height:46vh}}`;

// Runs in the saved file: pan, pinch and wheel zoom, hover details, labels that appear as there is room for them.
const VIEWER_JS = `
const svg=document.getElementById('svg'),lab=document.getElementById('labels'),tip=document.getElementById('tip');
let vb={x:0,y:0,w:W,h:H};const KMAX=40,NS='http://www.w3.org/2000/svg';
const els=LABELS.map(function(L){const t=document.createElementNS(NS,'text');t.textContent=L.s;t.setAttribute('class','lb'+(L.bold?' b':''));lab.appendChild(t);return t});
function aspect(){const r=svg.getBoundingClientRect();return r.width/r.height}
function fitW(){const a=aspect();return H*a>=W?H*a:W}
function clamp(){const a=aspect(),fw=fitW();vb.w=Math.min(Math.max(vb.w,fw/KMAX),fw);vb.h=vb.w/a;
  const mx=Math.max(0,(vb.w-W)/2);vb.x=Math.min(Math.max(vb.x,-mx),W-vb.w+mx);
  const my=Math.max(0,(vb.h-H)/2);vb.y=Math.min(Math.max(vb.y,-my),H-vb.h+my)}
function apply(){clamp();svg.setAttribute('viewBox',vb.x+' '+vb.y+' '+vb.w+' '+vb.h);const k=fitW()/vb.w;svg.style.setProperty('--s',Math.pow(k,.8));layout(k)}
function layout(k){const sc=1.35/k,boxes=[];
  LABELS.forEach(function(L,i){const e=els[i],fs=L.fs*sc,w=L.s.length*fs*.62,h=fs*.8,g=L.r/Math.pow(k,.8)+.6*sc;e.style.display='none';
    if(L.x<vb.x-5||L.x>vb.x+vb.w+5||L.y<vb.y-5||L.y>vb.y+vb.h+5)return;
    const cand=[[g,-g*.2],[-w-g,-g*.2],[-w/2,-g-h],[-w/2,g],[g,-g-h],[-w-g,-g-h],[g,g],[-w-g,g]];
    for(let c=0;c<cand.length;c++){const b={x:L.x+cand[c][0],y:L.y+cand[c][1],w:w,h:h};
      if(!boxes.some(function(o){return b.x<o.x+o.w&&b.x+b.w>o.x&&b.y<o.y+o.h&&b.y+b.h>o.y})){boxes.push(b);
        e.setAttribute('x',b.x);e.setAttribute('y',b.y+h*.88);e.style.fontSize=fs+'px';e.style.display='';return}}})}
function pt(cx,cy){const p=svg.createSVGPoint();p.x=cx;p.y=cy;return p.matrixTransform(svg.getScreenCTM().inverse())}
function zoomAt(cx,cy,f){const p=pt(cx,cy),nw=vb.w/f,r=nw/vb.w;vb.x=p.x-(p.x-vb.x)*r;vb.y=p.y-(p.y-vb.y)*r;vb.w=nw;apply()}
svg.addEventListener('wheel',function(e){e.preventDefault();zoomAt(e.clientX,e.clientY,Math.exp(-e.deltaY*(e.ctrlKey?.01:.0018)))},{passive:false});
const ptrs=new Map();let last=0;
svg.addEventListener('pointerdown',function(e){svg.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});svg.classList.add('drag');last=0});
svg.addEventListener('pointermove',function(e){const p=ptrs.get(e.pointerId);if(!p){hover(e);return}
  const ox=p.x,oy=p.y;p.x=e.clientX;p.y=e.clientY;
  if(ptrs.size===1){const r=svg.getBoundingClientRect(),u=vb.w/r.width;vb.x-=(p.x-ox)*u;vb.y-=(p.y-oy)*u;apply()}
  else if(ptrs.size===2){const v=Array.from(ptrs.values()),d=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y);if(last)zoomAt((v[0].x+v[1].x)/2,(v[0].y+v[1].y)/2,d/last);last=d}});
function up(e){ptrs.delete(e.pointerId);if(!ptrs.size)svg.classList.remove('drag');last=0}
svg.addEventListener('pointerup',up);svg.addEventListener('pointercancel',up);
function hover(e){if(e.pointerType==='touch')return;const t=e.target;let html='',key=null;
  if(t.dataset&&t.dataset.a){html='<b>'+t.dataset.a+'</b>'+(AI?' &middot; '+AI[t.dataset.a]+' movement'+(AI[t.dataset.a]===1?'':'s'):'')}
  else if(t.dataset&&t.dataset.r&&t.classList.contains('hit')){key=t.dataset.r;html='<b>'+key.replace('-',' - ')+'</b>';
    if(RI){const r=RI[key];html+=' &middot; '+r.n+' flight'+(r.n===1?'':'s')+' &middot; '+r.h+' h '+String(r.m).padStart(2,'0')+' min'}}
  svg.classList.toggle('hl',!!key);svg.querySelectorAll('.rg.on').forEach(function(n){n.classList.remove('on')});
  if(key)svg.querySelectorAll('.rg[data-r="'+key+'"]').forEach(function(n){n.classList.add('on')});
  if(html){tip.innerHTML=html;tip.style.display='block';tip.style.left=Math.min(e.clientX+14,innerWidth-tip.offsetWidth-8)+'px';tip.style.top=Math.max(8,e.clientY-34)+'px'}else tip.style.display='none'}
svg.addEventListener('pointerleave',function(){tip.style.display='none'});
function mid(){const r=svg.getBoundingClientRect();return[r.left+r.width/2,r.top+r.height/2]}
document.getElementById('zi').onclick=function(){const m=mid();zoomAt(m[0],m[1],1.6)};
document.getElementById('zo').onclick=function(){const m=mid();zoomAt(m[0],m[1],1/1.6)};
document.getElementById('zf').onclick=function(){vb={x:0,y:0,w:W,h:H};apply()};
addEventListener('resize',apply);apply();`;

function buildHtml(scene) {
  const c = scene.pal, showNums = !!scene.stats;
  const groups = new Map(), parts = [];
  for (const i of scene.items.slice(0, scene.items.plateFrom)) {
    if (i.t === "poly") parts.push(`<polygon class="${i.fill ? "land" : "coast"}" points="${pts2(i.pts)}"/>`);
    else if (i.t === "line" && i.route) {
      if (!groups.has(i.route)) { groups.set(i.route, []); parts.push("@@" + i.route + "@@"); }
      groups.get(i.route).push(`<polyline class="rt" style="--w:${f2(i.sw)};stroke:${i.stroke}" points="${pts2(i.pts)}"/>`);
    } else if (i.t === "line") parts.push(`<polyline class="${i.sw === 0.1 ? "bd" : "gr"}" points="${pts2(i.pts)}"/>`);
    else if (i.t === "circle") parts.push(`<circle class="ap" data-a="${i.ap}" cx="${f2(i.x)}" cy="${f2(i.y)}" style="--r:${f2(i.r)}"/>`);
  }
  for (const [key, list] of groups) parts[parts.indexOf("@@" + key + "@@")] = `<g class="rg" data-r="${key}">${list.join("")}</g>`;
  const hits = scene.routes.map(r => `<polyline class="hit" data-r="${r.key}" points="${pts2(r.pts)}"/>`).join("");
  const labels = scene.labels.map(l => ({ s: l.s, x: f2(l.x), y: f2(l.y), fs: l.fs, bold: l.bold, r: f2(l.r) }));
  const RI = showNums ? Object.fromEntries(scene.routes.map(r => [r.key, { n: r.n, h: Math.floor(r.mins / 60), m: r.mins % 60 }])) : null;
  const AI = showNums ? Object.fromEntries(scene.airports.map(a => [a.icao, a.n])) : null;
  const json = v => JSON.stringify(v).replace(/</g, "\\u003c");
  const vars = `--ocean:${c.ocean};--land:${c.land};--border:${c.border};--grid:${c.grid};--ink:${c.ink};--ink2:${c.ink2};--dim:${c.dim};--plate:${c.plate};--line:${c.plateLine};--dot:${c.dot};--ring:${c.ring}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Route map</title><style>:root{${vars}}${VIEWER_CSS}</style></head><body>
<svg id="svg" viewBox="0 0 ${scene.W} ${f2(scene.H)}" preserveAspectRatio="xMidYMid meet"><g id="world">${parts.join("")}${hits}</g><g id="labels"></g></svg>
${scene.rows ? `<div id="plate">${panelHtml(scene.rows)}<div class="st" style="margin-top:10px;color:var(--dim);font-size:10.5px">Scroll or pinch to zoom, drag to pan. Hover a route or airport for details.</div></div>` : ""}
<div id="btns"><button id="zi" aria-label="Zoom in">+</button><button id="zo" aria-label="Zoom out">-</button><button id="zf" aria-label="Fit all routes" style="font-size:10px">FIT</button></div>
<div id="tip"></div><div id="credit">Natural Earth via world-atlas (50 m)</div>
<script>const W=${scene.W},H=${f2(scene.H)},LABELS=${json(labels)},RI=${json(RI)},AI=${json(AI)};${VIEWER_JS}</script></body></html>`;
}

// ── entry point ──
// opts: { kind: "image"|"pdf"|"html", flights, theme, showStats, size, paper, orient }
// Returns { blob, ext }. Throws an Error with a message fit to show the user.
export async function buildRouteMapFile(opts) {
  const { kind, flights, theme, showStats, size = "wide", paper = "a4", orient = "landscape" } = opts;
  if (!flights.length) throw new Error("No routes in this date range");
  const geo = await loadGeo();
  const stats = showStats ? computeStats(flights) : null;
  if (kind === "image") {
    const [pw, ph] = IMAGE_SIZES[size] || IMAGE_SIZES.wide;
    return { blob: await drawImage(buildScene({ flights, stats, geo, theme, aspect: pw / ph }), pw, ph), ext: "png" };
  }
  if (kind === "pdf") {
    const [a, b] = PAPERS[paper] || PAPERS.a4;
    const pw = orient === "landscape" ? b : a, ph = orient === "landscape" ? a : b;
    return { blob: await drawPdf(buildScene({ flights, stats, geo, theme, aspect: pw / ph }), paper, orient, pw), ext: "pdf" };
  }
  // the page can be any shape, so keep extra land past the edges for when the window is wider than the map
  const scene = buildScene({ flights, stats, geo, theme, aspect: W / 297, geoMargin: 40 });
  return { blob: new Blob([buildHtml(scene)], { type: "text/html" }), ext: "html" };
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
