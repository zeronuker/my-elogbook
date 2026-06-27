import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import html2canvas from "html2canvas";
import { feature } from "topojson-client";
import landTopology from "world-atlas/land-110m.json";
import { getCoords } from "./airportCoords";

const THEME = {
  bg: "#0a0d12",
  bgInput: "#0b1828",
  accent: "#4fc3f7",
  border: "#1e3a5f",
  text: "#ffffff",
  textMuted: "#b8d6e5",
};

const MAP_OCEAN = "#060a10";
const MAP_LAND_FILL = "#16263b";
const MAP_LAND_STROKE = "#2a4a6a";
const ROUTE_COLOR_DEP = [236, 72, 153];  // #ec4899 magenta — departure end
const ROUTE_COLOR_ARR = [250, 204, 21];  // #facc15 yellow — arrival end

const BASEMAPS = {
  vector: { label: "VECTOR (NO WATERMARK)", type: "vector" },
  carto:  { label: "CARTO DARK", type: "tile",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    subdomains: "abcd", maxZoom: 19, attribution: "© OpenStreetMap, © CARTO" },
  esri:   { label: "SATELLITE (ESRI)", type: "tile",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maxZoom: 19, attribution: "© Esri" },
  stadia: { label: "STADIA DARK", type: "tile",
    url: "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
    maxZoom: 20, attribution: "© Stadia Maps, © OpenMapTiles, © OpenStreetMap" },
};

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

function lerpColor(t) {
  const r = Math.round(ROUTE_COLOR_DEP[0] + (ROUTE_COLOR_ARR[0] - ROUTE_COLOR_DEP[0]) * t);
  const g = Math.round(ROUTE_COLOR_DEP[1] + (ROUTE_COLOR_ARR[1] - ROUTE_COLOR_DEP[1]) * t);
  const b = Math.round(ROUTE_COLOR_DEP[2] + (ROUTE_COLOR_ARR[2] - ROUTE_COLOR_DEP[2]) * t);
  return `rgb(${r},${g},${b})`;
}

// Spherical interpolation between two lat/lon points — same slerp math used
// for day/night route shading (ELogbook.jsx calcDayNightRoute).
function greatCirclePoints(lat1, lon1, lat2, lon2, n = 64) {
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

// Mirrors the date-range row matching in ExportImportModal.getRowsInDateRange,
// reduced to just the departure/arrival fields the map needs.
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
      let rowDate;
      if (typeof row.date === "string" && row.date.includes("/")) {
        const parts = row.date.split("/");
        if (parts.length === 3) {
          rowDate = new Date(`${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}T00:00:00Z`);
        } else if (parts.length === 2) {
          const day = parseInt(parts[0]);
          if (!day || isNaN(day)) return;
          rowDate = new Date(`${keyYear}-${String(keyMonthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00Z`);
        } else return;
      } else {
        const day = parseInt(row.date);
        if (!day || isNaN(day)) return;
        rowDate = new Date(`${keyYear}-${String(keyMonthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00Z`);
      }
      if (rowDate >= fromDate && rowDate <= toDate) {
        sectors.push({ departure: row.departure, arrival: row.arrival });
      }
    });
  });

  return sectors;
}

export default function RouteMapModal({ open, onClose, monthData }) {
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const baseLayerRef = useRef(null);
  const attributionRef = useRef(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [basemap, setBasemap] = useState("vector");
  const [exportFormat, setExportFormat] = useState("png");
  const [exporting, setExporting] = useState(false);
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia("(max-width: 520px)").matches);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 520px)");
    const handler = e => setIsNarrow(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (open) {
      const today = new Date();
      if (!dateFrom) setDateFrom(`${today.getFullYear()}-01-01`);
      if (!dateTo) setDateTo(today.toISOString().split("T")[0]);
    }
  }, [open]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Init / teardown map instance with modal open state. The base layer
  // itself (tiles vs. vector outline) is handled by the effect below.
  useEffect(() => {
    if (!open || !mapElRef.current || mapRef.current) return;
    // preferCanvas: html2canvas (used for PNG export) can't reliably capture
    // Leaflet's default SVG-rendered routes/markers — they silently vanish
    // from the exported image. Canvas-rendered paths are a real bitmap, so
    // html2canvas captures them correctly.
    const map = L.map(mapElRef.current, { worldCopyJump: true, attributionControl: false, preferCanvas: true }).setView([20, 0], 2);
    mapRef.current = map;
    // Dedicated pane below the default overlayPane (where routes/markers
    // live) so the basemap can never end up drawn on top of them, no
    // matter what order layers get added/swapped in.
    map.createPane("basePane").style.zIndex = 200;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        baseLayerRef.current = null;
        attributionRef.current = null;
      }
    };
  }, [open]);

  // Swap the base layer when the user picks a different basemap. Tile
  // providers require visible attribution per their terms; the vector
  // outline uses bundled public-domain data (Natural Earth) so it needs none.
  useEffect(() => {
    const map = mapRef.current;
    if (!open || !map) return;

    if (baseLayerRef.current) { map.removeLayer(baseLayerRef.current); baseLayerRef.current = null; }
    if (attributionRef.current) { map.removeControl(attributionRef.current); attributionRef.current = null; }

    const cfg = BASEMAPS[basemap];
    if (cfg.type === "vector") {
      const land = unwrapAntimeridian(feature(landTopology, landTopology.objects.land));
      baseLayerRef.current = L.geoJSON(land, {
        pane: "basePane",
        style: { fillColor: MAP_LAND_FILL, fillOpacity: 1, color: MAP_LAND_STROKE, weight: 0.6 },
      }).addTo(map);
    } else {
      baseLayerRef.current = L.tileLayer(cfg.url, { pane: "basePane", subdomains: cfg.subdomains || "abc", maxZoom: cfg.maxZoom }).addTo(map);
      attributionRef.current = L.control.attribution({ prefix: false }).addTo(map);
      attributionRef.current.addAttribution(cfg.attribution);
    }
  }, [open, basemap]);

  // Redraw routes/markers whenever the date range or data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!open || !map || !dateFrom || !dateTo) return;

    map.eachLayer(layer => {
      if ((layer instanceof L.Polyline && !(layer instanceof L.Polygon)) || layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
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

    routes.forEach(({ dep, arr }) => {
      const pts = greatCirclePoints(dep.lat, dep.lon, arr.lat, arr.lon);
      for (let i = 0; i < pts.length - 1; i++) {
        L.polyline([pts[i], pts[i + 1]], {
          color: lerpColor(i / (pts.length - 1)), weight: 2, opacity: 1, lineCap: "butt",
        }).addTo(map);
      }
    });

    airports.forEach((coord, icao) => {
      L.circleMarker([coord.lat, coord.lon], {
        radius: 4, color: "#3FE0C5", fillColor: "#3FE0C5", fillOpacity: 1, weight: 1,
      }).bindTooltip(icao).addTo(map);
    });

    const allPts = routes.flatMap(r => [[r.dep.lat, r.dep.lon], [r.arr.lat, r.arr.lon]]);
    if (allPts.length) map.fitBounds(allPts, { padding: [40, 40] });
  }, [open, dateFrom, dateTo, monthData]);

  if (!open) return null;

  const handleExportPng = async () => {
    setExporting(true);
    try {
      const canvas = await html2canvas(mapElRef.current, { useCORS: true, scale: 4 });
      const link = document.createElement("a");
      const isJpg = exportFormat === "jpg";
      link.download = `route-map-${dateFrom}-to-${dateTo}.${isJpg ? "jpg" : "png"}`;
      link.href = isJpg ? canvas.toDataURL("image/jpeg", 0.92) : canvas.toDataURL("image/png");
      link.click();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
    >
      <div style={{
        background: THEME.bg, border: `1px solid ${THEME.border}`, borderRadius: 8,
        width: "min(920px, 92vw)", height: "min(660px, 88vh)",
        display: "flex", flexDirection: "column", fontFamily: "'Courier New', monospace", overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${THEME.border}` }}>
          <span style={{ color: THEME.accent, fontSize: 13, letterSpacing: "0.12em" }}>ROUTE MAP</span>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: THEME.textMuted, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        <div style={{
          display: "flex", flexDirection: isNarrow ? "column" : "row", alignItems: isNarrow ? "stretch" : "center",
          gap: isNarrow ? 8 : 12, padding: "10px 16px", borderBottom: `1px solid ${THEME.border}`, flexWrap: isNarrow ? "nowrap" : "wrap",
        }}>
          <div style={fieldRowStyle(isNarrow)}>
            <label style={labelStyle(isNarrow)}>FROM</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={isNarrow ? { ...inputStyle, flex: 1 } : inputStyle} />
          </div>
          <div style={fieldRowStyle(isNarrow)}>
            <label style={labelStyle(isNarrow)}>TO</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={isNarrow ? { ...inputStyle, flex: 1 } : inputStyle} />
          </div>
          <div style={fieldRowStyle(isNarrow)}>
            <label style={labelStyle(isNarrow)}>MAP</label>
            <select value={basemap} onChange={e => setBasemap(e.target.value)} style={isNarrow ? { ...inputStyle, flex: 1 } : inputStyle}>
              {Object.entries(BASEMAPS).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, marginLeft: isNarrow ? 0 : "auto" }}>
            <select value={exportFormat} onChange={e => setExportFormat(e.target.value)} style={isNarrow ? { ...inputStyle, flex: 1 } : inputStyle}>
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
            </select>
            <button onClick={handleExportPng} disabled={exporting} style={{ ...btnStyle, opacity: exporting ? 0.5 : 1, whiteSpace: "nowrap" }}>
              {exporting ? "EXPORTING…" : "EXPORT"}
            </button>
          </div>
        </div>

        <div ref={mapElRef} style={{ flex: 1, background: MAP_OCEAN }} />
      </div>
    </div>
  );
}

const fieldRowStyle = isNarrow => isNarrow
  ? { display: "flex", alignItems: "center", gap: 8 }
  : { display: "flex", alignItems: "center", gap: 6 };

const labelStyle = isNarrow => ({
  color: "#b8d6e5", fontSize: 11, width: isNarrow ? 36 : "auto", flexShrink: 0,
});

const inputStyle = {
  background: THEME.bgInput, border: `1px solid ${THEME.border}`, color: THEME.text,
  fontSize: 12, padding: "4px 8px", fontFamily: "inherit",
};

const btnStyle = {
  background: "transparent", border: `1px solid ${THEME.accent}`, color: THEME.accent,
  fontSize: 11, letterSpacing: "0.08em", padding: "5px 12px", cursor: "pointer",
};
