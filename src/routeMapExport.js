// Route map export: one scene (routeMapScene.js), three writers. Loaded only when the user presses Export.
import { buildScene, W, PAL } from "./routeMapScene.js";
import { computeStats, greatCircleKm } from "./routeMapStats.js";
import { countryOf } from "./icaoCountries.js";
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

// The stats window's title (label and date range). Its numbers are drawn in the viewer from the flight list, so they follow the filters and timeline.
function panelHead(rows) {
  return `<div class="eb">${esc(rows[0].s)}</div><div class="dt">${esc(rows[1].s)}</div>`;
}

const palVars = p => `--ocean:${p.ocean};--land:${p.land};--border:${p.border};--grid:${p.grid};--ink:${p.ink};--ink2:${p.ink2};--dim:${p.dim};--plate:${p.plate};--line:${p.plateLine};--dot:${p.dot};--ring:${p.ring};--dep:rgb(${p.dep});--arr:rgb(${p.arr})`;

const VIEWER_CSS = `
*{box-sizing:border-box}html,body{margin:0;height:100%;background:var(--ocean);color:var(--ink);font-family:'Courier New',monospace;overflow:hidden}
#svg{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:grab;--s:1}#svg.drag{cursor:grabbing}
.land{fill:var(--land)}.coast{fill:none;stroke:var(--border);stroke-width:calc(.14px/var(--s));stroke-linejoin:round}
.bd{fill:none;stroke:var(--border);stroke-width:calc(.1px/var(--s))}.gr{fill:none;stroke:var(--grid);stroke-width:calc(.15px/var(--s))}
.rt{fill:none;stroke:color-mix(in srgb,var(--arr) calc(var(--u)*100%),var(--dep));stroke-linecap:round;stroke-linejoin:round;stroke-width:calc(var(--w)*1px/var(--s))}.rg{transition:opacity .15s}
.hit{fill:none;stroke:transparent;stroke-width:calc(3px/var(--s));pointer-events:stroke}
.ap{fill:var(--dot);stroke:var(--ring);stroke-width:calc(.25px/var(--s));r:calc(var(--r)*1px/var(--s));pointer-events:all}
#svg.hl .rg{opacity:.12}#svg.hl .rg.on{opacity:1}
.rg.off,.hit.off,.ap.off{display:none}#svg.dn .rt{stroke:var(--rc)!important}
.lb{fill:var(--ink);pointer-events:none;paint-order:stroke;stroke:var(--ocean);stroke-width:.25em;stroke-opacity:.55;stroke-linejoin:round}.lb.b{font-weight:700}
#plate{position:absolute;left:14px;bottom:14px;width:min(330px,calc(100vw - 28px));max-height:calc(100vh - 28px);overflow:auto;background:var(--plate);border:1px solid var(--line);padding:14px 16px;opacity:.94;font-size:12px}
#plate .eb{font-size:10px;letter-spacing:.22em;color:var(--line);font-weight:700}#plate .dt{font-size:16px;font-weight:700;margin:6px 0 4px}#plate .st{color:var(--ink2)}
#plate h4{margin:12px 0 4px;font-size:10px;letter-spacing:.2em;color:var(--dim)}
#plate .row{display:flex;justify-content:space-between;gap:10px;padding:1px 0}#plate .row span:last-child{color:var(--ink2);text-align:right}
#plate .num{display:flex;justify-content:space-between;align-items:baseline}#plate .num b{font-size:20px}#plate .num span{color:var(--ink2)}
#plate .bar{display:flex;height:6px;margin:4px 0}#plate .bar i{display:block}#plate .wr{color:var(--ink2);line-height:1.5}
#ph{position:relative;padding-right:22px;cursor:pointer}#ph:focus-visible{outline:1px solid var(--line);outline-offset:4px}
#pc{position:absolute;right:0;top:0;font-size:12px;color:var(--dim);transition:transform .15s}
#plate.min #pc{transform:rotate(180deg)}#plate.min #pb{display:none}
#plate .go{cursor:pointer}#plate .go:hover span:first-child{color:var(--line)}#plate .go:focus-visible{outline:1px solid var(--line)}
#tlrow{display:flex;align-items:center;gap:10px;margin-top:10px}#tlb{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
#tp{flex:none;width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:none;border:1px solid var(--line);color:var(--ink);cursor:pointer;padding:0}#tp:hover{color:var(--line)}
#tp .pa,#tp.on .pl{display:none}#tp.on .pa{display:block}
#ts{width:100%;margin:0;accent-color:var(--line)}#td{font-size:11px;color:var(--ink2)}
#svg.nolab #labels{display:none}#svg.nogrid .gr{display:none}
#sel{position:absolute;left:14px;top:14px;max-width:calc(100vw - 80px);max-height:38vh;overflow:auto;display:none;flex-direction:column;gap:6px;background:var(--plate);border:1px solid var(--line);padding:7px 8px 7px 11px;font-size:12px;opacity:.94}#sel b{color:var(--line)}
#selh{display:flex;align-items:center;justify-content:space-between;gap:10px}#sell:empty{display:none}
#sel .row{display:flex;justify-content:space-between;gap:14px;padding:1px 0;cursor:pointer}#sel .row span:last-child{color:var(--ink2);text-align:right}#sel .row:hover span:first-child{color:var(--line)}#sel .row:focus-visible{outline:1px solid var(--line)}
#sel button{background:none;border:0;color:var(--dim);font:700 16px 'Courier New',monospace;cursor:pointer;padding:0 4px;line-height:1}#sel button:hover{color:var(--ink)}
.lw{position:relative}.pop{display:none;position:absolute;right:42px;top:0;flex-direction:column;gap:6px;background:var(--plate);border:1px solid var(--line);padding:8px 12px;font-size:12px;width:max-content;max-width:min(280px,calc(100vw - 110px))}.pop.open{display:flex}
#lay label{display:flex;align-items:center;gap:8px;cursor:pointer}#lay input{accent-color:var(--line)}
#flt .fh{font-size:10px;letter-spacing:.2em;color:var(--dim);margin:4px 0 2px}
#flt .chips,#flt .seg{display:flex;flex-wrap:wrap;gap:4px}
#flt label{position:relative;cursor:pointer}#flt input{position:absolute;opacity:0;inset:0;margin:0;cursor:pointer}
#flt label span{display:block;border:1px solid var(--line);padding:2px 8px;color:var(--dim)}
#flt input:checked+span{color:var(--ink);background:color-mix(in srgb,var(--line) 28%,transparent)}#flt input:focus-visible+span{outline:1px solid var(--ink)}
#flt .key{display:flex;gap:12px;color:var(--ink2)}#flt .key i{display:inline-block;width:8px;height:8px;margin-right:5px}
#fsum{color:var(--ink2);line-height:1.5;padding-top:6px;border-top:1px solid var(--line)}#fsum small{color:var(--dim)}
#frs{color:var(--dim);cursor:pointer;text-decoration:underline;align-self:flex-start}#frs:hover{color:var(--ink)}#fb.act{color:var(--line)}
#btns .ic{display:flex;align-items:center;justify-content:center;padding:0}
#tip{position:absolute;pointer-events:none;background:var(--plate);border:1px solid var(--line);padding:6px 9px;font-size:12px;display:none;white-space:nowrap}#tip b{color:var(--line)}
#btns{position:absolute;right:14px;top:14px;display:flex;flex-direction:column;gap:6px}
#btns button{width:34px;height:34px;white-space:nowrap;background:var(--plate);border:1px solid var(--line);color:var(--ink);font:700 16px 'Courier New',monospace;cursor:pointer}#btns button:hover{color:var(--line)}
#credit{position:absolute;right:14px;bottom:8px;font-size:10px;color:var(--dim)}
@media(max-width:560px){#plate{font-size:11px;padding:10px 12px;max-height:46vh}}`;

// Runs in the saved file: pan, pinch and wheel zoom, hover details, labels that appear as there is room for them.
const VIEWER_JS = `
const svg=document.getElementById('svg'),lab=document.getElementById('labels'),tip=document.getElementById('tip');
const selEl=document.getElementById('sel'),selTx=document.getElementById('seltx'),sell=document.getElementById('sell'),lay=document.getElementById('lay');
let vb={x:0,y:0,w:W,h:H};const KMAX=40,NS='http://www.w3.org/2000/svg';
const els=LABELS.map(function(L){const t=document.createElementNS(NS,'text');t.textContent=L.s;t.setAttribute('class','lb'+(L.bold?' b':''));lab.appendChild(t);return t});
function aspect(){const r=svg.getBoundingClientRect();return r.width/r.height}
function fitW(){const a=aspect();return H*a>=W?H*a:W}
function clamp(){const a=aspect(),fw=fitW();vb.w=Math.min(Math.max(vb.w,fw/KMAX),fw);vb.h=vb.w/a;
  const mx=Math.max(0,(vb.w-W)/2);vb.x=Math.min(Math.max(vb.x,-mx),W-vb.w+mx);
  const my=Math.max(0,(vb.h-H)/2);vb.y=Math.min(Math.max(vb.y,-my),H-vb.h+my)}
function apply(){clamp();svg.setAttribute('viewBox',vb.x+' '+vb.y+' '+vb.w+' '+vb.h);const k=fitW()/vb.w;svg.style.setProperty('--s',Math.pow(k,.8));layout(k)}
function layout(k){const sc=1.35/k,boxes=[];
  LABELS.forEach(function(L,i){const e=els[i],fs=L.fs*sc,w=L.s.length*fs*.62,h=fs*.8,g=L.r/Math.pow(k,.8)+.6*sc;e.style.display='none';if(L.on===false)return;
    if(L.x<vb.x-5||L.x>vb.x+vb.w+5||L.y<vb.y-5||L.y>vb.y+vb.h+5)return;
    const cand=[[g,-g*.2],[-w-g,-g*.2],[-w/2,-g-h],[-w/2,g],[g,-g-h],[-w-g,-g-h],[g,g],[-w-g,g]];
    for(let c=0;c<cand.length;c++){const b={x:L.x+cand[c][0],y:L.y+cand[c][1],w:w,h:h};
      if(!boxes.some(function(o){return b.x<o.x+o.w&&b.x+b.w>o.x&&b.y<o.y+o.h&&b.y+b.h>o.y})){boxes.push(b);
        e.setAttribute('x',b.x);e.setAttribute('y',b.y+h*.88);e.style.fontSize=fs+'px';e.style.display='';return}}})}
function pt(cx,cy){const p=svg.createSVGPoint();p.x=cx;p.y=cy;return p.matrixTransform(svg.getScreenCTM().inverse())}
function zoomAt(cx,cy,f){const p=pt(cx,cy),nw=vb.w/f,r=nw/vb.w;vb.x=p.x-(p.x-vb.x)*r;vb.y=p.y-(p.y-vb.y)*r;vb.w=nw;apply()}
svg.addEventListener('wheel',function(e){e.preventDefault();zoomAt(e.clientX,e.clientY,Math.exp(-e.deltaY*(e.ctrlKey?.01:.0018)))},{passive:false});
const ptrs=new Map();let last=0,down=null;
svg.addEventListener('pointerdown',function(e){svg.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});svg.classList.add('drag');last=0;
  down=ptrs.size===1?{x:e.clientX,y:e.clientY,t:e.target}:null});
svg.addEventListener('pointermove',function(e){const p=ptrs.get(e.pointerId);if(!p){hover(e);return}
  const ox=p.x,oy=p.y;p.x=e.clientX;p.y=e.clientY;
  if(ptrs.size===1){const r=svg.getBoundingClientRect(),u=vb.w/r.width;vb.x-=(p.x-ox)*u;vb.y-=(p.y-oy)*u;apply()}
  else if(ptrs.size===2){const v=Array.from(ptrs.values()),d=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y);if(last)zoomAt((v[0].x+v[1].x)/2,(v[0].y+v[1].y)/2,d/last);last=d}});
function up(e){if(e.type==='pointerup'&&down&&ptrs.size===1&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<6){select(describe(down.t));closePops()}
  down=null;ptrs.delete(e.pointerId);if(!ptrs.size)svg.classList.remove('drag');last=0}
svg.addEventListener('pointerup',up);svg.addEventListener('pointercancel',up);
let selK=null,R={},A={},maxC=1,maxA=1;
function nfm(n){return Math.round(n).toLocaleString('en-GB')}
function hm(m){return nfm(Math.floor(m/60))+' h '+String(m%60).padStart(2,'0')+' min'}
function E(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')}
function plural(n,w){return n+' '+w+(n===1?'':'s')}
// R: filtered flights per route {c: count, d: day mins, t: night mins}; A: movements per airport. Both come from FL, when the file has it.
function dk(k){
  if(k.k==='a'){const n=A[k.id]||0;if(FL&&!n)return null;
    const list=FL?Object.keys(R).filter(function(x){return x.split('-').indexOf(k.id)>-1}).sort(function(a,b){return R[b].c-R[a].c||R[b].d+R[b].t-R[a].d-R[a].t}).map(function(x){const r=R[x];
      return '<div class="row go2" data-r="'+x+'" role="button" tabindex="0"><span>'+x.replace('-',' - ')+'</span><span>'+plural(r.c,'flight')+' &middot; '+hm(r.d+r.t)+'</span></div>'}).join(''):'';
    return{k:k,html:'<b>'+k.id+'</b>'+(FL?' &middot; '+plural(n,'movement'):''),list:list}}
  const r=R[k.id];if(FL&&!r)return null;
  return{k:k,html:'<b>'+k.id.replace('-',' - ')+'</b>'+(FL?' &middot; '+plural(r.c,'flight')+' &middot; '+hm(r.d+r.t):''),list:''}}
function describe(t){if(!t||!t.dataset)return null;
  if(t.dataset.a)return dk({k:'a',id:t.dataset.a});
  if(t.dataset.r&&t.classList.contains('hit'))return dk({k:'r',id:t.dataset.r});
  return null}
function setHl(k){svg.classList.toggle('hl',!!k);
  svg.querySelectorAll('.rg').forEach(function(n){const id=n.dataset.r;n.classList.toggle('on',!!k&&(k.k==='r'?id===k.id:id.split('-').indexOf(k.id)>-1))})}
function select(d){selK=d?d.k:null;setHl(selK);selEl.style.display=d?'flex':'none';if(d){selTx.innerHTML=d.html;sell.innerHTML=d.list}}
function hover(e){if(e.pointerType==='touch')return;const d=describe(e.target);
  setHl((d&&d.k.k==='r'?d.k:null)||selK);
  if(d){tip.innerHTML=d.html;tip.style.display='block';tip.style.left=Math.min(e.clientX+14,innerWidth-tip.offsetWidth-8)+'px';tip.style.top=Math.max(8,e.clientY-34)+'px'}else tip.style.display='none'}
svg.addEventListener('pointerleave',function(){tip.style.display='none';setHl(selK)});
function mid(){const r=svg.getBoundingClientRect();return[r.left+r.width/2,r.top+r.height/2]}
document.getElementById('zi').onclick=function(){const m=mid();zoomAt(m[0],m[1],1.6)};
document.getElementById('zo').onclick=function(){const m=mid();zoomAt(m[0],m[1],1/1.6)};
function fit(){vb={x:0,y:0,w:W,h:H};apply()}
document.getElementById('zf').onclick=fit;
function fitRoute(key){const b=RB[key];if(!b)return;const a=aspect(),bw=b[2]-b[0],bh=b[3]-b[1];
  vb.w=Math.max(bw*1.35,bh*1.35*a);vb.h=vb.w/a;vb.x=(b[0]+b[2])/2-vb.w/2;vb.y=(b[1]+b[3])/2-vb.h/2;apply()}
function goRoute(key){fitRoute(key);select(dk({k:'r',id:key}))}
document.getElementById('selx').onclick=function(){select(null)};
selEl.addEventListener('click',function(e){const row=e.target.closest('.go2');if(row)goRoute(row.dataset.r)});
selEl.addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('go2')){e.preventDefault();goRoute(e.target.dataset.r)}});
function closePops(){document.querySelectorAll('.pop').forEach(function(n){n.classList.remove('open')})}
function pop(p){const o=!p.classList.contains('open');closePops();if(o)p.classList.add('open')}
document.getElementById('lb').onclick=function(){pop(lay)};
document.getElementById('tl').onchange=function(){svg.classList.toggle('nolab',!this.checked)};
document.getElementById('tg').onchange=function(){svg.classList.toggle('nogrid',!this.checked)};
const fs=document.getElementById('fs');
if(document.fullscreenEnabled)fs.onclick=function(){if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen()};else fs.style.display='none';
addEventListener('keydown',function(e){if(e.ctrlKey||e.metaKey||e.altKey)return;const k=e.key,m=mid();
  if(k==='+'||k==='=')zoomAt(m[0],m[1],1.6);else if(k==='-'||k==='_')zoomAt(m[0],m[1],1/1.6);else if(k==='0')fit();
  else if(k.indexOf('Arrow')===0&&e.target.tagName!=='INPUT'){e.preventDefault();const s=vb.w*.1;vb.x+=k==='ArrowLeft'?-s:k==='ArrowRight'?s:0;vb.y+=k==='ArrowUp'?-s:k==='ArrowDown'?s:0;apply()}
  else if(k==='Escape'){select(null);closePops()}});
const plate=document.getElementById('plate');
if(plate){const ph=document.getElementById('ph');
  function tgl(){const m=plate.classList.toggle('min');ph.setAttribute('aria-expanded',String(!m))}
  const narrow=function(){return matchMedia('(max-width:560px)').matches};
  ph.onclick=tgl;ph.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();tgl()}};
  function go(n){goRoute(n.dataset.r);if(narrow()&&!plate.classList.contains('min'))tgl()}
  const pb=document.getElementById('pb');
  pb.addEventListener('click',function(e){const n=e.target.closest('.go');if(n)go(n)});
  pb.addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('go')){e.preventDefault();go(e.target)}});
  if(narrow())tgl()}
document.getElementById('th').onclick=function(){const r=document.documentElement;r.dataset.theme=r.dataset.theme==='light'?'dark':'light'};
// Filters, timeline and the stats window's numbers: only in files made with stats, which carry
// FL = [routeKey, aircraft type, day mins, night mins, day number (UTC), km] per flight, and AC = country per airport.
if(FL){
  const ST={ty:null,tm:'all',dn:false,cut:null},fb=document.getElementById('fb'),ft=document.getElementById('ft'),flt=document.getElementById('flt'),sum=document.getElementById('fsum');
  const mins={};FL.forEach(function(f){mins[f[1]]=(mins[f[1]]||0)+f[2]+f[3]});
  const types=Object.keys(mins).sort(function(a,b){return mins[b]-mins[a]});
  types.forEach(function(t){const l=document.createElement('label'),i=document.createElement('input'),s=document.createElement('span');
    i.type='checkbox';i.checked=true;i.value=t;s.textContent=t||'No type';l.appendChild(i);l.appendChild(s);ft.appendChild(l)});
  if(types.length<2)document.getElementById('fa').style.display='none';
  const HINT='<div class="st" style="margin-top:10px;color:var(--dim);font-size:10.5px">Scroll or pinch to zoom, drag to pan. Hover or tap a route or airport for details.</div>';
  const pcn=document.getElementById('pcn'),pb=document.getElementById('pb');
  function row(a,b){return '<div class="row"><span>'+a+'</span><span>'+b+'</span></div>'}
  function drawPlate(S){const rk=Object.keys(R),ak=Object.keys(A);
    pcn.textContent=plural(S.nf,'flight')+'  |  '+plural(rk.length,'route')+'  |  '+plural(ak.length,'airport');
    if(!S.nf){pb.innerHTML='<div class="st" style="margin-top:10px">No flights match.</div>'+HINT;return}
    const cs={};ak.forEach(function(a){if(AC[a])cs[AC[a]]=1});const cl=Object.keys(cs).sort();
    const top=ak.slice().sort(function(a,b){return A[b]-A[a]})[0];
    let h='<h4>FLIGHT TIME</h4><div class="num"><b>'+hm(S.dm+S.nm)+'</b><span>total</span></div>'
      +'<div class="bar"><i style="flex:'+S.dm+';background:#f5c542"></i><i style="flex:'+S.nm+';background:#3B8DFF"></i></div>'+row('Day '+nfm(S.dm/60)+' h','Night '+nfm(S.nm/60)+' h')
      +'<h4>DISTANCE (APPROX., GREAT-CIRCLE)</h4><div class="num"><b>'+nfm(S.km/1.852)+' nm</b><span>'+nfm(S.km)+' km</span></div>'
      +row('Longest route  '+S.lg.key.replace('-',' - '),nfm(S.lg.km/1.852)+' nm')+row('Busiest airport  '+top,plural(A[top],'movement'));
    if(cl.length)h+='<h4>COUNTRIES VISITED  '+cl.length+'</h4><div class="wr">'+E(cl.join(', '))+'</div>';
    h+='<h4>MOST FLOWN</h4>'+rk.sort(function(a,b){return R[b].c-R[a].c||R[b].d+R[b].t-R[a].d-R[a].t}).slice(0,6).map(function(k){const r=R[k];
      return '<div class="row go" data-r="'+k+'" role="button" tabindex="0" title="Zoom to this route"><span>'+k.replace('-',' - ')+'</span><span>'+plural(r.c,'flight')+'  '+nfm(Math.floor((r.d+r.t)/60))+' h</span></div>'}).join('');
    const tk=Object.keys(S.ty).filter(function(t){return S.ty[t]>0}).sort(function(a,b){return S.ty[b]-S.ty[a]});
    if(tk.length)h+='<h4>AIRCRAFT TYPES</h4>'+tk.map(function(t){return row(E(t),nfm(Math.round(S.ty[t]/60))+' h')}).join('');
    pb.innerHTML=h+HINT}
  // timeline: show the flights up to a date; play runs it from the first date to the last in about 8 seconds
  const tr=document.getElementById('tlrow'),ts=document.getElementById('ts'),td=document.getElementById('td'),tp=document.getElementById('tp');
  const days=FL.map(function(f){return f[4]}).filter(function(d){return d!=null});
  const d0=days.length?days.reduce(function(a,b){return Math.min(a,b)}):0,d1=days.length?days.reduce(function(a,b){return Math.max(a,b)}):0;
  function dayName(n){return new Date(n*864e5).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).toUpperCase()}
  let tmr=null;
  function stop(){if(tmr){clearInterval(tmr);tmr=null}tp.classList.remove('on');tp.setAttribute('aria-label','Play timeline')}
  function setCut(v){ST.cut=v;ts.value=v;td.textContent='UP TO '+dayName(v);recompute()}
  if(d1>d0){ts.min=d0;ts.max=d1;ts.step=1;ts.value=d1;td.textContent='UP TO '+dayName(d1);
    ts.oninput=function(){stop();setCut(+ts.value)};
    tp.onclick=function(){if(tmr){stop();return}
      let pos=+ts.value>=d1?d0:+ts.value;const step=Math.max(.05,(d1-d0)/100);
      tp.classList.add('on');tp.setAttribute('aria-label','Pause timeline');setCut(Math.round(pos));
      tmr=setInterval(function(){pos+=step;if(pos>=d1){pos=d1;stop()}const v=Math.round(pos);if(v!==ST.cut)setCut(v)},80)}}
  else tr.style.display='none';
  function passes(f){return(!ST.ty||ST.ty.has(f[1]))&&(ST.tm==='all'||(ST.tm==='day'?f[2]>0:f[3]>0))&&(ST.cut==null||f[4]==null||f[4]<=ST.cut)}
  function recompute(){R={};A={};let nf=0,dm=0,nm=0,km=0,lg=null;const ty={};maxC=1;maxA=1;
    FL.forEach(function(f){if(!passes(f))return;nf++;dm+=f[2];nm+=f[3];km+=f[5];if(!lg||f[5]>lg.km)lg={km:f[5],key:f[0]};if(f[1])ty[f[1]]=(ty[f[1]]||0)+f[2]+f[3];
      const r=R[f[0]]||(R[f[0]]={c:0,d:0,t:0});r.c++;r.d+=f[2];r.t+=f[3];f[0].split('-').forEach(function(a){A[a]=(A[a]||0)+1})});
    Object.keys(R).forEach(function(k){maxC=Math.max(maxC,R[k].c)});Object.keys(A).forEach(function(k){maxA=Math.max(maxA,A[k])});
    svg.querySelectorAll('.rg').forEach(function(g){const r=R[g.dataset.r];g.classList.toggle('off',!r);if(!r)return;
      const tot=r.d+r.t,q=tot?r.t/tot:0;
      g.style.setProperty('--w',(.22+.95*Math.sqrt(r.c/maxC)).toFixed(3));
      g.style.setProperty('--rc',tot?'rgb('+Math.round(245-186*q)+','+Math.round(197-56*q)+','+Math.round(66+189*q)+')':'var(--dim)')});
    svg.querySelectorAll('.hit').forEach(function(h){h.classList.toggle('off',!R[h.dataset.r])});
    svg.querySelectorAll('.ap').forEach(function(c){const n=A[c.dataset.a]||0;c.classList.toggle('off',!n);if(n)c.style.setProperty('--r',(.7+2.3*Math.sqrt(n/maxA)).toFixed(3))});
    LABELS.forEach(function(L,i){const n=A[L.s]||0;L.on=n>0;L.r=.7+2.3*Math.sqrt(n/maxA);L.fs=n>100?3.6:n>25?2.7:2.2;L.bold=n>25;els[i].setAttribute('class','lb'+(L.bold?' b':''))});
    svg.classList.toggle('dn',ST.dn);document.getElementById('fk').style.display=ST.dn?'flex':'none';
    fb.classList.toggle('act',!!ST.ty||ST.tm!=='all'||ST.dn);
    sum.innerHTML=nf+' of '+FL.length+' flights &middot; '+hm(dm+nm)+'<br>Day '+(dm/60).toFixed(1)+' h &middot; Night '+(nm/60).toFixed(1)+' h';
    drawPlate({nf:nf,dm:dm,nm:nm,km:km,lg:lg,ty:ty});
    if(selK)select(dk(selK));
    apply()}
  function readUi(){const on=[].filter.call(ft.querySelectorAll('input'),function(b){return b.checked});
    ST.ty=on.length===types.length?null:new Set(on.map(function(b){return b.value}));
    ST.tm=flt.querySelector('input[name=tm]:checked').value;ST.dn=flt.querySelector('input[name=cm]:checked').value==='dn';recompute()}
  function reset(){ft.querySelectorAll('input').forEach(function(b){b.checked=true});
    flt.querySelector('input[name=tm][value=all]').checked=true;flt.querySelector('input[name=cm][value=route]').checked=true;readUi()}
  flt.addEventListener('change',readUi);fb.onclick=function(){pop(flt)};
  const frs=document.getElementById('frs');frs.onclick=reset;frs.onkeydown=function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();reset()}};
  recompute()}
addEventListener('resize',apply);apply();`;

function buildHtml(scene, flights) {
  const showNums = !!scene.stats;
  const groups = new Map(), parts = [];
  for (const i of scene.items.slice(0, scene.items.plateFrom)) {
    if (i.t === "poly") parts.push(`<polygon class="${i.fill ? "land" : "coast"}" points="${pts2(i.pts)}"/>`);
    else if (i.t === "line" && i.route) {
      if (!groups.has(i.route)) { groups.set(i.route, { w: i.sw, list: [] }); parts.push("@@" + i.route + "@@"); }
      groups.get(i.route).list.push(`<polyline class="rt" style="--u:${+i.u.toFixed(3)}" points="${pts2(i.pts)}"/>`);
    } else if (i.t === "line") parts.push(`<polyline class="${i.sw === 0.1 ? "bd" : "gr"}" points="${pts2(i.pts)}"/>`);
    else if (i.t === "circle") parts.push(`<circle class="ap" data-a="${i.ap}" cx="${f2(i.x)}" cy="${f2(i.y)}" style="--r:${f2(i.r)}"/>`);
  }
  for (const [key, g] of groups) parts[parts.indexOf("@@" + key + "@@")] = `<g class="rg" data-r="${key}" style="--w:${f2(g.w)}">${g.list.join("")}</g>`;
  const hits = scene.routes.map(r => `<polyline class="hit" data-r="${r.key}" points="${pts2(r.pts)}"/>`).join("");
  const labels = scene.labels.map(l => ({ s: l.s, x: f2(l.x), y: f2(l.y), fs: l.fs, bold: l.bold, r: f2(l.r) }));
  // One entry per flight, so the viewer can filter, play a timeline and work out the stats itself. Same route key as the scene's.
  const FL = showNums ? flights.map(f => [
    f.dep < f.arr ? f.dep + "-" + f.arr : f.arr + "-" + f.dep, (f.type || "").trim().toUpperCase(), f.dayMins, f.nightMins,
    f.date ? Math.floor(Date.parse(f.date + "T00:00:00Z") / 864e5) : null, Math.round(greatCircleKm(f.from, f.to)),
  ]) : null;
  const AC = {};
  if (showNums) for (const f of flights) for (const code of [f.dep, f.arr]) { const k = countryOf(code); if (k) AC[code] = k; }
  // bounding box per route, so a click on a "Most flown" row can zoom to it
  const RB = Object.fromEntries(scene.routes.map(r => {
    const xs = r.pts.map(p => p[0]), ys = r.pts.map(p => p[1]);
    return [r.key, [f2(Math.min(...xs)), f2(Math.min(...ys)), f2(Math.max(...xs)), f2(Math.max(...ys))]];
  }));
  const json = v => JSON.stringify(v).replace(/</g, "\\u003c");
  // both palettes ship in the file, the light/dark button just flips data-theme
  const vars = `:root{${palVars(PAL.dark)};color-scheme:dark}:root[data-theme="light"]{${palVars(PAL.light)};color-scheme:light}`;
  return `<!doctype html><html lang="en" data-theme="${scene.theme === "light" ? "light" : "dark"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Route map</title><style>${vars}${VIEWER_CSS}</style></head><body>
<svg id="svg" viewBox="0 0 ${scene.W} ${f2(scene.H)}" preserveAspectRatio="xMidYMid meet"><g id="world">${parts.join("")}${hits}</g><g id="labels"></g></svg>
${scene.rows ? `<div id="plate"><div id="ph" role="button" tabindex="0" aria-expanded="true" aria-controls="pb" title="Show or hide stats">${panelHead(scene.rows)}<div class="st" id="pcn"></div><span id="pc" aria-hidden="true">&#9662;</span></div>
<div id="tlrow"><button id="tp" aria-label="Play timeline"><svg class="pl" width="10" height="10" viewBox="0 0 10 10"><path d="M2 1l7 4-7 4z" fill="currentColor"/></svg><svg class="pa" width="10" height="10" viewBox="0 0 10 10"><path d="M2 1h2v8H2zM6 1h2v8H6z" fill="currentColor"/></svg></button><div id="tlb"><input type="range" id="ts" aria-label="Show flights up to this date"><div id="td"></div></div></div>
<div id="pb"></div></div>` : ""}
<div id="sel"><div id="selh"><span id="seltx"></span><button id="selx" aria-label="Clear selection">&times;</button></div><div id="sell"></div></div>
<div id="btns"><button id="zi" aria-label="Zoom in">+</button><button id="zo" aria-label="Zoom out">-</button><button id="zf" aria-label="Fit all routes" style="font-size:10px">FIT</button>
<button id="th" class="ic" aria-label="Switch light or dark map"><svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7 1.5a5.5 5.5 0 0 1 0 11z" fill="currentColor"/></svg></button>
<button id="fs" class="ic" aria-label="Full screen"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9"/></svg></button>
<div class="lw"><button id="lb" class="ic" aria-label="Map layers"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M7 1.5 1.5 4.5 7 7.5l5.5-3zM1.5 7 7 10l5.5-3M1.5 9.5 7 12.5l5.5-3"/></svg></button>
<div id="lay" class="pop"><label><input type="checkbox" id="tl" checked>Labels</label><label><input type="checkbox" id="tg" checked>Grid</label></div></div>
${showNums ? `<div class="lw"><button id="fb" class="ic" aria-label="Filters"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M1.5 2h11L8.5 7v4.5l-3 1.5V7z"/></svg></button>
<div id="flt" class="pop"><div id="fa"><div class="fh">AIRCRAFT</div><div class="chips" id="ft"></div></div>
<div class="fh">TIME FLOWN</div><div class="seg"><label><input type="radio" name="tm" value="all" checked><span>All</span></label><label><input type="radio" name="tm" value="day"><span>Has day</span></label><label><input type="radio" name="tm" value="night"><span>Has night</span></label></div>
<div class="fh">ROUTE COLOUR</div><div class="seg"><label><input type="radio" name="cm" value="route" checked><span>Route fade</span></label><label><input type="radio" name="cm" value="dn"><span>Day / night</span></label></div>
<div class="key" id="fk" style="display:none"><span><i style="background:#f5c542"></i>Day</span><span><i style="background:#3B8DFF"></i>Night</span></div>
<div id="fsum"></div><span id="frs" role="button" tabindex="0">Reset filters</span></div></div>` : ""}</div>
<div id="tip"></div><div id="credit">Natural Earth via world-atlas (50 m)</div>
<script>const W=${scene.W},H=${f2(scene.H)},LABELS=${json(labels)},FL=${json(FL)},AC=${json(AC)},RB=${json(RB)};${VIEWER_JS}</script></body></html>`;
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
  return { blob: new Blob([buildHtml(scene, flights)], { type: "text/html" }), ext: "html" };
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
