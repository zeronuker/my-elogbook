import { useState } from "react";

const sectors = [
  { id:1,  date:"02/04/2026", type:"B737-8",   reg:"9M-LRJ", capt:"SELF", cap:"P1", dep:"WMKK", arr:"VHHH", std:"0205", sta:"0614", blk:"04:09", flt:"04:05", day:"04:05", night:"",     imc:"04:05", ifr:"IFR", ldgD:0, ldgN:1, remarks:"KUL-HKG" },
  { id:2,  date:"02/04/2026", type:"B737-8",   reg:"9M-LRJ", capt:"SELF", cap:"P1", dep:"VHHH", arr:"WMKK", std:"0700", sta:"1131", blk:"04:04", flt:"04:00", day:"04:00", night:"",     imc:"04:00", ifr:"IFR", ldgD:1, ldgN:0, remarks:"HKG-KUL" },
  { id:3,  date:"07/04/2026", type:"B737-8",   reg:"9M-LRR", capt:"SELF", cap:"P1", dep:"WMKK", arr:"OPLA", std:"1017", sta:"1634", blk:"06:17", flt:"06:10", day:"",     night:"06:10", imc:"06:10", ifr:"IFR", ldgD:0, ldgN:1, remarks:"KUL-LHE" },
  { id:4,  date:"09/04/2026", type:"B737-8",   reg:"9M-LRC", capt:"SELF", cap:"P1", dep:"OPLA", arr:"WMKK", std:"1705", sta:"2300", blk:"05:55", flt:"05:48", day:"",     night:"05:48", imc:"05:48", ifr:"IFR", ldgD:0, ldgN:1, remarks:"LHE-KUL" },
  { id:5,  date:"13/04/2026", type:"B737-8",   reg:"9M-LRR", capt:"SELF", cap:"P1", dep:"RJAA", arr:"WMKK", std:"0110", sta:"0854", blk:"07:44", flt:"07:38", day:"07:38", night:"",     imc:"07:38", ifr:"IFR", ldgD:1, ldgN:0, remarks:"NRT-KUL" },
  { id:6,  date:"18/04/2026", type:"B737-8",   reg:"9M-LRP", capt:"SELF", cap:"P1", dep:"WMKK", arr:"ZGCS", std:"1202", sta:"1637", blk:"04:35", flt:"04:28", day:"",     night:"04:28", imc:"04:28", ifr:"IFR", ldgD:0, ldgN:1, remarks:"KUL-CSX" },
  { id:7,  date:"20/04/2026", type:"B737-8",   reg:"9M-LRS", capt:"SELF", cap:"P1", dep:"ZGCS", arr:"WMKK", std:"1823", sta:"2303", blk:"04:40", flt:"04:33", day:"",     night:"04:33", imc:"04:33", ifr:"IFR", ldgD:0, ldgN:1, remarks:"CSX-KUL" },
  { id:8,  date:"22/04/2026", type:"B737-800", reg:"9M-LDT", capt:"SELF", cap:"P1", dep:"WMKK", arr:"WPDL", std:"1812", sta:"2216", blk:"04:04", flt:"03:58", day:"01:00", night:"02:58", imc:"03:58", ifr:"IFR", ldgD:0, ldgN:1, remarks:"KUL-DIL" },
  { id:9,  date:"25/04/2026", type:"B737-800", reg:"9M-LDH", capt:"SELF", cap:"P1", dep:"WMKK", arr:"WADD", std:"0557", sta:"0930", blk:"03:03", flt:"02:57", day:"02:57", night:"",     imc:"02:57", ifr:"IFR", ldgD:1, ldgN:0, remarks:"KUL-DPS" },
  { id:10, date:"25/04/2026", type:"B737-800", reg:"9M-LDH", capt:"SELF", cap:"P1", dep:"WADD", arr:"YPPH", std:"0950", sta:"1340", blk:"03:34", flt:"03:27", day:"",     night:"03:27", imc:"03:27", ifr:"IFR", ldgD:0, ldgN:1, remarks:"DPS-PER" },
  { id:11, date:"26/04/2026", type:"B737-800", reg:"9M-LNY", capt:"SELF", cap:"P1", dep:"YPPH", arr:"WMKK", std:"1505", sta:"2108", blk:"06:03", flt:"05:56", day:"",     night:"05:56", imc:"05:56", ifr:"IFR", ldgD:0, ldgN:1, remarks:"PER-KUL" },
  { id:12, date:"27/04/2026", type:"B737-800", reg:"9M-LDD", capt:"SELF", cap:"P1", dep:"WMKK", arr:"VOCL", std:"1416", sta:"1832", blk:"04:03", flt:"03:57", day:"",     night:"03:57", imc:"03:57", ifr:"IFR", ldgD:0, ldgN:1, remarks:"KUL-COK" },
  { id:13, date:"27/04/2026", type:"B737-800", reg:"9M-LDD", capt:"SELF", cap:"P1", dep:"VOCL", arr:"WMKK", std:"1850", sta:"2303", blk:"04:03", flt:"03:57", day:"",     night:"03:57", imc:"03:57", ifr:"IFR", ldgD:0, ldgN:1, remarks:"COK-KUL" },
];

const ftlStats = [
  { label: "7-Day", hours: "14:13", limit: "60:00", pct: 24, status: "green" },
  { label: "28-Day", hours: "62:14", limit: "100:00", pct: 62, status: "yellow" },
  { label: "90-Day", hours: "192:26", limit: "270:00", pct: 71, status: "yellow" },
  { label: "365-Day", hours: "706:11", limit: "900:00", pct: 78, status: "yellow" },
];

const aprTotals = {
  sectors: 13,
  blk: "62:14",
  day: "19:40",
  night: "42:34",
  imc: "62:14",
  ldgDay: 3,
  ldgNight: 10,
};

const statusColor = { green: "#00e5a0", yellow: "#f5c542", red: "#ff4f4f" };

export default function ELogbook() {
  const [activeTab, setActiveTab] = useState("logbook");
  const [hoveredRow, setHoveredRow] = useState(null);

  return (
    <div style={{
      background: "#0a0d12",
      minHeight: "100vh",
      fontFamily: "'Courier New', monospace",
      color: "#c8d6e5",
      padding: "0",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #0d1117 0%, #161d2a 100%)",
        borderBottom: "1px solid #1e3a5f",
        padding: "20px 28px 0",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 22, color: "#4fc3f7" }}>✈</span>
              <span style={{ fontSize: 11, letterSpacing: "0.25em", color: "#4fc3f7", textTransform: "uppercase" }}>
                eLOGBOOK v4.0 · CAAM / MCAR 2016
              </span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#e8f4fd", letterSpacing: "0.05em" }}>
              APRIL 2026 — FLIGHT RECORD
            </div>
            <div style={{ fontSize: 11, color: "#5a7a9a", marginTop: 4 }}>
              Compliant with MCAR 2016 Part 7 (FTL) · Part 8 (Licensing) · ICAO Annex 1
            </div>
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {[
              { label: "SECTORS", val: aprTotals.sectors },
              { label: "BLOCK TIME", val: aprTotals.blk },
              { label: "DAY", val: aprTotals.day },
              { label: "NIGHT", val: aprTotals.night },
              { label: "LDG (D/N)", val: `${aprTotals.ldgDay}/${aprTotals.ldgNight}` },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "right" }}>
                <div style={{ fontSize: 9, color: "#4a6a8a", letterSpacing: "0.15em" }}>{s.label}</div>
                <div style={{ fontSize: 16, color: "#4fc3f7", fontWeight: 700 }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginTop: 18 }}>
          {["logbook", "ftl", "currency"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              background: activeTab === tab ? "#0a0d12" : "transparent",
              border: "none",
              borderTop: activeTab === tab ? "2px solid #4fc3f7" : "2px solid transparent",
              borderLeft: "1px solid " + (activeTab === tab ? "#1e3a5f" : "transparent"),
              borderRight: "1px solid " + (activeTab === tab ? "#1e3a5f" : "transparent"),
              color: activeTab === tab ? "#4fc3f7" : "#5a7a9a",
              padding: "8px 20px",
              fontSize: 11,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              cursor: "pointer",
              marginBottom: activeTab === tab ? "-1px" : 0,
            }}>
              {tab === "logbook" ? "📋 LOGBOOK" : tab === "ftl" ? "⏱ FTL LIMITS" : "✅ CURRENCY"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "20px 28px" }}>

        {/* LOGBOOK TAB */}
        {activeTab === "logbook" && (
          <div style={{ overflowX: "auto" }}>
            {/* NEW vs OLD callout */}
            <div style={{
              background: "linear-gradient(90deg, rgba(79,195,247,0.08), transparent)",
              border: "1px solid rgba(79,195,247,0.2)",
              borderLeft: "3px solid #4fc3f7",
              borderRadius: "0 4px 4px 0",
              padding: "10px 16px",
              marginBottom: 16,
              fontSize: 11,
              color: "#7ab8d4",
              lineHeight: 1.7,
            }}>
              <span style={{ color: "#4fc3f7", fontWeight: 700 }}>UPGRADE CHANGES: </span>
              Each row = 1 sector (was: 1 row per day) · ICAO DEP/ARR airport codes · Landing counts · IFR/IMC time · Block vs Flight time distinguished
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 1100 }}>
              <thead>
                <tr style={{ background: "#0d1520" }}>
                  {[
                    ["#","30px"], ["DATE","80px"], ["TYPE","80px"], ["REG","72px"],
                    ["CAPT","52px"], ["CAP","40px"],
                    ["DEP","48px"], ["ARR","48px"],
                    ["STD","48px"], ["STA","48px"],
                    ["BLOCK","52px"], ["FLT","52px"],
                    ["DAY","52px"], ["NIGHT","52px"],
                    ["IFR","36px"], ["IMC","52px"],
                    ["LDG D","44px"], ["LDG N","44px"],
                    ["REMARKS",""],
                  ].map(([h, w]) => (
                    <th key={h} style={{
                      padding: "7px 8px",
                      textAlign: "center",
                      color: "#3a6a8a",
                      fontSize: 9,
                      letterSpacing: "0.12em",
                      borderBottom: "1px solid #1a3050",
                      borderRight: "1px solid #111820",
                      whiteSpace: "nowrap",
                      width: w || "auto",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sectors.map((s, i) => {
                  const isHov = hoveredRow === s.id;
                  const isNight = s.night && !s.day;
                  const isMixed = s.day && s.night;
                  const rowBg = isHov
                    ? "rgba(79,195,247,0.07)"
                    : i % 2 === 0 ? "#0c1018" : "#0a0e14";

                  return (
                    <tr key={s.id}
                      onMouseEnter={() => setHoveredRow(s.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{ background: rowBg, transition: "background 0.15s" }}
                    >
                      <td style={td}><span style={{ color: "#2a4a6a" }}>{s.id}</span></td>
                      <td style={td}><span style={{ color: "#7ab8d4" }}>{s.date}</span></td>
                      <td style={td}><span style={{ color: "#c8d6e5" }}>{s.type}</span></td>
                      <td style={td}>
                        <span style={{
                          background: "rgba(79,195,247,0.08)",
                          color: "#4fc3f7",
                          padding: "1px 5px",
                          borderRadius: 2,
                          fontSize: 10,
                        }}>{s.reg}</span>
                      </td>
                      <td style={td}>{s.capt}</td>
                      <td style={{...td, textAlign:"center"}}>
                        <span style={{
                          background: "rgba(0,229,160,0.1)",
                          color: "#00e5a0",
                          padding: "1px 5px",
                          borderRadius: 2,
                          fontSize: 10,
                          fontWeight: 700,
                        }}>{s.cap}</span>
                      </td>
                      <td style={{...td, textAlign:"center", color:"#a8c8e8"}}>{s.dep}</td>
                      <td style={{...td, textAlign:"center", color:"#a8c8e8"}}>{s.arr}</td>
                      <td style={{...td, textAlign:"center", color:"#6a8aaa"}}>{s.std}</td>
                      <td style={{...td, textAlign:"center", color:"#6a8aaa"}}>{s.sta}</td>
                      <td style={{...td, textAlign:"center", color:"#c8d6e5", fontWeight:600}}>{s.blk}</td>
                      <td style={{...td, textAlign:"center", color:"#8aaaca"}}>{s.flt}</td>
                      <td style={{...td, textAlign:"center"}}>
                        {s.day ? <span style={{ color: "#f5c542" }}>{s.day}</span> : <span style={{ color:"#1e3a5f" }}>—</span>}
                      </td>
                      <td style={{...td, textAlign:"center"}}>
                        {s.night ? <span style={{ color: "#9b79e8" }}>{s.night}</span> : <span style={{ color:"#1e3a5f" }}>—</span>}
                      </td>
                      <td style={{...td, textAlign:"center"}}>
                        <span style={{ color:"#4fc3f7", fontSize:9 }}>{s.ifr}</span>
                      </td>
                      <td style={{...td, textAlign:"center", color:"#5a9abf"}}>{s.imc}</td>
                      <td style={{...td, textAlign:"center"}}>
                        {s.ldgD > 0 ? <span style={{ color:"#f5c542", fontWeight:700 }}>{s.ldgD}</span> : <span style={{ color:"#1e3a5f" }}>—</span>}
                      </td>
                      <td style={{...td, textAlign:"center"}}>
                        {s.ldgN > 0 ? <span style={{ color:"#9b79e8", fontWeight:700 }}>{s.ldgN}</span> : <span style={{ color:"#1e3a5f" }}>—</span>}
                      </td>
                      <td style={{...td, color:"#4a6a7a", fontSize:10, paddingLeft:10}}>{s.remarks}</td>
                    </tr>
                  );
                })}

                {/* Totals row */}
                <tr style={{ background: "#0d1828", borderTop: "2px solid #1e3a5f" }}>
                  <td colSpan={6} style={{...td, color:"#4fc3f7", fontWeight:700, letterSpacing:"0.1em", fontSize:10}}>APRIL 2026 TOTALS</td>
                  <td colSpan={4} style={td}></td>
                  <td style={{...td, textAlign:"center", color:"#4fc3f7", fontWeight:700}}>62:14</td>
                  <td style={{...td, textAlign:"center", color:"#4fc3f7"}}></td>
                  <td style={{...td, textAlign:"center", color:"#f5c542", fontWeight:700}}>19:40</td>
                  <td style={{...td, textAlign:"center", color:"#9b79e8", fontWeight:700}}>42:34</td>
                  <td style={td}></td>
                  <td style={{...td, textAlign:"center", color:"#5a9abf", fontWeight:700}}>62:14</td>
                  <td style={{...td, textAlign:"center", color:"#f5c542", fontWeight:700}}>3</td>
                  <td style={{...td, textAlign:"center", color:"#9b79e8", fontWeight:700}}>10</td>
                  <td style={td}></td>
                </tr>
              </tbody>
            </table>

            {/* Legend */}
            <div style={{ display:"flex", gap:20, marginTop:14, flexWrap:"wrap" }}>
              {[
                { color:"#f5c542", label:"Day time" },
                { color:"#9b79e8", label:"Night time" },
                { color:"#4fc3f7", label:"Aircraft reg / IFR" },
                { color:"#00e5a0", label:"Pilot capacity (P1/P2)" },
              ].map(l => (
                <div key={l.label} style={{ display:"flex", alignItems:"center", gap:6, fontSize:10, color:"#4a6a8a" }}>
                  <div style={{ width:8, height:8, borderRadius:2, background:l.color }}></div>
                  {l.label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FTL TAB */}
        {activeTab === "ftl" && (
          <div>
            <div style={{ marginBottom:20, fontSize:11, color:"#4a6a8a" }}>
              Rolling totals as of <span style={{ color:"#4fc3f7" }}>30 April 2026</span> · Limits per MCAR 2016 Part 7
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:16, marginBottom:28 }}>
              {ftlStats.map(s => {
                const col = statusColor[s.status];
                return (
                  <div key={s.label} style={{
                    background: "#0d1520",
                    border: `1px solid ${col}33`,
                    borderRadius: 6,
                    padding: "18px 20px",
                  }}>
                    <div style={{ fontSize:10, color:"#4a6a8a", letterSpacing:"0.15em", marginBottom:6 }}>{s.label} ROLLING</div>
                    <div style={{ fontSize:28, fontWeight:700, color: col, marginBottom:4, letterSpacing:"0.04em" }}>{s.hours}</div>
                    <div style={{ fontSize:10, color:"#3a5a7a", marginBottom:10 }}>LIMIT: {s.limit}</div>
                    {/* Bar */}
                    <div style={{ background:"#0a0e14", borderRadius:2, height:4, overflow:"hidden" }}>
                      <div style={{
                        width: `${s.pct}%`,
                        height:"100%",
                        background: col,
                        borderRadius:2,
                        transition:"width 1s ease",
                        boxShadow: `0 0 6px ${col}88`,
                      }}></div>
                    </div>
                    <div style={{ fontSize:10, color:"#3a5a7a", marginTop:5, textAlign:"right" }}>{s.pct}% used</div>
                  </div>
                );
              })}
            </div>

            {/* NEW vs OLD comparison */}
            <div style={{
              background:"#0d1520",
              border:"1px solid #1e3a5f",
              borderRadius:6,
              padding:"18px 20px",
            }}>
              <div style={{ fontSize:11, color:"#4fc3f7", letterSpacing:"0.15em", marginBottom:14 }}>WHAT'S NEW VS eLOGBOOK v3</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <div>
                  <div style={{ fontSize:10, color:"#ff4f4f", marginBottom:8 }}>✗ v3 TRACKED</div>
                  {["28-day rolling only"].map(i => (
                    <div key={i} style={{ fontSize:11, color:"#5a7a9a", padding:"4px 0", borderBottom:"1px solid #111820" }}>• {i}</div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize:10, color:"#00e5a0", marginBottom:8 }}>✓ v4 TRACKS</div>
                  {["7-day rolling","28-day rolling","90-day rolling","365-day rolling"].map(i => (
                    <div key={i} style={{ fontSize:11, color:"#7ab8d4", padding:"4px 0", borderBottom:"1px solid #111820" }}>• {i}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CURRENCY TAB */}
        {activeTab === "currency" && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))", gap:16 }}>
            {[
              {
                title: "LANDING RECENCY",
                sub: "3 landings in 90 days (MCAR 2016 Part 8)",
                items: [
                  { label:"Last landing", val:"27/04/2026", status:"green" },
                  { label:"Landings (90d)", val:"13 night  ·  3 day", status:"green" },
                  { label:"Night recency", val:"✓ Current", status:"green" },
                  { label:"Day recency", val:"✓ Current", status:"green" },
                ]
              },
              {
                title: "INSTRUMENT RECENCY",
                sub: "6 IFR approaches in 6 months (MCAR 2016)",
                items: [
                  { label:"Last IFR flt", val:"27/04/2026", status:"green" },
                  { label:"IFR hrs (6mo)", val:"62:14 IMC", status:"green" },
                  { label:"ILS/approaches", val:"⚠ Manual entry req'd", status:"yellow" },
                  { label:"IR Status", val:"✓ Current", status:"green" },
                ]
              },
              {
                title: "TYPE RATING",
                sub: "B737-800 / B737-8 (MAX)",
                items: [
                  { label:"Last proficiency", val:"Manual entry req'd", status:"yellow" },
                  { label:"Next OPC due", val:"Manual entry req'd", status:"yellow" },
                  { label:"B737-800 hrs", val:"~1,135:41 (P1)", status:"green" },
                  { label:"B737-8 hrs", val:"~884:17 (P1)", status:"green" },
                ]
              },
              {
                title: "MEDICAL",
                sub: "Class 1 Medical (CAAM)",
                items: [
                  { label:"Class 1 expiry", val:"Manual entry req'd", status:"yellow" },
                  { label:"ENG Language", val:"Manual entry req'd", status:"yellow" },
                  { label:"ATP Licence", val:"Manual entry req'd", status:"yellow" },
                  { label:"ATPL Status", val:"Manual entry req'd", status:"yellow" },
                ]
              },
            ].map(card => (
              <div key={card.title} style={{
                background:"#0d1520",
                border:"1px solid #1e3a5f",
                borderRadius:6,
                padding:"16px 18px",
              }}>
                <div style={{ fontSize:11, color:"#4fc3f7", fontWeight:700, letterSpacing:"0.12em", marginBottom:3 }}>{card.title}</div>
                <div style={{ fontSize:10, color:"#3a5a7a", marginBottom:12 }}>{card.sub}</div>
                {card.items.map(item => (
                  <div key={item.label} style={{
                    display:"flex", justifyContent:"space-between", alignItems:"center",
                    padding:"5px 0", borderBottom:"1px solid #0f1a24",
                    fontSize:10,
                  }}>
                    <span style={{ color:"#5a7a9a" }}>{item.label}</span>
                    <span style={{ color: statusColor[item.status] || "#c8d6e5", fontWeight:600 }}>{item.val}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding:"12px 28px",
        borderTop:"1px solid #111820",
        fontSize:9,
        color:"#2a4a6a",
        letterSpacing:"0.12em",
        display:"flex",
        justifyContent:"space-between",
        flexWrap:"wrap",
        gap:8,
      }}>
        <span>eLOGBOOK v4.0 · SAMPLE · APRIL 2026</span>
        <span>MCAR 2016 PART 7 &amp; 8 · ICAO ANNEX 1 COMPLIANT FORMAT</span>
        <span>⚠ FIELDS MARKED "MANUAL ENTRY REQ'D" NOT IN ORIGINAL v3 DATA</span>
      </div>
    </div>
  );
}

const td = {
  padding: "6px 8px",
  borderBottom: "1px solid #0f1820",
  borderRight: "1px solid #0d1520",
  whiteSpace: "nowrap",
  fontSize: 11,
  color: "#8aaaca",
};
