// Duty Log link — read-only fetch from the superapp's duty-log sync endpoint (see my-superapp/api/dutylog-sync.js)
export const DUTY_LOG_SYNC_URL = "https://claudeborne-superapp.vercel.app/api/dutylog-sync";
export const DUTY_LOG_CODE_RE = /^[A-Z0-9]{4,8}(-[A-Z0-9]{4,8}){1,3}$/;

// Crew display order — CP through A2, anything else sorted alphabetically after A2.
export const CREW_RANK_ORDER = ["CP", "P1", "P2", "P3", "P4", "A1", "A2"];

// Table columns whose values are HH:MM time strings — shared by the manual-entry
// normalization in updateCell and the Logbook table's own rendering.
export const timeCols = ["dayP1","dayP1US","dayP2","nightP1","nightP1US","nightP2","total","std","sta"];

export const FTL_COLOR  = { green: "#22c55e", yellow: "#eab308", red: "#ef4444" };
export const FTL_BG     = { green: "rgba(34,197,94,0.08)",  yellow: "rgba(234,179,8,0.08)",  red: "rgba(239,68,68,0.08)"  };
export const FTL_BORDER = { green: "rgba(34,197,94,0.3)",   yellow: "rgba(234,179,8,0.3)",   red: "rgba(239,68,68,0.3)"   };

// Regulatory reference content for info-button popups
export const FTL_POPUPS = {
  "ftl-28d": {
    para:  "CAD 1901 ISS01/REV01 · PARA 2.18(a)",
    title: "ABSOLUTE LIMIT — FLIGHT TIME · ANY 28 CONSECUTIVE DAYS",
    body:  `A person shall not act as a member of the flight crew of an aircraft if, at the <strong style="color:#c8d6e5">beginning of the flight</strong>, the aggregate of all previous flight times during the period of <span style="color:#4fc3f7">28 consecutive days expiring at the end of the day on which the flight begins</span> exceeds <strong style="color:#c8d6e5">100 hours</strong>.<br><br>Exception: on the 28th day a crew member may <strong style="color:#c8d6e5">depart</strong> on a single sector flight and complete that sector even if the 28-day total will exceed 100 hrs on landing. The crew member <strong style="color:#c8d6e5">cannot then operate any subsequent sectors</strong> during that day.`,
    note:  `<span style="color:#4fc3f7">Flight time</span> = block time <span style="color:#4fc3f7">STD → STA</span> per sector, summed across all sectors in the rolling 28-day window.`,
  },
  "ftl-12m": {
    para:  "CAD 1901 ISS01/REV01 · PARA 2.18(b)",
    title: "ABSOLUTE LIMIT — FLIGHT TIME · ANY 12 MONTHS",
    body:  `A person shall not act as a member of the flight crew of an aircraft if, at the <strong style="color:#c8d6e5">beginning of the flight</strong>, the aggregate of all previous flight times during the period of <span style="color:#4fc3f7">12 months expiring at the end of the previous month</span> exceeds <strong style="color:#c8d6e5">900 hours</strong>.<br><br>For augmented crew operations (or a mixture of), the operator shall establish in the Operations Manual the aggregate of flying hours applicable for this calculation.`,
    note:  `<span style="color:#4fc3f7">Flight time</span> = block time <span style="color:#4fc3f7">STD → STA</span> per sector. The 12-month window closes at the end of the <span style="color:#4fc3f7">previous calendar month</span>, not the current date.`,
  },
  "duty-7d": {
    para:  "CAD 1901 ISS01/REV01 · PARA 2.19.1(a)",
    title: "CUMULATIVE DUTY — ANY 7 CONSECUTIVE DAYS",
    body:  `The maximum duty hours for flight crew shall not exceed <span style="color:#4fc3f7">55 hours in any 7 consecutive days</span>.<br><br>This limit <strong style="color:#c8d6e5">may be increased to 60 hours</strong> when a rostered duty covering a series of duty periods, once commenced, is subject to <strong style="color:#c8d6e5">unforeseen delays</strong>.`,
    note:  `<span style="color:#4fc3f7">Duty time</span> per sector is estimated as <span style="color:#4fc3f7">STD − pre-flight buffer</span> to <span style="color:#4fc3f7">STA + post-flight buffer</span> (defaults 1 hr 15 min and 15 min, set in Settings). CAD 1901 para 2.10.1 sets post-flight duties at a minimum of 30 min for major operators and 15 min for others. Standby and positioning duty (para 2.19.5) are not included.`,
  },
  "duty-14d": {
    para:  "CAD 1901 ISS01/REV01 · PARA 2.19.1(b)",
    title: "CUMULATIVE DUTY — ANY 14 CONSECUTIVE DAYS",
    body:  `The maximum duty hours for flight crew shall not exceed <span style="color:#4fc3f7">95 hours in any 14 consecutive days</span>.<br><br>CAD 1901 gives no extension for this limit. All duty periods within the rolling 14-day window must be summed when assessing compliance.`,
    note:  `<span style="color:#4fc3f7">Duty time</span> per sector is estimated as <span style="color:#4fc3f7">STD − pre-flight buffer</span> to <span style="color:#4fc3f7">STA + post-flight buffer</span> (defaults 1 hr 15 min and 15 min, set in Settings). CAD 1901 para 2.10.1 sets post-flight duties at a minimum of 30 min for major operators and 15 min for others. Standby and positioning duty (para 2.19.5) are not included.`,
  },
  "duty-28d": {
    para:  "CAD 1901 ISS01/REV01 · PARA 2.19.1(c)",
    title: "CUMULATIVE DUTY — ANY 28 CONSECUTIVE DAYS",
    body:  `The maximum duty hours for flight crew shall not exceed <span style="color:#4fc3f7">190 hours in any 28 consecutive days</span>.<br><br>CAD 1901 gives no extension for this limit. All duty periods within the rolling 28-day window must be summed when assessing compliance.`,
    note:  `<span style="color:#4fc3f7">Duty time</span> per sector is estimated as <span style="color:#4fc3f7">STD − pre-flight buffer</span> to <span style="color:#4fc3f7">STA + post-flight buffer</span> (defaults 1 hr 15 min and 15 min, set in Settings). CAD 1901 para 2.10.1 sets post-flight duties at a minimum of 30 min for major operators and 15 min for others. Standby and positioning duty (para 2.19.5) are not included.`,
  },
  "rec-tol": {
    para:  "CAD 6 PART 1 (CAT) · PARA 9.4.1",
    title: "TAKEOFF & LANDING RECENCY — 3 WITHIN 90 DAYS",
    body:  `Flight crew shall not be assigned to operate an aeroplane as part of the <strong style="color:#c8d6e5">minimum certificated crew</strong>, as pilot flying or pilot monitoring, unless they have carried out <span style="color:#4fc3f7">three take-offs and three landings in the previous 90 days</span> as pilot flying in an aeroplane, or in a flight simulator, of the <span style="color:#4fc3f7">same type/class</span> (para 9.4.1(a)).<br><br>A pilot without a valid instrument rating shall not operate an aeroplane at night as <strong style="color:#c8d6e5">pilot-in-command</strong> unless they have carried out <span style="color:#4fc3f7">at least one landing at night in the preceding 90 days</span> as pilot flying in an aeroplane or flight simulator of the same type/class (para 9.4.1(b)).`,
    note:  `Use the <strong style="color:#c8d6e5">PILOT FLYING</strong> checkbox in the logbook to mark sectors where you were the handling pilot — each checked sector counts as 1 T/O and 1 LDG. Simulator takeoffs and landings count under CAD 6 but are not tracked here.`,
  },
  "rec-autoland": {
    para:  "CAGM 6008(III) LVO · PARA 4.4.6 & 4.6",
    title: "LVO / AUTOLAND CURRENCY",
    body:  `To maintain LVO currency, <strong style="color:#c8d6e5">recurrent checks are required as per CAD 6 para 4.11</strong> and may be combined with pilot proficiency checks. As a minimum, <span style="color:#4fc3f7">at least three LVO approaches should be conducted in an aircraft or FSTD</span> concurrent with the PPC checks (para 4.6).<br><br>The period of Category II/III certification is <span style="color:#4fc3f7">six months or up to the validity period of the PPC</span> (para 4.4.6).`,
    note:  `Check the <span style="color:#4fc3f7">AUTOLAND checkbox</span> in the remarks window to mark sectors where a coupled autoland to touchdown was performed. The card shows what you have logged for reference. Currency itself depends on your recurrent check and PPC, which this app does not track.`,
  },
};

export const FONT_FAMILIES = {
  courier:   "'Courier New', Courier, monospace",
  jetbrains: "'JetBrains Mono', monospace",
  ibmplex:   "'IBM Plex Mono', monospace",
  roboto:    "'Roboto Mono', monospace",
  space:     "'Space Mono', monospace",
};

export const ANIM_SPEED_MS = { normal: 260, slow: 420, slower: 650 };

// Row density sets cell top/bottom padding; column density sets cell left/right padding.
export const DENSITY_PAD = {
  compact:  "3px",
  relaxed:  "10px",
};

export const COLUMN_PAD = {
  narrow:  "4px",
  wide:    "14px",
};

export const COLUMN_SCALE = {
  narrow:  0.75,
  wide:    1.35,
};

// Shared table header/cell styles — used by the Logbook and Flight Summary tabs.
export const thStyle = {
  padding: "7px var(--elb-pad-x, 4px)",
  textAlign: "center",
  color: "var(--elb-txt-muted, #3a6a8a)",
  fontSize: "var(--elb-th-sz, 10px)",
  letterSpacing: "0.12em",
  borderBottom: "1px solid var(--elb-border2, #1a3050)",
  borderRight: "1px solid var(--elb-border4, #111820)",
  whiteSpace: "nowrap",
  fontWeight: 700,
  textTransform: "uppercase",
  lineHeight: 1.3,
};

export const thSubStyle = {
  ...thStyle,
  color: "var(--elb-txt-muted, #3a6a8a)",
  background: "var(--elb-bg2, #090d14)",
  fontSize: "var(--elb-ths-sz, 9px)",
  fontWeight: 700,
};

export const tdStyle = {
  padding: "var(--elb-pad-y, 3px) var(--elb-pad-x, 4px)",
  borderBottom: "1px solid var(--elb-border3, #0f1820)",
  borderRight: "1px solid var(--elb-bg2, #0d1520)",
  whiteSpace: "nowrap",
  fontSize: "var(--elb-td-sz, 13px)",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
