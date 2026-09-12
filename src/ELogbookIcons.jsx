import { useState } from "react";

// Toolbar sync-status chip — tap/click morphs between compact (time only) and
// full (date + time, or failure reason) in place. No dropdown/popover/toast —
// hover tooltips don't work on iPad, so tap is the only reveal mechanism.
// `flash`: briefly render bold + bright (✓/✗) right after a check completes,
// then settle back to the quiet compact/expanded style — mirrors the old
// "✓ SYNCED" / "✗ SYNC FAILED" flash feedback for both Cloud and Duty Log.
// `identityColor`: while expanded (tapped open), the ICON alone recolors to
// this — lets Cloud vs. Duty Log be told apart at a glance once tapped. Text
// color is unaffected, still driven by state/flash as normal.
export function ToolbarSyncChip({ icon, compact, full, state, flash, identityColor, onActivate }) {
  const [expanded, setExpanded] = useState(false);
  const quietColor = state === "bad" ? "#ef4444" : state === "busy" ? "#7c87a3" : "#3a6a8a";
  const flashColor = state === "bad" ? "#ef4444" : "#22c55e";
  return (
    <button
      onClick={() => { onActivate?.(); setExpanded(e => !e); }}
      style={{
        display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
        background: "none", border: "none", padding: "4px 2px", fontFamily: "inherit", cursor: "pointer",
        transition: "color 0.2s ease, font-size 0.2s ease",
        color: flash ? flashColor : quietColor,
        fontWeight: flash ? 700 : 400,
        fontStyle: flash || state === "bad" ? "normal" : "italic",
        letterSpacing: flash ? "0.1em" : "0.06em",
        fontSize: flash ? 11 : 10,
        animation: state === "busy" ? "blink 1.3s ease-in-out infinite" : "none",
      }}
    >
      <span style={{ display: "flex", color: expanded ? identityColor : "inherit" }}>{icon}</span>
      {flash && (state === "bad" ? "✗ " : "✓ ")}
      {expanded ? full : compact}
    </button>
  );
}

export const TabLogbookIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="2" width="14" height="20" rx="1" fill="#dde6f0" stroke="#8a93a8" strokeWidth="0.6" />
    <polygon points="14,2 18,2 18,6" fill="#3FE0C5" />
    <line x1="7" y1="9" x2="15" y2="9" stroke="#8a93a8" strokeWidth="0.8" />
    <line x1="7" y1="12" x2="15" y2="12" stroke="#8a93a8" strokeWidth="0.8" />
    <g transform="rotate(-15 14 17)">
      <circle cx="14" cy="17" r="4.5" fill="none" stroke="#e24b4a" strokeWidth="1.6" />
      <polyline points="12,17 13.5,18.5 16.5,15" fill="none" stroke="#e24b4a" strokeWidth="1.6" strokeLinejoin="miter" />
    </g>
  </svg>
);

export const TabSummaryIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <line x1="3" y1="21" x2="21" y2="21" stroke="#5a7a9a" strokeWidth="0.8" />
    <polygon points="4,19 10,12 15,14 18,9 18,21 4,21" fill="#3B8DFF" opacity="0.28" />
    <polyline points="4,19 10,12 15,14 18,9" fill="none" stroke="#3FE0C5" strokeWidth="1.8" strokeLinejoin="miter" />
    <polygon points="18,6.5 20.5,9 18,11.5 15.5,9" fill="#FAC775" />
  </svg>
);

export const TabLimitsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="#1a2230" stroke="#4fc3f7" strokeWidth="1.2" />
    <line x1="6.70" y1="17.30" x2="5.64" y2="18.36" stroke="#22c55e" strokeWidth="1.6" />
    <line x1="4.5" y1="12" x2="3" y2="12" stroke="#22c55e" strokeWidth="1.6" />
    <line x1="6.70" y1="6.70" x2="5.64" y2="5.64" stroke="#22c55e" strokeWidth="1.6" />
    <line x1="12" y1="4.5" x2="12" y2="3" stroke="#22c55e" strokeWidth="1.6" />
    <line x1="17.30" y1="6.70" x2="18.36" y2="5.64" stroke="#f5c542" strokeWidth="1.6" />
    <line x1="19.5" y1="12" x2="21" y2="12" stroke="#f5c542" strokeWidth="1.6" />
    <line x1="17.30" y1="17.30" x2="18.36" y2="18.36" stroke="#ef4444" strokeWidth="1.6" />
    <line x1="12" y1="12" x2="17.3" y2="6.7" stroke="#ffffff" strokeWidth="1.6" />
    <circle cx="12" cy="12" r="1.5" fill="#ffffff" />
  </svg>
);
