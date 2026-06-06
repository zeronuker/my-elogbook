import { useState, useEffect } from "react";

// ── Sub-components ────────────────────────────────────────────────────────────

// ── Shared mockup primitives ──────────────────────────────────────────────────

const mockField = (label, value, hint) => (
  <div key={label} style={{ marginBottom: 10 }}>
    <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "#3a6a8a", marginBottom: 4 }}>{label}</div>
    <div style={{
      background: "#060b14", border: "1px solid #1e3a5f", borderRadius: 4,
      padding: "7px 10px", fontSize: 12, color: hint ? "#3a6a8a" : "#c8dce8",
      fontFamily: "Courier New, monospace", letterSpacing: "0.04em",
    }}>{value}</div>
  </div>
);

const mockBtn = (label, primary) => (
  <div style={{
    background: primary ? "rgba(63,224,197,0.12)" : "transparent",
    border: `1px solid ${primary ? "#3FE0C5" : "#1e3a5f"}`,
    borderRadius: 4, padding: "8px 0", textAlign: "center",
    color: primary ? "#3FE0C5" : "#5a8aaa",
    fontSize: 11, letterSpacing: "0.12em", fontFamily: "Courier New, monospace",
    fontWeight: primary ? 700 : 400, marginBottom: 8,
  }}>{label}</div>
);

function LandingPageMockup() {
  return (
    <div style={{ background: "#060b14", border: "1px solid #1e3a5f", borderRadius: 6, padding: "24px 28px", margin: "14px 0 20px", textAlign: "center" }}>
      {/* Logo */}
      <div style={{ width: 52, height: 52, borderRadius: 12, background: "#0a0d12", border: "1px solid #1e3a5f", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "#3FE0C5", fontSize: 22, fontWeight: 700, fontFamily: "Courier New, monospace" }}>C</span>
      </div>
      <div style={{ fontSize: 13, letterSpacing: "0.22em", color: "#e2eef5", fontWeight: 700, fontFamily: "Courier New, monospace", marginBottom: 4 }}>CLAUDEBORNE</div>
      <div style={{ fontSize: 9, letterSpacing: "0.14em", color: "#3a6a8a", marginBottom: 22, fontFamily: "Courier New, monospace" }}>eLOGBOOK V6.7 · CAAM / MCAR 2016</div>
      <div style={{ maxWidth: 240, margin: "0 auto" }}>
        {mockBtn("SIGN UP", true)}
        {mockBtn("LOG IN", false)}
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0" }}>
          <div style={{ flex: 1, height: 1, background: "#1e3a5f" }} />
          <span style={{ fontSize: 9, color: "#3a6a8a", letterSpacing: "0.08em" }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "#1e3a5f" }} />
        </div>
        {mockBtn("G  CONTINUE WITH GOOGLE", false)}
      </div>
    </div>
  );
}

function SignUpFormMockup() {
  return (
    <div style={{ background: "#060b14", border: "1px solid #1e3a5f", borderRadius: 6, padding: "20px 24px", margin: "14px auto 20px", maxWidth: 360 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.16em", color: "#3FE0C5", fontWeight: 700, marginBottom: 16, fontFamily: "Courier New, monospace" }}>CREATE ACCOUNT</div>
      {mockField("EMAIL ADDRESS", "pilot@example.com", false)}
      {mockField("PASSWORD", "••••••••••", false)}
      {mockField("CONFIRM PASSWORD", "••••••••••", false)}
      <div style={{ marginTop: 14 }}>{mockBtn("SIGN UP", true)}</div>
      <div style={{ fontSize: 10, color: "#3a6a8a", letterSpacing: "0.06em", marginTop: 8, fontFamily: "Courier New, monospace" }}>
        A verification email will be sent to your inbox.
      </div>
    </div>
  );
}

function PilotProfileMockup() {
  return (
    <div style={{ background: "#060b14", border: "1px solid #1e3a5f", borderRadius: 6, padding: "20px 24px", margin: "14px auto 20px", maxWidth: 360 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.16em", color: "#3FE0C5", fontWeight: 700, marginBottom: 16, fontFamily: "Courier New, monospace" }}>PILOT PROFILE</div>
      {mockField("FULL NAME", "CAPT. AMIR RASHID", false)}
      {mockField("LICENCE NUMBER", "ML-XXXXXX", false)}
      {mockField("LICENCE TYPE", "ATPL(A)", false)}
      {mockField("AIRLINE / OPERATOR", "MALAYSIA AIRLINES", false)}
      <div style={{ marginTop: 14 }}>{mockBtn("SAVE PROFILE", true)}</div>
    </div>
  );
}

function ColumnGuideMockup() {
  const cols = [
    { label: "DATE",     value: "15",      desc: "Day of month" },
    { label: "TYPE",     value: "B737",    desc: "Aircraft type" },
    { label: "MARKINGS", value: "9M-XXX",  desc: "Registration" },
    { label: "CAPTAIN",  value: "SELF",    desc: "PIC name" },
    { label: "H.O.C",    value: "P1",      desc: "Your capacity" },
    { label: "SECTORS",  value: "2",       desc: "No. of sectors" },
    { label: "DEP",      value: "WMKK",    desc: "Departure ICAO" },
    { label: "ARR",      value: "WMBT",    desc: "Arrival ICAO" },
    { label: "STD",      value: "08:30",   desc: "Sched dep UTC" },
    { label: "STA",      value: "10:15",   desc: "Sched arr UTC" },
    { label: "RMK",      value: "✎",       desc: "Notes" },
  ];
  return (
    <div style={{ overflowX: "auto", margin: "14px 0 20px", border: "1px solid #1e3a5f", borderRadius: 6 }}>
      <table style={{ borderCollapse: "collapse", fontFamily: "Courier New, monospace", fontSize: 11, width: "100%" }}>
        <thead>
          <tr style={{ background: "#060b14" }}>
            {cols.map(c => (
              <th key={c.label} style={{ padding: "7px 10px", color: "#3FE0C5", letterSpacing: "0.1em", fontWeight: 700, borderBottom: "2px solid #1e3a5f", borderRight: "1px solid #0f1e30", whiteSpace: "nowrap", textAlign: "center" }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr style={{ background: "#0a0f1a" }}>
            {cols.map(c => (
              <td key={c.label} style={{ padding: "7px 10px", color: "#e2eef5", borderRight: "1px solid #0f1e30", borderBottom: "1px solid #0f1e30", textAlign: "center", whiteSpace: "nowrap" }}>
                {c.value}
              </td>
            ))}
          </tr>
          <tr style={{ background: "#060b14" }}>
            {cols.map(c => (
              <td key={c.label} style={{ padding: "5px 10px 7px", color: "#4a7a9a", fontSize: 10, borderRight: "1px solid #0f1e30", textAlign: "center", whiteSpace: "nowrap", letterSpacing: "0.05em" }}>
                {c.desc}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Section 2 ─────────────────────────────────────────────────────────────────

function iOSShareMockup() {
  return (
    <div style={{ background: "#060b14", border: "1px solid #1e3a5f", borderRadius: 6, margin: "14px auto 20px", maxWidth: 300, overflow: "hidden" }}>
      <div style={{ background: "#0a0f1a", padding: "8px 12px", borderBottom: "1px solid #1e3a5f", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, background: "#060b14", border: "1px solid #1e3a5f", borderRadius: 10, padding: "4px 10px", fontSize: 10, color: "#5a8aaa", fontFamily: "Courier New, monospace" }}>claudeborne.my</div>
        <span style={{ color: "#3FE0C5", fontSize: 13 }}>⎙</span>
      </div>
      {["Copy", "Add Bookmark", "Add to Favourites", "Find on Page"].map(item => (
        <div key={item} style={{ padding: "10px 16px", fontSize: 11, color: "#5a8aaa", fontFamily: "Courier New, monospace", borderBottom: "1px solid #0f1e30" }}>{item}</div>
      ))}
      <div style={{ padding: "10px 16px", fontSize: 11, color: "#3FE0C5", fontFamily: "Courier New, monospace", fontWeight: 700, background: "rgba(63,224,197,0.06)", display: "flex", alignItems: "center", gap: 8 }}>
        <span>⊞</span> Add to Home Screen
      </div>
    </div>
  );
}

function AndroidInstallMockup() {
  return (
    <div style={{ background: "#060b14", border: "1px solid #1e3a5f", borderRadius: 6, padding: 16, margin: "14px auto 20px", maxWidth: 320 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: "#0a0d12", border: "1px solid #1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ color: "#3FE0C5", fontSize: 16, fontWeight: 700, fontFamily: "Courier New, monospace" }}>C</span>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#e2eef5", fontFamily: "Courier New, monospace", letterSpacing: "0.06em" }}>ClaudeBorne eLogBook</div>
          <div style={{ fontSize: 10, color: "#3a6a8a", fontFamily: "Courier New, monospace" }}>claudeborne.my</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#5a8aaa", fontFamily: "Courier New, monospace", marginBottom: 14, lineHeight: 1.6 }}>Add to your home screen for quick access and offline use.</div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <div style={{ padding: "6px 14px", border: "1px solid #1e3a5f", borderRadius: 4, fontSize: 11, color: "#5a8aaa", fontFamily: "Courier New, monospace" }}>CANCEL</div>
        <div style={{ padding: "6px 14px", border: "1px solid #3FE0C5", borderRadius: 4, fontSize: 11, color: "#3FE0C5", fontFamily: "Courier New, monospace", fontWeight: 700, background: "rgba(63,224,197,0.1)" }}>INSTALL</div>
      </div>
    </div>
  );
}

function HomeScreenMockup() {
  const icons = ["📷", "📧", "🗺", "📱", null, "📅", "⚙️", "🎵"];
  return (
    <div style={{ background: "#060b14", border: "1px solid #1e3a5f", borderRadius: 6, padding: 16, margin: "14px auto 20px", maxWidth: 240 }}>
      <div style={{ fontSize: 9, color: "#3a6a8a", fontFamily: "Courier New, monospace", letterSpacing: "0.08em", marginBottom: 12, textAlign: "center" }}>HOME SCREEN</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {icons.map((icon, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: icon === null ? "#0a0d12" : "#0f1e30", border: icon === null ? "2px solid #3FE0C5" : "1px solid #1e3a5f", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: icon === null ? "0 0 8px rgba(63,224,197,0.25)" : "none" }}>
              {icon === null ? <span style={{ color: "#3FE0C5", fontSize: 18, fontWeight: 700, fontFamily: "Courier New, monospace" }}>C</span> : <span style={{ fontSize: 18 }}>{icon}</span>}
            </div>
            {icon === null && <div style={{ fontSize: 8, color: "#3FE0C5", fontFamily: "Courier New, monospace", letterSpacing: "0.05em" }}>eLogBook</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section 3 ─────────────────────────────────────────────────────────────────

function LogbookMainViewMockup() {
  const headers = ["DATE", "TYPE", "REG", "CAPTAIN", "H.O.C", "SECT", "DEP", "ARR"];
  const rows = [
    ["15", "B737", "9M-XXX", "SELF", "P1", "2", "WMKK", "WMBT"],
    ["18", "B737", "9M-XYZ", "TAN, J", "P2", "1", "WMBT", "WMKK"],
    ["", "", "", "", "", "", "", ""],
  ];
  return (
    <div style={{ background: "#060b14", border: "1px solid #1e3a5f", borderRadius: 6, margin: "14px auto 20px", overflow: "hidden" }}>
      <div style={{ background: "#0a0f1a", borderBottom: "1px solid #1e3a5f", padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 9, color: "#3FE0C5", letterSpacing: "0.12em", fontFamily: "Courier New, monospace", fontWeight: 700 }}>CLAUDEBORNE · ELOGBOOK</div>
        <div style={{ display: "flex", gap: 12 }}>
          {["☁", "⬡", "⚙", "⏻"].map(ic => <span key={ic} style={{ color: "#3FE0C5", fontSize: 13 }}>{ic}</span>)}
        </div>
      </div>
      <div style={{ padding: "7px 12px", borderBottom: "1px solid #0f1e30", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 10, color: "#3FE0C5", letterSpacing: "0.1em", fontFamily: "Courier New, monospace", fontWeight: 700 }}>MAY 2026</div>
        <div style={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 3, padding: "2px 7px", fontSize: 9, color: "#5a8aaa", fontFamily: "Courier New, monospace" }}>▼</div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontFamily: "Courier New, monospace", fontSize: 10, width: "100%" }}>
          <thead>
            <tr style={{ background: "#080f1a" }}>
              {headers.map(h => <th key={h} style={{ padding: "5px 8px", color: "#3a6a8a", letterSpacing: "0.08em", fontWeight: 700, borderBottom: "1px solid #1e3a5f", borderRight: "1px solid #0f1e30", whiteSpace: "nowrap", textAlign: "center" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? "#060b14" : "#080f1a" }}>
                {row.map((cell, ci) => <td key={ci} style={{ padding: "5px 8px", color: cell ? "#c8dce8" : "#1e3a5f", borderRight: "1px solid #0f1e30", borderBottom: "1px solid #0a1525", textAlign: "center", whiteSpace: "nowrap" }}>{cell || "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowBeingEditedMockup() {
  const headers = ["DATE", "TYPE", "REG", "CAPTAIN", "H.O.C", "SECT", "DEP", "ARR"];
  const rows = [
    { data: ["15", "B737", "9M-XXX", "SELF", "P1", "2", "WMKK", "WMBT"], active: true },
    { data: ["", "", "", "", "", "", "", ""], active: false },
  ];
  return (
    <div style={{ background: "#060b14", border: "1px solid #1e3a5f", borderRadius: 6, margin: "14px auto 20px", overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontFamily: "Courier New, monospace", fontSize: 10, width: "100%" }}>
          <thead>
            <tr style={{ background: "#080f1a" }}>
              {headers.map(h => <th key={h} style={{ padding: "5px 8px", color: "#3a6a8a", letterSpacing: "0.08em", fontWeight: 700, borderBottom: "1px solid #1e3a5f", borderRight: "1px solid #0f1e30", whiteSpace: "nowrap", textAlign: "center" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ background: row.active ? "rgba(63,224,197,0.06)" : "#060b14" }}>
                {row.data.map((cell, ci) => (
                  <td key={ci} style={{ padding: "5px 8px", color: row.active ? "#e2eef5" : "#1e3a5f", borderRight: "1px solid #0f1e30", borderBottom: "1px solid #0a1525", textAlign: "center", whiteSpace: "nowrap", fontWeight: row.active ? 600 : 400, borderTop: row.active ? "1px solid rgba(63,224,197,0.25)" : "none" }}>
                    {cell || (row.active ? <span style={{ color: "#3FE0C5" }}>_</span> : "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "5px 12px", fontSize: 9, color: "#3FE0C5", fontFamily: "Courier New, monospace", letterSpacing: "0.08em", borderTop: "1px solid #0f1e30", background: "rgba(63,224,197,0.03)" }}>↑ ROW BEING EDITED</div>
    </div>
  );
}

// ── Section 4 ─────────────────────────────────────────────────────────────────

function DayNightSettingMockup() {
  return (
    <div style={{ background: "#060b14", border: "1px solid #1e3a5f", borderRadius: 6, padding: "16px 20px", margin: "14px auto 20px", maxWidth: 400 }}>
      <div style={{ fontSize: 9, letterSpacing: "0.12em", color: "#3a6a8a", marginBottom: 12, fontFamily: "Courier New, monospace" }}>DAY / NIGHT CALCULATION METHOD</div>
      {[
        { label: "Fixed UTC", desc: "Night: 11:30 – 23:30 UTC", selected: false },
        { label: "Sunrise / Sunset (CAD-6 Part 1)", desc: "Based on departure airport coordinates", selected: true },
      ].map(opt => (
        <div key={opt.label} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", background: opt.selected ? "rgba(63,224,197,0.06)" : "#0a0f1a", border: `1px solid ${opt.selected ? "#3FE0C5" : "#1e3a5f"}`, borderRadius: 4, marginBottom: 8 }}>
          <div style={{ width: 13, height: 13, borderRadius: "50%", border: `2px solid ${opt.selected ? "#3FE0C5" : "#3a6a8a"}`, background: opt.selected ? "#3FE0C5" : "transparent", flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: 11, color: opt.selected ? "#3FE0C5" : "#c8dce8", fontFamily: "Courier New, monospace", letterSpacing: "0.06em", marginBottom: 2 }}>{opt.label}</div>
            <div style={{ fontSize: 9, color: "#3a6a8a", fontFamily: "Courier New, monospace" }}>{opt.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DayNightSplitMockup() {
  const cols = [
    { label: "DEP", value: "WMKK", hi: false },
    { label: "STD", value: "07:00", hi: false },
    { label: "STA", value: "08:45", hi: false },
    { label: "DAY P1", value: "01:45", hi: true },
    { label: "NIGHT P1", value: "00:00", hi: true },
    { label: "TOTAL", value: "01:45", hi: true },
  ];
  return (
    <div style={{ overflowX: "auto", margin: "14px auto 20px", border: "1px solid #1e3a5f", borderRadius: 6 }}>
      <table style={{ borderCollapse: "collapse", fontFamily: "Courier New, monospace", fontSize: 11, width: "100%" }}>
        <thead>
          <tr style={{ background: "#060b14" }}>
            {cols.map(c => <th key={c.label} style={{ padding: "6px 10px", color: c.hi ? "#3FE0C5" : "#3a6a8a", letterSpacing: "0.1em", fontWeight: 700, borderBottom: `2px solid ${c.hi ? "#3FE0C5" : "#1e3a5f"}`, borderRight: "1px solid #0f1e30", whiteSpace: "nowrap", textAlign: "center", background: c.hi ? "rgba(63,224,197,0.04)" : "transparent" }}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr style={{ background: "#0a0f1a" }}>
            {cols.map(c => <td key={c.label} style={{ padding: "7px 10px", color: c.hi ? "#e2eef5" : "#c8dce8", borderRight: "1px solid #0f1e30", textAlign: "center", whiteSpace: "nowrap", background: c.hi ? "rgba(63,224,197,0.04)" : "transparent", fontWeight: c.hi ? 600 : 400 }}>{c.value}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Section 5 ─────────────────────────────────────────────────────────────────

function CarryForwardMockup() {
  return (
    <div style={{ background: "#060b14", border: "1px solid #1e3a5f", borderRadius: 6, padding: "16px 20px", margin: "14px auto 20px", maxWidth: 400 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.14em", color: "#3FE0C5", fontWeight: 700, marginBottom: 14, fontFamily: "Courier New, monospace" }}>CARRY FORWARD HOURS</div>
      <div style={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 4, padding: "12px 14px", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: "#e2eef5", fontFamily: "Courier New, monospace", letterSpacing: "0.1em", marginBottom: 10, fontWeight: 700 }}>B737</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
          {[["DAY P1", "1200:00"], ["NIGHT P1", "340:00"], ["DAY P2", "80:00"], ["NIGHT P2", "12:00"]].map(([label, val]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, color: "#3a6a8a", fontFamily: "Courier New, monospace" }}>{label}</span>
              <span style={{ fontSize: 10, color: "#c8dce8", fontFamily: "Courier New, monospace" }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 10 }}>{mockBtn("+ ADD AIRCRAFT TYPE", false)}</div>
    </div>
  );
}

// ── Section 6 ─────────────────────────────────────────────────────────────────

function ToolbarSyncMockup() {
  return (
    <div style={{ background: "#060b14", border: "1px solid #1e3a5f", borderRadius: 6, margin: "14px auto 20px", overflow: "hidden" }}>
      <div style={{ background: "#0a0f1a", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 9, color: "#3FE0C5", letterSpacing: "0.12em", fontFamily: "Courier New, monospace", fontWeight: 700 }}>CLAUDEBORNE · ELOGBOOK V6.7</div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{ background: "rgba(63,224,197,0.12)", border: "1px solid #3FE0C5", borderRadius: 4, padding: "4px 8px" }}>
              <span style={{ color: "#3FE0C5", fontSize: 13 }}>☁</span>
            </div>
            <span style={{ fontSize: 7, color: "#3FE0C5", fontFamily: "Courier New, monospace", letterSpacing: "0.06em" }}>SYNC</span>
          </div>
          {["⬡", "⚙", "⏻"].map(ic => <span key={ic} style={{ color: "#3FE0C5", fontSize: 13 }}>{ic}</span>)}
        </div>
      </div>
      <div style={{ padding: "7px 16px", fontSize: 9, color: "#3a6a8a", fontFamily: "Courier New, monospace", letterSpacing: "0.07em" }}>
        LAST SYNCED: 27 MAY 2026 · 14:32 UTC
      </div>
    </div>
  );
}

function SyncConflictMockup() {
  return (
    <div style={{ background: "#060b14", border: "1px solid #1e3a5f", borderRadius: 6, padding: "18px 20px", margin: "14px auto 20px", maxWidth: 380 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.14em", color: "#f0a830", fontWeight: 700, marginBottom: 6, fontFamily: "Courier New, monospace" }}>⚠ SYNC CONFLICT DETECTED</div>
      <div style={{ fontSize: 11, color: "#5a8aaa", fontFamily: "Courier New, monospace", marginBottom: 14, lineHeight: 1.6 }}>Your local data and cloud data differ. Choose which version to keep.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[{ label: "LOCAL", date: "27 MAY 2026", time: "14:32 UTC", rows: "84 entries" }, { label: "CLOUD", date: "27 MAY 2026", time: "09:15 UTC", rows: "81 entries" }].map(opt => (
          <div key={opt.label} style={{ background: "#0a0f1a", border: "1px solid #1e3a5f", borderRadius: 4, padding: "10px 12px" }}>
            <div style={{ fontSize: 9, color: "#3FE0C5", letterSpacing: "0.12em", fontFamily: "Courier New, monospace", fontWeight: 700, marginBottom: 6 }}>{opt.label}</div>
            <div style={{ fontSize: 10, color: "#c8dce8", fontFamily: "Courier New, monospace" }}>{opt.date}</div>
            <div style={{ fontSize: 10, color: "#5a8aaa", fontFamily: "Courier New, monospace" }}>{opt.time}</div>
            <div style={{ fontSize: 9, color: "#3a6a8a", fontFamily: "Courier New, monospace", marginTop: 4 }}>{opt.rows}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ padding: "8px 0", border: "1px solid #3FE0C5", borderRadius: 4, textAlign: "center", fontSize: 11, color: "#3FE0C5", fontFamily: "Courier New, monospace", fontWeight: 700, background: "rgba(63,224,197,0.08)" }}>KEEP LOCAL</div>
        <div style={{ padding: "8px 0", border: "1px solid #1e3a5f", borderRadius: 4, textAlign: "center", fontSize: 11, color: "#5a8aaa", fontFamily: "Courier New, monospace" }}>KEEP CLOUD</div>
      </div>
    </div>
  );
}

// ── Section 7 ─────────────────────────────────────────────────────────────────

function ExportModalMockup() {
  return (
    <div style={{ background: "#060b14", border: "1px solid #1e3a5f", borderRadius: 6, overflow: "hidden", margin: "14px auto 20px", maxWidth: 380 }}>
      <div style={{ background: "#0a0f1a", borderBottom: "1px solid #1e3a5f", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 10, color: "#3FE0C5", letterSpacing: "0.14em", fontFamily: "Courier New, monospace", fontWeight: 700 }}>EXPORT / IMPORT</div>
        <span style={{ color: "#3a6a8a", fontSize: 14 }}>✕</span>
      </div>
      <div style={{ display: "flex", borderBottom: "1px solid #1e3a5f" }}>
        {["EXPORT", "IMPORT"].map((tab, i) => (
          <div key={tab} style={{ padding: "8px 20px", fontSize: 10, fontFamily: "Courier New, monospace", letterSpacing: "0.1em", color: i === 0 ? "#3FE0C5" : "#3a6a8a", borderBottom: i === 0 ? "2px solid #3FE0C5" : "none" }}>{tab}</div>
        ))}
      </div>
      <div style={{ padding: "16px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {mockField("FROM", "JAN 2026", false)}
          {mockField("TO", "MAY 2026", false)}
        </div>
        {mockBtn("EXPORT TO EXCEL  ↓", true)}
      </div>
    </div>
  );
}

function ExcelTabsMockup() {
  const tabs = ["Profile", "Carry Forward", "Flights", "Summary"];
  return (
    <div style={{ background: "#060b14", border: "1px solid #1e3a5f", borderRadius: 6, overflow: "hidden", margin: "14px auto 20px" }}>
      <div style={{ background: "#1a1a2e", padding: "20px 16px 14px" }}>
        <div style={{ fontSize: 9, color: "#5a7a6a", fontFamily: "Courier New, monospace", marginBottom: 8 }}>ClaudeBorne_eLogBook_Export_MAY2026.xlsx</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
          {["A", "B", "C", "D"].map(col => <div key={col} style={{ textAlign: "center", fontSize: 9, color: "#2a3a50", fontFamily: "Courier New, monospace" }}>{col}</div>)}
        </div>
      </div>
      <div style={{ display: "flex", borderTop: "2px solid #1e3a5f", background: "#141420" }}>
        {tabs.map((tab, i) => (
          <div key={tab} style={{ padding: "7px 12px", fontSize: 10, fontFamily: "Courier New, monospace", letterSpacing: "0.05em", color: i === 2 ? "#1a1a2e" : "#5a8aaa", background: i === 2 ? "#3FE0C5" : "transparent", borderRight: "1px solid #1e3a5f", whiteSpace: "nowrap" }}>{tab}</div>
        ))}
      </div>
    </div>
  );
}

// ── Section 8 ─────────────────────────────────────────────────────────────────

function SettingsTabsMockup() {
  const tabs = ["PROFILE", "PREFERENCES", "CARRY FWD", "APPEARANCE", "LIMITS", "MISC"];
  return (
    <div style={{ background: "#060b14", border: "1px solid #1e3a5f", borderRadius: 6, overflow: "hidden", margin: "14px auto 20px" }}>
      <div style={{ background: "#0a0f1a", borderBottom: "1px solid #1e3a5f", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 10, color: "#3FE0C5", letterSpacing: "0.14em", fontFamily: "Courier New, monospace", fontWeight: 700 }}>SETTINGS</div>
        <span style={{ color: "#3a6a8a", fontSize: 14 }}>✕</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", borderBottom: "1px solid #1e3a5f", background: "#080f1a" }}>
        {tabs.map((tab, i) => (
          <div key={tab} style={{ padding: "7px 11px", fontSize: 9, fontFamily: "Courier New, monospace", letterSpacing: "0.07em", color: i === 0 ? "#3FE0C5" : "#3a6a8a", borderBottom: i === 0 ? "2px solid #3FE0C5" : "none", whiteSpace: "nowrap" }}>{tab}</div>
        ))}
      </div>
      <div style={{ padding: "14px 20px" }}>
        <div style={{ fontSize: 9, color: "#2a4a6a", fontFamily: "Courier New, monospace", letterSpacing: "0.08em" }}>TAP ANY TAB TO VIEW SETTINGS →</div>
      </div>
    </div>
  );
}

function DangerZoneMockup() {
  return (
    <div style={{ background: "#060b14", border: "1px solid #1e3a5f", borderRadius: 6, overflow: "hidden", margin: "14px auto 20px", maxWidth: 400 }}>
      <div style={{ background: "rgba(220,50,50,0.06)", borderBottom: "1px solid rgba(220,50,50,0.2)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "#dc3232" }}>⚠</span>
        <div style={{ fontSize: 10, color: "#dc3232", letterSpacing: "0.14em", fontFamily: "Courier New, monospace", fontWeight: 700 }}>DANGER ZONE</div>
      </div>
      <div style={{ padding: "16px 20px" }}>
        <div style={{ fontSize: 11, color: "#5a8aaa", fontFamily: "Courier New, monospace", lineHeight: 1.7, marginBottom: 14 }}>
          Permanently delete your account and all associated data. This action cannot be undone.
        </div>
        <div style={{ padding: "9px 0", border: "1px solid rgba(220,50,50,0.4)", borderRadius: 4, textAlign: "center", fontSize: 11, color: "#dc3232", fontFamily: "Courier New, monospace", fontWeight: 700, letterSpacing: "0.1em", background: "rgba(220,50,50,0.06)" }}>
          DELETE ACCOUNT
        </div>
      </div>
    </div>
  );
}

function Screenshot({ label }) {
  return (
    <div style={{
      background: "#080f1a",
      border: "1px dashed #1e3a5f",
      borderRadius: 6,
      padding: "32px 20px",
      textAlign: "center",
      color: "#3a6a8a",
      fontSize: 11,
      letterSpacing: "0.1em",
      margin: "14px 0 20px",
    }}>
      📸 {label}
    </div>
  );
}

function Note({ children }) {
  return (
    <div style={{
      background: "rgba(63,224,197,0.05)",
      border: "1px solid rgba(63,224,197,0.2)",
      borderLeft: "3px solid #3FE0C5",
      borderRadius: 4,
      padding: "10px 14px",
      fontSize: 12,
      color: "#b8d6e5",
      margin: "14px 0",
      lineHeight: 1.7,
    }}>
      ⚠ {children}
    </div>
  );
}

function Tip({ children }) {
  return (
    <div style={{
      background: "rgba(59,141,255,0.05)",
      border: "1px solid rgba(59,141,255,0.2)",
      borderLeft: "3px solid #3B8DFF",
      borderRadius: 4,
      padding: "10px 14px",
      fontSize: 12,
      color: "#b8d6e5",
      margin: "14px 0",
      lineHeight: 1.7,
    }}>
      💡 {children}
    </div>
  );
}

// ── Section content ───────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 1,
    icon: "🚀",
    title: "Getting Started",
    Content: () => (
      <div className="htg-content">
        <p>ClaudeBorne eLogBook requires an account to keep your logbook securely backed up to the cloud. You can sign up with your email or use Google for a faster setup.</p>

        <LandingPageMockup />

        <h4>Creating an account</h4>
        <ul>
          <li>Tap <strong>Sign Up</strong> on the landing page</li>
          <li>Enter your email address and a password</li>
          <li>Check your inbox and verify your email before logging in</li>
        </ul>

        <SignUpFormMockup />

        <h4>Signing in with Google</h4>
        <ul>
          <li>Tap <strong>Continue with Google</strong></li>
          <li>Select your Google account — you'll be taken straight into the app</li>
        </ul>

        <h4>First-time setup</h4>
        <ul>
          <li>After signing in, fill in your pilot profile (name, licence number, licence type, airline)</li>
          <li>This information appears in your exported logbook</li>
        </ul>

        <PilotProfileMockup />
      </div>
    ),
  },
  {
    id: 2,
    icon: "📱",
    title: "Installing the App",
    Content: () => (
      <div className="htg-content">
        <p>The app can be installed directly on your phone or tablet — no App Store required. It works fully offline once installed.</p>

        <h4>On iPhone / iPad</h4>
        <ul>
          <li>Open <strong>claudeborne.my</strong> in Safari</li>
          <li>Tap the <strong>Share</strong> button at the bottom of the screen</li>
          <li>Tap <strong>Add to Home Screen</strong></li>
          <li>Tap <strong>Add</strong> — the app icon will appear on your home screen</li>
        </ul>

        <iOSShareMockup />

        <h4>On Android</h4>
        <ul>
          <li>Open <strong>claudeborne.my</strong> in Chrome</li>
          <li>Tap the <strong>three-dot menu</strong> in the top right</li>
          <li>Tap <strong>Add to Home Screen</strong> or <strong>Install App</strong></li>
          <li>Tap <strong>Install</strong></li>
        </ul>

        <AndroidInstallMockup />

        <Note>Always use Safari on iPhone and Chrome on Android for the best experience.</Note>

        <HomeScreenMockup />
      </div>
    ),
  },
  {
    id: 3,
    icon: "✈️",
    title: "Logging a Flight",
    Content: () => (
      <div className="htg-content">
        <p>The logbook is organised by month. Each row represents one flight sector. Tap any cell to start editing.</p>

        <LogbookMainViewMockup />

        <h4>Adding a flight</h4>
        <ul>
          <li>Navigate to the correct month by selecting from the dropdown menu. The current month is displayed by default.</li>
          <li>Tap an empty row to start filling it in</li>
          <li>Fill in the columns from left to right — date, aircraft type, registration, etc.</li>
          <li>Day/night hours and total are calculated automatically</li>
        </ul>

        <RowBeingEditedMockup />

        <h4>Column guide</h4>
        <ul>
          <li><strong>Date</strong> — day of the month (e.g. 15)</li>
          <li><strong>Type</strong> — aircraft type (e.g. B737, A320)</li>
          <li><strong>Markings</strong> — aircraft registration (e.g. 9M-XXX)</li>
          <li><strong>Captain</strong> — captain's name, or "SELF" if you were the captain</li>
          <li><strong>H.O.C</strong> — your capacity: P1, P2, or P1 U/S</li>
          <li><strong>Sectors</strong> — number of sectors flown</li>
          <li><strong>DEP / ARR</strong> — ICAO departure and arrival airport codes</li>
          <li><strong>STD / STA</strong> — scheduled departure and arrival times in UTC (HH:MM)</li>
          <li><strong>Remarks</strong> — any additional notes (tap the remarks icon)</li>
        </ul>

        <ColumnGuideMockup />

        <Tip>Once all rows are filled, tap the + ADD SECTOR button to add a new row.</Tip>
      </div>
    ),
  },
  {
    id: 4,
    icon: "🌙",
    title: "Day/Night Calculation",
    Content: () => (
      <div className="htg-content">
        <p>The app automatically splits your flight time into day and night hours based on your STD and STA. No manual entry needed.</p>

        <h4>Two calculation methods are available</h4>
        <ul>
          <li><strong>Fixed UTC</strong> — night is defined as 11:30–23:30 UTC. Simple and consistent.</li>
          <li><strong>Sunrise/Sunset (CAD-6 Part 1)</strong> — night is calculated based on actual sunrise and sunset times at your departure airport. More accurate for CAD-6 Part 1 compliance.</li>
        </ul>

        <h4>To change the method</h4>
        <ul>
          <li>Go to <strong>Settings → Preferences</strong></li>
          <li>Select your preferred method under <strong>Day/Night Calculation</strong></li>
        </ul>

        <DayNightSettingMockup />

        <Note>The sunrise/sunset method requires a valid ICAO departure airport code to calculate correctly.</Note>

        <DayNightSplitMockup />
      </div>
    ),
  },
  {
    id: 5,
    icon: "📊",
    title: "Carry Forward Hours",
    Content: () => (
      <div className="htg-content">
        <p>Carry forward hours are your total flight hours accumulated before you started using ClaudeBorne eLogBook. Adding them ensures your grand totals are accurate.</p>

        <h4>Setting up carry forward hours</h4>
        <ul>
          <li>Go to <strong>Settings → Carry Forward</strong></li>
          <li>Tap <strong>Add Aircraft Type</strong></li>
          <li>Enter the aircraft type and your previous hours for each category (Day P1, Night P1, etc.)</li>
          <li>Tap <strong>Save</strong></li>
        </ul>

        <CarryForwardMockup />

        <Tip>Add a separate entry for each aircraft type you have previous hours on.</Tip>
      </div>
    ),
  },
  {
    id: 6,
    icon: "☁️",
    title: "Syncing Your Logbook",
    Content: () => (
      <div className="htg-content">
        <p>Your flights are saved to your device instantly as you type. Use the Sync button to back up your data to the cloud and access it from other devices.</p>

        <h4>To sync</h4>
        <ul>
          <li>Tap the <strong>Sync icon</strong> in the toolbar</li>
          <li>The app will upload your latest data to the cloud</li>
          <li>A timestamp will confirm when the last sync was completed</li>
        </ul>

        <ToolbarSyncMockup />

        <h4>Using on multiple devices</h4>
        <ul>
          <li>Sign in with the same account on each device</li>
          <li>Tap Sync on the new device to pull your latest data down</li>
        </ul>

        <h4>If a conflict is detected</h4>
        <ul>
          <li>A prompt will appear asking you to choose between <strong>Keep Local</strong> or <strong>Keep Cloud</strong></li>
          <li>Choose whichever has the most up-to-date data</li>
        </ul>

        <SyncConflictMockup />

        <Tip>Sync before switching devices to avoid conflicts.</Tip>
      </div>
    ),
  },
  {
    id: 7,
    icon: "📤",
    title: "Exporting Your Data",
    Content: () => (
      <div className="htg-content">
        <p>ClaudeBorne eLogBook can export your logbook to Excel (.xlsx) format. The export covers a date range you select and includes four tabs.</p>

        <h4>To export</h4>
        <ul>
          <li>Tap the <strong>Export / Import icon</strong> in the toolbar</li>
          <li>Select a <strong>date range</strong></li>
          <li>Tap <strong>Export to Excel</strong></li>
          <li>The file will download to your device</li>
        </ul>

        <ExportModalMockup />

        <h4>What's included in the Excel file</h4>
        <ul>
          <li><strong>Profile</strong> — your pilot details</li>
          <li><strong>Carry Forward</strong> — your pre-app hours by aircraft type</li>
          <li><strong>Flights</strong> — all flight entries in the selected date range</li>
          <li><strong>Summary</strong> — monthly totals for all hour categories</li>
        </ul>

        <ExcelTabsMockup />

        <h4>Importing data</h4>
        <ul>
          <li>Tap the <strong>Import tab</strong> in the same window</li>
          <li>Select a previously exported Excel file</li>
          <li>Review the preview and confirm the import</li>
        </ul>

        <Note>Only files exported from ClaudeBorne eLogBook can be imported back in.</Note>
      </div>
    ),
  },
  {
    id: 8,
    icon: "⚙️",
    title: "Settings",
    Content: () => (
      <div className="htg-content">
        <p>The Settings panel gives you control over your profile, preferences, and appearance.</p>

        <h4>To open Settings</h4>
        <ul>
          <li>Tap the <strong>Settings icon</strong> (gear) in the toolbar</li>
        </ul>

        <SettingsTabsMockup />

        <h4>Tabs overview</h4>
        <ul>
          <li><strong>Profile</strong> — update your name, licence number, licence type, and airline</li>
          <li><strong>Preferences</strong> — set default aircraft type, captain name, day/night calculation method, and rows per page</li>
          <li><strong>Carry Forward</strong> — manage your pre-app hours (see Section 5)</li>
          <li><strong>Appearance</strong> — change accent colour, font size, and screen brightness filter</li>
          <li><strong>Limits & Recency</strong> — view your FTL limits and landing/autoland recency by aircraft type</li>
          <li><strong>Misc</strong> — access this guide, send feedback, check for app updates, and manage your account</li>
        </ul>

        <h4>Deleting your account</h4>
        <ul>
          <li>Go to <strong>Settings → Misc → Danger Zone</strong></li>
          <li>Tap <strong>Delete Account</strong></li>
          <li>Confirm when prompted — this permanently removes all your data</li>
        </ul>

        <DangerZoneMockup />
      </div>
    ),
  },
];

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function HowToGuideModal({ open, onClose }) {
  const [active, setActive] = useState(0);

  // Reset to first section on open
  useEffect(() => {
    if (open) setActive(0);
  }, [open]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const { icon, title, Content } = SECTIONS[active];

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 2200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#0a0d12", border: "1px solid #1e3a5f", borderRadius: 8, width: "100%", maxWidth: 860, height: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #1e3a5f", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.16em", color: "#3FE0C5", fontWeight: 700, marginBottom: 2 }}>HOW-TO GUIDE</div>
            <div style={{ fontSize: 10, color: "#3a6a8a", letterSpacing: "0.08em" }}>ClaudeBorne eLogBook</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#3a6a8a", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* Sidebar */}
          <div style={{ width: 210, borderRight: "1px solid #1e3a5f", overflowY: "auto", flexShrink: 0 }}>
            {SECTIONS.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActive(i)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "11px 16px",
                  background: active === i ? "rgba(63,224,197,0.07)" : "transparent",
                  borderLeft: `3px solid ${active === i ? "#3FE0C5" : "transparent"}`,
                  border: "none",
                  borderBottom: "1px solid #0f1e30",
                  color: active === i ? "#3FE0C5" : "#5a8aaa",
                  cursor: "pointer", textAlign: "left",
                  fontSize: 11, letterSpacing: "0.08em",
                  fontFamily: "Courier New, monospace",
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
            <div style={{ fontSize: 12, letterSpacing: "0.14em", color: "#3FE0C5", fontWeight: 700, marginBottom: 18, textTransform: "uppercase", textAlign: "left" }}>
              {icon} &nbsp;{title}
            </div>
            <Content />
          </div>
        </div>

        {/* Footer nav */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 20px", borderTop: "1px solid #1e3a5f", flexShrink: 0 }}>
          <button
            onClick={() => setActive(prev => Math.max(0, prev - 1))}
            disabled={active === 0}
            style={{ background: "transparent", border: "1px solid #1e3a5f", borderRadius: 4, color: active === 0 ? "#1e3a5f" : "#3a6a8a", padding: "5px 14px", cursor: active === 0 ? "default" : "pointer", fontSize: 11, letterSpacing: "0.08em", fontFamily: "Courier New, monospace" }}
          >← PREV</button>
          <span style={{ fontSize: 10, color: "#3a6a8a", letterSpacing: "0.1em" }}>{active + 1} / {SECTIONS.length}</span>
          <button
            onClick={() => active === SECTIONS.length - 1 ? onClose() : setActive(prev => prev + 1)}
            style={{ background: active === SECTIONS.length - 1 ? "rgba(63,224,197,0.1)" : "transparent", border: `1px solid ${active === SECTIONS.length - 1 ? "#3FE0C5" : "#1e3a5f"}`, borderRadius: 4, color: active === SECTIONS.length - 1 ? "#3FE0C5" : "#3a6a8a", padding: "5px 14px", cursor: "pointer", fontSize: 11, letterSpacing: "0.08em", fontFamily: "Courier New, monospace" }}
          >{active === SECTIONS.length - 1 ? "FINISH ✓" : "NEXT →"}</button>
        </div>
      </div>

      <style>{`
        .htg-content { text-align: left; }
        .htg-content p { margin: 0 0 14px; line-height: 1.75; font-size: 13px; color: #c8dce8; text-align: left; }
        .htg-content h4 { font-size: 10px; letter-spacing: 0.16em; color: #4fc3f7; font-weight: 700; text-transform: uppercase; margin: 22px 0 8px; font-family: Courier New, monospace; text-align: left; }
        .htg-content ul { margin: 0 0 10px 0; padding-left: 20px; text-align: left; }
        .htg-content li { margin-bottom: 7px; line-height: 1.65; font-size: 13px; color: #c8dce8; text-align: left; }
        .htg-content strong { color: #e2eef5; font-weight: 600; }
      `}</style>
    </div>
  );
}
