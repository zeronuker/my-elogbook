import { useEffect, useState } from "react";

// ── Default settings shape ──────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  // Profile
  fullName: "",
  dateOfBirth: "",
  staffId: "",
  licenceNumber: "",
  licenceType: "ATPL(A)",
  airline: "",
  homeBase: "",
  defaultAircraftType: "",
  defaultMarkings: "",
  defaultCaptain: "",
  // Carry forward
  carryForward: [
    { type: "", dayP1: "", dayP1US: "", dayP2: "", nightP1: "", nightP1US: "", nightP2: "" },
  ],
  // Appearance
  theme: "dark",            // "dark" | "light"
  fontSize: 14,             // 12–18
  tableDensity: "default",  // "compact" | "default" | "relaxed"
  fontType: "courier",      // "courier" | "jetbrains" | "ibmplex" | "roboto" | "space"
  brightness: 100,          // 60–100 (dark mode only)
  accentColor: "#4fc3f7",   // hex from ACCENT_PALETTE
  // Preferences
  dateFormat: "D",      // "D" | "DD" | "DD MMM" — display format for DATE column
  rowsPerPage: 15,      // minimum rows shown per month in logbook
  dayNightMethod: "fixed", // "fixed" | "sunrise"
  useStandardFormula: true,
  preFlightBuffer: 75,
  postFlightBuffer: 15,
};

// ── Dark Cockpit Theme (fixed) ──────────────────────────────────────────────
const DARK_COCKPIT_THEME = {
  bg:        "#0a0d12", bg2:       "#0d1520", bg3:       "#0a1018",
  bgHeader:  "#0d1117", bgAlt:     "#161d2a", bgThead:   "#0b1320",
  bgInput:   "#0b1828",
  accent:    "#4fc3f7", accent2:   "#7ab8d4", accentDim: "#2a5a7a",
  border:    "#1e3a5f", border2:   "#1a3050", border3:   "#0f1820", border4: "#111820",
  text:      "#ffffff", textMuted: "#b8d6e5", textDim:   "#7a9aaa", textBright: "#ffffff",
  rowHover:  "#122030",
};

const TAB_HINTS = {
  profile:     "Profile changes update your logbook defaults immediately.",
  appearance:  "Appearance changes apply after saving.",
  preferences: "⚠ Recalculation may take a moment on large logbooks.",
  misc:        "Version 5.5 · claudeborne.my",
};

// ── Carry-forward helpers ────────────────────────────────────────────────────
const CF_FIELDS = ["dayP1", "dayP1US", "dayP2", "nightP1", "nightP1US", "nightP2"];
const CF_EMPTY  = () => ({ type: "", dayP1: "", dayP1US: "", dayP2: "", nightP1: "", nightP1US: "", nightP2: "" });

function cfParseHHMM(val) {
  if (!val || !String(val).trim()) return 0;
  const parts = String(val).trim().split(":");
  return parts.length === 2
    ? (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0)
    : parseInt(val) || 0;
}
function cfToHHMM(mins) {
  if (!mins || mins <= 0) return "";
  return `${Math.floor(mins / 60).toString().padStart(2, "0")}:${(mins % 60).toString().padStart(2, "0")}`;
}
function cfRowTotal(row) {
  return cfToHHMM(CF_FIELDS.reduce((acc, k) => acc + cfParseHHMM(row[k] || ""), 0));
}

// ── Component ───────────────────────────────────────────────────────────────
export default function SettingsModal({ open, onClose, settings, onSave, userEmail, onDeleteAccount }) {
  const [tab, setTab] = useState("profile");
  const [draft, setDraft] = useState(settings || DEFAULT_SETTINGS);
  const [savedFlash, setSavedFlash] = useState(false);

  // Reset tab and flash only when modal is first opened
  useEffect(() => {
    if (open) {
      setTab("profile");
      setSavedFlash(false);
    }
  }, [open]);

  // Resync draft whenever upstream settings change (includes after save)
  useEffect(() => {
    if (open) {
      setDraft({ ...DEFAULT_SETTINGS, ...(settings || {}) });
    }
  }, [open, settings]);

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const upd = (patch) => setDraft(prev => ({ ...prev, ...patch }));

  const handleSave = async () => {
    await onSave(draft);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const footerHint = savedFlash
    ? "✓ Settings saved successfully."
    : (TAB_HINTS[tab] || "All changes are saved to your cloud profile.");

  return (
    <div className="elb-settings-overlay" onClick={handleBackdrop}>
      <style>{settingsCss}</style>
      <div className="elb-settings-modal" role="dialog" aria-modal="true" aria-label="Settings">
        {/* ── HEADER ── */}
        <div className="elb-modal-header">
          <div>
            <div className="elb-modal-label">eLOGBOOK V5.5 · CONFIGURATION</div>
            <div className="elb-modal-title">⚙ SETTINGS</div>
          </div>
          <button className="elb-modal-close" onClick={onClose} title="Close">✕</button>
        </div>

        {/* ── TABS ── */}
        <div className="elb-settings-tabs">
          {[
            { id: "profile",     label: "👤 PROFILE" },
            { id: "appearance",  label: "🎨 APPEARANCE" },
            { id: "preferences", label: "⚙ PREFERENCES" },
            { id: "misc",        label: "📋 MISCELLANEOUS" },
          ].map(t => (
            <button
              key={t.id}
              className={"elb-stab" + (tab === t.id ? " active" : "")}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── CONTENT ── */}
        <div className="elb-tab-content">
          {tab === "profile"     && <ProfileTab     d={draft} upd={upd} userEmail={userEmail} />}
          {tab === "appearance"  && <AppearanceTab d={draft} upd={upd} />}
          {tab === "preferences" && <PreferencesTab d={draft} upd={upd} />}
          {tab === "misc"        && <MiscTab onDeleteAccount={onDeleteAccount} />}
        </div>

        {/* ── FOOTER ── */}
        <div className="elb-modal-footer">
          <div className={"elb-footer-hint" + (savedFlash ? " saved" : "")}>{footerHint}</div>
          <div className="elb-footer-actions">
            <button className="elb-btn elb-btn-ghost" onClick={onClose}>CANCEL</button>
            <button className="elb-btn elb-btn-primary" onClick={handleSave}>SAVE CHANGES</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   PROFILE TAB
   ───────────────────────────────────────────────────────────────────────── */
function ProfileTab({ d, upd, userEmail }) {
  return (
    <>
      <div className="elb-form-section">
        <div className="elb-form-section-title">PERSONAL INFORMATION</div>
        <div className="elb-form-row">
          <Field label="FULL NAME" required>
            <input className="elb-form-input" type="text" value={d.fullName}
              onChange={e => upd({ fullName: e.target.value })}
              placeholder="Your full name" />
          </Field>
          <Field label="DATE OF BIRTH" required>
            <input className="elb-form-input" type="date" value={d.dateOfBirth}
              onChange={e => upd({ dateOfBirth: e.target.value })} />
          </Field>
        </div>
        <div className="elb-form-row">
          <Field label="STAFF / EMPLOYEE ID">
            <input className="elb-form-input" type="text" value={d.staffId}
              onChange={e => upd({ staffId: e.target.value })}
              placeholder="e.g. AK-12345" />
          </Field>
          <Field label="EMAIL ADDRESS"
                 hint="Linked to your Google account. Cannot be changed here.">
            <input className="elb-form-input" type="email" value={userEmail || ""} disabled />
          </Field>
        </div>
      </div>

      <div className="elb-form-section">
        <div className="elb-form-section-title">LICENCE & RATINGS</div>
        <div className="elb-form-row">
          <Field label="LICENCE NUMBER">
            <input className="elb-form-input" type="text" value={d.licenceNumber}
              onChange={e => upd({ licenceNumber: e.target.value })}
              placeholder="e.g. MY-ATPL-001234" />
          </Field>
          <Field label="LICENCE TYPE">
            <select className="elb-form-input" value={d.licenceType}
              onChange={e => upd({ licenceType: e.target.value })}>
              <option>ATPL(A)</option>
              <option>CPL(A)</option>
              <option>MPL</option>
              <option>PPL(A)</option>
            </select>
          </Field>
        </div>
        <div className="elb-form-row single">
          <Field label="AIRLINE / OPERATOR">
            <input className="elb-form-input" type="text" value={d.airline}
              onChange={e => upd({ airline: e.target.value })}
              placeholder="e.g. AirAsia" />
          </Field>
        </div>
      </div>

      {/* ── CARRY FORWARD HOURS ── */}
      <div className="elb-form-section">
        <div className="elb-form-section-title">CARRY FORWARD HOURS</div>
        <div className="elb-form-hint" style={{ marginBottom: 10 }}>
          Enter total flying hours from previous logbooks per aircraft type. Time format: HH:MM
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="elb-cf-table">
            <thead>
              <tr>
                <th className="elb-cf-th elb-cf-th-type" rowSpan={2}>AIRCRAFT<br />TYPE</th>
                <th className="elb-cf-th elb-cf-th-group elb-cf-day" colSpan={3}>DAY</th>
                <th className="elb-cf-th elb-cf-th-group elb-cf-night" colSpan={3}>NIGHT</th>
                <th className="elb-cf-th elb-cf-th-total" rowSpan={2}>TOTAL</th>
                <th className="elb-cf-th" rowSpan={2} style={{ width: 20 }} />
              </tr>
              <tr>
                {["P1","P1 U/S","P2","P1","P1 U/S","P2"].map((lbl, i) => (
                  <th key={i} className="elb-cf-th elb-cf-th-sub">{lbl}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(d.carryForward || [CF_EMPTY()]).map((row, i) => {
                const rows = d.carryForward || [CF_EMPTY()];
                const setRow = (patch) => {
                  const next = rows.map((r, idx) => idx === i ? { ...r, ...patch } : r);
                  upd({ carryForward: next });
                };
                return (
                  <tr key={i}>
                    <td className="elb-cf-td">
                      <input className="elb-cf-input elb-cf-input-type" type="text"
                        value={row.type || ""}
                        onChange={e => setRow({ type: e.target.value.toUpperCase() })}
                        placeholder="B737" />
                    </td>
                    {CF_FIELDS.map(field => (
                      <td key={field} className="elb-cf-td">
                        <input className="elb-cf-input" type="text"
                          value={row[field] || ""}
                          onChange={e => setRow({ [field]: e.target.value })}
                          placeholder="00:00" />
                      </td>
                    ))}
                    <td className="elb-cf-td elb-cf-total-cell">
                      {cfRowTotal(row) || <span style={{ color: "#1e3a5f" }}>—</span>}
                    </td>
                    <td className="elb-cf-td elb-cf-action-cell">
                      {rows.length > 1 && (
                        <button type="button" className="elb-cf-remove"
                          title="Remove row"
                          onClick={() => upd({ carryForward: rows.filter((_, idx) => idx !== i) })}>
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button type="button" className="elb-cf-add"
          onClick={() => upd({ carryForward: [...(d.carryForward || [CF_EMPTY()]), CF_EMPTY()] })}>
          ＋ ADD AIRCRAFT TYPE
        </button>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   APPEARANCE TAB
   ───────────────────────────────────────────────────────────────────────── */
const ACCENT_SWATCHES = [
  { hex: "#4fc3f7", name: "CYAN"   },
  { hex: "#f5c542", name: "AMBER"  },
  { hex: "#22c55e", name: "GREEN"  },
  { hex: "#a78bfa", name: "PURPLE" },
  { hex: "#fb923c", name: "ORANGE" },
  { hex: "#f472b6", name: "PINK"   },
  { hex: "#ef4444", name: "RED"    },
  { hex: "#2dd4bf", name: "TEAL"   },
];

const FONT_OPTIONS = [
  { key: "courier",   label: "COURIER NEW",  sample: "AaBb 01" },
  { key: "jetbrains", label: "JETBRAINS",    sample: "AaBb 01" },
  { key: "ibmplex",   label: "IBM PLEX",     sample: "AaBb 01" },
  { key: "roboto",    label: "ROBOTO",       sample: "AaBb 01" },
  { key: "space",     label: "SPACE MONO",   sample: "AaBb 01" },
];

const FONT_FAMILIES_PREVIEW = {
  courier:   "'Courier New', Courier, monospace",
  jetbrains: "'JetBrains Mono', monospace",
  ibmplex:   "'IBM Plex Mono', monospace",
  roboto:    "'Roboto Mono', monospace",
  space:     "'Space Mono', monospace",
};

function AppearanceTab({ d, upd }) {
  const theme       = d.theme        || "dark";
  const fontSize    = Math.min(18, Math.max(12, Number(d.fontSize) || 14));
  const density     = d.tableDensity || "default";
  const fontType    = d.fontType     || "courier";
  const brightness  = Number(d.brightness) || 100;
  const accentColor = d.accentColor  || "#4fc3f7";

  return (
    <>
      {/* ── THEME ── */}
      <div className="elb-form-section">
        <div className="elb-form-section-title">THEME</div>
        <div className="elb-radio-group">
          <RadioOption
            checked={theme === "dark"}
            onChange={() => upd({ theme: "dark" })}
            name="DARK COCKPIT (DEFAULT)"
            desc="Dark background optimised for low-light environments. Recommended for cockpit and night use."
          />
          <RadioOption
            checked={theme === "light"}
            onChange={() => upd({ theme: "light" })}
            name="LIGHT MODE"
            desc="Light background for bright environments — office, home, daytime use."
          />
        </div>
      </div>

      {/* ── TYPOGRAPHY ── */}
      <div className="elb-form-section">
        <div className="elb-form-section-title">TYPOGRAPHY</div>

        {/* Font size slider */}
        <div className="elb-form-group" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <label className="elb-form-label" style={{ margin: 0 }}>FONT SIZE</label>
            <span style={{ fontSize: "0.9em", color: "var(--elb-acc, #4fc3f7)", fontWeight: 700 }}>{fontSize}px</span>
          </div>
          <input
            type="range" min="12" max="18" step="1"
            value={fontSize}
            onChange={e => upd({ fontSize: Number(e.target.value) })}
            className="elb-range-input"
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span className="elb-form-hint">12px · MIN</span>
            <span className="elb-form-hint">18px · MAX</span>
          </div>
          <div className="elb-preview-row" style={{ fontFamily: FONT_FAMILIES_PREVIEW[fontType], fontSize }}>
            WMKK → OMDB &nbsp;·&nbsp; STD 23:45 &nbsp;·&nbsp; B737 &nbsp;·&nbsp; 9M-XXX
          </div>
        </div>

        {/* Font type */}
        <div className="elb-form-group">
          <label className="elb-form-label">FONT TYPE</label>
          <div className="elb-form-hint" style={{ marginBottom: 10 }}>All options are monospace to preserve column alignment.</div>
          <div className="elb-font-grid">
            {FONT_OPTIONS.map(opt => (
              <button
                key={opt.key}
                type="button"
                className={"elb-font-card" + (fontType === opt.key ? " selected" : "")}
                onClick={() => upd({ fontType: opt.key })}
              >
                <span className="elb-font-card-name">{opt.label}</span>
                <span className="elb-font-card-sample" style={{ fontFamily: FONT_FAMILIES_PREVIEW[opt.key] }}>{opt.sample}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── TABLE DENSITY ── */}
      <div className="elb-form-section">
        <div className="elb-form-section-title">TABLE DENSITY</div>
        <div className="elb-radio-group">
          <RadioOption
            checked={density === "compact"}
            onChange={() => upd({ tableDensity: "compact" })}
            name="COMPACT"
            desc="Tighter rows — more sectors visible without scrolling. Good for large monthly totals."
          />
          <RadioOption
            checked={density === "default"}
            onChange={() => upd({ tableDensity: "default" })}
            name="DEFAULT"
            desc="Standard row height. Balanced readability and density."
          />
          <RadioOption
            checked={density === "relaxed"}
            onChange={() => upd({ tableDensity: "relaxed" })}
            name="RELAXED"
            desc="Taller rows with more padding. Easier to tap on tablets and touchscreens."
          />
        </div>
      </div>

      {/* ── ACCENT COLOUR ── */}
      <div className="elb-form-section">
        <div className="elb-form-section-title">ACCENT COLOUR</div>
        <div className="elb-form-hint" style={{ marginBottom: 12 }}>Changes highlight colour for headers, active states, and badges.</div>
        <div className="elb-swatch-row">
          {ACCENT_SWATCHES.map(sw => (
            <div key={sw.hex} className="elb-swatch-item">
              <button
                type="button"
                className={"elb-swatch" + (accentColor === sw.hex ? " selected" : "")}
                style={{ background: sw.hex }}
                title={sw.name}
                onClick={() => upd({ accentColor: sw.hex })}
              />
              <span className="elb-swatch-name">{sw.name}</span>
            </div>
          ))}
        </div>
        <div className="elb-form-hint" style={{ marginTop: 8 }}>
          SELECTED: {ACCENT_SWATCHES.find(s => s.hex === accentColor)?.name || "CYAN"}
        </div>
      </div>

      {/* ── BRIGHTNESS (dark mode only) ── */}
      {theme === "dark" && (
        <div className="elb-form-section">
          <div className="elb-form-section-title">DISPLAY</div>
          <div className="elb-form-group">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label className="elb-form-label" style={{ margin: 0 }}>SCREEN BRIGHTNESS</label>
              <span style={{ fontSize: "0.9em", color: "var(--elb-acc, #4fc3f7)", fontWeight: 700 }}>{brightness}%</span>
            </div>
            <input
              type="range" min="60" max="100" step="5"
              value={brightness}
              onChange={e => upd({ brightness: Number(e.target.value) })}
              className="elb-range-input"
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span className="elb-form-hint">60% · DIM</span>
              <span className="elb-form-hint">100% · FULL</span>
            </div>
            <div className="elb-form-hint" style={{ marginTop: 8 }}>
              ⚠ Dims the logbook interface only. For full screen dimming use your device brightness controls.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   PREFERENCES TAB
   ───────────────────────────────────────────────────────────────────────── */
function PreferencesTab({ d, upd }) {
  return (
    <>
      <div className="elb-form-section">
        <div className="elb-form-section-title">LOGBOOK DISPLAY</div>
        <div className="elb-form-row">
          <Field label="DATE FORMAT" hint="Controls how the DATE column appears in the logbook">
            <select className="elb-form-input" value={d.dateFormat || "D"}
              onChange={e => upd({ dateFormat: e.target.value })}>
              <option value="D">1 · 2 · 31 — Day number only</option>
              <option value="DD">01 · 02 · 31 — Zero-padded day</option>
              <option value="DD MMM">01 JAN · 15 MAY — Day + month abbreviation</option>
            </select>
          </Field>
          <Field label="ROWS PER PAGE" hint="Minimum rows shown per month in the logbook">
            <select className="elb-form-input" value={d.rowsPerPage || 15}
              onChange={e => upd({ rowsPerPage: Number(e.target.value) })}>
              <option value={10}>10 rows</option>
              <option value={15}>15 rows (default)</option>
              <option value={20}>20 rows</option>
              <option value={30}>30 rows</option>
              <option value={50}>50 rows</option>
            </select>
          </Field>
        </div>
      </div>

      <div className="elb-form-section">
        <div className="elb-form-section-title">DAY / NIGHT CALCULATION METHOD</div>
        <div className="elb-radio-group">
          <RadioOption
            value="fixed"
            checked={d.dayNightMethod === "fixed"}
            onChange={() => upd({ dayNightMethod: "fixed" })}
            name="FIXED BOUNDARY (CURRENT)"
            desc="Day = 23:30–11:30 UTC · Night = 11:30–23:30 UTC · Applied uniformly to all sectors regardless of location or date. Simple and fast."
          />
          <RadioOption
            value="sunrise"
            checked={d.dayNightMethod === "sunrise"}
            onChange={() => upd({ dayNightMethod: "sunrise" })}
            name={<>DYNAMIC — DEPARTURE AIRPORT <span className="elb-tag elb-tag-new">CAD-6</span></>}
            desc="Uses departure airport ICAO to determine sunrise/sunset for each flight date. Night = sunset + 20 min → sunrise − 20 min (CAD-6 Part-1). Works offline. Falls back to fixed method if airport not in database — departure/arrival cells flagged."
          />
        </div>
        <div className="elb-form-hint" style={{ marginTop: 8 }}>
          ⚠ Changing this setting will recalculate all existing logbook entries.
        </div>
      </div>

      <div className="elb-form-section">
        <div className="elb-form-section-title">DUTY HOURS CALCULATION</div>
        <ToggleRow
          name="USE STANDARD FORMULA"
          desc="Apply the fixed pre/post-flight buffer to derive duty time from block time"
          checked={d.useStandardFormula}
          onChange={v => upd({ useStandardFormula: v })}
        />

        <div className="elb-formula-box">
          <div style={{ marginBottom: 6, fontSize: "0.73em", letterSpacing: "0.12em", color: "#22c55e" }}>
            CURRENT FORMULA
          </div>
          <span className="f-hl">DUTY START</span> = STD − <span className="f-acc">{fmtMin(d.preFlightBuffer)}</span> &nbsp;(report time)<br />
          <span className="f-hl">DUTY END</span> &nbsp;= STA + <span className="f-acc">{fmtMin(d.postFlightBuffer)}</span> &nbsp;(post-flight wrap-up)<br />
          <span className="f-hl">DUTY TIME</span> = DUTY END − DUTY START &nbsp;per sector, summed across all sectors<br /><br />
          <span style={{ color: "#2a5070" }}>Used for CAD 1901 Para 2.19.1 cumulative duty calculations only.</span>
        </div>

        <div className="elb-form-row" style={{ marginTop: 12 }}>
          <Field label="PRE-FLIGHT BUFFER (MIN)" hint="Default: 75 min (1 hr 15 min)">
            <input className="elb-form-input" type="number" min="30" max="120"
              value={d.preFlightBuffer}
              onChange={e => upd({ preFlightBuffer: Math.max(0, Number(e.target.value) || 0) })} />
          </Field>
          <Field label="POST-FLIGHT BUFFER (MIN)" hint="Default: 15 min">
            <input className="elb-form-input" type="number" min="0" max="60"
              value={d.postFlightBuffer}
              onChange={e => upd({ postFlightBuffer: Math.max(0, Number(e.target.value) || 0) })} />
          </Field>
        </div>
        <div className="elb-form-hint" style={{ marginTop: 4 }}>
          ⚠ Custom buffers override the standard formula. Changes apply to all FTL calculations going forward.
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   MISCELLANEOUS TAB
   ───────────────────────────────────────────────────────────────────────── */
function MiscTab({ onDeleteAccount }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <>
      <div className="elb-ver-badge">✈ eLOGBOOK · VERSION 5.5 · CAD 1901 ISS01/REV01</div>

      <div className="elb-form-section">
        <div className="elb-form-section-title">SUPPORT</div>
        <MiscItem icon="💬" name="FEEDBACK & FEATURE REQUESTS"
                  desc="Share suggestions or ideas to improve eLOGBOOK"
                  href="mailto:zero.nuker@gmail.com?subject=eLOGBOOK%20Feedback" />
        <MiscItem icon="🐛" name="REPORT A BUG"
                  desc="Something not working correctly? Let us know"
                  href="mailto:zero.nuker@gmail.com?subject=eLOGBOOK%20Bug%20Report" />
        <MiscItem icon="📖" name="HOW TO GUIDE"
                  desc="Step-by-step instructions for using eLOGBOOK"
                  href="#" />
      </div>

      <div className="elb-form-section">
        <div className="elb-form-section-title">CHANGELOG</div>

        <div className="elb-changelog-scroll">

          <div className="elb-changelog-entry">
            <div className="elb-changelog-ver">
              <span className="elb-changelog-tag">V5.5 <span className="elb-tag elb-tag-new">CURRENT</span></span>
              <span className="elb-changelog-date">14 MAY 2026</span>
            </div>
            <div className="elb-changelog-section">
              <div className="elb-changelog-subsection">Appearance</div>
              <ul className="elb-changelog-items">
                <li><span className="elb-tag elb-tag-new">NEW</span> Font size slider — 12px to 18px with live preview</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Font type selector — 5 monospace options</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Accent colour — 8 swatches (Cyan, Amber, Green, Purple, Orange, Pink, Red, Teal)</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Screen brightness dimmer — Dark Mode only (60–100%)</li>
              </ul>
            </div>
          </div>

          <div className="elb-changelog-entry">
            <div className="elb-changelog-ver">
              <span className="elb-changelog-tag">V5.4</span>
              <span className="elb-changelog-date">14 MAY 2026</span>
            </div>
            <div className="elb-changelog-section">
              <div className="elb-changelog-subsection">Appearance</div>
              <ul className="elb-changelog-items">
                <li><span className="elb-tag elb-tag-new">NEW</span> Light Mode theme — bright background for office and daytime use</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Font size selector — Small (12px), Default (14px), Large (16px)</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Table density — Compact, Default, and Relaxed row spacing</li>
              </ul>
            </div>
            <div className="elb-changelog-section">
              <div className="elb-changelog-subsection">Bug Fixes</div>
              <ul className="elb-changelog-items">
                <li><span className="elb-tag elb-tag-fix">FIX</span> Dynamic day/night method reverting to Fixed after autosave</li>
              </ul>
            </div>
          </div>

          <div className="elb-changelog-entry">
            <div className="elb-changelog-ver">
              <span className="elb-changelog-tag">V5.3</span>
              <span className="elb-changelog-date">14 MAY 2026</span>
            </div>
            <div className="elb-changelog-section">
              <div className="elb-changelog-subsection">Table &amp; Display</div>
              <ul className="elb-changelog-items">
                <li><span className="elb-tag elb-tag-new">NEW</span> Bold all table headers in logbook &amp; flight summary tabs</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Floating Add Remarks &amp; Delete Row columns with transparent background</li>
              </ul>
            </div>
            <div className="elb-changelog-section">
              <div className="elb-changelog-subsection">Data Entry &amp; Input</div>
              <ul className="elb-changelog-items">
                <li><span className="elb-tag elb-tag-new">NEW</span> Auto-capitalize all data entry fields (uppercase display)</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Accept both HH:MM and HHMM time formats (STD, STA, Carry Forward)</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Read-only columns after STA (UTC) — Day, Night, and Total columns</li>
              </ul>
            </div>
            <div className="elb-changelog-section">
              <div className="elb-changelog-subsection">Navigation &amp; Interaction</div>
              <ul className="elb-changelog-items">
                <li><span className="elb-tag elb-tag-new">NEW</span> Tab navigation stops at STA (UTC) and wraps to next row</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Add Remarks button with 4 state colors (gray/amber/cyan/green)</li>
              </ul>
            </div>
            <div className="elb-changelog-section">
              <div className="elb-changelog-subsection">Feedback &amp; Status</div>
              <ul className="elb-changelog-items">
                <li><span className="elb-tag elb-tag-new">NEW</span> Autosave timestamp display in tabs row (HH:MM:SS format)</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Autosave failure prompt with clear error message &amp; action button</li>
              </ul>
            </div>
            <div className="elb-changelog-section">
              <div className="elb-changelog-subsection">Header &amp; Compliance</div>
              <ul className="elb-changelog-items">
                <li><span className="elb-tag elb-tag-fix">FIX</span> Removed duplicate "CAAM/MCAR 2016" header line for cleaner display</li>
              </ul>
            </div>
            <div className="elb-changelog-section">
              <div className="elb-changelog-subsection">Data Management (Previous)</div>
              <ul className="elb-changelog-items">
                <li><span className="elb-tag elb-tag-new">NEW</span> Export logbook data to Excel or PDF (date range)</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Import Excel/PDF files with validation &amp; merge</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Duplicate flight detection — skip existing entries</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Globe icon with bidirectional arrows (import/export)</li>
              </ul>
            </div>
            <div className="elb-changelog-section">
              <div className="elb-changelog-subsection">Account Management (Previous)</div>
              <ul className="elb-changelog-items">
                <li><span className="elb-tag elb-tag-new">NEW</span> Delete account &amp; all data — permanent deletion via Cloud Function</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Account deletion confirmation dialog with clear warnings</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Auto-redirect to login/signup after deletion</li>
              </ul>
            </div>
          </div>

          <div className="elb-changelog-entry">
            <div className="elb-changelog-ver">
              <span className="elb-changelog-tag">V5.2</span>
              <span className="elb-changelog-date">13 MAY 2026</span>
            </div>
            <div className="elb-changelog-section">
              <div className="elb-changelog-subsection">Settings &amp; Customization</div>
              <ul className="elb-changelog-items">
                <li><span className="elb-tag elb-tag-new">NEW</span> Settings modal with font type and size scaling</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Profile header with standard formula toggle</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Dark Cockpit theme locked in</li>
              </ul>
            </div>
            <div className="elb-changelog-section">
              <div className="elb-changelog-subsection">Layout &amp; Spacing</div>
              <ul className="elb-changelog-items">
                <li><span className="elb-tag elb-tag-imp">IMP</span> Center number input fields &amp; airline operator</li>
                <li><span className="elb-tag elb-tag-fix">FIX</span> Field spacing &amp; visual layout improvements</li>
              </ul>
            </div>
            <div className="elb-changelog-section">
              <div className="elb-changelog-subsection">UI Polish &amp; Refinements</div>
              <ul className="elb-changelog-items">
                <li><span className="elb-tag elb-tag-imp">IMP</span> Font sizing, header weights, column widths</li>
                <li><span className="elb-tag elb-tag-imp">IMP</span> Rename STD/STA headers, current month default</li>
              </ul>
            </div>
          </div>

          <div className="elb-changelog-entry">
            <div className="elb-changelog-ver">
              <span className="elb-changelog-tag">V5.1</span>
              <span className="elb-changelog-date">07 MAY 2026</span>
            </div>
            <div className="elb-changelog-section">
              <div className="elb-changelog-subsection">Flight Tracking</div>
              <ul className="elb-changelog-items">
                <li><span className="elb-tag elb-tag-new">NEW</span> Dynamic day/night calculation (CAD-6) with sunrise/sunset</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Autoland recency tracking — 3-in-6-months requirement</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Grand total hours section with date picker</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Carry forward hours table in profile settings</li>
              </ul>
            </div>
            <div className="elb-changelog-section">
              <div className="elb-changelog-subsection">Authentication</div>
              <ul className="elb-changelog-items">
                <li><span className="elb-tag elb-tag-fix">FIX</span> Google auth UI freeze — manual state update</li>
                <li><span className="elb-tag elb-tag-fix">FIX</span> Input focus loss on signup screens</li>
                <li><span className="elb-tag elb-tag-fix">FIX</span> Email verification error handling</li>
              </ul>
            </div>
            <div className="elb-changelog-section">
              <div className="elb-changelog-subsection">Other</div>
              <ul className="elb-changelog-items">
                <li><span className="elb-tag elb-tag-imp">IMP</span> Move Firebase config to env variables</li>
              </ul>
            </div>
          </div>

          <div className="elb-changelog-entry">
            <div className="elb-changelog-ver">
              <span className="elb-changelog-tag">V5.0</span>
              <span className="elb-changelog-date">05 MAY 2026</span>
            </div>
            <div className="elb-changelog-section">
              <div className="elb-changelog-subsection">Authentication &amp; Onboarding</div>
              <ul className="elb-changelog-items">
                <li><span className="elb-tag elb-tag-new">NEW</span> Firebase email/password &amp; Google OAuth</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> 3-step onboarding flow with email verification</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Logout confirmation screen</li>
              </ul>
            </div>
            <div className="elb-changelog-section">
              <div className="elb-changelog-subsection">UI Structure &amp; Data</div>
              <ul className="elb-changelog-items">
                <li><span className="elb-tag elb-tag-new">NEW</span> Remarks popup per-row with modal editor</li>
                <li><span className="elb-tag elb-tag-fix">FIX</span> Duplicate row entries via ID regeneration</li>
                <li><span className="elb-tag elb-tag-imp">IMP</span> Auto column widths with fixed captain column</li>
              </ul>
            </div>
          </div>

          <div className="elb-changelog-entry">
            <div className="elb-changelog-ver">
              <span className="elb-changelog-tag">V1</span>
              <span className="elb-changelog-date">01 MAY 2026</span>
            </div>
            <div className="elb-changelog-section">
              <div className="elb-changelog-subsection">Early Work &amp; Foundation</div>
              <ul className="elb-changelog-items">
                <li><span className="elb-tag elb-tag-new">NEW</span> Initial commit and v5 scaffolding</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Dropdown for capacity column</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Departure/arrival subcategories under sectors</li>
              </ul>
            </div>
            <div className="elb-changelog-section">
              <div className="elb-changelog-subsection">UI Structure &amp; Foundation</div>
              <ul className="elb-changelog-items">
                <li><span className="elb-tag elb-tag-new">NEW</span> Green plus icon, aligned delete button</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Auto day/night calculation from STD/STA</li>
                <li><span className="elb-tag elb-tag-new">NEW</span> Google login &amp; Firebase cloud save</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="elb-form-section">
        <div className="elb-form-section-title">DISCLAIMER</div>
        <div className="elb-disclaimer-box">
          <span className="hl">⚠ IMPORTANT — PLEASE READ</span><br /><br />
          eLOGBOOK is provided as a <span className="hl">personal logbook aid only</span>. All FTL calculations
          (flight time limits, cumulative duty hours) and recency tracking are for{" "}
          <span className="hl">reference purposes only</span> and may not reflect positioning flights, simulator
          sessions, standby duty, or records held by your operator.<br /><br />
          The pilot and operator remain <span className="hl">solely responsible</span> for ensuring full compliance
          with <span className="hl">CAD 1901 ISS01/REV01</span>, <span className="hl">MCAR 2016 Part 7 &amp; 8</span>,{" "}
          <span className="hl">ICAO Annex 1</span>, and all applicable CAAM regulations and company operations
          manual requirements.<br /><br />
          Always verify your flight time, duty, and recency status with your{" "}
          <span className="hl">Operations department</span> before accepting a duty assignment. eLOGBOOK does not
          constitute an official record for regulatory or legal purposes.
        </div>
      </div>

      <div className="elb-form-section">
        <div className="elb-form-section-title">ACCOUNT</div>
        {!confirmDelete ? (
          <button
            type="button"
            className="elb-misc-item elb-misc-item-danger"
            onClick={() => setConfirmDelete(true)}
          >
            <span className="elb-misc-item-left">
              <span className="elb-misc-item-icon">🗑</span>
              <span>
                <span className="elb-misc-item-name">DELETE ACCOUNT &amp; ALL DATA</span>
                <span className="elb-misc-item-desc">Permanently removes your account and all logbook data. This cannot be undone.</span>
              </span>
            </span>
            <span className="elb-misc-item-arrow">›</span>
          </button>
        ) : (
          <div className="elb-delete-confirm">
            <div className="elb-delete-warn">⚠ THIS CANNOT BE UNDONE</div>
            <div className="elb-delete-body">
              All logbook data, carry-forward hours, and your eLOGBOOK account will be
              permanently deleted. You will be asked to re-authenticate with Google before
              deletion proceeds.
            </div>
            <div className="elb-delete-actions">
              <button type="button" className="elb-btn elb-btn-ghost"
                onClick={() => setConfirmDelete(false)}>
                CANCEL
              </button>
              <button type="button" className="elb-btn elb-btn-danger"
                onClick={() => { setConfirmDelete(false); onDeleteAccount && onDeleteAccount(); }}>
                CONFIRM DELETE
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Reusable little bits
   ───────────────────────────────────────────────────────────────────────── */
function Field({ label, required, hint, children }) {
  return (
    <div className="elb-form-group">
      <label className="elb-form-label">
        {label}
        {required && <span className="elb-required">*</span>}
      </label>
      {children}
      {hint && <span className="elb-form-hint">{hint}</span>}
    </div>
  );
}

function ToggleRow({ name, desc, checked, onChange }) {
  return (
    <div className="elb-toggle-row">
      <div>
        <div className="elb-toggle-name">{name}</div>
        <div className="elb-toggle-desc">{desc}</div>
      </div>
      <label className="elb-toggle-switch">
        <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} />
        <span className="elb-toggle-track" />
      </label>
    </div>
  );
}

function RadioOption({ checked, onChange, name, desc, disabled }) {
  return (
    <label className={"elb-radio-option" + (checked ? " selected" : "") + (disabled ? " disabled" : "")}>
      <input type="radio" checked={checked} onChange={onChange} disabled={disabled} />
      <div>
        <div className="elb-radio-option-name">{name}</div>
        <div className="elb-radio-option-desc">{desc}</div>
      </div>
    </label>
  );
}

function MiscItem({ icon, name, desc, href }) {
  const Tag = href ? "a" : "button";
  return (
    <Tag
      className="elb-misc-item"
      {...(href ? { href, target: href.startsWith("mailto:") ? undefined : "_blank", rel: "noopener noreferrer" } : { type: "button" })}
    >
      <span className="elb-misc-item-left">
        <span className="elb-misc-item-icon">{icon}</span>
        <span>
          <span className="elb-misc-item-name">{name}</span>
          <span className="elb-misc-item-desc">{desc}</span>
        </span>
      </span>
      <span className="elb-misc-item-arrow">›</span>
    </Tag>
  );
}

function fmtMin(mins) {
  const m = Number(mins) || 0;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h} hr ${r} min`;
  if (h)      return `${h} hr`;
  return `${r} min`;
}

/* ─────────────────────────────────────────────────────────────────────────
   Styles
   ───────────────────────────────────────────────────────────────────────── */
const settingsCss = `
  .elb-settings-overlay{
    position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:2000;
    display:flex;align-items:center;justify-content:center;padding:20px;
    font-family:var(--elb-font,'Courier New',monospace);font-size:var(--elb-td-sz,14px);color:var(--elb-txt,#c8d6e5);
    animation:elbFadeIn 0.15s ease;
  }
  @keyframes elbFadeIn{from{opacity:0;}to{opacity:1;}}

  .elb-settings-modal{
    background:var(--elb-bg2,#0d1520);border:1px solid #1a3050;border-top:2px solid #4fc3f7;
    border-radius:5px;width:100%;max-width:720px;max-height:88vh;
    display:flex;flex-direction:column;overflow:hidden;
    box-shadow:0 20px 60px rgba(0,0,0,0.85);
    animation:elbPopIn 0.18s ease;
  }
  @keyframes elbPopIn{from{opacity:0;transform:scale(0.96) translateY(8px);}to{opacity:1;transform:scale(1) translateY(0);}}

  .elb-modal-header{
    display:flex;align-items:center;justify-content:space-between;
    padding:14px 20px 0;flex-shrink:0;
  }
  .elb-modal-label{font-size:0.85em;letter-spacing:0.2em;color:#4fc3f7;margin-bottom:4px;}
  .elb-modal-title{font-size:1.27em;font-weight:700;color:#e8f4fd;letter-spacing:0.05em;text-align:left;}
  .elb-modal-close{
    background:transparent;border:1px solid #1a3050;color:#4a6a8a;
    font-family:inherit;font-size:1em;width:26px;height:26px;border-radius:3px;
    cursor:pointer;display:flex;align-items:center;justify-content:center;
    transition:border-color 0.15s,color 0.15s;flex-shrink:0;
  }
  .elb-modal-close:hover{border-color:#ef4444;color:#ef4444;}

  .elb-settings-tabs{
    display:flex;border-bottom:1px solid #1a3050;
    padding:12px 20px 0;flex-shrink:0;gap:2px;flex-wrap:wrap;
  }
  .elb-stab{
    padding:7px 16px;font-size:0.85em;letter-spacing:0.14em;
    color:#4a6a8a;cursor:pointer;border:1px solid transparent;border-bottom:none;
    border-radius:3px 3px 0 0;background:transparent;
    transition:all 0.15s;display:flex;align-items:center;gap:5px;
    position:relative;bottom:-1px;font-family:inherit;
  }
  .elb-stab:hover{color:#8fafc8;border-color:#0f1e2d;}
  .elb-stab.active{
    color:#4fc3f7;background:var(--elb-bginput,#0b1828);border-color:#1a3050;border-bottom-color:#0b1828;
  }

  .elb-tab-content{flex:1;overflow-y:auto;padding:22px 24px 20px;}
  .elb-tab-content::-webkit-scrollbar{width:3px;}
  .elb-tab-content::-webkit-scrollbar-track{background:transparent;}
  .elb-tab-content::-webkit-scrollbar-thumb{background:#1a3050;border-radius:2px;}

  .elb-form-section{margin-bottom:32px;}
  .elb-form-section-title{
    font-size:0.85em;letter-spacing:0.18em;color:#4fc3f7;
    margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #0f1e2d;
  }
  .elb-form-row{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:24px;}
  .elb-form-row.single{grid-template-columns:1fr;justify-items:center;}
  .elb-form-group{display:flex;flex-direction:column;gap:8px;margin-bottom:12px;}
  .elb-form-label{font-size:0.85em;letter-spacing:0.12em;color:var(--elb-txt-muted,#4a6a8a);}
  .elb-required{color:#ef4444;margin-left:2px;}
  .elb-form-input{
    background:var(--elb-bginput,#0b1828);border:1px solid #1a3050;color:#c8d6e5;
    font-family:inherit;font-size:1em;padding:7px 10px;border-radius:3px;
    transition:border-color 0.15s;outline:none;width:100%;
  }
  .elb-form-input:focus{border-color:#4fc3f7;}
  .elb-form-input:disabled{opacity:0.45;cursor:not-allowed;}
  .elb-form-input::placeholder{color:#4a6a8a;}
  input[type="number"].elb-form-input{max-width:120px;margin:0 auto;display:block;}
  .elb-form-row.single .elb-form-input{max-width:280px;text-align:left;}
  .elb-form-hint{font-size:0.85em;color:var(--elb-txt-muted,#4a6a8a);letter-spacing:0.04em;margin-top:2px;}
  select.elb-form-input{
    appearance:none;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%234a6a8a'/%3E%3C/svg%3E");
    background-repeat:no-repeat;background-position:right 10px center;
    padding-right:28px;cursor:pointer;
  }

  .elb-toggle-row{
    display:flex;align-items:center;justify-content:space-between;
    padding:10px 12px;background:var(--elb-bginput,#0b1828);border:1px solid #0f1e2d;
    border-radius:3px;margin-bottom:8px;gap:12px;
  }
  .elb-toggle-name{font-size:1em;color:#c8d6e5;letter-spacing:0.05em;}
  .elb-toggle-desc{font-size:0.85em;color:var(--elb-txt-muted,#4a6a8a);margin-top:3px;line-height:1.5;}
  .elb-toggle-switch{position:relative;width:38px;height:20px;flex-shrink:0;}
  .elb-toggle-switch input{opacity:0;width:0;height:0;}
  .elb-toggle-track{
    position:absolute;inset:0;background:var(--elb-bg3,#0a1018);border:1px solid #1a3050;
    border-radius:20px;cursor:pointer;transition:background 0.2s,border-color 0.2s;
    display:block;
  }
  .elb-toggle-track::before{
    content:'';position:absolute;left:3px;top:3px;width:12px;height:12px;
    background:#4a6a8a;border-radius:50%;transition:transform 0.2s,background 0.2s;
  }
  .elb-toggle-switch input:checked + .elb-toggle-track{background:rgba(79,195,247,0.15);border-color:#4fc3f7;}
  .elb-toggle-switch input:checked + .elb-toggle-track::before{transform:translateX(18px);background:#4fc3f7;}


  .elb-range-input{
    width:100%;-webkit-appearance:none;appearance:none;height:4px;
    background:var(--elb-bginput,#0b1828);border-radius:2px;outline:none;
    border:1px solid #1a3050;accent-color:var(--elb-acc,#4fc3f7);
  }
  .elb-range-input::-webkit-slider-thumb{
    -webkit-appearance:none;width:16px;height:16px;border-radius:50%;
    background:var(--elb-acc,#4fc3f7);cursor:pointer;border:2px solid var(--elb-bginput,#0b1828);
  }
  .elb-range-input::-moz-range-thumb{
    width:14px;height:14px;border-radius:50%;
    background:var(--elb-acc,#4fc3f7);cursor:pointer;border:2px solid var(--elb-bginput,#0b1828);
  }
  .elb-preview-row{
    margin-top:10px;padding:8px 12px;background:var(--elb-bg,#0a0d12);
    border:1px solid #0f1e2d;border-radius:3px;color:var(--elb-txt,#c8d6e5);
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  }
  .elb-font-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;}
  .elb-font-card{
    background:var(--elb-bg,#0a0d12);border:1px solid #0f1e2d;border-radius:3px;
    padding:10px 6px;cursor:pointer;text-align:center;font-family:inherit;
    display:flex;flex-direction:column;align-items:center;gap:6px;
    transition:border-color 0.15s,background 0.15s;
  }
  .elb-font-card:hover{border-color:#243d5a;}
  .elb-font-card.selected{border-color:rgba(79,195,247,0.4);background:rgba(79,195,247,0.05);}
  .elb-font-card-name{font-size:9px;letter-spacing:0.08em;color:#4a6a8a;}
  .elb-font-card-sample{font-size:14px;color:var(--elb-acc,#4fc3f7);}
  .elb-swatch-row{display:flex;gap:10px;flex-wrap:wrap;}
  .elb-swatch-item{display:flex;flex-direction:column;align-items:center;gap:5px;}
  .elb-swatch{
    width:30px;height:30px;border-radius:3px;border:2px solid transparent;
    cursor:pointer;transition:transform 0.1s,border-color 0.15s;
  }
  .elb-swatch:hover{transform:scale(1.1);}
  .elb-swatch.selected{border-color:#ffffff;transform:scale(1.15);}
  .elb-swatch-name{font-size:9px;color:#4a6a8a;letter-spacing:0.08em;}

  .elb-radio-group{display:flex;flex-direction:column;gap:6px;}
  .elb-radio-option{
    display:flex;align-items:flex-start;gap:10px;padding:10px 12px;
    background:var(--elb-bginput,#0b1828);border:1px solid #0f1e2d;border-radius:3px;
    cursor:pointer;transition:border-color 0.15s;
  }
  .elb-radio-option:hover{border-color:#243d5a;}
  .elb-radio-option.selected{border-color:rgba(79,195,247,0.4);background:rgba(79,195,247,0.04);}
  .elb-radio-option.disabled{opacity:0.55;cursor:not-allowed;}
  .elb-radio-option input[type=radio]{accent-color:#4fc3f7;margin-top:2px;flex-shrink:0;}
  .elb-radio-option-name{font-size:1em;color:#c8d6e5;letter-spacing:0.05em;}
  .elb-radio-option-desc{font-size:0.85em;color:var(--elb-txt-muted,#4a6a8a);margin-top:3px;line-height:1.6;}

  .elb-misc-item{
    display:flex;align-items:center;justify-content:space-between;
    padding:12px 14px;background:var(--elb-bginput,#0b1828);border:1px solid #0f1e2d;
    border-radius:3px;margin-bottom:8px;cursor:pointer;width:100%;
    transition:border-color 0.15s,background 0.15s;
    text-decoration:none;color:inherit;font-family:inherit;font-size:1em;
    text-align:left;
  }
  .elb-misc-item:hover{border-color:#243d5a;background:rgba(255,255,255,0.02);}
  .elb-misc-item-left{display:flex;align-items:center;gap:10px;}
  .elb-misc-item-icon{font-size:1.27em;width:20px;text-align:center;flex-shrink:0;display:inline-block;}
  .elb-misc-item-name{font-size:1em;color:#c8d6e5;letter-spacing:0.05em;display:block;}
  .elb-misc-item-desc{font-size:0.85em;color:var(--elb-txt-muted,#4a6a8a);margin-top:3px;display:block;}
  .elb-misc-item-arrow{font-size:0.91em;color:var(--elb-txt-muted,#4a6a8a);}
  .elb-misc-item-danger{border-color:rgba(239,68,68,0.15);}
  .elb-misc-item-danger .elb-misc-item-name{color:#ef4444;}
  .elb-misc-item-danger:hover{border-color:rgba(239,68,68,0.35);background:rgba(239,68,68,0.03);}
  .elb-misc-item-danger .elb-misc-item-arrow{color:#ef4444;}

  .elb-formula-box{
    background:var(--elb-bg3,#06100f);border:1px solid rgba(34,197,94,0.2);
    border-left:2px solid #22c55e;border-radius:3px;
    padding:10px 14px;margin-top:8px;
    font-size:0.82em;color:var(--elb-txt-muted,#4a6a8a);line-height:1.8;
  }
  .elb-formula-box .f-hl{color:#22c55e;}
  .elb-formula-box .f-acc{color:#4fc3f7;}

  .elb-modal-footer{
    padding:12px 24px;border-top:1px solid #1a3050;
    display:flex;align-items:center;justify-content:space-between;
    flex-shrink:0;background:var(--elb-bginput,#0b1828);gap:12px;flex-wrap:wrap;
  }
  .elb-footer-hint{font-size:0.85em;color:var(--elb-txt-muted,#4a6a8a);letter-spacing:0.05em;transition:color 0.2s;}
  .elb-footer-hint.saved{color:#22c55e;}
  .elb-footer-actions{display:flex;gap:8px;}
  .elb-btn{
    font-family:inherit;font-size:0.82em;letter-spacing:0.1em;
    padding:7px 18px;border-radius:3px;cursor:pointer;
    border:1px solid;transition:all 0.15s;
  }
  .elb-btn-ghost{background:transparent;border-color:#1a3050;color:#4a6a8a;}
  .elb-btn-ghost:hover{border-color:#243d5a;color:#c8d6e5;}
  .elb-btn-primary{background:rgba(79,195,247,0.1);border-color:#4fc3f7;color:#4fc3f7;}
  .elb-btn-primary:hover{background:rgba(79,195,247,0.18);}
  .elb-btn-danger{background:rgba(239,68,68,0.1);border-color:#ef4444;color:#ef4444;}
  .elb-btn-danger:hover{background:rgba(239,68,68,0.2);}

  .elb-delete-confirm{
    background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.25);
    border-left:3px solid #ef4444;border-radius:3px;padding:14px 16px;
  }
  .elb-delete-warn{
    font-size:0.85em;font-weight:700;letter-spacing:0.15em;color:#ef4444;margin-bottom:8px;
  }
  .elb-delete-body{
    font-size:0.85em;color:#4a6a8a;line-height:1.7;margin-bottom:14px;
  }
  .elb-delete-actions{display:flex;gap:8px;justify-content:flex-end;}

  .elb-ver-badge{
    display:inline-flex;align-items:center;gap:5px;
    background:rgba(79,195,247,0.07);border:1px solid rgba(79,195,247,0.15);
    border-radius:3px;padding:3px 8px;font-size:0.85em;color:#4fc3f7;
    letter-spacing:0.1em;margin-bottom:16px;
  }

  .elb-changelog-scroll{
    height:200px;overflow-y:auto;border:1px solid #0f1e2d;border-radius:3px;
    padding:12px;background:var(--elb-bg,#0a0d12);
  }
  .elb-changelog-scroll::-webkit-scrollbar{width:4px;}
  .elb-changelog-scroll::-webkit-scrollbar-track{background:transparent;}
  .elb-changelog-scroll::-webkit-scrollbar-thumb{background:#1a3050;border-radius:2px;}
  .elb-changelog-scroll::-webkit-scrollbar-thumb:hover{background:#243d5a;}

  .elb-changelog-entry{
    padding:0 2px 12px 2px;margin-bottom:12px;text-align:left;border-bottom:1px solid #0f1e2d;
  }
  .elb-changelog-entry:last-child{border-bottom:none;margin-bottom:0;}
  .elb-changelog-ver{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;text-align:left;}
  .elb-changelog-tag{font-size:0.82em;color:#4fc3f7;font-weight:700;}
  .elb-changelog-date{font-size:0.85em;color:var(--elb-txt-muted,#4a6a8a);}

  .elb-changelog-section{margin-bottom:8px;}
  .elb-changelog-section:last-child{margin-bottom:0;}
  .elb-changelog-subsection{font-size:0.8em;letter-spacing:0.08em;color:#4fc3f7;font-weight:600;margin-bottom:4px;text-transform:uppercase;}

  .elb-changelog-items{list-style:none;padding:0;margin:0 0 6px 0;text-align:left;}
  .elb-changelog-items li{font-size:0.82em;color:var(--elb-txt-muted,#4a6a8a);line-height:1.6;padding-left:16px;position:relative;margin-bottom:3px;}
  .elb-changelog-items li::before{content:'›';position:absolute;left:4px;color:#4fc3f7;}

  .elb-disclaimer-box{
    background:rgba(234,179,8,0.04);border:1px solid rgba(234,179,8,0.15);
    border-left:2px solid #eab308;border-radius:3px;
    padding:12px 14px;font-size:0.85em;color:var(--elb-txt-muted,#4a6a8a);line-height:1.85;letter-spacing:0.03em;
  }
  .elb-disclaimer-box .hl{color:#eab308;}

  .elb-tag{display:inline-block;font-size:0.64em;letter-spacing:0.1em;padding:2px 6px;border-radius:2px;font-weight:700;margin-left:6px;}
  .elb-tag-new{background:rgba(34,197,94,0.12);color:#22c55e;border:1px solid rgba(34,197,94,0.25);}
  .elb-tag-fix{background:rgba(79,195,247,0.1);color:#4fc3f7;border:1px solid rgba(79,195,247,0.2);}
  .elb-tag-imp{background:rgba(234,179,8,0.1);color:#eab308;border:1px solid rgba(234,179,8,0.2);}


  /* ── Carry-forward table ── */
  .elb-cf-table{
    width:100%;border-collapse:collapse;min-width:560px;font-family:inherit;
  }
  .elb-cf-th{
    padding:5px 6px;text-align:center;background:var(--elb-bg3,#06101c);
    border:1px solid var(--elb-border3,#0f1e2d);font-size:0.73em;letter-spacing:0.1em;
    font-weight:700;white-space:nowrap;color:var(--elb-txt-muted,#4a6a8a);line-height:1.4;
  }
  .elb-cf-th-type{text-align:left;padding-left:8px;min-width:80px;}
  .elb-cf-th-total{min-width:56px;}
  .elb-cf-th-group{border-bottom:1px solid #1a3050;}
  .elb-cf-day{color:#f5c542;}
  .elb-cf-night{color:#7ab8d4;}
  .elb-cf-th-sub{
    background:var(--elb-bg2,#04080e);font-weight:400;font-size:0.64em;color:var(--elb-txt-muted,#4a6a8a);
  }
  .elb-cf-td{
    padding:2px 3px;border:1px solid var(--elb-border3,#0f1e2d);vertical-align:middle;
    background:var(--elb-bg,#0a0d12);
  }
  .elb-cf-input{
    width:100%;background:transparent;border:none;outline:none;
    color:var(--elb-txt,#c8d6e5);font-family:inherit;font-size:1em;
    text-align:center;padding:4px 3px;min-width:46px;
  }
  .elb-cf-input:focus{background:rgba(79,195,247,0.05);}
  .elb-cf-input::placeholder{color:var(--elb-border,#1e3050);}
  .elb-cf-input-type{text-align:left;padding-left:6px;min-width:70px;}
  .elb-cf-total-cell{
    text-align:center;color:var(--elb-accent,#4fc3f7);font-weight:700;
    background:var(--elb-bg2,#04080e);white-space:nowrap;padding:4px 8px;
    font-size:0.85em;border:1px solid var(--elb-border3,#0f1e2d);
  }
  .elb-cf-action-cell{
    padding:0 3px;border:1px solid var(--elb-border3,#0f1e2d);text-align:center;width:18px;
    background:var(--elb-bg,#0a0d12);
  }
  .elb-cf-remove{
    background:transparent;border:none;color:var(--elb-txt-dim,#2a4a6a);cursor:pointer;
    font-size:0.82em;padding:2px 4px;line-height:1;transition:color 0.15s;
  }
  .elb-cf-remove:hover{color:#ef4444;}
  .elb-cf-add{
    margin-top:8px;background:transparent;border:1px dashed #1a3050;
    border-radius:3px;color:#4a6a8a;font-family:inherit;font-size:0.82em;
    letter-spacing:0.1em;padding:7px 16px;cursor:pointer;
    width:100%;transition:all 0.15s;text-align:center;
  }
  .elb-cf-add:hover{border-color:#4fc3f7;color:#4fc3f7;background:rgba(79,195,247,0.03);}

  @media (max-width: 540px){
    .elb-scheme-grid{grid-template-columns:repeat(2,1fr);}
    .elb-form-row{grid-template-columns:1fr;}
    .elb-modal-footer{flex-direction:column;align-items:stretch;}
    .elb-footer-actions{justify-content:flex-end;}
  }
`;
