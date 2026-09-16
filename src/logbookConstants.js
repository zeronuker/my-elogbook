// Duty Log link — read-only fetch from the superapp's duty-log sync endpoint (see my-superapp/api/dutylog-sync.js)
export const DUTY_LOG_SYNC_URL = "https://claudeborne-superapp.vercel.app/api/dutylog-sync";
export const DUTY_LOG_CODE_RE = /^[A-Z0-9]{4,8}(-[A-Z0-9]{4,8}){1,3}$/;

// Crew display order — CP through A2, anything else sorted alphabetically after A2.
export const CREW_RANK_ORDER = ["CP", "P1", "P2", "P3", "P4", "A1", "A2"];

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
    body:  `The maximum duty hours for flight crew shall not exceed <span style="color:#4fc3f7">55 hours in any 7 consecutive days</span>.<br><br>This limit <strong style="color:#c8d6e5">may be increased to 60 hours</strong> when a rostered duty covering a series of duty periods, once commenced, is subject to <strong style="color:#c8d6e5">unforeseen delays</strong>. This extension is not available by prior rostering.`,
    note:  `<span style="color:#4fc3f7">Duty time</span> per sector = <span style="color:#4fc3f7">STD − 1 hr 15 min</span> (report) to <span style="color:#4fc3f7">STA + 15 min</span> (post-flight). All sectors within the 7-day window are summed.`,
  },
  "duty-14d": {
    para:  "CAD 1901 ISS01/REV01 · PARA 2.19.1(b)",
    title: "CUMULATIVE DUTY — ANY 14 CONSECUTIVE DAYS",
    body:  `The maximum duty hours for flight crew shall not exceed <span style="color:#4fc3f7">95 hours in any 14 consecutive days</span>.<br><br>This is a hard limit with no provision for extension. All duty periods within the rolling 14-day window must be summed when assessing compliance.`,
    note:  `<span style="color:#4fc3f7">Duty time</span> per sector = <span style="color:#4fc3f7">STD − 1 hr 15 min</span> (report) to <span style="color:#4fc3f7">STA + 15 min</span> (post-flight). All sectors within the 14-day window are summed.`,
  },
  "duty-28d": {
    para:  "CAD 1901 ISS01/REV01 · PARA 2.19.1(c)",
    title: "CUMULATIVE DUTY — ANY 28 CONSECUTIVE DAYS",
    body:  `The maximum duty hours for flight crew shall not exceed <span style="color:#4fc3f7">190 hours in any 28 consecutive days</span>.<br><br>This is a hard limit with no provision for extension. All duty periods within the rolling 28-day window must be summed when assessing compliance.`,
    note:  `<span style="color:#4fc3f7">Duty time</span> per sector = <span style="color:#4fc3f7">STD − 1 hr 15 min</span> (report) to <span style="color:#4fc3f7">STA + 15 min</span> (post-flight). All sectors within the 28-day window are summed.`,
  },
  "rec-tol": {
    para:  "MCAR 2016 PART 8 · SUBPART A",
    title: "TAKEOFF & LANDING RECENCY — 3 WITHIN 90 DAYS",
    body:  `A pilot shall not act as <strong style="color:#c8d6e5">Pilot-in-Command</strong> (or co-pilot performing the duties of PIC) unless they have carried out, as pilot flying, <span style="color:#4fc3f7">at least 3 takeoffs and 3 landings</span> in the <span style="color:#4fc3f7">preceding 90 days</span> on an aircraft of the same type.<br><br><strong style="color:#c8d6e5">Day and Night recency are tracked separately.</strong> A night takeoff or landing is one that occurs between the end of evening civil twilight and the beginning of morning civil twilight.`,
    note:  `Recency is <span style="color:#4fc3f7">type-specific</span>. Takeoffs and landings on a B737 do not count toward A320 recency. Use the <strong style="color:#c8d6e5">PILOT FLYING</strong> checkbox in the logbook to mark sectors where you were the handling pilot — each checked sector counts as 1 T/O and 1 LDG. Day/night is determined by STD (takeoff) and STA (landing) UTC times — civil day = 23:30–11:30 UTC, civil night = 11:30–23:30 UTC.`,
  },
  "rec-autoland": {
    para:  "MCAR 2016 PART 8 · SUBPART A",
    title: "AUTOLAND RECENCY — 3 WITHIN 6 MONTHS",
    body:  `A pilot qualified for <strong style="color:#c8d6e5">CAT III autoland operations</strong> shall maintain currency by performing <span style="color:#4fc3f7">at least 3 autoland approaches and landings within the preceding 6 months</span>.<br><br>Autoland operations may be performed on any approved aircraft type or in an approved Full Flight Simulator (FFS). Simulator autolands count toward currency if conducted in an approved FFS with a valid approval letter.`,
    note:  `Check the <span style="color:#4fc3f7">AUTOLAND checkbox</span> in the remarks window to mark sectors where a coupled autoland to touchdown was performed. Track autoland recency for all aircraft types combined — a 6-month rolling window with minimum 3 entries required.`,
  },
};

export const FONT_FAMILIES = {
  courier:   "'Courier New', Courier, monospace",
  jetbrains: "'JetBrains Mono', monospace",
  ibmplex:   "'IBM Plex Mono', monospace",
  roboto:    "'Roboto Mono', monospace",
  space:     "'Space Mono', monospace",
};

export const DENSITY_PAD = {
  compact:  "3px 6px",
  default:  "6px 8px",
  relaxed:  "10px 8px",
};

export const COLUMN_SCALE = {
  narrow:  0.75,
  default: 1.0,
  wide:    1.35,
};

// Shared table header/cell styles — used by the Logbook and Flight Summary tabs.
export const thStyle = {
  padding: "7px 8px",
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
  padding: "var(--elb-row-pad, 6px 8px)",
  borderBottom: "1px solid var(--elb-border3, #0f1820)",
  borderRight: "1px solid var(--elb-bg2, #0d1520)",
  whiteSpace: "nowrap",
  fontSize: "var(--elb-td-sz, 13px)",
  overflow: "hidden",
  textOverflow: "ellipsis",
};
