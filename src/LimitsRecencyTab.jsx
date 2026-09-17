import { getCoords } from "./airportCoords";
import {
  parseHHMM, toHHMM, isPointDay,
  getAllSectors, rollingMins, rolling12MonthFlightMins, ftlCls,
} from "./logbookCalculations";
import { FTL_COLOR, FTL_BG, FTL_BORDER } from "./logbookConstants";

export default function LimitsRecencyTab({ data, settings, setActivePopup }) {
  const dutyBufferMins = settings.useStandardFormula === false
    ? 0
    : (Number(settings.preFlightBuffer) || 0) + (Number(settings.postFlightBuffer) || 0);

  const allSectors = getAllSectors(data, dutyBufferMins, settings.dayNightMethod);

  // ── FTL computations (live from logbook data) ──────────────────────────────
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const ft28dMins   = rollingMins(allSectors, 28,  "flightMins", today);
  const ft12mMins   = rolling12MonthFlightMins(allSectors, today);
  const duty7dMins  = rollingMins(allSectors,  7,  "dutyMins",   today);
  const duty14dMins = rollingMins(allSectors, 14,  "dutyMins",   today);
  const duty28dMins = rollingMins(allSectors, 28,  "dutyMins",   today);

  const ftlLimits = [
    { key: "ft28d", label: "ANY 28 CONSECUTIVE DAYS",           used: ft28dMins,   max: 100 * 60, popupId: "ftl-28d" },
    { key: "ft12m", label: "ANY 12 MONTHS (END OF PREV MONTH)", used: ft12mMins,   max: 900 * 60, popupId: "ftl-12m" },
  ];
  const dutyLimits = [
    { key: "duty7d",  label: "DUTY — ANY 7 CONSECUTIVE DAYS",  used: duty7dMins,  max:  55 * 60, popupId: "duty-7d"  },
    { key: "duty14d", label: "DUTY — ANY 14 CONSECUTIVE DAYS", used: duty14dMins, max:  95 * 60, popupId: "duty-14d" },
    { key: "duty28d", label: "DUTY — ANY 28 CONSECUTIVE DAYS", used: duty28dMins, max: 190 * 60, popupId: "duty-28d" },
  ];

  const allComputedLimits = [...ftlLimits, ...dutyLimits].map(l => ({
    ...l,
    rawPct: l.max ? (l.used / l.max) * 100 : 0,
    status: ftlCls(l.max ? (l.used / l.max) * 100 : 0),
  }));

  const bannerCls = allComputedLimits.some(l => l.status === "red")    ? "red"
                  : allComputedLimits.some(l => l.status === "yellow") ? "yellow"
                  : "green";

  const bannerMessages = {
    green:  { icon: "✅", label: "ALL LIMITS WITHIN RANGE — FULLY COMPLIANT",    text: "All flight time and cumulative duty limits are well within regulatory requirements. No action required at this time." },
    yellow: { icon: "⚠️", label: "APPROACHING LIMIT — ACTION REQUIRED",           text: "One or more limits are within 10% of the regulatory maximum. Monitor closely before accepting your next duty assignment." },
    red:    { icon: "🚨", label: "LIMIT EXCEEDED — REGULATORY VIOLATION",         text: "One or more regulatory limits have been exceeded. Immediate action required — notify your Chief Pilot and CAAM Operations." },
  };
  const bannerInfo = bannerMessages[bannerCls];

  // Unique aircraft types found in logbook for recency dropdown
  const aircraftTypes = [...new Set(allSectors.map(s => s.type).filter(Boolean))].sort();

  // ── Takeoff & Landing Recency computation ────────────────────────────────
  const cutoff90 = new Date(today);
  cutoff90.setDate(today.getDate() - 90);
  cutoff90.setHours(0, 0, 0, 0);

  // Helper: determine if takeoff/landing is day or night based on settings
  const isDayTakeoffDynamic = (sector) => {
    if (settings.dayNightMethod === "sunrise") {
      const stdM = parseHHMM(sector.std);
      const depMs = Date.UTC(sector.date.getFullYear(), sector.date.getMonth(), sector.date.getDate()) + stdM * 60000;
      const isDay = isPointDay(sector.departure, depMs);
      if (isDay !== null) return isDay;
    }
    return sector.isDayTakeoff;
  };

  const isDayLandingDynamic = (sector) => {
    if (settings.dayNightMethod === "sunrise") {
      // Use arrival airport coords for landing classification; fall back to departure if arrival unknown
      const landingIcao = (sector.arrival && getCoords(sector.arrival)) ? sector.arrival : sector.departure;
      let stdM = parseHHMM(sector.std), staM = parseHHMM(sector.sta);
      if (staM <= stdM) staM += 1440;
      const arrMs = Date.UTC(sector.date.getFullYear(), sector.date.getMonth(), sector.date.getDate()) + staM * 60000;
      const isDay = isPointDay(landingIcao, arrMs);
      if (isDay !== null) return isDay;
    }
    return sector.isDayLanding;
  };

  // Build recency data for all aircraft types
  const getRecencyExpiry = (arr) => {
    if (arr.length < 3) return null;
    const exp = new Date(arr[arr.length - 3].date);
    exp.setDate(exp.getDate() + 90);
    return exp;
  };

  const allRecencyByType = {};
  aircraftTypes.forEach(type => {
    const allPfForType = allSectors
      .filter(s => s.type === type && s.pilotFlying && s.date <= today)
      .sort((a, b) => a.date - b.date);

    const pf90 = allPfForType.filter(s => s.date > cutoff90);

    const dayTakeoffs90   = pf90.filter(s =>  isDayTakeoffDynamic(s)).length;
    const nightTakeoffs90 = pf90.filter(s => !isDayTakeoffDynamic(s)).length;
    const dayLandings90   = pf90.filter(s =>  isDayLandingDynamic(s)).length;
    const nightLandings90 = pf90.filter(s => !isDayLandingDynamic(s)).length;

    const dayTOExpiry    = getRecencyExpiry(allPfForType.filter(s =>  isDayTakeoffDynamic(s)));
    const nightTOExpiry  = getRecencyExpiry(allPfForType.filter(s => !isDayTakeoffDynamic(s)));
    const dayLdgExpiry   = getRecencyExpiry(allPfForType.filter(s =>  isDayLandingDynamic(s)));
    const nightLdgExpiry = getRecencyExpiry(allPfForType.filter(s => !isDayLandingDynamic(s)));

    allRecencyByType[type] = {
      dayTakeoffs90, nightTakeoffs90, dayLandings90, nightLandings90,
      dayTOExpiry, nightTOExpiry, dayLdgExpiry, nightLdgExpiry
    };
  });


  const fmtRecencyDate = (d) =>
    d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase() : null;

  // ── Autoland Recency computation ──────────────────────────────────────────
  let lastAutolandDate = null;
  const autolandDates = [];
  Object.entries(data).forEach(([key, rows]) => {
    if (!Array.isArray(rows)) return;
    const parts = key.split("-");
    const monthIdx = parseInt(parts[0]);
    const year = parseInt(parts[1]);
    if (isNaN(monthIdx) || isNaN(year)) return;
    rows.forEach(row => {
      if (row.autoland && row.date) {
        const [dd] = row.date.split('/');
        const day = parseInt(dd);
        if (!day || day < 1 || day > 31) return;
        const d = new Date(year, monthIdx, day);
        d.setHours(12, 0, 0, 0);
        if (d > today) return;
        autolandDates.push(d);
        if (!lastAutolandDate || d > lastAutolandDate) {
          lastAutolandDate = d;
        }
      }
    });
  });

  // Count autolands within last 6 months
  const cutoff6m = new Date(today);
  cutoff6m.setDate(today.getDate() - 180);
  cutoff6m.setHours(0, 0, 0, 0);
  const autoland6m = autolandDates.filter(d => d > cutoff6m).length;
  const autolandCurrent = autoland6m >= 3;

  const daysSinceAutoland = lastAutolandDate
    ? Math.floor((today - lastAutolandDate) / (1000 * 60 * 60 * 24))
    : null;

  // ── Render helper: FTL/Duty limit card ────────────────────────────────────
  const renderLimitCard = (l) => {
    const pct    = Math.min(l.rawPct, 100);
    const status = l.status;
    const c      = FTL_COLOR[status];
    const remaining = l.max - l.used;
    const remStr = remaining >= 0
      ? `${status === "green" ? "✓" : "⚠"} ${toHHMM(remaining) || "00:00"} REMAINING`
      : `🚨 ${toHHMM(-remaining)} OVER LIMIT`;

    return (
      <div key={l.key} style={{
        background: "var(--elb-bg2, #0d1520)",
        border: `1px solid var(--elb-border2, #0f1e2d)`,
        borderLeft: `3px solid ${c}`,
        borderRadius: 4,
        padding: 12,
        minWidth: 220,
        flex: "1 1 220px",
      }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.08em", color: "var(--elb-txt-muted, #4a6a8a)", lineHeight: 1.4 }}>{l.label}</div>
          <div style={{
            width: 7, height: 7, borderRadius: "50%", marginTop: 2, flexShrink: 0,
            background: c,
            boxShadow: `0 0 6px ${c}`,
            animation: status !== "green" ? `blink ${status === "red" ? "0.8" : "1.5"}s ease infinite` : "none",
          }} />
        </div>
        {/* Numbers */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
          <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color: c, fontFamily: "'Courier New',monospace" }}>
            {toHHMM(l.used) || "00:00"}
          </div>
          <div style={{ fontSize: 15, color: "var(--elb-txt-muted, #4a6a8a)" }}>&nbsp;/&nbsp;</div>
          <div style={{ fontSize: 15, color: "var(--elb-txt-muted, #4a6a8a)" }}>{toHHMM(l.max)}</div>
          <div style={{ fontSize: "var(--elb-desc-sz)", color: "var(--elb-txt-muted, #4a6a8a)", marginLeft: 2 }}>HR</div>
        </div>
        {/* Progress bar */}
        <div style={{ background: "var(--elb-bg3, #0a1018)", borderRadius: 2, height: 4, marginBottom: 8, overflow: "hidden", border: "1px solid var(--elb-border2, #0f1e2d)" }}>
          <div style={{ height: "100%", borderRadius: 2, background: c, width: `${pct.toFixed(1)}%`, transition: "width 0.4s ease" }} />
        </div>
        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.04em", color: c }}>{remStr}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: "var(--elb-hint-sz)", color: "var(--elb-txt-muted, #4a6a8a)" }}>{l.rawPct.toFixed(1)}% USED</div>
            <button
              onClick={() => setActivePopup(l.popupId)}
              title="View regulatory reference"
              style={{
                width: 16, height: 16, borderRadius: "50%",
                background: "transparent",
                border: "1px solid #1e3a55",
                color: "#2d5070",
                fontFamily: "Georgia,serif",
                fontStyle: "italic", fontWeight: 700,
                fontSize: 12,
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: 0, lineHeight: 1,
                transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#4fc3f7"; e.currentTarget.style.color = "#4fc3f7"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e3a55"; e.currentTarget.style.color = "#2d5070"; }}
            >i</button>
          </div>
        </div>
      </div>
    );
  };

  // ── Section header helper ──────────────────────────────────────────────────
  const SectionHeader = ({ icon, title, popupId }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, marginTop: 20 }}>
      <div style={{ fontSize: "var(--elb-th-sz)", letterSpacing: "0.18em", color: "var(--elb-acc, #4fc3f7)", whiteSpace: "nowrap" }}>
        {icon} {title}
      </div>
      <div style={{ flex: 1, height: 1, background: "var(--elb-border2, #1a3050)" }} />
      {popupId && (
        <button
          onClick={() => setActivePopup(popupId)}
          title="View regulatory reference"
          style={{
            width: 16, height: 16, borderRadius: "50%",
            background: "transparent", border: "1px solid var(--elb-border, #1e3a55)",
            color: "var(--elb-txt-muted, #2d5070)", fontFamily: "Georgia,serif",
            fontStyle: "italic", fontWeight: 700, fontSize: 12,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            padding: 0, lineHeight: 1, flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--elb-acc, #4fc3f7)"; e.currentTarget.style.color = "var(--elb-acc, #4fc3f7)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--elb-border, #1e3a55)"; e.currentTarget.style.color = "var(--elb-txt-muted, #2d5070)"; }}
        >i</button>
      )}
    </div>
  );

  return (
    <div>

      {/* ── STATUS BANNER ── */}
      <div style={{
        borderRadius: 4,
        padding: "12px 16px",
        marginBottom: 14,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        gap: 12,
        flexWrap: "wrap",
        background: FTL_BG[bannerCls],
        border: `1px solid ${FTL_BORDER[bannerCls]}`,
        borderLeft: `3px solid ${FTL_COLOR[bannerCls]}`,
      }}>
        <div style={{ fontSize: 18, flexShrink: 0, paddingTop: 1 }}>{bannerInfo.icon}</div>
        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: FTL_COLOR[bannerCls], textAlign: "left" }}>
            {bannerInfo.label}
          </div>
          <div style={{ fontSize: "var(--elb-desc-sz)", color: "var(--elb-txt-muted, #4a6a8a)", marginTop: 3, letterSpacing: "0.04em", lineHeight: 1.5, textAlign: "left" }}>
            {bannerInfo.text}
          </div>
          <div style={{ marginTop: 6, fontSize: "var(--elb-hint-sz)", color: "var(--elb-txt-muted, #4a6a8a)", letterSpacing: "0.1em", textAlign: "left" }}>
            AS OF {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}
          </div>
        </div>
      </div>

      {/* ── FLIGHT TIME LIMITS — Para 2.18 ── */}
      <SectionHeader icon="✈" title="FLIGHT TIME LIMITS — CAD 1901 PARA 2.18" />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
        {ftlLimits.map(l => renderLimitCard({ ...l, rawPct: l.max ? (l.used / l.max) * 100 : 0, status: ftlCls(l.max ? (l.used / l.max) * 100 : 0) }))}
      </div>

      {/* ── CUMULATIVE DUTY — Para 2.19.1 ── */}
      <SectionHeader icon="📊" title="CUMULATIVE DUTY HOURS — CAD 1901 PARA 2.19.1" />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
        {dutyLimits.map(l => renderLimitCard({ ...l, rawPct: l.max ? (l.used / l.max) * 100 : 0, status: ftlCls(l.max ? (l.used / l.max) * 100 : 0) }))}
      </div>

      {/* ── TAKEOFF & LANDING RECENCY ── */}
      <SectionHeader icon="🛬" title="TAKEOFF & LANDING RECENCY — 3 WITHIN 90 DAYS" popupId="rec-tol" />

      {/* Explanation note */}
      <div style={{
        fontSize: "var(--elb-hint-sz)", color: "#3a5a7a", lineHeight: 1.7, letterSpacing: "0.03em",
        marginBottom: 16, borderLeft: "2px solid #1a3050", paddingLeft: 8, textAlign: "left",
      }}>
        Each sector with <span style={{ color: "#4fc3f7" }}>PILOT FLYING ✓</span> counts as 1 takeoff and 1 landing.
        Day / night is determined by <span style={{ color: "#4fc3f7" }}>STD</span> (takeoff) and{" "}
        <span style={{ color: "#4fc3f7" }}>STA</span> (landing) {settings.dayNightMethod === "sunrise" ? "using sunrise/sunset times at the departure airport" : "UTC times — civil day = 23:30–11:30 UTC, civil night = 11:30–23:30 UTC"}.
      </div>

      {/* Recency grid for all aircraft types */}
      {aircraftTypes.length === 0 ? (
        <div style={{
          background: "var(--elb-bg2, #0d1520)", border: "1px solid var(--cb-line, rgba(255,255,255,0.07))", borderRadius: 4,
          padding: 24, textAlign: "center", color: "var(--elb-txt-muted, #4a6a8a)",
          fontSize: 11, letterSpacing: "0.12em",
        }}>
          NO AIRCRAFT TYPES IN LOGBOOK
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          {aircraftTypes.map(type => {
            const recency = allRecencyByType[type];
            const anyRed = recency.dayTakeoffs90 < 3 || recency.dayLandings90 < 3 || recency.nightTakeoffs90 < 3 || recency.nightLandings90 < 3;
            const borderCol = anyRed ? "#ef4444" : "#22c55e";
            const dotCol = anyRed ? "#ef4444" : "#22c55e";

            const recencyCards = [
              { label: "☀ DAY TAKEOFFS",   count: recency.dayTakeoffs90,   expiry: recency.dayTOExpiry   },
              { label: "☀ DAY LANDINGS",   count: recency.dayLandings90,   expiry: recency.dayLdgExpiry  },
              { label: "☾ NIGHT TAKEOFFS", count: recency.nightTakeoffs90, expiry: recency.nightTOExpiry },
              { label: "☾ NIGHT LANDINGS", count: recency.nightLandings90, expiry: recency.nightLdgExpiry},
            ];

            return (
              <div key={type} style={{
                background: "var(--elb-bg2, #0d1520)", border: "1px solid var(--cb-line, rgba(255,255,255,0.07))",
                borderLeft: `3px solid ${borderCol}`, borderRadius: 4, padding: 16,
              }}>
                {/* Type badge + status dot */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ textAlign: "left" }}>
                    <div style={{
                      display: "inline-block", fontSize: "var(--elb-hint-sz)", letterSpacing: "0.12em",
                      padding: "2px 8px", borderRadius: 2, marginBottom: 6, fontWeight: 700,
                      background: "rgba(79,195,247,0.12)", border: "1px solid rgba(79,195,247,0.3)", color: "#4fc3f7",
                    }}>{type}</div>
                    <div style={{ fontSize: "var(--elb-desc-sz)", color: "var(--elb-txt-muted, #4a6a8a)", letterSpacing: "0.08em" }}>
                      TAKEOFF &amp; LANDING RECENCY · LAST 90 DAYS · MINIMUM 3 EACH
                    </div>
                  </div>
                  <div style={{
                    width: 7, height: 7, borderRadius: "50%", marginTop: 4, flexShrink: 0,
                    background: dotCol, boxShadow: `0 0 6px ${dotCol}`,
                    animation: anyRed ? "blink 0.8s ease infinite" : "none",
                  }} />
                </div>

                {/* Live recency counters */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                  {recencyCards.map(({ label, count, expiry }) => {
                    const ok = count >= 3;
                    const c  = ok ? "#22c55e" : "#ef4444";
                    const expiryStr = fmtRecencyDate(expiry);
                    const daysLeft = expiry
                      ? Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24))
                      : null;
                    return (
                      <div key={label} style={{
                        textAlign: "center", background: "var(--elb-bg3, #080b10)",
                        border: `1px solid ${ok ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                        borderTop: `2px solid ${c}`,
                        borderRadius: 3, padding: "10px 6px",
                      }}>
                        <div style={{ fontSize: "var(--elb-hint-sz)", color: "var(--elb-txt-muted, #4a6a8a)", letterSpacing: "0.1em", marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: c, fontFamily: "'Courier New',monospace" }}>
                          {count}
                        </div>
                        <div style={{ fontSize: "var(--elb-hint-sz)", color: "#2a4a6a", marginTop: 3 }}>REQ: 3 IN 90 DAYS</div>
                        <div style={{ fontSize: "var(--elb-hint-sz)", fontWeight: 700, letterSpacing: "0.08em", color: c, marginTop: 5 }}>
                          {ok ? "✓ CURRENT" : "✗ NOT CURRENT"}
                        </div>
                        {ok && expiryStr && (
                          <div style={{ fontSize: "var(--elb-hint-sz)", color: daysLeft !== null && daysLeft <= 14 ? "#eab308" : "#3a5a7a", marginTop: 3 }}>
                            EXP: {expiryStr}
                            {daysLeft !== null && daysLeft <= 14 && (
                              <span style={{ color: "#eab308" }}> ({daysLeft}d)</span>
                            )}
                          </div>
                        )}
                        {!ok && count > 0 && (
                          <div style={{ fontSize: "var(--elb-hint-sz)", color: "#ef4444", marginTop: 3 }}>
                            NEED {3 - count} MORE
                          </div>
                        )}
                        {!ok && count === 0 && (
                          <div style={{ fontSize: "var(--elb-hint-sz)", color: "#3a5a7a", marginTop: 3 }}>
                            NO DATA
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── AUTOLAND RECENCY ── */}
      <SectionHeader icon="🎯" title="AUTOLAND RECENCY — 3 WITHIN 6 MONTHS · ALL TYPES" popupId="rec-autoland" />
      <div style={{
        background: "var(--elb-bg2, #0d1520)", border: "1px solid var(--cb-line, rgba(255,255,255,0.07))",
        borderLeft: `3px solid ${autolandCurrent ? "#22c55e" : "#ef4444"}`, borderRadius: 4, padding: 16,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ textAlign: "left" }}>
            <div style={{
              display: "inline-block", fontSize: "var(--elb-hint-sz)", letterSpacing: "0.12em",
              padding: "2px 8px", borderRadius: 2, marginBottom: 6, fontWeight: 700,
              background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)", color: "#c084fc",
            }}>CAT III AUTOLAND</div>
            <div style={{ fontSize: "var(--elb-desc-sz)", color: "var(--elb-txt-muted, #4a6a8a)", letterSpacing: "0.08em" }}>
              ALL AIRCRAFT TYPES · LAST 6 MONTHS · MINIMUM 3
            </div>
          </div>
          <div style={{ width: 7, height: 7, borderRadius: "50%", marginTop: 4,
            background: autolandCurrent ? "#22c55e" : "#ef4444",
            boxShadow: `0 0 6px ${autolandCurrent ? "#22c55e" : "#ef4444"}`,
            animation: "blink 1.5s ease infinite" }} />
        </div>
        {lastAutolandDate ? (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12,
          }}>
            <div style={{
              background: "var(--elb-bg3, #080b10)", border: "1px solid rgba(234,179,8,0.2)",
              borderRadius: 3, padding: "12px 10px", textAlign: "center",
            }}>
              <div style={{ fontSize: "var(--elb-hint-sz)", color: "var(--elb-txt-muted, #4a6a8a)", letterSpacing: "0.1em", marginBottom: 6 }}>LAST AUTOLAND</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#4fc3f7", marginBottom: 3 }}>
                {fmtRecencyDate(lastAutolandDate)}
              </div>
              <div style={{ fontSize: "var(--elb-hint-sz)", color: "#eab308", fontWeight: 700, letterSpacing: "0.08em" }}>
                {daysSinceAutoland} DAYS AGO
              </div>
            </div>
            <div style={{
              background: "var(--elb-bg3, #080b10)", border: `1px solid ${autolandCurrent ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
              borderTop: `2px solid ${autolandCurrent ? "#22c55e" : "#ef4444"}`,
              borderRadius: 3, padding: "12px 10px", textAlign: "center",
            }}>
              <div style={{ fontSize: "var(--elb-hint-sz)", color: "var(--elb-txt-muted, #4a6a8a)", letterSpacing: "0.1em", marginBottom: 6 }}>STATUS · 6 MONTHS</div>
              <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, color: autolandCurrent ? "#22c55e" : "#ef4444", fontFamily: "'Courier New',monospace", marginBottom: 3 }}>
                {autoland6m}
              </div>
              <div style={{ fontSize: "var(--elb-hint-sz)", color: "var(--elb-txt-muted, #4a6a8a)", marginBottom: 6 }}>
                {autolandCurrent ? "REQ: 3 ✓" : "REQ: 3 — NEED " + (3 - autoland6m)}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: autolandCurrent ? "#22c55e" : "#ef4444", letterSpacing: "0.08em" }}>
                {autolandCurrent ? "✓ CURRENT" : "✗ NOT CURRENT"}
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.2)",
            borderLeft: "3px solid rgba(234,179,8,0.5)", borderRadius: "0 4px 4px 0",
            padding: "12px 16px",
          }}>
            <div style={{ fontSize: "var(--elb-desc-sz)", color: "#eab308", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>
              ⏳ NO AUTOLAND ENTRIES FOUND
            </div>
            <div style={{ fontSize: "var(--elb-desc-sz)", color: "var(--elb-txt-muted, #4a6a8a)", lineHeight: 1.8, letterSpacing: "0.03em" }}>
              Check the <span style={{ color: "#4fc3f7" }}>AUTOLAND checkbox</span> in the remarks window when logging autoland landings.
            </div>
          </div>
        )}
      </div>

      {/* ── DISCLAIMER ── */}
      <div style={{
        background: "rgba(79,195,247,0.04)", border: "1px solid rgba(79,195,247,0.1)",
        borderRadius: 4, padding: "10px 14px", marginTop: 20,
        fontSize: "var(--elb-hint-sz)", color: "var(--elb-txt-muted, #4a6a8a)", letterSpacing: "0.04em", lineHeight: 1.7,
        textAlign: "left",
      }}>
        <span style={{ color: "#4fc3f7" }}>⚠ DISCLAIMER:</span> The information displayed is for{" "}
        <span style={{ color: "#4fc3f7" }}>references only</span> and is solely based on logbook data.
        Compliance with <span style={{ color: "#4fc3f7" }}>CAD 1901</span> and{" "}
        <span style={{ color: "#4fc3f7" }}>MCAR 2016 Part 69 &amp; Part 74</span> remains the users responsibility.
      </div>

    </div>
  );
}
