import { useState, useEffect } from "react";

// ── Sub-components ────────────────────────────────────────────────────────────

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

        <Screenshot label="Landing page" />

        <h4>Creating an account</h4>
        <ul>
          <li>Tap <strong>Sign Up</strong> on the landing page</li>
          <li>Enter your email address and a password</li>
          <li>Check your inbox and verify your email before logging in</li>
        </ul>

        <Screenshot label="Sign up form" />

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

        <Screenshot label="Pilot profile setup" />
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

        <Screenshot label="iOS Share menu" />

        <h4>On Android</h4>
        <ul>
          <li>Open <strong>claudeborne.my</strong> in Chrome</li>
          <li>Tap the <strong>three-dot menu</strong> in the top right</li>
          <li>Tap <strong>Add to Home Screen</strong> or <strong>Install App</strong></li>
          <li>Tap <strong>Install</strong></li>
        </ul>

        <Screenshot label="Android install prompt" />

        <Note>Always use Safari on iPhone and Chrome on Android for the best experience.</Note>

        <Screenshot label="App icon on home screen" />
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

        <Screenshot label="Logbook main view" />

        <h4>Adding a flight</h4>
        <ul>
          <li>Navigate to the correct month by selecting from the dropdown menu. The current month is displayed by default.</li>
          <li>Tap an empty row to start filling it in</li>
          <li>Fill in the columns from left to right — date, aircraft type, registration, etc.</li>
          <li>Day/night hours and total are calculated automatically</li>
        </ul>

        <Screenshot label="Row being edited" />

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

        <Screenshot label="Remarks modal" />

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

        <Screenshot label="Day/Night setting in Preferences" />

        <Note>The sunrise/sunset method requires a valid ICAO departure airport code to calculate correctly.</Note>

        <Screenshot label="Logbook row showing day/night split" />
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

        <Screenshot label="Carry Forward tab in Settings" />

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

        <Screenshot label="Toolbar showing Sync button" />

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

        <Screenshot label="Sync conflict modal" />

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

        <Screenshot label="Export/Import modal" />

        <h4>What's included in the Excel file</h4>
        <ul>
          <li><strong>Profile</strong> — your pilot details</li>
          <li><strong>Carry Forward</strong> — your pre-app hours by aircraft type</li>
          <li><strong>Flights</strong> — all flight entries in the selected date range</li>
          <li><strong>Summary</strong> — monthly totals for all hour categories</li>
        </ul>

        <Screenshot label="Excel file showing all 4 tabs" />

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

        <Screenshot label="Settings modal overview" />

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

        <Screenshot label="Danger Zone in Misc tab" />
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
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
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
            <div style={{ fontSize: 12, letterSpacing: "0.14em", color: "#3FE0C5", fontWeight: 700, marginBottom: 18, textTransform: "uppercase" }}>
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
            onClick={() => setActive(prev => Math.min(SECTIONS.length - 1, prev + 1))}
            disabled={active === SECTIONS.length - 1}
            style={{ background: "transparent", border: "1px solid #1e3a5f", borderRadius: 4, color: active === SECTIONS.length - 1 ? "#1e3a5f" : "#3a6a8a", padding: "5px 14px", cursor: active === SECTIONS.length - 1 ? "default" : "pointer", fontSize: 11, letterSpacing: "0.08em", fontFamily: "Courier New, monospace" }}
          >NEXT →</button>
        </div>
      </div>

      <style>{`
        .htg-content p { margin: 0 0 14px; line-height: 1.75; font-size: 13px; color: #c8dce8; }
        .htg-content h4 { font-size: 10px; letter-spacing: 0.16em; color: #4fc3f7; font-weight: 700; text-transform: uppercase; margin: 22px 0 8px; font-family: Courier New, monospace; }
        .htg-content ul { margin: 0 0 10px 0; padding-left: 20px; }
        .htg-content li { margin-bottom: 7px; line-height: 1.65; font-size: 13px; color: #c8dce8; }
        .htg-content strong { color: #e2eef5; font-weight: 600; }
      `}</style>
    </div>
  );
}
