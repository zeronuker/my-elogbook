// Shared by the Route map modal and the Logbook MAP view: basemaps, map colours and route geometry.
import L from "leaflet";
import { feature } from "topojson-client";
import landTopology from "world-atlas/land-110m.json";

// Map-area colors the CSS variables can't reach (vector basemap, canvas, markers).
export const MAP_COLORS = {
  dark:  { ocean: "#060a10", landFill: "#16263b", landStroke: "#2a4a6a", dotRing: "#3FE0C5" },
  light: { ocean: "#d6dde3", landFill: "#f3f4f6", landStroke: "#b9c3cf", dotRing: "#0b6b5d" },
};
export const ROUTE_COLOR_DEP = [236, 72, 153];  // #ec4899 magenta — departure end
export const ROUTE_COLOR_ARR = { dark: [250, 204, 21], light: [245, 158, 11] };  // yellow / amber (yellow washes out on light maps)

export const BASEMAPS = {
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

// Online: CARTO for the theme. Offline: the bundled vector outline, since tiles can't load.
export const defaultBasemap = isLight => !navigator.onLine ? "vector" : isLight ? "cartoLight" : "carto";

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

// The map needs panes "basePane" (below everything) before a basemap can be mounted.
export function createBasePanes(map) {
  // Dedicated pane below the default overlayPane (where routes/markers
  // live) so the basemap can never end up drawn on top of them, no
  // matter what order layers get added/swapped in.
  map.createPane("basePane").style.zIndex = 200;
  // Routes sit above the basemap but below the airport markers (overlayPane, 400).
  map.createPane("routesPane").style.zIndex = 350;
}

// Puts the chosen basemap on the map and returns a function that takes it off again.
// Tile providers require visible attribution per their terms; the vector
// outline uses bundled public-domain data (Natural Earth) so it needs none.
export function mountBasemap(map, key, mapColors) {
  const cfg = BASEMAPS[key];
  let layer = null, attribution = null, cancelled = false;
  const addAttribution = () => {
    attribution = L.control.attribution({ prefix: false }).addTo(map);
    attribution.addAttribution(cfg.attribution);
  };
  if (cfg.type === "vector") {
    const land = unwrapAntimeridian(feature(landTopology, landTopology.objects.land));
    layer = L.geoJSON(land, {
      pane: "basePane",
      style: { fillColor: mapColors.landFill, fillOpacity: 1, color: mapColors.landStroke, weight: 0.6 },
    }).addTo(map);
  } else if (cfg.type === "maplibre") {
    loadMaplibreGL().then(maplibreGL => {
      // Bail if the user switched away from this basemap (or closed the
      // map) while the chunk was still downloading.
      if (cancelled) return;
      layer = maplibreGL({ style: cfg.styleUrl, pane: "basePane" }).addTo(map);
      addAttribution();
    });
  } else {
    layer = L.tileLayer(cfg.url, { pane: "basePane", subdomains: cfg.subdomains || "abc", maxZoom: cfg.maxZoom }).addTo(map);
    addAttribution();
  }
  return () => {
    cancelled = true;
    if (layer) map.removeLayer(layer);
    if (attribution) map.removeControl(attribution);
  };
}

export function lerpColor(t, arr) {
  const r = Math.round(ROUTE_COLOR_DEP[0] + (arr[0] - ROUTE_COLOR_DEP[0]) * t);
  const g = Math.round(ROUTE_COLOR_DEP[1] + (arr[1] - ROUTE_COLOR_DEP[1]) * t);
  const b = Math.round(ROUTE_COLOR_DEP[2] + (arr[2] - ROUTE_COLOR_DEP[2]) * t);
  return `rgb(${r},${g},${b})`;
}
