import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { feature } from "topojson-client";
import landTopology from "world-atlas/land-110m.json";
import { getCoords } from "./airportCoords";
import { parseHHMM } from "./logbookCalculations";
import { useExitAnim } from "./useExitAnim";
import { useEscClose } from "./useEscClose";
import { useScrollLock } from "./useScrollLock";
import ChamferFrame from "@brand/ChamferFrame";

// Modal chrome follows the app theme variables (dark fallbacks match the old values).
const THEME = {
  bg: "var(--elb-bg, #0a0d12)",
  bgInput: "var(--elb-bginput, #0b1828)",
  border: "var(--elb-border, #1e3a5f)",
  text: "var(--elb-txt, #ffffff)",
  textMuted: "var(--elb-txt-muted, #b8d6e5)",
};

const MINT = "#3FE0C5";
const MINT_LIGHT = "#0b8a78";  // readable on white
const FONT_DISPLAY = "'Tourney', system-ui, sans-serif";

// Map-area colors the CSS variables can't reach (vector basemap, canvas, markers).
const MAP_COLORS = {
  dark:  { ocean: "#060a10", landFill: "#16263b", landStroke: "#2a4a6a", dotRing: "#3FE0C5" },
  light: { ocean: "#d6dde3", landFill: "#f3f4f6", landStroke: "#b9c3cf", dotRing: "#0b6b5d" },
};
const ROUTE_COLOR_DEP = [236, 72, 153];  // #ec4899 magenta — departure end
const ROUTE_COLOR_ARR = { dark: [250, 204, 21], light: [245, 158, 11] };  // yellow / amber (yellow washes out on light maps)

const BASEMAPS = {
  carto:  { label: "CARTO DARK", type: "tile",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=cb1_3i3x_1_c753f0b8edbf6bd3a0226da6",
    subdomains: "abcd", maxZoom: 19, attribution: "© OpenStreetMap, © CARTO" },
  cartoLight: { label: "CARTO LIGHT", type: "tile",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_3i3x_1_c753f0b8edbf6bd3a0226da6",
    subdomains: "abcd", maxZoom: 19, attribution: "© OpenStreetMap, © CARTO" },
  cartoVector: { label: "CARTO VECTOR", type: "maplibre",
    styleUrl: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    attribution: "© OpenStreetMap, © CARTO" },
  stadia: { label: "STADIA DARK", type: "tile",
    url: "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
    maxZoom: 20, attribution: "© Stadia Maps, © OpenMapTiles, © OpenStreetMap" },
  esri:   { label: "SATELLITE (ESRI)", type: "tile",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19, attribution: "© Esri" },
  vector: { label: "VECTOR (NO WATERMARK)", type: "vector" },
};

// MapLibre (needed only for the CARTO Vector basemap) adds ~900KB to the
// bundle, so it's loaded on demand instead of bundled into the main chunk.
let maplibreGLPromise = null;
function loadMaplibreGL() {
  if (!maplibreGLPromise) {
    maplibreGLPromise = Promise.all([
      import("maplibre-gl"),
      import("maplibre-gl/dist/maplibre-gl.css"),
      import("@maplibre/maplibre-gl-leaflet"),
    ]).then(([{ setWorkerUrl }, , { maplibreGL }]) => {
      // Vite's dev-server transform injects an HMR-client import into every
      // module it serves, including maplibre-gl's own worker bundle — which
      // throws inside a Worker's global scope (no `document`). Point at a
      // plain static copy of the same file (see vite.config.js) so it's
      // served untouched instead.
      setWorkerUrl("/maplibre-gl-worker.mjs");
      return maplibreGL;
    });
  }
  return maplibreGLPromise;
}

// Leaflet draws straight pixel lines between consecutive ring points — it
// doesn't know a ring crosses the antimeridian. Natural Earth's land-110m
// has a few rings that do (Russia's Chukotka peninsula, Antarctica's wrap),
// which otherwise render as a long straight band cutting across the map.
// Unwrapping keeps each ring's longitudes continuous (e.g. 179 -> 181
// instead of 179 -> -179) so Leaflet draws the true shape instead of a cut.
function unwrapAntimeridian(geojson) {
  const unwrapRing = ring => {
    let prevLon = ring[0][0];
    const unwrapped = ring.map(([lon, lat], i) => {
      if (i === 0) return [lon, lat];
      let d = lon - prevLon;
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      prevLon += d;
      return [prevLon, lat];
    });
    // A single crossing shifts the *rest* of the ring by a full 360°, even
    // though the ring as a whole doesn't need it (e.g. Eurasia's coastline
    // touches the antimeridian once near Siberia, then the unwrap carries
    // that -360 offset through the rest of Europe/Asia). Re-center the whole
    // ring back onto its natural range so it lands where it actually is.
    const avgLon = unwrapped.reduce((s, p) => s + p[0], 0) / unwrapped.length;
    const shift = Math.round(avgLon / 360) * 360;
    return shift ? unwrapped.map(([lon, lat]) => [lon - shift, lat]) : unwrapped;
  };
  geojson.features.forEach(f => {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    f.geometry.coordinates = f.geometry.type === "Polygon"
      ? polys[0].map(unwrapRing)
      : polys.map(rings => rings.map(unwrapRing));
  });
  return geojson;
}

function lerpColor(t, arr) {
  const r = Math.round(ROUTE_COLOR_DEP[0] + (arr[0] - ROUTE_COLOR_DEP[0]) * t);
  const g = Math.round(ROUTE_COLOR_DEP[1] + (arr[1] - ROUTE_COLOR_DEP[1]) * t);
  const b = Math.round(ROUTE_COLOR_DEP[2] + (arr[2] - ROUTE_COLOR_DEP[2]) * t);
  return `rgb(${r},${g},${b})`;
}

// Draws every route as one smooth gradient stroke on its own canvas. Leaflet's
// own polylines round each vertex to a whole pixel, which makes zoomed-out
// routes (short on-screen segments) look squiggly; projecting here keeps
// sub-pixel precision. The canvas is hidden during zoom animation and
// redrawn at zoomend.
const RouteLayer = L.Layer.extend({
  initialize(routes, arrColor) { this._routes = routes; this._arr = arrColor; },
  onAdd(map) {
    this._canvas = L.DomUtil.create("canvas", "", map.getPane("routesPane"));
    this._canvas.style.pointerEvents = "none";
    map.on("moveend zoomend resize", this._draw, this);
    map.on("zoomstart", this._hide, this);
    this._draw();
  },
  onRemove(map) {
    map.off("moveend zoomend resize", this._draw, this);
    map.off("zoomstart", this._hide, this);
    L.DomUtil.remove(this._canvas);
  },
  _hide() { this._canvas.style.visibility = "hidden"; },
  _draw() {
    const map = this._map, canvas = this._canvas;
    // Draw at 2x the device resolution; the browser downsamples it, which
    // anti-aliases the diagonal edges far better than a 1:1 canvas can.
    const size = map.getSize(), dpr = 2 * (window.devicePixelRatio || 1);
    const origin = map.getPixelBounds().min, zoom = map.getZoom();
    L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
    canvas.width = size.x * dpr;
    canvas.height = size.y * dpr;
    canvas.style.width = size.x + "px";
    canvas.style.height = size.y + "px";
    canvas.style.visibility = "visible";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    this._routes.forEach(pts => {
      const xy = pts.map(([lat, lon]) => map.project([lat, lon], zoom)._subtract(origin));
      const a = xy[0], b = xy[xy.length - 1];
      if (Math.hypot(b.x - a.x, b.y - a.y) < 1) {
        ctx.strokeStyle = lerpColor(0.5, this._arr);
      } else {
        const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        g.addColorStop(0, lerpColor(0, this._arr));
        g.addColorStop(1, lerpColor(1, this._arr));
        ctx.strokeStyle = g;
      }
      ctx.beginPath();
      xy.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
    });
  },
});

// Spherical interpolation between two lat/lon points — same slerp math used
// for day/night route shading (ELogbook.jsx calcDayNightRoute).
function greatCirclePoints(lat1, lon1, lat2, lon2, n = 256) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;
  const φ1 = toRad(lat1), λ1 = toRad(lon1), φ2 = toRad(lat2), λ2 = toRad(lon2);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2
  ));
  if (d < 1e-9) return [[lat1, lon1]];
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    pts.push([toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))]);
  }
  return pts;
}

// Mirrors the date-range row matching in ExportImportModal.getRowsInDateRange.
// Returns a UTC-midnight Date for a row, or null if its date can't be read.
function parseRowDate(row, keyMonthIdx, keyYear) {
  if (typeof row.date === "string" && row.date.includes("/")) {
    const parts = row.date.split("/");
    if (parts.length === 3) {
      return new Date(`${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}T00:00:00Z`);
    }
    if (parts.length !== 2) return null;
  }
  const day = parseInt(row.date);
  if (!day || isNaN(day)) return null;
  return new Date(`${keyYear}-${String(keyMonthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00Z`);
}

// Each match keeps its row, month and year so the export can work out hours from it.
function getSectorsInRange(monthData, dateFrom, dateTo) {
  if (!dateFrom || !dateTo || !monthData || typeof monthData !== "object") return [];
  const fromDate = new Date(dateFrom + "T00:00:00Z");
  const toDate = new Date(dateTo + "T23:59:59Z");
  const sectors = [];

  Object.entries(monthData).forEach(([key, monthRows]) => {
    if (!Array.isArray(monthRows)) return;
    const [monthIdxStr, yearStr] = key.split("-");
    const keyMonthIdx = parseInt(monthIdxStr);
    const keyYear = parseInt(yearStr);

    monthRows.forEach(row => {
      if (!row || !row.date || !row.departure || !row.arrival) return;
      const rowDate = parseRowDate(row, keyMonthIdx, keyYear);
      if (rowDate && rowDate >= fromDate && rowDate <= toDate) {
        sectors.push({ departure: row.departure, arrival: row.arrival, row, year: keyYear, monthIdx: keyMonthIdx, date: rowDate.toISOString().slice(0, 10) });
      }
    });
  });

  return sectors;
}

// Earliest flight date (YYYY-MM-DD) with a route logged, or null if none.
function getEarliestDate(monthData) {
  if (!monthData || typeof monthData !== "object") return null;
  let earliest = null;
  Object.entries(monthData).forEach(([key, monthRows]) => {
    if (!Array.isArray(monthRows)) return;
    const [monthIdxStr, yearStr] = key.split("-");
    monthRows.forEach(row => {
      if (!row || !row.date || !row.departure || !row.arrival) return;
      const rowDate = parseRowDate(row, parseInt(monthIdxStr), parseInt(yearStr));
      if (rowDate && (!earliest || rowDate < earliest)) earliest = rowDate;
    });
  });
  return earliest ? earliest.toISOString().split("T")[0] : null;
}

// The flights the export draws: only those whose airports are both known, with day and night minutes from the logbook's own calculation.
function toExportFlights(sectors, computeFlightTimes) {
  const mins = (ft, keys) => keys.reduce((t, k) => t + parseHHMM(ft[k] || ""), 0);
  return sectors.flatMap(s => {
    const from = getCoords(s.departure), to = getCoords(s.arrival);
    if (!from || !to) return [];
    const ft = computeFlightTimes ? computeFlightTimes(s.row, s.year, s.monthIdx) : {};
    return [{
      dep: s.departure.toUpperCase().trim(), arr: s.arrival.toUpperCase().trim(), from, to, date: s.date, type: s.row.type,
      dayMins: mins(ft, ["dayP1", "dayP1US", "dayP2"]), nightMins: mins(ft, ["nightP1", "nightP1US", "nightP2"]),
    }];
  });
}

const EXPORT_KINDS = [["image", "Image"], ["pdf", "PDF"], ["html", "Interactive"]];
const IMAGE_SIZE_OPTIONS = [["wide", "Wide 16:9"], ["square", "Square 1:1"], ["portrait", "Portrait 4:5"]];
const PAPER_OPTIONS = [["a4", "A4"], ["a3", "A3"], ["letter", "US Letter"]];
const ORIENT_OPTIONS = [["landscape", "Landscape"], ["portrait", "Portrait"]];

export default function RouteMapModal({ open, onClose, monthData, theme = "dark", computeFlightTimes }) {
  const isLight = theme === "light";
  const mapColors = MAP_COLORS[isLight ? "light" : "dark"];
  const accent = isLight ? MINT_LIGHT : MINT;
  // `mounted` outlives `open` while the exit animation plays; the map lives
  // for that whole window so it doesn't blank out mid-fade.
  const { mounted, closing } = useExitAnim(open);
  useScrollLock(mounted);
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const baseLayerRef = useRef(null);
  const routeLayerRef = useRef(null);
  const attributionRef = useRef(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // Online: CARTO for the current theme. Offline: the bundled vector outline, since tiles can't load.
  const defaultBasemap = () => !navigator.onLine ? "vector" : isLight ? "cartoLight" : "carto";
  const [basemap, setBasemap] = useState(defaultBasemap);
  const [exportKind, setExportKind] = useState("image");
  const [imageSize, setImageSize] = useState("wide");
  const [paper, setPaper] = useState("a4");
  const [orient, setOrient] = useState("landscape");
  const [showStats, setShowStats] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia("(max-width: 520px)").matches);

  useEffect(() => {
    const mqNarrow = window.matchMedia("(max-width: 520px)");
    const onNarrow = e => setIsNarrow(e.matches);
    mqNarrow.addEventListener("change", onNarrow);
    return () => {
      mqNarrow.removeEventListener("change", onNarrow);
    };
  }, []);

  // Switching theme resets the map to that theme's default basemap.
  useEffect(() => { setBasemap(defaultBasemap()); }, [isLight]);

  useEffect(() => {
    if (open) {
      if (!navigator.onLine && BASEMAPS[basemap].type !== "vector") setBasemap("vector");
      const today = new Date();
      if (!dateFrom) setDateFrom(getEarliestDate(monthData) || `${today.getFullYear()}-01-01`);
      if (!dateTo) setDateTo(today.toISOString().split("T")[0]);
    }
  }, [open]);

  useEscClose(open, onClose);

  // Init / teardown map instance with modal open state. The base layer
  // itself (tiles vs. vector outline) is handled by the effect below.
  useEffect(() => {
    if (!mounted || !mapElRef.current || mapRef.current) return;
    // preferCanvas: markers draw to one canvas. The old screenshot export needed this; it is kept so the map looks the same.
    const map = L.map(mapElRef.current, { worldCopyJump: true, attributionControl: false, preferCanvas: true, zoomSnap: 0.25 }).setView([20, 0], 2);
    mapRef.current = map;
    // Dedicated pane below the default overlayPane (where routes/markers
    // live) so the basemap can never end up drawn on top of them, no
    // matter what order layers get added/swapped in.
    map.createPane("basePane").style.zIndex = 200;
    // Routes sit above the basemap but below the airport markers (overlayPane, 400).
    map.createPane("routesPane").style.zIndex = 350;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        baseLayerRef.current = null;
        routeLayerRef.current = null;
        attributionRef.current = null;
      }
    };
  }, [mounted]);

  // Swap the base layer when the user picks a different basemap. Tile
  // providers require visible attribution per their terms; the vector
  // outline uses bundled public-domain data (Natural Earth) so it needs none.
  useEffect(() => {
    const map = mapRef.current;
    if (!mounted || !map) return;

    if (baseLayerRef.current) { map.removeLayer(baseLayerRef.current); baseLayerRef.current = null; }
    if (attributionRef.current) { map.removeControl(attributionRef.current); attributionRef.current = null; }

    const cfg = BASEMAPS[basemap];
    if (cfg.type === "vector") {
      const land = unwrapAntimeridian(feature(landTopology, landTopology.objects.land));
      baseLayerRef.current = L.geoJSON(land, {
        pane: "basePane",
        style: { fillColor: mapColors.landFill, fillOpacity: 1, color: mapColors.landStroke, weight: 0.6 },
      }).addTo(map);
    } else if (cfg.type === "maplibre") {
      let cancelled = false;
      loadMaplibreGL().then(maplibreGL => {
        // Bail if the user switched away from this basemap (or closed the
        // modal) while the chunk was still downloading.
        if (cancelled) return;
        baseLayerRef.current = maplibreGL({ style: cfg.styleUrl, pane: "basePane" }).addTo(map);
        attributionRef.current = L.control.attribution({ prefix: false }).addTo(map);
        attributionRef.current.addAttribution(cfg.attribution);
      });
      return () => { cancelled = true; };
    } else {
      baseLayerRef.current = L.tileLayer(cfg.url, { pane: "basePane", subdomains: cfg.subdomains || "abc", maxZoom: cfg.maxZoom }).addTo(map);
      attributionRef.current = L.control.attribution({ prefix: false }).addTo(map);
      attributionRef.current.addAttribution(cfg.attribution);
    }
  }, [mounted, basemap, isLight]);

  // Redraw routes/markers whenever the date range or data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!mounted || !map || !dateFrom || !dateTo) return;

    if (routeLayerRef.current) { map.removeLayer(routeLayerRef.current); routeLayerRef.current = null; }
    map.eachLayer(layer => {
      if (layer instanceof L.CircleMarker) map.removeLayer(layer);
    });

    const sectors = getSectorsInRange(monthData, dateFrom, dateTo);
    const seenRoutes = new Set();
    const airports = new Map();
    const routes = [];

    sectors.forEach(({ departure, arrival }) => {
      const dep = getCoords(departure), arr = getCoords(arrival);
      if (!dep || !arr) return;
      const key = [departure, arrival].sort().join("-");
      if (seenRoutes.has(key)) return;
      seenRoutes.add(key);
      routes.push({ dep, arr });
      airports.set(departure, dep);
      airports.set(arrival, arr);
    });

    routeLayerRef.current = new RouteLayer(
      routes.map(({ dep, arr }) => greatCirclePoints(dep.lat, dep.lon, arr.lat, arr.lon)),
      ROUTE_COLOR_ARR[isLight ? "light" : "dark"]
    ).addTo(map);

    airports.forEach((coord, icao) => {
      L.circleMarker([coord.lat, coord.lon], {
        radius: 4, color: mapColors.dotRing, fillColor: MINT, fillOpacity: 1, weight: 1,
      }).bindTooltip(icao).addTo(map);
    });

    const allPts = routes.flatMap(r => [[r.dep.lat, r.dep.lon], [r.arr.lat, r.arr.lon]]);
    if (allPts.length) map.fitBounds(allPts, { padding: [30, 30] });
  }, [mounted, dateFrom, dateTo, monthData, isLight]);

  if (!mounted) return null;

  // The export is drawn from the logbook data, not from the map on screen, so it works with any basemap and offline.
  const handleExport = async () => {
    setExporting(true);
    setExportError("");
    try {
      const flights = toExportFlights(getSectorsInRange(monthData, dateFrom, dateTo), computeFlightTimes);
      const { buildRouteMapFile, downloadBlob } = await import("./routeMapExport");
      const { blob, ext } = await buildRouteMapFile({ kind: exportKind, flights, theme, showStats, size: imageSize, paper, orient });
      downloadBlob(blob, `route-map-${dateFrom}-to-${dateTo}.${ext}`);
    } catch (e) {
      setExportError(e?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  // Toolbar parts, built once and placed by whichever layout is showing.
  const fieldStyle = isNarrow ? { ...inputStyle, width: "100%", minWidth: 0, boxSizing: "border-box" } : inputStyle;
  const fromInput = <input id="route-map-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={fieldStyle} />;
  const fromField = <Field label="FROM" stacked={isNarrow}>{fromInput}</Field>;
  const toField = (
    <Field label="TO" stacked={isNarrow}>
      <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={fieldStyle} />
    </Field>
  );
  const mapField = (
    <Field label="MAP" stacked={isNarrow}>
      <select value={basemap} onChange={e => setBasemap(e.target.value)} style={fieldStyle}>
        {Object.entries(BASEMAPS).map(([key, cfg]) => (
          <option key={key} value={key}>{cfg.label}</option>
        ))}
      </select>
    </Field>
  );
  const kindSelect = (
    <select value={exportKind} onChange={e => setExportKind(e.target.value)} aria-label="Export type" style={fieldStyle}>
      {EXPORT_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
  const sizeSelect = exportKind === "image" && (
    <select value={imageSize} onChange={e => setImageSize(e.target.value)} aria-label="Image size" style={fieldStyle}>
      {IMAGE_SIZE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
  const paperSelects = exportKind === "pdf" && (
    <div style={isNarrow ? { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } : { display: "contents" }}>
      <select value={paper} onChange={e => setPaper(e.target.value)} aria-label="Paper size" style={fieldStyle}>
        {PAPER_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <select value={orient} onChange={e => setOrient(e.target.value)} aria-label="Orientation" style={fieldStyle}>
        {ORIENT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
  const statsToggle = (
    <label style={{ display: "flex", alignItems: "center", gap: 6, color: THEME.textMuted, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>
      <input type="checkbox" checked={showStats} onChange={e => setShowStats(e.target.checked)} />
      Include stats
    </label>
  );
  const exportButton = (
    <button
      onClick={handleExport}
      disabled={exporting}
      style={{ ...btnStyle, opacity: exporting ? 0.5 : 1, whiteSpace: "nowrap", ...(isNarrow ? { width: "100%", padding: "9px 12px" } : { marginLeft: "auto" }) }}
    >
      {exporting ? "EXPORTING…" : "EXPORT"}
    </button>
  );
  const errorLine = exportError && (
    <span role="alert" style={{ color: "#ef4444", fontSize: 11, ...(!isNarrow && { flexBasis: "100%" }) }}>{exportError}</span>
  );

  return (
    <div
      className={"elb-fade" + (closing ? " elb-closing" : "")}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
    >
      <ChamferFrame className={"elb-pop" + (closing ? " elb-closing" : "")} face={THEME.bg} style={{
        width: "min(920px, 92vw)", height: "min(660px, 88vh)",
        fontFamily: "'Courier New', monospace",
        colorScheme: isLight ? "light" : "dark",
      }}>
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "14px 16px",
          borderBottom: `1px solid ${THEME.border}`, background: "linear-gradient(180deg, rgba(63,224,197,0.04), transparent)",
        }}>
          <div>
            <div style={{ color: accent, fontSize: 10, letterSpacing: "0.2em", marginBottom: 4, textTransform: "uppercase" }}>// route map</div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17, letterSpacing: "0.03em", color: THEME.text }}>Route map</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: `1px solid ${THEME.border}`, color: THEME.textMuted, cursor: "pointer", width: 28, height: 28, fontSize: 16, lineHeight: 1, transition: "color 0.12s, border-color 0.12s" }}
            onMouseEnter={e => { e.currentTarget.style.color = accent; e.currentTarget.style.borderColor = accent; }}
            onMouseLeave={e => { e.currentTarget.style.color = THEME.textMuted; e.currentTarget.style.borderColor = THEME.border; }}
          >×</button>
        </div>

        {isNarrow ? (
          /* Phone: one field per line, labels above, dates side by side, full-width export button */
          <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "10px 16px", borderBottom: `1px solid ${THEME.border}`, maxHeight: "60%", overflowY: "auto", overscrollBehavior: "contain", flexShrink: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))", gap: 10 }}>
              {fromField}
              {toField}
            </div>
            {mapField}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: `1px solid ${THEME.border}`, paddingTop: 10 }}>
              <span style={groupLabelStyle}>EXPORT</span>
              {kindSelect}
              {sizeSelect}
              {paperSelects}
              {statsToggle}
              {exportButton}
              {errorLine}
            </div>
          </div>
        ) : (
          /* Wide: two rows. What to draw, then how to export it. The FROM label gets its own column,
             so the export row starts exactly under the FROM date field. */
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 6, rowGap: 10, alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${THEME.border}` }}>
            <label htmlFor="route-map-from" style={labelStyle}>FROM</label>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 16px" }}>
              {fromInput}
              {toField}
              {mapField}
            </div>
            <span />
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              {kindSelect}
              {sizeSelect}
              {paperSelects}
              {statsToggle}
              {exportButton}
              {errorLine}
            </div>
          </div>
        )}

        <div ref={mapElRef} style={{ flex: 1, background: mapColors.ocean }} />
      </ChamferFrame>
    </div>
  );
}

// A labelled field: label beside the control on wide screens, above it on phones.
function Field({ label, stacked, children }) {
  return (
    <label style={{ display: "flex", flexDirection: stacked ? "column" : "row", alignItems: stacked ? "stretch" : "center", gap: stacked ? 4 : 6, minWidth: 0 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

const labelStyle = { color: THEME.textMuted, fontSize: 11, flexShrink: 0, textAlign: "left" };
const groupLabelStyle = { color: THEME.textMuted, fontSize: 10, letterSpacing: "0.16em", textAlign: "left" };

const inputStyle = {
  background: THEME.bgInput, border: `1px solid ${THEME.border}`, color: THEME.text, borderRadius: 0,
  fontSize: 12, padding: "4px 8px", fontFamily: "inherit",
};

const btnStyle = {
  backgroundImage: `linear-gradient(135deg, ${MINT}, #3B8DFF)`, border: 0, borderRadius: 0, color: "#0a0d12",
  fontSize: 11, letterSpacing: "0.08em", padding: "5px 12px", cursor: "pointer", fontWeight: 700, textTransform: "uppercase",
};
