import { useEffect, useRef, useState } from "react";

const injectFont = () => {
  if (!document.getElementById("tourney-font")) {
    const link = document.createElement("link");
    link.id = "tourney-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Tourney:wght@600;700;800&display=swap";
    document.head.appendChild(link);
  }
};

// ── PNG export helpers ────────────────────────────────────────────────────────

let _cachedFontUri = null;

async function fetchEmbeddedFont() {
  if (_cachedFontUri) return _cachedFontUri;
  try {
    const cssRes = await fetch(
      "https://fonts.googleapis.com/css2?family=Tourney:wght@700&display=swap",
      { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120" } }
    );
    const css = await cssRes.text();
    const matches = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/g)];
    const woff2Url = matches[matches.length - 1]?.[1];
    if (!woff2Url) throw new Error("WOFF2 URL not found");
    const fontRes = await fetch(woff2Url);
    const buf = await fontRes.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let b64 = "";
    for (let i = 0; i < bytes.length; i += 8192)
      b64 += String.fromCharCode(...bytes.slice(i, i + 8192));
    _cachedFontUri = `data:font/woff2;base64,${btoa(b64)}`;
    return _cachedFontUri;
  } catch (err) {
    console.warn("Font embed failed — output may use fallback font:", err.message);
    return null;
  }
}

async function svgToPngBlob(svgEl, targetSize) {
  await document.fonts.ready;
  const fontUri = await fetchEmbeddedFont();

  const serializer = new XMLSerializer();
  let svgStr = serializer.serializeToString(svgEl);

  if (fontUri) {
    const face = `<style>@font-face{font-family:'Tourney';font-weight:700;font-style:normal;src:url('${fontUri}') format('woff2');}</style>`;
    svgStr = svgStr.includes("</defs>")
      ? svgStr.replace("</defs>", `${face}</defs>`)
      : svgStr.replace(/<svg([^>]*)>/, `<svg$1><defs>${face}</defs>`);
  }

  const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
  const url  = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width  = targetSize;
      canvas.height = targetSize;
      canvas.getContext("2d").drawImage(img, 0, 0, targetSize, targetSize);
      URL.revokeObjectURL(url);
      canvas.toBlob(resolve, "image/png");
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

function triggerDownload(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ── SVG icon component ────────────────────────────────────────────────────────

function AppIconSVG({ size = 512, shape = "ios", config, svgRef = null }) {
  const S   = 512;
  const uid = `${config.id}-${shape}-${size}`;
  // maskable = full square (OS applies its own mask); ios/android = rounded rect
  const rx  = shape === "maskable" ? 0 : shape === "ios" ? S * 0.225 : S * 0.165;
  const cx  = S / 2;
  const cy  = S / 2;

  const contentScale = shape === "android" ? 0.82 : 1.0
  const contentPad   = (S * (1 - contentScale)) / 2

  const sw  = S * 0.052;
  const sqH = S * 0.400;
  const L = cx - sqH, R = cx + sqH, T = cy - sqH, B = cy + sqH;
  const gap = sqH * 0.72;
  const squarePath = [
    `M ${L},${B - gap}`, `L ${L},${T}`,
    `L ${R},${T}`,       `L ${R},${B}`,
    `L ${L + gap},${B}`,
  ].join(" ");

  const step = 32;
  const gridLines = [];
  for (let x = 0; x <= S; x += step)
    gridLines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={S} stroke="white" strokeWidth="0.75" />);
  for (let y = 0; y <= S; y += step)
    gridLines.push(<line key={`h${y}`} x1={0} y1={y} x2={S} y2={y} stroke="white" strokeWidth="0.75" />);

  let tgY1, tgY2, textNodes;

  if (config.type === "single") {
    const fSize = S * config.fSizeMult;
    const capH  = fSize * 0.73;
    const yBase = cy + capH * 0.5;
    tgY1 = yBase - capH;
    tgY2 = yBase;
    textNodes = (
      <>
        <text x={cx + 2} y={yBase + 4} fontFamily="'Tourney', sans-serif"
          fontWeight="700" fontSize={fSize} fill="#000"
          textAnchor="middle" dominantBaseline="alphabetic" opacity="0.28">
          {config.char}
        </text>
        <text x={cx} y={yBase} fontFamily="'Tourney', sans-serif"
          fontWeight="700" fontSize={fSize}
          fill="#3dd9cc" textAnchor="middle" dominantBaseline="alphabetic">
          {config.char}
        </text>
      </>
    );
  } else {
    const fSize   = S * config.fSizeMult;
    const capH    = fSize * 0.73;
    const lineGap = capH + fSize * (config.extraGap || 0);
    const nudge   = fSize * 0.03;
    const y1 = cy + nudge;
    const y2 = y1 + lineGap;
    tgY1 = y1 - capH;
    tgY2 = y2;

    const renderLine = (text, y, accentChar) => (
      <text x={cx} y={y} fontFamily="'Tourney', sans-serif"
        fontWeight="700" fontSize={fSize} letterSpacing="0.005em"
        fill={`url(#tg-${uid})`} textAnchor="middle" dominantBaseline="alphabetic">
        {accentChar
          ? <><tspan fill="#3dd9cc">{accentChar}</tspan>{text.slice(accentChar.length)}</>
          : text}
      </text>
    );

    textNodes = (
      <>
        {[[config.line1, y1], [config.line2, y2]].map(([word, y], i) => (
          <text key={`sh${i}`} x={cx + 2.5} y={y + 4}
            fontFamily="'Tourney', sans-serif" fontWeight="700"
            fontSize={fSize} letterSpacing="0.005em"
            fill="#000" textAnchor="middle" dominantBaseline="alphabetic" opacity="0.32">
            {word}
          </text>
        ))}
        {renderLine(config.line1, y1, config.accent1)}
        {renderLine(config.line2, y2, config.accent2)}
      </>
    );
  }

  return (
    <svg ref={svgRef} width={size} height={size} viewBox={`0 0 ${S} ${S}`}
      xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#0d3d52" />
          <stop offset="42%"  stopColor="#082240" />
          <stop offset="100%" stopColor="#010508" />
        </linearGradient>
        <linearGradient id={`gf-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="white" stopOpacity="1"    />
          <stop offset="100%" stopColor="white" stopOpacity="0.15" />
        </linearGradient>
        <mask id={`gm-${uid}`}>
          <rect width={S} height={S} fill={`url(#gf-${uid})`} />
        </mask>
        <radialGradient id={`vig-${uid}`} cx="50%" cy="50%" r="71%">
          <stop offset="50%"  stopColor="transparent" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
        <linearGradient id={`tg-${uid}`} x1="0" y1={tgY1} x2="0" y2={tgY2} gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="1"    />
          <stop offset="100%" stopColor="#cce8f0" stopOpacity="0.92" />
        </linearGradient>
        <filter id={`glw-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <clipPath id={`clip-${uid}`}>
          <rect x="0" y="0" width={S} height={S} rx={rx} ry={rx} />
        </clipPath>
      </defs>
      <g clipPath={`url(#clip-${uid})`}>
        <rect width={S} height={S} fill={`url(#bg-${uid})`} />
        <g mask={`url(#gm-${uid})`} opacity="0.11">{gridLines}</g>
        <rect width={S} height={S} fill={`url(#vig-${uid})`} />
        <g transform={`translate(${contentPad}, ${contentPad}) scale(${contentScale})`}>
          <path d={squarePath} fill="none" stroke="#2a7d94"
            strokeWidth={sw * 2.2} strokeLinecap="square" strokeLinejoin="miter"
            filter={`url(#glw-${uid})`} opacity="0.18" />
          <path d={squarePath} fill="none" stroke="#2a7d94"
            strokeWidth={sw} strokeLinecap="square" strokeLinejoin="miter" opacity="0.95" />
          <rect x={L - sw * 0.5} y={B - gap - sw * 0.5} width={sw} height={sw} fill="#2a7d94" opacity="0.95" />
          <rect x={L + gap - sw * 0.5} y={B - sw * 0.5}  width={sw} height={sw} fill="#2a7d94" opacity="0.95" />
          {textNodes}
        </g>
      </g>
    </svg>
  );
}

// ── PWA Export Panel ──────────────────────────────────────────────────────────

// Files named to match exactly what manifest.webmanifest and index.html reference
const PWA_FILES = [
  // Browser favicons
  { filename: "favicon-16.png",           size: 16,  shape: "android", group: "Browser",  note: "favicon"        },
  { filename: "favicon-32.png",           size: 32,  shape: "android", group: "Browser",  note: "favicon @2x"    },
  // iOS apple-touch-icon
  { filename: "apple-touch-icon-180.png", size: 180, shape: "ios",     group: "iOS",      note: "home screen ✦"  },
  { filename: "apple-touch-icon-167.png", size: 167, shape: "ios",     group: "iOS",      note: "iPad Pro"       },
  { filename: "apple-touch-icon-152.png", size: 152, shape: "ios",     group: "iOS",      note: "iPad @2x"       },
  { filename: "apple-touch-icon-120.png", size: 120, shape: "ios",     group: "iOS",      note: "iPhone @2x"     },
  // Android / PWA manifest
  { filename: "icon-48.png",              size: 48,  shape: "android", group: "Android",  note: "mdpi"           },
  { filename: "icon-72.png",              size: 72,  shape: "android", group: "Android",  note: "hdpi"           },
  { filename: "icon-96.png",              size: 96,  shape: "android", group: "Android",  note: "xhdpi"          },
  { filename: "icon-144.png",             size: 144, shape: "android", group: "Android",  note: "xxhdpi"         },
  { filename: "icon-192.png",             size: 192, shape: "android", group: "Android",  note: "manifest ✦"     },
  { filename: "icon-512.png",             size: 512, shape: "android", group: "Android",  note: "manifest ✦"     },
  { filename: "icon-maskable-512.png",    size: 512, shape: "maskable",group: "Android",  note: "maskable ✦"     },
];

const GROUP_COLORS = {
  Browser: "#a78bfa",
  iOS:     "#38bdf8",
  Android: "#34d399",
};

function PWAExportPanel({ config, label = "eLogbook" }) {
  const iosRef      = useRef(null);
  const androidRef  = useRef(null);
  const maskableRef = useRef(null);

  const refMap = { ios: iosRef, android: androidRef, maskable: maskableRef };

  const [status,    setStatus]    = useState({});   // filename → 'loading' | 'done' | 'error'
  const [exporting, setExporting] = useState(false);

  const exportOne = async (file) => {
    const svgEl = refMap[file.shape]?.current;
    if (!svgEl) return;
    setStatus(s => ({ ...s, [file.filename]: "loading" }));
    try {
      const blob = await svgToPngBlob(svgEl, file.size);
      triggerDownload(blob, file.filename);
      setStatus(s => ({ ...s, [file.filename]: "done" }));
      setTimeout(() => setStatus(s => ({ ...s, [file.filename]: undefined })), 2500);
    } catch (e) {
      console.error(e);
      setStatus(s => ({ ...s, [file.filename]: "error" }));
    }
  };

  const exportAll = async () => {
    setExporting(true);
    for (const file of PWA_FILES) {
      await exportOne(file);
      await new Promise(r => setTimeout(r, 350));
    }
    setExporting(false);
  };

  const groups = [...new Set(PWA_FILES.map(f => f.group))];

  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(125,211,252,0.25)",
      borderRadius: "20px",
      padding: "28px 24px",
      marginBottom: "52px",
    }}>
      {/* Hidden 512px source SVGs — one per shape, used for all size exports */}
      <div style={{ position: "fixed", left: "-9999px", top: 0, pointerEvents: "none", zIndex: -1 }}>
        <AppIconSVG size={512} shape="ios"      config={config} svgRef={iosRef}      />
        <AppIconSVG size={512} shape="android"  config={config} svgRef={androidRef}  />
        <AppIconSVG size={512} shape="maskable" config={config} svgRef={maskableRef} />
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em",
            color: "#7dd3fc", textTransform: "uppercase", marginBottom: "5px" }}>
            PWA Icon Export · {label}
          </div>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", lineHeight: 1.6 }}>
            {PWA_FILES.length} files &nbsp;·&nbsp; iOS + Android + Browser<br />
            <span style={{ color: "rgba(255,255,255,0.18)", fontSize: "11px" }}>
              ✦ = referenced in manifest.webmanifest / index.html
            </span>
          </div>
        </div>
        <button onClick={exportAll} disabled={exporting} style={{
          background: exporting ? "rgba(56,189,248,0.06)" : "rgba(56,189,248,0.12)",
          border: "1px solid rgba(125,211,252,0.5)",
          borderRadius: "10px", color: "#7dd3fc",
          padding: "10px 22px", fontSize: "11px", fontFamily: "monospace",
          fontWeight: 700, letterSpacing: "0.1em",
          cursor: exporting ? "not-allowed" : "pointer",
          opacity: exporting ? 0.55 : 1, transition: "opacity 0.2s",
          whiteSpace: "nowrap",
        }}>
          {exporting ? "⟳  EXPORTING…" : "↓  DOWNLOAD ALL"}
        </button>
      </div>

      {/* File grid grouped by platform */}
      {groups.map(group => (
        <div key={group} style={{ marginBottom: "18px" }}>
          <div style={{
            fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: GROUP_COLORS[group] || "#7dd3fc",
            marginBottom: "8px",
          }}>
            {group === "Browser" ? "🌐" : group === "iOS" ? "🍎" : "🤖"} {group}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "6px" }}>
            {PWA_FILES.filter(f => f.group === group).map(file => {
              const st = status[file.filename];
              const col = GROUP_COLORS[file.group];
              return (
                <div key={file.filename} onClick={() => !exporting && exportOne(file)} style={{
                  background: st === "done" ? `${col}18` : "rgba(255,255,255,0.03)",
                  border: `1px solid ${st === "done" ? col + "55" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: "8px", padding: "9px 12px",
                  cursor: exporting ? "default" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: "8px", transition: "all 0.15s",
                }}>
                  <div>
                    <div style={{
                      fontSize: "11px", fontFamily: "monospace",
                      color: st === "done" ? col : "rgba(255,255,255,0.65)",
                      marginBottom: "2px",
                    }}>
                      {file.filename}
                    </div>
                    <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.22)" }}>
                      {file.size}×{file.size} · {file.note}
                    </div>
                  </div>
                  <div style={{ fontSize: "15px", flexShrink: 0, color: st === "done" ? col : "rgba(255,255,255,0.3)" }}>
                    {st === "loading" ? "⟳" : st === "done" ? "✓" : st === "error" ? "✗" : "↓"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Platform preview card ─────────────────────────────────────────────────────

const IOS_SIZES     = [180, 167, 152, 120, 87, 60];
const ANDROID_SIZES = [512, 192, 144, 96, 72, 48];

function PlatformCard({ variant, shape }) {
  const svgRefs = useRef({});
  const [status, setStatus] = useState({});
  const sizes = shape === "ios" ? IOS_SIZES : ANDROID_SIZES;

  const download = async (sz) => {
    const svgEl = svgRefs.current[sz];
    if (!svgEl) return;
    setStatus(s => ({ ...s, [sz]: "loading" }));
    try {
      const blob = await svgToPngBlob(svgEl, sz);
      triggerDownload(blob, `${variant.id}-${shape}-${sz}.png`);
      setStatus(s => ({ ...s, [sz]: "done" }));
      setTimeout(() => setStatus(s => ({ ...s, [sz]: undefined })), 1500);
    } catch (e) {
      setStatus(s => ({ ...s, [sz]: "error" }));
    }
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "20px", padding: "24px 20px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: "20px",
    }}>
      <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.16em",
        textTransform: "uppercase", color: "#7dd3fc" }}>
        {shape === "ios" ? "iOS" : "Android"}
      </span>

      {/* Large preview */}
      <div style={{
        borderRadius: shape === "ios" ? "46px" : "33px",
        overflow: "hidden", lineHeight: 0,
        boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06)",
      }}>
        <AppIconSVG size={200} shape={shape} config={variant.config} />
      </div>

      {/* Size strip — each AppIconSVG stores its ref for export */}
      <div style={{ display: "flex", gap: "10px", alignItems: "flex-end",
        flexWrap: "wrap", justifyContent: "center" }}>
        {sizes.map(sz => (
          <div key={sz} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
            <div style={{
              borderRadius: shape === "ios" ? `${sz * 0.225}px` : `${sz * 0.165}px`,
              overflow: "hidden", lineHeight: 0, boxShadow: "0 3px 12px rgba(0,0,0,0.5)",
            }}>
              <AppIconSVG
                size={sz} shape={shape} config={variant.config}
                svgRef={el => { svgRefs.current[sz] = el; }}
              />
            </div>
            <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.28)", fontFamily: "monospace" }}>{sz}</span>
          </div>
        ))}
      </div>

      {/* Download buttons */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
        {sizes.map(sz => {
          const st = status[sz];
          return (
            <button key={sz} onClick={() => download(sz)} style={{
              background: st === "done" ? "rgba(56,189,248,0.18)" : "rgba(255,255,255,0.05)",
              border: `1px solid rgba(125,211,252,${st === "done" ? "0.7" : "0.25"})`,
              borderRadius: "7px", color: st === "done" ? "#bae6fd" : "#7dd3fc",
              padding: "5px 11px", fontSize: "10px", fontFamily: "monospace",
              cursor: "pointer", transition: "all 0.2s",
            }}>
              {st === "loading" ? `⟳ ${sz}` : st === "done" ? `✓ ${sz}` : `↓ ${sz}px`}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Variant section ───────────────────────────────────────────────────────────

const VARIANTS = [
  {
    id: "elogbook", label: "eLogbook",
    config: { id: "elogbook", type: "stacked", line1: "eLOG", line2: "BOOK", accent1: "e", fSizeMult: 0.238 },
  },
  {
    id: "c", label: "C Mark",
    config: { id: "c", type: "single", char: "C", fSizeMult: 0.68 },
  },
  {
    id: "superapp", label: "SuperApp",
    config: { id: "superapp", type: "stacked", line1: "Super", line2: "App", accent1: "S", accent2: "A", fSizeMult: 0.218, extraGap: 0.06 },
  },
  {
    id: "airborne", label: "AirBorne",
    config: { id: "airborne", type: "stacked", line1: "Air", line2: "Borne", accent1: "A", accent2: "B", fSizeMult: 0.218, extraGap: 0.06 },
  },
];

function VariantSection({ variant }) {
  const hasPwaPanel = variant.id === "elogbook" || variant.id === "airborne";
  return (
    <div style={{ marginBottom: "48px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" }}>
        <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
        <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em",
          textTransform: "uppercase", color: "#5eead4" }}>{variant.label}</span>
        <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
      </div>

      {/* PWA export panel — eLogbook + AirBorne */}
      {hasPwaPanel && <PWAExportPanel config={variant.config} label={variant.label} />}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
        <PlatformCard variant={variant} shape="ios"     />
        <PlatformCard variant={variant} shape="android" />
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  useEffect(() => { injectFont(); }, []);
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #020c18 0%, #030e14 60%, #020808 100%)",
      color: "white", fontFamily: "'Segoe UI', system-ui, sans-serif",
      padding: "52px 20px 64px",
    }}>
      <div style={{ textAlign: "center", marginBottom: "52px" }}>
        <p style={{ margin: "0 0 10px", fontSize: "10px", fontWeight: 700,
          letterSpacing: "0.2em", textTransform: "uppercase", color: "#7dd3fc" }}>
          App Icon Set · 4 Variants
        </p>
        <h1 style={{
          margin: "0 0 8px", fontFamily: "'Tourney', sans-serif",
          fontSize: "clamp(24px, 5vw, 40px)", fontWeight: 700,
          background: "linear-gradient(120deg, #bae6fd 30%, #5eead4)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>ClaudeBorne Icons</h1>
        <p style={{ margin: 0, color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>
          Tourney 700 · iOS &amp; Android · PNG export
        </p>
      </div>
      <div style={{ maxWidth: "860px", margin: "0 auto" }}>
        {VARIANTS.map(v => <VariantSection key={v.id} variant={v} />)}
      </div>
      <p style={{ textAlign: "center", fontSize: "11px", color: "rgba(255,255,255,0.15)", margin: "8px 0 0" }}>
        Exports PNG · Tourney font embedded · all sizes scale from 512px master
      </p>
    </div>
  );
}
