import { useState, useEffect } from "react";

// ── Design tokens ─────────────────────────────────────────────────────────────
const A   = "var(--elb-accent, #3FE0C5)";
const MINT = "#3FE0C5"; // fixed brand mint for the modal shell — matches Settings modal, not the user-customizable accent
const FONT_DISPLAY = "'Tourney', system-ui, sans-serif";
const BG  = "#060b14";
const BG2 = "#0a0f1a";
const BDR = "#1e3a5f";
const F   = "'JetBrains Mono','Courier New',monospace";
const TXT = "#c8dce8";
const MUT = "#5a8aaa";
const DIM = "#3a6a8a";

// ── Shared primitives ─────────────────────────────────────────────────────────

function MockField({ label, value }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, letterSpacing: "0.12em", color: DIM, marginBottom: 4, fontFamily: F }}>{label}</div>
      <div style={{ background: BG, border: `1px solid ${BDR}`, borderRadius: 4, padding: "7px 10px", fontSize: 12, color: TXT, fontFamily: F, letterSpacing: "0.04em" }}>{value}</div>
    </div>
  );
}

function MockBtn({ label, primary }) {
  return (
    <div style={{
      background: primary ? "rgba(63,224,197,0.10)" : "transparent",
      border: `1px solid ${primary ? A : BDR}`,
      borderRadius: 4, padding: "8px 0", textAlign: "center",
      color: primary ? A : MUT,
      fontSize: 11, letterSpacing: "0.12em", fontFamily: F,
      fontWeight: primary ? 700 : 400, marginBottom: 8,
    }}>{label}</div>
  );
}

function Note({ children }) {
  return (
    <div style={{
      background: "rgba(63,224,197,0.05)", border: `1px solid rgba(63,224,197,0.2)`,
      borderLeft: `3px solid ${A}`, borderRadius: 4,
      padding: "10px 14px", fontSize: 12, color: "#b8d6e5",
      margin: "14px 0", lineHeight: 1.7, fontFamily: F,
    }}>⚠ {children}</div>
  );
}

function Tip({ children }) {
  return (
    <div style={{
      background: "rgba(59,141,255,0.05)", border: "1px solid rgba(59,141,255,0.2)",
      borderLeft: "3px solid #3B8DFF", borderRadius: 4,
      padding: "10px 14px", fontSize: 12, color: "#b8d6e5",
      margin: "14px 0", lineHeight: 1.7, fontFamily: F,
    }}>💡 {children}</div>
  );
}

// ── Section 1 mockups ─────────────────────────────────────────────────────────

function LandingMockup() {
  return (
    <div style={{ background: BG, border: `1px solid ${BDR}`, borderRadius: 6, padding: "24px 28px", margin: "14px 0 20px", textAlign: "center" }}>
      <div style={{ width: 52, height: 52, borderRadius: 12, background: BG2, border: `1px solid ${BDR}`, margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: A, fontSize: 22, fontWeight: 700, fontFamily: F }}>C</span>
      </div>
      <div style={{ fontSize: 13, letterSpacing: "0.22em", color: "#e2eef5", fontWeight: 700, fontFamily: "'Tourney',system-ui,sans-serif", marginBottom: 2 }}>CLAUDEBORNE</div>
      <div style={{ fontSize: 9, letterSpacing: "0.14em", color: DIM, marginBottom: 22, fontFamily: F }}>eLOGBOOK · CAAM / MCAR 2016</div>
      <div style={{ maxWidth: 240, margin: "0 auto" }}>
        <MockBtn label="SIGN UP" primary />
        <MockBtn label="LOG IN" />
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0" }}>
          <div style={{ flex: 1, height: 1, background: BDR }} />
          <span style={{ fontSize: 9, color: DIM, letterSpacing: "0.08em", fontFamily: F }}>OR</span>
          <div style={{ flex: 1, height: 1, background: BDR }} />
        </div>
        <MockBtn label="G  CONTINUE WITH GOOGLE" />
      </div>
    </div>
  );
}

function SignUpMockup() {
  return (
    <div style={{ background: BG, border: `1px solid ${BDR}`, borderRadius: 6, padding: "20px 24px", margin: "14px auto 20px", maxWidth: 360 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.16em", color: A, fontWeight: 700, marginBottom: 16, fontFamily: F }}>CREATE ACCOUNT</div>
      <MockField label="EMAIL ADDRESS" value="pilot@example.com" />
      <MockField label="PASSWORD" value="••••••••••" />
      <MockField label="CONFIRM PASSWORD" value="••••••••••" />
      <div style={{ marginTop: 14 }}><MockBtn label="SIGN UP" primary /></div>
      <div style={{ fontSize: 10, color: DIM, letterSpacing: "0.06em", marginTop: 8, fontFamily: F }}>A verification email will be sent to your inbox.</div>
    </div>
  );
}

function PilotProfileMockup() {
  return (
    <div style={{ background: BG, border: `1px solid ${BDR}`, borderRadius: 6, padding: "20px 24px", margin: "14px auto 20px", maxWidth: 360 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.16em", color: A, fontWeight: 700, marginBottom: 16, fontFamily: F }}>PILOT PROFILE</div>
      <MockField label="FULL NAME" value="CAPT. AMIR RASHID" />
      <MockField label="LICENCE NUMBER" value="ML-ATPL-XXXXX" />
      <MockField label="LICENCE TYPE" value="ATPL(A)" />
      <MockField label="AIRLINE / OPERATOR" value="YOUR AIRLINE" />
      <div style={{ marginTop: 14 }}><MockBtn label="SAVE PROFILE" primary /></div>
    </div>
  );
}

// ── Section 2 mockups ─────────────────────────────────────────────────────────

function IOSShareMockup() {
  return (
    <div style={{ background: BG, border: `1px solid ${BDR}`, borderRadius: 6, margin: "14px auto 20px", maxWidth: 300, overflow: "hidden" }}>
      <div style={{ background: BG2, padding: "8px 12px", borderBottom: `1px solid ${BDR}`, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, background: BG, border: `1px solid ${BDR}`, borderRadius: 10, padding: "4px 10px", fontSize: 10, color: MUT, fontFamily: F }}>claudeborne.my</div>
        <span style={{ color: A, fontSize: 13 }}>⎙</span>
      </div>
      {["Copy", "Add Bookmark", "Add to Favourites", "Find on Page"].map(item => (
        <div key={item} style={{ padding: "10px 16px", fontSize: 11, color: MUT, fontFamily: F, borderBottom: `1px solid ${BG2}` }}>{item}</div>
      ))}
      <div style={{ padding: "10px 16px", fontSize: 11, color: A, fontFamily: F, fontWeight: 700, background: "rgba(63,224,197,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
        <span>⊞</span> Add to Home Screen
      </div>
    </div>
  );
}

function AndroidInstallMockup() {
  return (
    <div style={{ background: BG, border: `1px solid ${BDR}`, borderRadius: 6, padding: 16, margin: "14px auto 20px", maxWidth: 320 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: BG2, border: `1px solid ${BDR}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ color: A, fontSize: 16, fontWeight: 700, fontFamily: F }}>C</span>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#e2eef5", fontFamily: F, letterSpacing: "0.06em" }}>ClaudeBorne eLogBook</div>
          <div style={{ fontSize: 10, color: DIM, fontFamily: F }}>claudeborne.my</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: MUT, fontFamily: F, marginBottom: 14, lineHeight: 1.6 }}>Add to your home screen for quick access and offline use.</div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <div style={{ padding: "6px 14px", border: `1px solid ${BDR}`, borderRadius: 4, fontSize: 11, color: MUT, fontFamily: F }}>CANCEL</div>
        <div style={{ padding: "6px 14px", border: `1px solid ${A}`, borderRadius: 4, fontSize: 11, color: A, fontFamily: F, fontWeight: 700, background: "rgba(63,224,197,0.1)" }}>INSTALL</div>
      </div>
    </div>
  );
}

function HomeScreenMockup() {
  const icons = ["📷", "📧", "🗺", "📱", null, "📅", "⚙️", "🎵"];
  return (
    <div style={{ background: BG, border: `1px solid ${BDR}`, borderRadius: 6, padding: 16, margin: "14px auto 20px", maxWidth: 240 }}>
      <div style={{ fontSize: 9, color: DIM, fontFamily: F, letterSpacing: "0.08em", marginBottom: 12, textAlign: "center" }}>HOME SCREEN</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {icons.map((icon, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: icon === null ? BG2 : "#0f1e30", border: icon === null ? `2px solid ${A}` : `1px solid ${BDR}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: icon === null ? "0 0 8px rgba(63,224,197,0.25)" : "none" }}>
              {icon === null
                ? <span style={{ color: A, fontSize: 18, fontWeight: 700, fontFamily: "'Tourney',system-ui,sans-serif" }}>C</span>
                : <span style={{ fontSize: 18 }}>{icon}</span>}
            </div>
            {icon === null && <div style={{ fontSize: 8, color: A, fontFamily: F, letterSpacing: "0.05em" }}>eLogBook</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section 3 mockups ─────────────────────────────────────────────────────────

function AppOverviewMockup() {
  const iconBtn = (label) => (
    <div key={label} title={label} style={{ width: 28, height: 28, border: `1px solid ${BDR}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: A, fontSize: 12, fontFamily: F, cursor: "default" }}>{label}</div>
  );
  return (
    <div style={{ background: BG, border: `1px solid ${BDR}`, borderRadius: 6, margin: "14px 0 20px", overflow: "hidden" }}>
      {/* Topbar */}
      <div style={{ background: BG2, borderBottom: `1px solid ${BDR}`, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: BG, border: `1px solid ${BDR}`, display: "flex", alignItems: "center", justifyContent: "center", color: A, fontSize: 14, fontWeight: 700, fontFamily: "'Tourney',system-ui,sans-serif" }}>C</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: A, fontFamily: "'Tourney',system-ui,sans-serif" }}>CLAUDEBORNE</div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.28)", letterSpacing: "0.16em", fontFamily: F }}>ELOGBOOK</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: TXT, fontFamily: F, fontWeight: 700, letterSpacing: "0.1em" }}>CAPT. AMIR RASHID</div>
            <div style={{ fontSize: 9, color: DIM, fontFamily: F }}>YOUR AIRLINE</div>
          </div>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg, #3FE0C5 0%, #3B8DFF 100%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#0a1020", fontFamily: "'Tourney',system-ui,sans-serif" }}>A</div>
        </div>
      </div>

      {/* Page header */}
      <div style={{ background: "#0d1117", borderBottom: `1px solid ${BDR}`, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.04em", fontFamily: "'Tourney',system-ui,sans-serif" }}>
            <span style={{ color: TXT }}>JUNE </span>
            <span style={{ color: A }}>2026</span>
          </div>
          <div style={{ fontSize: 9, letterSpacing: "0.2em", color: A, fontFamily: F, margin: "3px 0 4px" }}>FLIGHT RECORDS</div>
          <div style={{ fontSize: 10, color: DIM, fontFamily: F }}>CAAM · MCAR 2016</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 9, color: DIM, fontFamily: F, letterSpacing: "0.12em" }}>SELECT PERIOD</span>
            <div style={{ background: BG, border: `1px solid ${BDR}`, borderRadius: 3, padding: "3px 10px", fontSize: 10, color: TXT, fontFamily: F }}>JUNE ▾</div>
            <div style={{ background: BG, border: `1px solid ${BDR}`, borderRadius: 3, padding: "3px 10px", fontSize: 10, color: TXT, fontFamily: F }}>2026 ▾</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["↻", "⬡", "⚙", "⏻"].map(iconBtn)}
          </div>
        </div>
      </div>

      {/* Tab bar — 3 tabs, matching current app exactly */}
      <div style={{ display: "flex", borderBottom: `1px solid ${BDR}`, background: BG }}>
        {[
          { label: "📋 LOGBOOK", active: true },
          { label: "📊 FLIGHT SUMMARY", active: false },
          { label: "⏱ LIMITS & RECENCY", active: false },
        ].map((t, i) => (
          <div key={i} style={{
            padding: "8px 16px", fontSize: 11, fontFamily: F, letterSpacing: "0.1em",
            color: t.active ? A : MUT,
            borderTop: `2px solid ${t.active ? A : "transparent"}`,
            borderLeft: t.active ? `1px solid ${BDR}` : "none",
            borderRight: t.active ? `1px solid ${BDR}` : "none",
            background: t.active ? BG : "transparent",
            marginBottom: t.active ? -1 : 0,
          }}>{t.label}</div>
        ))}
      </div>
    </div>
  );
}

// ── Section 4 mockups ─────────────────────────────────────────────────────────

function LogbookTableMockup() {
  const thS = { background: "#0b1320", color: MUT, fontSize: 9, letterSpacing: "0.12em", fontWeight: 700, padding: "5px 7px", border: "1px solid #111820", fontFamily: F, textAlign: "center", whiteSpace: "nowrap" };
  const tdS = { padding: "4px 7px", border: "1px solid #111820", fontFamily: F, fontSize: 11, textAlign: "center", whiteSpace: "nowrap" };

  const capBadge = (label, color, bg, bdr) => (
    <span style={{ background: bg, border: `1px solid ${bdr}`, color, borderRadius: 3, padding: "2px 6px", fontSize: 9, fontFamily: F, fontWeight: 700 }}>{label} ▾</span>
  );
  const chkYes = (
    <span style={{ display: "inline-block", width: 13, height: 13, background: "rgba(63,224,197,0.12)", border: `1px solid ${A}`, borderRadius: 2, position: "relative" }}>
      <span style={{ position: "absolute", top: -2, left: 1, color: A, fontSize: 10, fontWeight: 700 }}>✓</span>
    </span>
  );
  const chkNo = <span style={{ display: "inline-block", width: 13, height: 13, background: "transparent", border: `1px solid ${BDR}`, borderRadius: 2 }} />;

  return (
    <div style={{ margin: "14px 0 20px", border: `1px solid ${BDR}`, borderRadius: 6, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th rowSpan={2} style={thS}>#</th>
              <th rowSpan={2} style={thS}>DATE</th>
              <th colSpan={2} style={{ ...thS, color: "#7ab8d4", borderBottom: "1px solid #1a3050" }}>AIRCRAFT</th>
              <th rowSpan={2} style={thS}>CAPTAIN</th>
              <th rowSpan={2} style={{ ...thS, lineHeight: 1.35 }}>HOLDER<br />OP. CAP.</th>
              <th rowSpan={2} style={thS}>P.F.</th>
              <th colSpan={2} style={{ ...thS, color: "#7ab8d4", borderBottom: "1px solid #1a3050" }}>SECTORS</th>
              <th rowSpan={2} style={thS}>STD</th>
              <th rowSpan={2} style={thS}>STA</th>
              <th colSpan={3} style={{ ...thS, color: "#f5c542", borderBottom: "1px solid #1a3050" }}>☀ DAY</th>
              <th colSpan={3} style={{ ...thS, color: "#7ab8d4", borderBottom: "1px solid #1a3050" }}>☾ NIGHT</th>
              <th rowSpan={2} style={{ ...thS, color: A }}>TOTAL</th>
            </tr>
            <tr>
              <th style={thS}>TYPE</th><th style={thS}>REG</th>
              <th style={thS}>DEP</th><th style={thS}>ARR</th>
              <th style={{ ...thS, color: "#22c55e" }}>P1</th>
              <th style={{ ...thS, color: "#ef4444" }}>P1 U/S</th>
              <th style={{ ...thS, color: "#eab308" }}>P2</th>
              <th style={{ ...thS, color: "#4fc3f7" }}>P1</th>
              <th style={{ ...thS, color: "#ef4444" }}>P1 U/S</th>
              <th style={{ ...thS, color: "#4fc3f7" }}>P2</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: "#0a0d12" }}>
              <td style={{ ...tdS, color: "#2a4a6a" }}>1</td>
              <td style={{ ...tdS, color: TXT }}>15</td>
              <td style={{ ...tdS, color: TXT }}>B737-8</td>
              <td style={{ ...tdS, color: TXT }}>9M-XXX</td>
              <td style={{ ...tdS, color: TXT }}>SELF</td>
              <td style={tdS}>{capBadge("P1", "#22c55e", "rgba(34,197,94,0.12)", "rgba(34,197,94,0.3)")}</td>
              <td style={tdS}>{chkYes}</td>
              <td style={{ ...tdS, color: TXT }}>WMKK</td>
              <td style={{ ...tdS, color: TXT }}>WBKK</td>
              <td style={{ ...tdS, color: DIM }}>08:30</td>
              <td style={{ ...tdS, color: DIM }}>10:45</td>
              <td style={{ ...tdS, color: "#22c55e" }}>02:15</td>
              <td style={{ ...tdS, color: MUT }}>—</td>
              <td style={{ ...tdS, color: MUT }}>—</td>
              <td style={{ ...tdS, color: MUT }}>—</td>
              <td style={{ ...tdS, color: MUT }}>—</td>
              <td style={{ ...tdS, color: MUT }}>—</td>
              <td style={{ ...tdS, color: A, fontWeight: 700 }}>02:15</td>
            </tr>
            <tr style={{ background: "#0c1018" }}>
              <td style={{ ...tdS, color: "#2a4a6a" }}>2</td>
              <td style={{ ...tdS, color: TXT }}>18</td>
              <td style={{ ...tdS, color: TXT }}>B737-8</td>
              <td style={{ ...tdS, color: TXT }}>9M-XYZ</td>
              <td style={{ ...tdS, color: TXT }}>TAN J</td>
              <td style={tdS}>{capBadge("P2", "#eab308", "rgba(234,179,8,0.12)", "rgba(234,179,8,0.3)")}</td>
              <td style={tdS}>{chkNo}</td>
              <td style={{ ...tdS, color: TXT }}>WBKK</td>
              <td style={{ ...tdS, color: TXT }}>WMKK</td>
              <td style={{ ...tdS, color: DIM }}>23:30</td>
              <td style={{ ...tdS, color: DIM }}>01:45</td>
              <td style={{ ...tdS, color: MUT }}>—</td>
              <td style={{ ...tdS, color: MUT }}>—</td>
              <td style={{ ...tdS, color: MUT }}>—</td>
              <td style={{ ...tdS, color: "#4fc3f7" }}>01:30</td>
              <td style={{ ...tdS, color: MUT }}>—</td>
              <td style={{ ...tdS, color: MUT }}>—</td>
              <td style={{ ...tdS, color: A, fontWeight: 700 }}>01:30</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ padding: "8px 14px", background: "#080b10", borderTop: "1px solid #0f1820" }}>
        <span style={{ background: "transparent", border: `1px solid ${BDR}`, borderRadius: 3, color: A, fontFamily: F, fontSize: 10, letterSpacing: "0.15em", padding: "5px 14px", fontWeight: 700 }}>✚ ADD SECTOR</span>
      </div>
    </div>
  );
}

function HOCMockup() {
  const opts = [
    { label: "P1",     desc: "Pilot in Command",                       color: "#22c55e", bg: "rgba(34,197,94,0.12)",  bdr: "rgba(34,197,94,0.3)" },
    { label: "P2",     desc: "Co-Pilot / Second in Command",           color: "#eab308", bg: "rgba(234,179,8,0.12)",  bdr: "rgba(234,179,8,0.3)" },
    { label: "P1 U/S", desc: "Pilot in Command Under Supervision",     color: "#ef4444", bg: "rgba(239,68,68,0.12)",  bdr: "rgba(239,68,68,0.3)" },
  ];
  return (
    <div style={{ margin: "14px 0 20px", background: BG, border: `1px solid ${BDR}`, borderRadius: 6, padding: "14px 16px" }}>
      <div style={{ fontSize: 9, letterSpacing: "0.16em", color: DIM, fontFamily: F, marginBottom: 12 }}>HOLDER OPERATING CAPACITY — OPTIONS</div>
      {opts.map(o => (
        <div key={o.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ background: o.bg, border: `1px solid ${o.bdr}`, color: o.color, borderRadius: 3, padding: "3px 8px", fontSize: 10, fontFamily: F, fontWeight: 700, minWidth: 56, textAlign: "center" }}>{o.label}</span>
          <span style={{ fontSize: 11, color: TXT, fontFamily: F }}>{o.desc}</span>
        </div>
      ))}
    </div>
  );
}

// ── Section 5 mockups — Remarks ──────────────────────────────────────────────

function NumberColumnMockup() {
  const thS = { background: "#0b1320", color: MUT, fontSize: 9, letterSpacing: "0.12em", fontWeight: 700, padding: "5px 8px", borderBottom: "1px solid #111820", fontFamily: F, textAlign: "center", whiteSpace: "nowrap" };
  const tdS = { padding: "4px 8px", fontFamily: F, fontSize: 12, color: TXT, textAlign: "center", whiteSpace: "nowrap" };
  const rows = [
    { num: 1, color: "#6f93b8", ul: false, date: "12 JUN 26", dep: "DXB", arr: "LHR" },
    { num: 2, color: "#f5c542", ul: true,  date: "13 JUN 26", dep: "LHR", arr: "DXB" },
    { num: 3, color: "#a855f7", ul: true,  date: "14 JUN 26", dep: "DXB", arr: "SIN" },
    { num: 4, color: "#ec4899", ul: true,  date: "15 JUN 26", dep: "SIN", arr: "DXB" },
  ];
  return (
    <div style={{ margin: "14px 0 20px", border: `1px solid ${BDR}`, borderRadius: 6, overflow: "hidden" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontFamily: F }}>
        <thead>
          <tr>
            <th style={{ ...thS, width: 40 }}>#</th>
            <th style={thS}>DATE</th>
            <th style={thS}>TYPE</th>
            <th style={thS}>DEP</th>
            <th style={thS}>ARR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.num} style={{ background: i % 2 === 0 ? "#0a0d12" : "#0c1018" }}>
              <td style={{ ...tdS, padding: 0 }}>
                <button style={{
                  width: "100%", minHeight: 30, background: "transparent", border: "none",
                  cursor: "pointer", color: r.color, fontSize: 16, fontWeight: 700, fontFamily: F,
                  textDecoration: r.ul ? "underline" : "none", textUnderlineOffset: 3,
                  display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 2px",
                }}>{r.num}</button>
              </td>
              <td style={tdS}>{r.date}</td>
              <td style={tdS}>B777</td>
              <td style={tdS}>{r.dep}</td>
              <td style={tdS}>{r.arr}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ background: "#080b10", borderTop: "1px solid #0f1820", padding: "8px 14px", display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: "#6f93b8", fontFamily: F }}>● none</span>
        <span style={{ fontSize: 10, color: "#f5c542", fontFamily: F }}>● remarks</span>
        <span style={{ fontSize: 10, color: "#a855f7", fontFamily: F }}>● autoland</span>
        <span style={{ fontSize: 10, color: "#ec4899", fontFamily: F }}>● remarks + autoland</span>
      </div>
    </div>
  );
}

function RemarksPanelMockup() {
  return (
    <div style={{ background: "rgba(0,0,0,0.45)", borderRadius: 6, padding: 20, display: "flex", alignItems: "center", justifyContent: "center", margin: "14px 0 20px", minHeight: 300 }}>
      <div style={{ background: "#141a2e", border: `1px solid ${BDR}`, borderTop: "2px solid #4fc3f7", borderRadius: 6, padding: "20px 22px 18px", maxWidth: 420, width: "100%", fontFamily: F }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.16em", color: "#4fc3f7", marginBottom: 5 }}>ROW 2 · DATE 13 JUN 26</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#e8ecf5", letterSpacing: "0.07em" }}>REMARKS</div>
          </div>
          <div style={{ background: "transparent", border: `1px solid ${BDR}`, borderRadius: 3, color: "#7c87a3", fontSize: 12, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</div>
        </div>
        <div style={{ height: 1, background: BDR, marginBottom: 14 }} />
        <div style={{ background: "#0a1020", border: `1px solid ${BDR}`, borderRadius: 4, color: MUT, fontFamily: F, fontSize: 12, padding: "10px 12px", lineHeight: 1.6, minHeight: 90, boxSizing: "border-box", fontStyle: "italic" }}>Enter remarks for this sector…</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 6 }}>
          <div style={{ width: 14, height: 14, border: `1px solid ${BDR}`, borderRadius: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: "#b8c0d4", letterSpacing: "0.08em" }}>AUTOLAND</span>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <div style={{ background: "transparent", border: `1px solid ${BDR}`, borderRadius: 4, color: "#7c87a3", fontSize: 11, letterSpacing: "0.12em", padding: "6px 16px" }}>CANCEL</div>
          <div style={{ background: "rgba(79,195,247,0.08)", border: "1px solid #4fc3f7", borderRadius: 4, color: "#4fc3f7", fontSize: 11, letterSpacing: "0.12em", padding: "6px 20px", fontWeight: 700 }}>SAVE REMARKS</div>
        </div>
      </div>
    </div>
  );
}

// ── Section 6 mockups ─────────────────────────────────────────────────────────

function DayNightSettingMockup() {
  return (
    <div style={{ background: BG, border: `1px solid ${BDR}`, borderRadius: 6, padding: "16px 20px", margin: "14px auto 20px", maxWidth: 400 }}>
      <div style={{ fontSize: 9, letterSpacing: "0.12em", color: DIM, marginBottom: 12, fontFamily: F }}>SETTINGS → PREFERENCES · DAY/NIGHT METHOD</div>
      {[
        { label: "Fixed bands",  desc: "Night: 11:30 – 23:30 UTC. Simple, consistent.", selected: false },
        { label: "Route (sun)",  desc: "Sun below −6° along the great-circle route. Most accurate.", selected: true },
      ].map(opt => (
        <div key={opt.label} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", background: opt.selected ? "rgba(63,224,197,0.06)" : BG2, border: `1px solid ${opt.selected ? A : BDR}`, borderRadius: 4, marginBottom: 8 }}>
          <div style={{ width: 13, height: 13, borderRadius: "50%", border: `2px solid ${opt.selected ? A : DIM}`, background: opt.selected ? A : "transparent", flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 11, color: opt.selected ? A : TXT, fontFamily: F, letterSpacing: "0.06em", marginBottom: 2 }}>{opt.label}</div>
            <div style={{ fontSize: 9, color: DIM, fontFamily: F }}>{opt.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DayNightSplitMockup() {
  const cols = [
    { label: "STD",        value: "23:00", hi: false },
    { label: "STA",        value: "01:30", hi: false },
    { label: "☀ DAY P1",  value: "00:30", hi: true, color: "#22c55e" },
    { label: "☾ NIGHT P1",value: "02:00", hi: true, color: "#4fc3f7" },
    { label: "TOTAL",      value: "02:30", hi: true, color: A },
  ];
  return (
    <div style={{ overflowX: "auto", margin: "14px 0 20px", border: `1px solid ${BDR}`, borderRadius: 6 }}>
      <table style={{ borderCollapse: "collapse", fontFamily: F, fontSize: 11, width: "100%" }}>
        <thead>
          <tr style={{ background: BG }}>
            {cols.map(c => (
              <th key={c.label} style={{ padding: "6px 10px", color: c.hi ? c.color : DIM, letterSpacing: "0.1em", fontWeight: 700, borderBottom: `2px solid ${c.hi ? c.color : BDR}`, borderRight: "1px solid #0f1e30", whiteSpace: "nowrap", textAlign: "center" }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr style={{ background: BG2 }}>
            {cols.map(c => (
              <td key={c.label} style={{ padding: "7px 10px", color: c.hi ? c.color : TXT, borderRight: "1px solid #0f1e30", textAlign: "center", whiteSpace: "nowrap", fontWeight: c.hi ? 600 : 400 }}>{c.value}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Section 7 mockups ─────────────────────────────────────────────────────────

function SyncStatusMockup() {
  const states = [
    { label: "✓ SYNCED",      color: "#22c55e", desc: "Data saved to cloud" },
    { label: "↻ SYNCING…",    color: "#f5c542", desc: "Upload in progress" },
    { label: "✗ SYNC FAILED", color: "#ef4444", desc: "Check your connection" },
    { label: "✈ OFFLINE",     color: "#f5c542", desc: "No network — local only" },
  ];
  return (
    <div style={{ background: BG, border: `1px solid ${BDR}`, borderRadius: 6, padding: "16px 20px", margin: "14px 0 20px" }}>
      <div style={{ fontSize: 9, letterSpacing: "0.14em", color: DIM, fontFamily: F, marginBottom: 12 }}>SYNC STATUS STATES</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {states.map(s => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, background: BG2, border: `1px solid ${BDR}`, borderRadius: 4, padding: "8px 10px" }}>
            <div style={{ width: 28, height: 28, border: `1px solid ${s.color}`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: s.color, fontSize: 11, flexShrink: 0, fontFamily: F, fontWeight: 700 }}>↻</div>
            <div>
              <div style={{ fontSize: 10, color: s.color, fontFamily: F, fontWeight: 700, letterSpacing: "0.08em" }}>{s.label}</div>
              <div style={{ fontSize: 9, color: DIM, fontFamily: F }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SyncConflictMockup() {
  return (
    <div style={{ background: BG, border: `1px solid ${BDR}`, borderRadius: 6, padding: "18px 20px", margin: "14px auto 20px", maxWidth: 380 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.14em", color: "#f0a830", fontWeight: 700, marginBottom: 6, fontFamily: F }}>⚠ SYNC CONFLICT DETECTED</div>
      <div style={{ fontSize: 11, color: MUT, fontFamily: F, marginBottom: 14, lineHeight: 1.6 }}>Your local data and cloud data differ. Choose which version to keep.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[
          { label: "LOCAL", date: "13 JUN 2026", time: "14:32 UTC", rows: "84 entries" },
          { label: "CLOUD", date: "13 JUN 2026", time: "09:15 UTC", rows: "81 entries" },
        ].map(opt => (
          <div key={opt.label} style={{ background: BG2, border: `1px solid ${BDR}`, borderRadius: 4, padding: "10px 12px" }}>
            <div style={{ fontSize: 9, color: A, letterSpacing: "0.12em", fontFamily: F, fontWeight: 700, marginBottom: 6 }}>{opt.label}</div>
            <div style={{ fontSize: 10, color: TXT, fontFamily: F }}>{opt.date}</div>
            <div style={{ fontSize: 10, color: MUT, fontFamily: F }}>{opt.time}</div>
            <div style={{ fontSize: 9, color: DIM, fontFamily: F, marginTop: 4 }}>{opt.rows}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ padding: "8px 0", border: `1px solid ${A}`, borderRadius: 4, textAlign: "center", fontSize: 11, color: A, fontFamily: F, fontWeight: 700, background: "rgba(63,224,197,0.08)" }}>KEEP LOCAL</div>
        <div style={{ padding: "8px 0", border: `1px solid ${BDR}`, borderRadius: 4, textAlign: "center", fontSize: 11, color: MUT, fontFamily: F }}>KEEP CLOUD</div>
      </div>
    </div>
  );
}

// ── Section 8 mockups ─────────────────────────────────────────────────────────

function ExportModalMockup() {
  return (
    <div style={{ background: BG, border: `1px solid ${BDR}`, borderRadius: 6, overflow: "hidden", margin: "14px auto 20px", maxWidth: 380 }}>
      <div style={{ background: BG2, borderBottom: `1px solid ${BDR}`, padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 8, color: DIM, fontFamily: F, letterSpacing: "0.1em", marginBottom: 2 }}>DATA MANAGEMENT</div>
          <div style={{ fontSize: 11, color: A, letterSpacing: "0.14em", fontFamily: F, fontWeight: 700 }}>🌐 EXPORT / IMPORT</div>
        </div>
        <span style={{ color: DIM, fontSize: 14 }}>✕</span>
      </div>
      <div style={{ display: "flex", borderBottom: `1px solid ${BDR}` }}>
        {["⬇ EXPORT", "⬆ IMPORT"].map((tab, i) => (
          <div key={tab} style={{ padding: "8px 20px", fontSize: 10, fontFamily: F, letterSpacing: "0.1em", color: i === 0 ? A : DIM, borderBottom: i === 0 ? `2px solid ${A}` : "none" }}>{tab}</div>
        ))}
      </div>
      <div style={{ padding: "16px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <MockField label="FROM" value="01 JAN 2026" />
          <MockField label="TO" value="13 JUN 2026" />
        </div>
        <MockBtn label="⬇ EXPORT" primary />
        <MockBtn label="⬇ EXPORT ALL" />
        <div style={{ fontSize: 10, color: DIM, fontFamily: F, letterSpacing: "0.05em", marginTop: 2, lineHeight: 1.5 }}>Export All skips the date range and downloads every flight in your logbook.</div>
      </div>
    </div>
  );
}

function ExcelSheetsMockup() {
  const tabs = ["Profile", "Carry Forward", "Flights", "Summary"];
  return (
    <div style={{ background: BG, border: `1px solid ${BDR}`, borderRadius: 6, overflow: "hidden", margin: "14px auto 20px" }}>
      <div style={{ background: "#1a1a2e", padding: "16px 16px 12px" }}>
        <div style={{ fontSize: 9, color: "#5a7a6a", fontFamily: F, marginBottom: 8 }}>ClaudeBorne_eLogBook_Export_2026.xlsx</div>
        <div style={{ height: 28, background: "#0f1525", borderRadius: 2, opacity: 0.5 }} />
      </div>
      <div style={{ display: "flex", borderTop: `2px solid ${BDR}`, background: "#141420" }}>
        {tabs.map((tab, i) => (
          <div key={tab} style={{ padding: "7px 12px", fontSize: 10, fontFamily: F, letterSpacing: "0.05em", color: i === 2 ? "#0a0d12" : MUT, background: i === 2 ? A : "transparent", borderRight: `1px solid ${BDR}`, whiteSpace: "nowrap" }}>{tab}</div>
        ))}
      </div>
    </div>
  );
}

// ── Section 9 mockups ─────────────────────────────────────────────────────────

function CarryForwardMockup() {
  return (
    <div style={{ background: BG, border: `1px solid ${BDR}`, borderRadius: 6, overflow: "hidden", margin: "14px auto 20px", maxWidth: 420 }}>
      {/* Settings-style shell */}
      <div style={{ background: BG2, borderBottom: `1px solid ${BDR}`, padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 10, color: A, letterSpacing: "0.14em", fontFamily: F, fontWeight: 700 }}>SETTINGS</div>
        <span style={{ color: DIM, fontSize: 14 }}>✕</span>
      </div>
      {/* 4-tab bar */}
      <div style={{ display: "flex", borderBottom: `1px solid ${BDR}`, background: "#080f1a" }}>
        {["PROFILE", "APPEARANCE", "PREFERENCES", "MISC"].map((t, i) => (
          <div key={t} style={{ flex: 1, padding: "7px 4px", fontSize: 8, fontFamily: F, letterSpacing: "0.06em", color: i === 0 ? A : DIM, borderBottom: i === 0 ? `2px solid ${A}` : "none", textAlign: "center", fontWeight: i === 0 ? 700 : 400 }}>{t}</div>
        ))}
      </div>
      {/* Profile tab content — carry forward sub-section */}
      <div style={{ padding: "14px 16px" }}>
        <div style={{ fontSize: 9, letterSpacing: "0.14em", color: A, fontWeight: 700, fontFamily: F, marginBottom: 12 }}>// CARRY-FORWARD HOURS · per aircraft type · prior to using this app</div>
        <div style={{ background: BG2, border: `1px solid ${BDR}`, borderRadius: 4, padding: "10px 12px", marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: TXT, fontFamily: F, letterSpacing: "0.1em", marginBottom: 10, fontWeight: 700 }}>B737-8</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
            {[["☀ Day P1", "1200:00"], ["☀ Day P1 U/S", "340:00"], ["☾ Night P1", "60:00"], ["☾ Night P2", "12:00"]].map(([label, val]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, color: DIM, fontFamily: F }}>{label}</span>
                <span style={{ fontSize: 10, color: TXT, fontFamily: F }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
        <MockBtn label="+ ADD AIRCRAFT TYPE" />
      </div>
    </div>
  );
}

// ── Section 10 mockups ────────────────────────────────────────────────────────

function SettingsMockup() {
  const tabs = [
    { label: "PROFILE",     hint: "name · airline · licence" },
    { label: "APPEARANCE",  hint: "theme · font · density" },
    { label: "PREFERENCES", hint: "date · day/night" },
    { label: "MISC",        hint: "help · changelog" },
  ];
  return (
    <div style={{ background: BG, border: `1px solid ${BDR}`, borderRadius: 6, overflow: "hidden", margin: "14px auto 20px" }}>
      <div style={{ background: BG2, borderBottom: `1px solid ${BDR}`, padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 10, color: A, letterSpacing: "0.14em", fontFamily: F, fontWeight: 700 }}>SETTINGS</div>
        <span style={{ color: DIM, fontSize: 14 }}>✕</span>
      </div>
      <div style={{ display: "flex", borderBottom: `1px solid ${BDR}`, background: "#080f1a" }}>
        {tabs.map((t, i) => (
          <div key={t.label} style={{ flex: 1, padding: "8px 4px", fontSize: 8, fontFamily: F, letterSpacing: "0.05em", color: i === 0 ? A : DIM, borderBottom: i === 0 ? `2px solid ${A}` : "none", textAlign: "center" }}>
            <div style={{ fontWeight: i === 0 ? 700 : 400 }}>{t.label}</div>
            <div style={{ fontSize: 7, color: i === 0 ? DIM : "#1a3050", marginTop: 2 }}>{t.hint}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "12px 16px", fontSize: 9, color: DIM, fontFamily: F, letterSpacing: "0.08em" }}>
        Tap any tab to configure →
      </div>
    </div>
  );
}

function DangerZoneMockup() {
  return (
    <div style={{ background: BG, border: `1px solid ${BDR}`, borderRadius: 6, overflow: "hidden", margin: "14px auto 20px", maxWidth: 400 }}>
      <div style={{ background: "rgba(220,50,50,0.06)", borderBottom: "1px solid rgba(220,50,50,0.2)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#dc3232" }}>⚠</span>
        <div style={{ fontSize: 10, color: "#dc3232", letterSpacing: "0.14em", fontFamily: F, fontWeight: 700 }}>DANGER ZONE</div>
      </div>
      <div style={{ padding: "16px 20px" }}>
        <div style={{ fontSize: 11, color: MUT, fontFamily: F, lineHeight: 1.7, marginBottom: 14 }}>
          Permanently delete your account and all associated data. This action cannot be undone.
        </div>
        <div style={{ padding: "9px 0", border: "1px solid rgba(220,50,50,0.4)", borderRadius: 4, textAlign: "center", fontSize: 11, color: "#dc3232", fontFamily: F, fontWeight: 700, letterSpacing: "0.1em", background: "rgba(220,50,50,0.06)" }}>
          DELETE ACCOUNT
        </div>
      </div>
    </div>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 1, icon: "🚀", title: "Getting Started",
    Content: () => (
      <div className="htg-content">
        <p>ClaudeBorne eLogBook requires an account to keep your logbook securely backed up to the cloud. You can sign up with your email or use Google for a faster setup.</p>
        <LandingMockup />
        <h4>Creating an account</h4>
        <ul>
          <li>Tap <strong>Sign Up</strong> on the landing page</li>
          <li>Enter your email address and choose a password</li>
          <li>Check your inbox and tap the verification link before logging in</li>
          <li>If the email doesn't arrive, tap <strong>Resend verification email</strong> on the verification screen (30-second cooldown between resends)</li>
        </ul>
        <SignUpMockup />
        <h4>Signing in with Google</h4>
        <ul>
          <li>Tap <strong>Continue with Google</strong></li>
          <li>Select your Google account — no email verification required</li>
        </ul>
        <h4>First-time setup</h4>
        <ul>
          <li>After signing in, open <strong>Settings → Profile</strong> and fill in your name, licence number, licence type, and airline</li>
          <li>This information appears in your exported logbook and in the app header</li>
        </ul>
        <PilotProfileMockup />
      </div>
    ),
  },
  {
    id: 2, icon: "📱", title: "Installing the App",
    Content: () => (
      <div className="htg-content">
        <p>ClaudeBorne eLogBook is a Progressive Web App. Install it directly from the browser — no App Store required. Once installed it works fully offline.</p>
        <h4>On iPhone / iPad</h4>
        <ul>
          <li>Open <strong>claudeborne.my</strong> in <strong>Safari</strong></li>
          <li>Tap the <strong>Share</strong> button (box with arrow) at the bottom of the screen</li>
          <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
          <li>Tap <strong>Add</strong> — the ClaudeBorne icon appears on your home screen</li>
        </ul>
        <IOSShareMockup />
        <h4>On Android</h4>
        <ul>
          <li>Open <strong>claudeborne.my</strong> in <strong>Chrome</strong></li>
          <li>Tap the <strong>three-dot menu</strong> in the top right</li>
          <li>Tap <strong>Add to Home Screen</strong> or <strong>Install App</strong></li>
          <li>Tap <strong>Install</strong></li>
        </ul>
        <AndroidInstallMockup />
        <Note>Always use Safari on iPhone and Chrome on Android for the best installation experience.</Note>
        <HomeScreenMockup />
      </div>
    ),
  },
  {
    id: 3, icon: "🗺️", title: "App Overview",
    Content: () => (
      <div className="htg-content">
        <p>The app has three main tabs and a toolbar. Here is a quick tour of the layout before diving into each feature.</p>
        <AppOverviewMockup />
        <h4>Main tabs</h4>
        <ul>
          <li><strong>📋 Logbook</strong> — your month-by-month flight records. This is where you enter and edit individual sectors.</li>
          <li><strong>📊 Flight Summary</strong> — an annual overview table showing hours by month and by aircraft type. Grand totals appear here.</li>
          <li><strong>⏱ Limits &amp; Recency</strong> — real-time regulatory monitoring. Flight time limits, duty hour limits, and takeoff/landing recency per aircraft type.</li>
        </ul>
        <h4>Toolbar</h4>
        <ul>
          <li><strong>↻ Sync</strong> — upload your data to the cloud. The icon and status chip update to show sync state.</li>
          <li><strong>⬡ Export / Import</strong> — export your logbook to Excel or import from a previous export file.</li>
          <li><strong>⚙ Settings</strong> — profile, appearance, preferences, and account management. A badge appears if you have hidden columns.</li>
          <li><strong>⏻ Sign Out</strong> — sign out of your account.</li>
        </ul>
        <h4>Period selector</h4>
        <ul>
          <li>The month and year dropdowns (top right of the page header) control which month is shown in the Logbook tab</li>
          <li>The current month is selected by default on each login</li>
        </ul>
        <Tip>The save status chip below the toolbar shows when data was last saved to your device. Sync is separate — it pushes saved data to the cloud.</Tip>
      </div>
    ),
  },
  {
    id: 4, icon: "✈️", title: "The Logbook",
    Content: () => (
      <div className="htg-content">
        <p>The Logbook tab shows all flight sectors for the selected month. Each row is one sector. Tap any cell to start editing.</p>
        <LogbookTableMockup />
        <h4>Adding a flight</h4>
        <ul>
          <li>Navigate to the correct month using the period selector (top right)</li>
          <li>Tap an empty row and fill in the columns from left to right</li>
          <li>Day/night split and TOTAL calculate automatically once STD, STA, DEP, and ARR are filled</li>
          <li>To add more rows, tap <strong>✚ ADD SECTOR</strong> at the bottom of the table</li>
        </ul>
        <h4>Column guide</h4>
        <ul>
          <li><strong>Date</strong> — day of the month (e.g. 15)</li>
          <li><strong>Type</strong> — aircraft type (e.g. B737-8, ATR72-600)</li>
          <li><strong>Markings</strong> — aircraft registration (e.g. 9M-XXX)</li>
          <li><strong>Captain</strong> — captain's name, or SELF if you were the captain</li>
          <li><strong>H.O.C</strong> — Holder Operating Capacity: your legal role for this sector</li>
          <li><strong>P.F.</strong> — Pilot Flying checkbox: tick if you were the handling pilot</li>
          <li><strong>DEP / ARR</strong> — ICAO codes for departure and arrival airports</li>
          <li><strong>STD / STA</strong> — scheduled departure and arrival in UTC. Accepts HH:MM or HHMM format</li>
          <li><strong>☀ Day / ☾ Night columns</strong> — auto-calculated; broken into P1, P1 U/S, and P2</li>
          <li><strong>Total</strong> — auto-calculated sum of all day and night columns</li>
        </ul>
        <h4>Navigating &amp; managing rows</h4>
        <ul>
          <li>Press <strong>Tab</strong> or <strong>Enter</strong> to move to the next cell</li>
          <li>Tap the <strong>row number</strong> to open remarks &amp; the AUTOLAND checkbox — colour shows state: grey none, gold remarks, purple autoland, magenta both</li>
          <li>Use <strong>✕</strong> on any row to delete it</li>
        </ul>
        <h4>Holder Operating Capacity (H.O.C)</h4>
        <p>Your role determines which column receives the flight hours. The badge colour changes with the selection.</p>
        <HOCMockup />
        <Tip>You can hide columns you don't use via Settings → Appearance. Hidden columns leave a narrow stub in the header — click the stub to restore them.</Tip>
      </div>
    ),
  },
  {
    id: 5, icon: "💬", title: "Remarks",
    Content: () => (
      <div className="htg-content">
        <p>Each row has a remarks panel for free-text notes and autoland flagging. Tap the row number in the <strong>#</strong> column to open it. The number changes colour and gets underlined when remarks or an autoland flag are recorded.</p>
        <NumberColumnMockup />
        <h4>Adding remarks</h4>
        <ul>
          <li>Tap the row number in the <strong>#</strong> column for the sector you want to annotate</li>
          <li>Type your notes in the text area — no length limit</li>
          <li>Tick <strong>AUTOLAND</strong> if an autoland was performed on this sector</li>
          <li>Tap <strong>SAVE REMARKS</strong> to confirm, or <strong>CANCEL</strong> to discard changes</li>
          <li>To delete remarks, open the panel, clear the text, untick AUTOLAND if set, then save</li>
        </ul>
        <RemarksPanelMockup />
        <h4>Row number colour states</h4>
        <ul>
          <li><strong style={{ color: "#6f93b8" }}>Slate</strong> — no remarks, no autoland</li>
          <li><strong style={{ color: "#f5c542" }}>Gold</strong> — remarks entered, no autoland</li>
          <li><strong style={{ color: "#a855f7" }}>Purple</strong> — autoland flagged, no remarks text</li>
          <li><strong style={{ color: "#ec4899" }}>Magenta</strong> — both remarks and autoland</li>
        </ul>
        <Tip>Tick AUTOLAND when an autoland was performed. This feeds the Limits &amp; Recency tab for autoland currency tracking.</Tip>
      </div>
    ),
  },
  {
    id: 6, icon: "🌙", title: "Day / Night Calculation",
    Content: () => (
      <div className="htg-content">
        <p>The app automatically splits your block time into day and night portions based on your STD, STA, and airport codes. No manual calculation needed.</p>
        <h4>Two methods are available</h4>
        <ul>
          <li><strong>Fixed bands</strong> — Night is defined as 11:30–23:30 UTC. Simple and consistent, unaffected by location or season.</li>
          <li><strong>Route (sun)</strong> — The most accurate option. Night is counted whenever the sun is below civil twilight (−6°), calculated minute by minute along the great-circle route between your DEP and ARR airports. Correctly handles sectors that cross multiple time zones — for example, an eastbound sector landing into sunrise logs only the night portion as night.</li>
        </ul>
        <h4>How to change the method</h4>
        <ul>
          <li>Go to <strong>Settings → Preferences</strong></li>
          <li>Under <strong>Day/Night Calculation</strong>, select your preferred method</li>
        </ul>
        <DayNightSettingMockup />
        <Note>Route (sun) requires valid ICAO codes for both departure and arrival airports. If either airport is not in the database, that sector falls back to Fixed bands automatically.</Note>
        <DayNightSplitMockup />
      </div>
    ),
  },
  {
    id: 7, icon: "☁️", title: "Cloud Sync",
    Content: () => (
      <div className="htg-content">
        <p>Your flights are saved to your device immediately as you type. Use the Sync button to back up to the cloud and keep multiple devices in sync.</p>
        <h4>To sync</h4>
        <ul>
          <li>Tap the <strong>↻ Sync</strong> icon in the toolbar</li>
          <li>The icon and status chip update to show the result</li>
          <li>The app also checks automatically every 30 minutes and each time you reopen it</li>
        </ul>
        <SyncStatusMockup />
        <h4>Using on multiple devices</h4>
        <ul>
          <li>Sign in with the same account on each device</li>
          <li>Tap Sync on the second device to pull the latest cloud data down</li>
          <li>Always sync before switching devices to avoid conflicts</li>
        </ul>
        <h4>If a sync conflict is detected</h4>
        <ul>
          <li>A prompt appears asking you to choose between <strong>Keep Local</strong> and <strong>Keep Cloud</strong></li>
          <li>Both options show entry counts and timestamps to help you decide</li>
          <li>The version you keep overwrites the other — this cannot be undone</li>
        </ul>
        <SyncConflictMockup />
        <Tip>If a new version of the app is ready, a banner will appear prompting you to refresh. The app checks for updates on the same schedule as sync.</Tip>
      </div>
    ),
  },
  {
    id: 8, icon: "📤", title: "Export & Import",
    Content: () => (
      <div className="htg-content">
        <p>ClaudeBorne eLogBook exports your logbook to Excel (.xlsx). Export a specific date range or use Export All to download every flight in your logbook at once.</p>
        <h4>To export</h4>
        <ul>
          <li>Tap the <strong>⬡ Export / Import</strong> icon in the toolbar</li>
          <li>To export a specific period: set the <strong>From</strong> and <strong>To</strong> dates, then tap <strong>⬇ Export</strong></li>
          <li>To export everything: tap <strong>⬇ Export All</strong> — the date range is ignored</li>
          <li>The .xlsx file downloads to your device</li>
        </ul>
        <ExportModalMockup />
        <h4>What's in the Excel file</h4>
        <ul>
          <li><strong>Profile</strong> — your pilot details (name, licence, airline)</li>
          <li><strong>Carry Forward</strong> — your pre-app hours by aircraft type</li>
          <li><strong>Flights</strong> — all flight entries in the exported range</li>
          <li><strong>Summary</strong> — monthly hour totals across all categories</li>
        </ul>
        <ExcelSheetsMockup />
        <h4>Importing data</h4>
        <ul>
          <li>Tap the <strong>⬆ Import</strong> tab in the same window</li>
          <li>Select a .xlsx file previously exported from ClaudeBorne eLogBook</li>
          <li>Review the import preview (valid rows, duplicates, errors)</li>
          <li>Tap <strong>Import</strong> to confirm — duplicate entries are skipped automatically</li>
        </ul>
        <Note>Only files exported from ClaudeBorne eLogBook can be imported. Third-party logbook files are not supported.</Note>
      </div>
    ),
  },
  {
    id: 9, icon: "📊", title: "Carry Forward Hours",
    Content: () => (
      <div className="htg-content">
        <p>Carry forward hours are your total flight hours accumulated before you started using ClaudeBorne eLogBook. Adding them ensures your grand totals and lifetime hours are correct.</p>
        <h4>Setting up carry forward hours</h4>
        <ul>
          <li>Go to <strong>Settings → Profile</strong></li>
          <li>Scroll down to the <strong>Carry-forward hours</strong> section</li>
          <li>Tap <strong>+ Add Aircraft Type</strong></li>
          <li>Enter the aircraft type and your previous hours for each category (Day P1, Day P1 U/S, Day P2, Night P1, Night P1 U/S, Night P2)</li>
          <li>Add a separate entry for each aircraft type you have prior hours on</li>
        </ul>
        <CarryForwardMockup />
        <Tip>Carry forward hours are added to your logged hours in the Flight Summary tab and the grand total. They do not appear as individual rows in the Logbook.</Tip>
      </div>
    ),
  },
  {
    id: 10, icon: "⚙️", title: "Settings",
    Content: () => (
      <div className="htg-content">
        <p>The Settings panel gives you control over your pilot profile, display, and app behaviour. Open it via the <strong>⚙ Settings</strong> icon in the toolbar.</p>
        <SettingsMockup />
        <h4>Profile</h4>
        <ul>
          <li>Update your full name, date of birth, staff ID, licence number, licence type, airline, home base, and default rank</li>
          <li>Set defaults for aircraft type, markings, and captain name — these pre-fill new rows automatically</li>
          <li>Manage <strong>Carry Forward Hours</strong> per aircraft type (see Section 9)</li>
        </ul>
        <h4>Appearance</h4>
        <ul>
          <li><strong>Accent colour</strong> — choose from 10 presets: ClaudeBorne gradient, Mint, Blue, Violet, Amber, Emerald, Rose, Cyan, Gold, and Coral</li>
          <li><strong>Font</strong> — JetBrains Mono, IBM Plex Mono, Roboto Mono, Space Mono, or Courier New</li>
          <li><strong>Table density</strong> — Compact, Default, or Relaxed row spacing</li>
          <li><strong>Column visibility</strong> — hide columns you don't need. Hidden columns leave a narrow stub in the header; click the stub to restore them</li>
        </ul>
        <h4>Preferences</h4>
        <ul>
          <li><strong>Day/Night calculation method</strong> — Fixed bands or Route (sun) (see Section 6)</li>
          <li><strong>Pre-flight and post-flight buffers</strong> — duty time added around each sector for FTL calculations</li>
          <li><strong>Date format</strong> and <strong>rows per page</strong> defaults</li>
        </ul>
        <h4>Misc</h4>
        <ul>
          <li>Access this How-To Guide</li>
          <li>Send feedback or report a bug</li>
          <li>View the changelog and check for app updates</li>
        </ul>
        <h4>Deleting your account</h4>
        <ul>
          <li>Go to <strong>Settings → Misc → Danger Zone</strong></li>
          <li>Tap <strong>Delete Account</strong></li>
          <li>You will be asked to re-authenticate before anything is deleted — entering your password or re-confirming with Google</li>
          <li>If you cancel the authentication prompt, nothing is deleted</li>
        </ul>
        <DangerZoneMockup />
      </div>
    ),
  },
];

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function HowToGuideModal({ open, onClose, version }) {
  const [active, setActive] = useState(0);

  useEffect(() => { if (open) setActive(0); }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const { icon, title, Content } = SECTIONS[active];
  const vLabel = (version || "").toUpperCase();

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)", zIndex: 2200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#0a0d12", border: `1px solid ${BDR}`, borderRadius: 0, boxShadow: "0 30px 80px rgba(0,0,0,0.5)", width: "100%", maxWidth: 860, height: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "14px 20px",
          borderBottom: `1px solid ${BDR}`, background: "linear-gradient(180deg, rgba(63,224,197,0.04), transparent)", flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.2em", color: MINT, marginBottom: 4, fontFamily: F, textTransform: "uppercase" }}>
              // guide{vLabel ? ` · ${vLabel}` : ""}
            </div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17, letterSpacing: "0.03em", color: "#e2eef5" }}>How-to guide</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: `1px solid ${BDR}`, color: DIM, cursor: "pointer", width: 28, height: 28, fontSize: 16, lineHeight: 1, transition: "color 0.12s, border-color 0.12s" }}
            onMouseEnter={e => { e.currentTarget.style.color = MINT; e.currentTarget.style.borderColor = MINT; }}
            onMouseLeave={e => { e.currentTarget.style.color = DIM; e.currentTarget.style.borderColor = BDR; }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* Sidebar */}
          <div style={{ width: 210, borderRight: `1px solid ${BDR}`, overflowY: "auto", flexShrink: 0 }}>
            {SECTIONS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActive(i)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "11px 16px",
                  background: active === i ? "rgba(63,224,197,0.07)" : "transparent",
                  borderLeft: `3px solid ${active === i ? A : "transparent"}`,
                  border: "none", borderBottom: `1px solid #0f1e30`,
                  color: active === i ? A : MUT,
                  cursor: "pointer", textAlign: "left",
                  fontSize: 11, letterSpacing: "0.08em", fontFamily: F,
                  transition: "all 0.12s",
                }}
              >
                <span style={{ fontSize: 14 }}>{s.icon}</span>
                <span>{s.title}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
            <div style={{ fontSize: 12, letterSpacing: "0.14em", color: A, fontWeight: 700, marginBottom: 18, textTransform: "uppercase", fontFamily: F }}>
              {icon}&nbsp;&nbsp;{title}
            </div>
            <Content />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", borderTop: `1px solid ${BDR}`, flexShrink: 0 }}>
          <button
            onClick={() => setActive(p => Math.max(0, p - 1))}
            disabled={active === 0}
            style={{ background: "transparent", border: `1px solid ${BDR}`, borderRadius: 0, color: active === 0 ? BDR : DIM, padding: "5px 14px", cursor: active === 0 ? "default" : "pointer", fontSize: 11, letterSpacing: "0.08em", fontFamily: F }}
          >← PREV</button>
          <span style={{ fontSize: 10, color: DIM, letterSpacing: "0.1em", fontFamily: F }}>{active + 1} / {SECTIONS.length}</span>
          <button
            onClick={() => active === SECTIONS.length - 1 ? onClose() : setActive(p => p + 1)}
            style={{ background: active === SECTIONS.length - 1 ? "rgba(63,224,197,0.10)" : "transparent", border: `1px solid ${active === SECTIONS.length - 1 ? A : BDR}`, borderRadius: 0, color: active === SECTIONS.length - 1 ? A : DIM, padding: "5px 14px", cursor: "pointer", fontSize: 11, letterSpacing: "0.08em", fontFamily: F }}
          >{active === SECTIONS.length - 1 ? "FINISH ✓" : "NEXT →"}</button>
        </div>
      </div>

      <style>{`
        .htg-content { text-align: left; }
        .htg-content p { margin: 0 0 14px; line-height: 1.75; font-size: 13px; color: #c8dce8; font-family: 'JetBrains Mono','Courier New',monospace; }
        .htg-content h4 { font-size: 10px; letter-spacing: 0.16em; color: var(--elb-accent, #3FE0C5); font-weight: 700; text-transform: uppercase; margin: 22px 0 8px; font-family: 'JetBrains Mono','Courier New',monospace; }
        .htg-content ul { margin: 0 0 10px; padding-left: 20px; }
        .htg-content li { margin-bottom: 7px; line-height: 1.65; font-size: 13px; color: #c8dce8; font-family: 'JetBrains Mono','Courier New',monospace; }
        .htg-content strong { color: #e2eef5; font-weight: 600; }
      `}</style>
    </div>
  );
}
