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
  // Appearance
  colorScheme: "darkCockpit",
  darkMode: true,
  highContrast: false,
  fontType: "Courier New",
  fontSize: 11,
  // Preferences
  dayNightMethod: "fixed", // "fixed" | "sunrise" | "great-circle"
  useStandardFormula: true,
  preFlightBuffer: 75,
  postFlightBuffer: 15,
};

// ── Color themes ────────────────────────────────────────────────────────────
export const THEMES = {
  darkCockpit: {
    name: "Dark Cockpit",
    bg:        "#0a0d12", bg2:       "#0d1520", bg3:       "#0a1018",
    bgHeader:  "#0d1117", bgAlt:     "#161d2a", bgThead:   "#0b1320",
    bgInput:   "#0b1828",
    accent:    "#4fc3f7", accent2:   "#7ab8d4", accentDim: "#2a5a7a",
    border:    "#1e3a5f", border2:   "#1a3050", border3:   "#0f1820", border4: "#111820",
    text:      "#c8d6e5", textMuted: "#4a6a8a", textDim:   "#2a4a6a", textBright: "#e8f4fd",
    rowHover:  "#122030",
    swatch: ["#0a0d12","#4fc3f7","#1e3a5f"],
  },
  airAsia: {
    name: "AirAsia",
    bg:        "#0d0608", bg2:       "#1a0a0e", bg3:       "#120709",
    bgHeader:  "#0f0507", bgAlt:     "#1e0c10", bgThead:   "#0e0508",
    bgInput:   "#1a0a0e",
    accent:    "#ff2b4a", accent2:   "#cc2038", accentDim: "#5a0f1a",
    border:    "#6a1525", border2:   "#4a1018", border3:   "#28080e", border4: "#1a0608",
    text:      "#f0ced2", textMuted: "#8a4a52", textDim:   "#4a1a22", textBright: "#fff0f2",
    rowHover:  "#221015",
    swatch: ["#0d0608","#ff2b4a","#6a1525"],
  },
  airAsiaX: {
    name: "Batik Air Malaysia",
    bg:        "#090710", bg2:       "#12101e", bg3:       "#0d0b18",
    bgHeader:  "#0a0812", bgAlt:     "#181428", bgThead:   "#0a0814",
    bgInput:   "#100e1c",
    accent:    "#c040a8", accent2:   "#9a3088", accentDim: "#501848",
    border:    "#5a1a60", border2:   "#401050", border3:   "#200830", border4: "#160622",
    text:      "#e8cce8", textMuted: "#7a4a80", textDim:   "#3a1a45", textBright: "#f8eafc",
    rowHover:  "#1a1030",
    swatch: ["#090710","#c040a8","#5a1a60"],
  },
  malaysiaAirlines: {
    name: "Malaysia Airlines",
    bg:        "#070a14", bg2:       "#0c1020", bg3:       "#080b18",
    bgHeader:  "#080a14", bgAlt:     "#0f1428", bgThead:   "#08091a",
    bgInput:   "#0c1020",
    accent:    "#7c4dff", accent2:   "#9d6fff", accentDim: "#301a70",
    border:    "#2a1a70", border2:   "#1e1060", border3:   "#100830", border4: "#0c0620",
    text:      "#d0d0f5", textMuted: "#5050a0", textDim:   "#202060", textBright: "#eeeeff",
    rowHover:  "#121830",
    swatch: ["#070a14","#7c4dff","#2a1a70"],
  },
};

const TAB_HINTS = {
  profile:     "Profile changes update your logbook defaults immediately.",
  appearance:  "Appearance changes apply after saving.",
  preferences: "⚠ Recalculation may take a moment on large logbooks.",
  misc:        "Version 5.2 · claudeborne.my",
};

// ── Component ───────────────────────────────────────────────────────────────
export default function SettingsModal({ open, onClose, settings, onSave, userEmail }) {
  const [tab, setTab] = useState("profile");
  const [draft, setDraft] = useState(settings || DEFAULT_SETTINGS);
  const [savedFlash, setSavedFlash] = useState(false);

  // Resync local draft whenever the modal is opened or upstream settings change
  useEffect(() => {
    if (open) {
      setDraft({ ...DEFAULT_SETTINGS, ...(settings || {}) });
      setTab("profile");
      setSavedFlash(false);
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
            <div className="elb-modal-label">eLOGBOOK V5.2 · CONFIGURATION</div>
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
          {tab === "appearance"  && <AppearanceTab  d={draft} upd={upd} />}
          {tab === "preferences" && <PreferencesTab d={draft} upd={upd} />}
          {tab === "misc"        && <MiscTab />}
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
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   APPEARANCE TAB
   ───────────────────────────────────────────────────────────────────────── */
function AppearanceTab({ d, upd }) {
  return (
    <>
      {/* ── COLOR SCHEME ── */}
      <div className="elb-form-section">
        <div className="elb-form-section-title">COLOR SCHEME</div>
        <div className="elb-scheme-grid">
          {Object.entries(THEMES).map(([key, t]) => {
            const isSel = d.colorScheme === key;
            return (
              <button
                key={key}
                type="button"
                className={"elb-scheme-card" + (isSel ? " elb-scheme-sel" : "")}
                onClick={() => upd({ colorScheme: key })}
              >
                {/* Mini colour preview */}
                <div className="elb-scheme-preview" style={{ background: t.bg }}>
                  <div style={{ height: 3, background: t.accent, borderRadius: "2px 2px 0 0" }} />
                  <div style={{ display: "flex", gap: 3, padding: "5px 6px 3px" }}>
                    <div style={{ height: 4, flex: 2, background: t.border2, borderRadius: 1 }} />
                    <div style={{ height: 4, flex: 1, background: t.accent, borderRadius: 1, opacity: 0.55 }} />
                  </div>
                  <div style={{ display: "flex", gap: 2, padding: "0 6px 5px" }}>
                    {[1, 0.6, 0.35].map((op, i) => (
                      <div key={i} style={{ height: 3, flex: 1, background: t.accent, borderRadius: 1, opacity: op }} />
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 2, padding: "0 6px 4px" }}>
                    {[0.2, 0.15, 0.12, 0.1].map((op, i) => (
                      <div key={i} style={{ height: 3, flex: 1, background: t.text, borderRadius: 1, opacity: op }} />
                    ))}
                  </div>
                </div>
                <div className="elb-scheme-name">{t.name}</div>
                {isSel && <div className="elb-scheme-tick">✓</div>}
              </button>
            );
          })}
        </div>
        <div className="elb-form-hint" style={{ marginTop: 4 }}>
          Colour scheme applies immediately on save. All schemes use the same dark-cockpit layout — only accent and background tones change.
        </div>
      </div>

      {/* ── DISPLAY ── */}
      <div className="elb-form-section">
        <div className="elb-form-section-title">DISPLAY</div>
        <ToggleRow
          name="DARK MODE"
          desc="Cockpit-dark theme · Recommended for all lighting conditions · Default ON"
          checked={d.darkMode !== false}
          onChange={v => upd({ darkMode: v })}
        />
        <ToggleRow
          name="HIGH CONTRAST BORDERS"
          desc="Strengthens table row and card borders for improved readability · Default OFF"
          checked={!!d.highContrast}
          onChange={v => upd({ highContrast: v })}
        />
      </div>

      {/* ── TYPOGRAPHY ── */}
      <div className="elb-form-section">
        <div className="elb-form-section-title">TYPOGRAPHY</div>

        <div className="elb-form-row" style={{ alignItems: "flex-end", marginBottom: 10 }}>
          <div className="elb-form-group">
            <label className="elb-form-label" style={{ marginBottom: 6 }}>FONT TYPE</label>
            <select className="elb-form-input" value={d.fontType}
              onChange={e => upd({ fontType: e.target.value })}>
              <option value="Courier New">Courier New — Classic aviation logbook</option>
              <option value="IBM Plex Mono">IBM Plex Mono — Modern technical</option>
              <option value="JetBrains Mono">JetBrains Mono — High legibility</option>
              <option value="Space Mono">Space Mono — Bold distinctive</option>
              <option value="Roboto Mono">Roboto Mono — Clean minimal</option>
            </select>
          </div>

          <div className="elb-form-group">
            <div className="elb-slider-wrap" style={{ margin: 0, padding: "7px 10px" }}>
              <div className="elb-slider-header" style={{ marginBottom: 6 }}>
                <span className="elb-slider-label">FONT SIZE</span>
                <span className="elb-slider-value">{d.fontSize}px</span>
              </div>
              <input type="range" min="9" max="14" step="1" value={d.fontSize}
                onChange={e => upd({ fontSize: Number(e.target.value) })} />
            </div>
          </div>
        </div>

        <div className="elb-preview">
          <div className="elb-preview-label">PREVIEW</div>
          <div className="elb-preview-body" style={{
            fontFamily: `'${d.fontType}', 'Courier New', monospace`,
            fontSize: d.fontSize,
          }}>
            DATE &nbsp; AIRCRAFT &nbsp; DEP &nbsp; ARR &nbsp; STD &nbsp; STA &nbsp; TOTAL<br />
            09 MAY &nbsp; B737-800 &nbsp; WMKK &nbsp; WSSS &nbsp; 08:30 &nbsp; 10:20 &nbsp; 01:50
          </div>
        </div>
      </div>
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
        <div className="elb-form-section-title">DAY / NIGHT CALCULATION METHOD</div>
        <div className="elb-radio-group">
          <RadioOption
            value="fixed"
            checked={d.dayNightMethod === "fixed"}
            onChange={() => upd({ dayNightMethod: "fixed" })}
            name="FIXED BOUNDARY (CURRENT)"
            desc="Day = 07:30–19:30 UTC · Night = outside this window · Applied uniformly to all sectors regardless of location or date. Simple and fast."
          />
          <RadioOption
            value="sunrise"
            checked={d.dayNightMethod === "sunrise"}
            onChange={() => upd({ dayNightMethod: "sunrise" })}
            name={<>DYNAMIC — DEPARTURE AIRPORT SUNRISE/SUNSET <span className="elb-tag elb-tag-new">COMING SOON</span></>}
            desc="Uses departure airport coordinates and solar position formula to calculate actual sunrise/sunset for each flight date. Day = 10 min after sunrise to 10 min before sunset. No API required — works offline."
            disabled
          />
          <RadioOption
            value="great-circle"
            checked={d.dayNightMethod === "great-circle"}
            onChange={() => upd({ dayNightMethod: "great-circle" })}
            name={<>DYNAMIC — GREAT CIRCLE INTERPOLATION <span className="elb-tag elb-tag-new">COMING SOON</span></>}
            desc="Full route interpolation every 30 minutes along the great circle track. Ideal for long-haul international sectors (e.g. WMKK–OMDB) where the aircraft crosses significantly different solar conditions."
            disabled
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
function MiscTab() {
  return (
    <>
      <div className="elb-ver-badge">✈ eLOGBOOK · VERSION 5.2 · CAD 1901 ISS01/REV01</div>

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

        <div className="elb-changelog-entry">
          <div className="elb-changelog-ver">
            <span className="elb-changelog-tag">V5.2 <span className="elb-tag elb-tag-new">CURRENT</span></span>
            <span className="elb-changelog-date">MAY 2026</span>
          </div>
          <ul className="elb-changelog-items">
            <li><span className="elb-tag elb-tag-new">NEW</span> Settings panel — profile, appearance, preferences and misc</li>
            <li><span className="elb-tag elb-tag-new">NEW</span> Default aircraft / markings / captain auto-fill</li>
            <li><span className="elb-tag elb-tag-new">NEW</span> Configurable pre/post-flight duty buffers</li>
            <li><span className="elb-tag elb-tag-imp">IMP</span> Adjustable logbook font size (9–14px)</li>
          </ul>
        </div>

        <div className="elb-changelog-entry">
          <div className="elb-changelog-ver">
            <span className="elb-changelog-tag">V5.1</span>
            <span className="elb-changelog-date">MAY 2026</span>
          </div>
          <ul className="elb-changelog-items">
            <li><span className="elb-tag elb-tag-new">NEW</span> FTL Limits tab — Para 2.18 &amp; 2.19.1 with approaching-limit alerts</li>
            <li><span className="elb-tag elb-tag-new">NEW</span> Recency tracker — T/O &amp; LDG and Autoland per aircraft type</li>
            <li><span className="elb-tag elb-tag-new">NEW</span> Regulatory reference popups on each limit card</li>
            <li><span className="elb-tag elb-tag-imp">IMP</span> Day/night calculation now handles cross-midnight sectors</li>
          </ul>
        </div>

        <div className="elb-changelog-entry">
          <div className="elb-changelog-ver">
            <span className="elb-changelog-tag">V5.0</span>
            <span className="elb-changelog-date">MAR 2026</span>
          </div>
          <ul className="elb-changelog-items">
            <li><span className="elb-tag elb-tag-new">NEW</span> Cloud save with Google Sign-In · Private per-pilot data</li>
            <li><span className="elb-tag elb-tag-new">NEW</span> Monthly Summary tab with annual grand totals</li>
            <li><span className="elb-tag elb-tag-fix">FIX</span> HOC colour coding badge now wraps text correctly</li>
            <li><span className="elb-tag elb-tag-imp">IMP</span> Tab key navigation between logbook cells</li>
          </ul>
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
        <button
          type="button"
          className="elb-misc-item elb-misc-item-danger"
          onClick={() => alert("Delete account is not yet wired up. Contact support to request deletion.")}
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
    font-family:var(--elb-font,'Courier New',monospace);font-size:var(--elb-td-sz,11px);color:#c8d6e5;
    animation:elbFadeIn 0.15s ease;
  }
  @keyframes elbFadeIn{from{opacity:0;}to{opacity:1;}}

  .elb-settings-modal{
    background:#0d1520;border:1px solid #1a3050;border-top:2px solid #4fc3f7;
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
  .elb-modal-label{font-size:0.73em;letter-spacing:0.2em;color:#4fc3f7;margin-bottom:4px;}
  .elb-modal-title{font-size:1.27em;font-weight:700;color:#e8f4fd;letter-spacing:0.05em;}
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
    padding:7px 16px;font-size:0.73em;letter-spacing:0.14em;
    color:#4a6a8a;cursor:pointer;border:1px solid transparent;border-bottom:none;
    border-radius:3px 3px 0 0;background:transparent;
    transition:all 0.15s;display:flex;align-items:center;gap:5px;
    position:relative;bottom:-1px;font-family:inherit;
  }
  .elb-stab:hover{color:#8fafc8;border-color:#0f1e2d;}
  .elb-stab.active{
    color:#4fc3f7;background:#0b1828;border-color:#1a3050;border-bottom-color:#0b1828;
  }

  .elb-tab-content{flex:1;overflow-y:auto;padding:22px 24px 20px;}
  .elb-tab-content::-webkit-scrollbar{width:3px;}
  .elb-tab-content::-webkit-scrollbar-track{background:transparent;}
  .elb-tab-content::-webkit-scrollbar-thumb{background:#1a3050;border-radius:2px;}

  .elb-form-section{margin-bottom:22px;}
  .elb-form-section-title{
    font-size:0.73em;letter-spacing:0.18em;color:#4fc3f7;
    margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #0f1e2d;
  }
  .elb-form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;}
  .elb-form-row.single{grid-template-columns:1fr;}
  .elb-form-group{display:flex;flex-direction:column;gap:5px;}
  .elb-form-label{font-size:0.73em;letter-spacing:0.12em;color:#4a6a8a;}
  .elb-required{color:#ef4444;margin-left:2px;}
  .elb-form-input{
    background:#0b1828;border:1px solid #1a3050;color:#c8d6e5;
    font-family:inherit;font-size:1em;padding:7px 10px;border-radius:3px;
    transition:border-color 0.15s;outline:none;width:100%;
  }
  .elb-form-input:focus{border-color:#4fc3f7;}
  .elb-form-input:disabled{opacity:0.45;cursor:not-allowed;}
  .elb-form-input::placeholder{color:#4a6a8a;}
  .elb-form-hint{font-size:0.73em;color:#4a6a8a;letter-spacing:0.04em;margin-top:2px;}
  select.elb-form-input{
    appearance:none;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%234a6a8a'/%3E%3C/svg%3E");
    background-repeat:no-repeat;background-position:right 10px center;
    padding-right:28px;cursor:pointer;
  }

  .elb-toggle-row{
    display:flex;align-items:center;justify-content:space-between;
    padding:10px 12px;background:#0b1828;border:1px solid #0f1e2d;
    border-radius:3px;margin-bottom:8px;gap:12px;
  }
  .elb-toggle-name{font-size:1em;color:#c8d6e5;letter-spacing:0.05em;}
  .elb-toggle-desc{font-size:0.73em;color:#4a6a8a;margin-top:3px;line-height:1.5;}
  .elb-toggle-switch{position:relative;width:38px;height:20px;flex-shrink:0;}
  .elb-toggle-switch input{opacity:0;width:0;height:0;}
  .elb-toggle-track{
    position:absolute;inset:0;background:#0a1018;border:1px solid #1a3050;
    border-radius:20px;cursor:pointer;transition:background 0.2s,border-color 0.2s;
    display:block;
  }
  .elb-toggle-track::before{
    content:'';position:absolute;left:3px;top:3px;width:12px;height:12px;
    background:#4a6a8a;border-radius:50%;transition:transform 0.2s,background 0.2s;
  }
  .elb-toggle-switch input:checked + .elb-toggle-track{background:rgba(79,195,247,0.15);border-color:#4fc3f7;}
  .elb-toggle-switch input:checked + .elb-toggle-track::before{transform:translateX(18px);background:#4fc3f7;}

  .elb-slider-wrap{
    padding:10px 12px;background:#0b1828;border:1px solid #0f1e2d;
    border-radius:3px;margin-bottom:8px;
  }
  .elb-slider-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}
  .elb-slider-label{font-size:1em;color:#c8d6e5;letter-spacing:0.05em;}
  .elb-slider-value{font-size:1em;color:#4fc3f7;font-weight:700;min-width:28px;text-align:right;}
  .elb-slider-wrap input[type=range]{
    width:100%;appearance:none;height:4px;background:#0a1018;
    border-radius:2px;border:1px solid #0f1e2d;outline:none;cursor:pointer;
  }
  .elb-slider-wrap input[type=range]::-webkit-slider-thumb{
    appearance:none;width:14px;height:14px;border-radius:50%;
    background:#4fc3f7;border:2px solid #0c1622;cursor:pointer;
    box-shadow:0 0 6px rgba(79,195,247,0.4);
  }
  .elb-slider-labels{display:flex;justify-content:space-between;font-size:0.73em;color:#4a6a8a;margin-top:5px;}

  .elb-preview{
    padding:10px 12px;background:#0b1828;border:1px solid #0f1e2d;border-radius:3px;
  }
  .elb-preview-label{font-size:0.73em;color:#4a6a8a;letter-spacing:0.1em;margin-bottom:6px;}
  .elb-preview-body{color:#8fafc8;line-height:1.8;}

  .elb-radio-group{display:flex;flex-direction:column;gap:6px;}
  .elb-radio-option{
    display:flex;align-items:flex-start;gap:10px;padding:10px 12px;
    background:#0b1828;border:1px solid #0f1e2d;border-radius:3px;
    cursor:pointer;transition:border-color 0.15s;
  }
  .elb-radio-option:hover{border-color:#243d5a;}
  .elb-radio-option.selected{border-color:rgba(79,195,247,0.4);background:rgba(79,195,247,0.04);}
  .elb-radio-option.disabled{opacity:0.55;cursor:not-allowed;}
  .elb-radio-option input[type=radio]{accent-color:#4fc3f7;margin-top:2px;flex-shrink:0;}
  .elb-radio-option-name{font-size:1em;color:#c8d6e5;letter-spacing:0.05em;}
  .elb-radio-option-desc{font-size:0.73em;color:#4a6a8a;margin-top:3px;line-height:1.6;}

  .elb-misc-item{
    display:flex;align-items:center;justify-content:space-between;
    padding:12px 14px;background:#0b1828;border:1px solid #0f1e2d;
    border-radius:3px;margin-bottom:8px;cursor:pointer;width:100%;
    transition:border-color 0.15s,background 0.15s;
    text-decoration:none;color:inherit;font-family:inherit;font-size:1em;
    text-align:left;
  }
  .elb-misc-item:hover{border-color:#243d5a;background:rgba(255,255,255,0.02);}
  .elb-misc-item-left{display:flex;align-items:center;gap:10px;}
  .elb-misc-item-icon{font-size:1.27em;width:20px;text-align:center;flex-shrink:0;display:inline-block;}
  .elb-misc-item-name{font-size:1em;color:#c8d6e5;letter-spacing:0.05em;display:block;}
  .elb-misc-item-desc{font-size:0.73em;color:#4a6a8a;margin-top:3px;display:block;}
  .elb-misc-item-arrow{font-size:0.91em;color:#4a6a8a;}
  .elb-misc-item-danger{border-color:rgba(239,68,68,0.15);}
  .elb-misc-item-danger .elb-misc-item-name{color:#ef4444;}
  .elb-misc-item-danger:hover{border-color:rgba(239,68,68,0.35);background:rgba(239,68,68,0.03);}
  .elb-misc-item-danger .elb-misc-item-arrow{color:#ef4444;}

  .elb-formula-box{
    background:#06100f;border:1px solid rgba(34,197,94,0.2);
    border-left:2px solid #22c55e;border-radius:3px;
    padding:10px 14px;margin-top:8px;
    font-size:0.82em;color:#4a6a8a;line-height:1.8;
  }
  .elb-formula-box .f-hl{color:#22c55e;}
  .elb-formula-box .f-acc{color:#4fc3f7;}

  .elb-modal-footer{
    padding:12px 24px;border-top:1px solid #1a3050;
    display:flex;align-items:center;justify-content:space-between;
    flex-shrink:0;background:#0b1828;gap:12px;flex-wrap:wrap;
  }
  .elb-footer-hint{font-size:0.73em;color:#4a6a8a;letter-spacing:0.05em;transition:color 0.2s;}
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

  .elb-ver-badge{
    display:inline-flex;align-items:center;gap:5px;
    background:rgba(79,195,247,0.07);border:1px solid rgba(79,195,247,0.15);
    border-radius:3px;padding:3px 8px;font-size:0.73em;color:#4fc3f7;
    letter-spacing:0.1em;margin-bottom:16px;
  }

  .elb-changelog-entry{
    padding:10px 12px;background:#0b1828;border:1px solid #0f1e2d;
    border-radius:3px;margin-bottom:6px;
  }
  .elb-changelog-ver{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}
  .elb-changelog-tag{font-size:0.82em;color:#4fc3f7;font-weight:700;}
  .elb-changelog-date{font-size:0.73em;color:#4a6a8a;}
  .elb-changelog-items{list-style:none;padding:0;margin:0;}
  .elb-changelog-items li{font-size:0.73em;color:#4a6a8a;line-height:1.7;padding-left:12px;position:relative;}
  .elb-changelog-items li::before{content:'›';position:absolute;left:0;color:#4fc3f7;}

  .elb-disclaimer-box{
    background:rgba(234,179,8,0.04);border:1px solid rgba(234,179,8,0.15);
    border-left:2px solid #eab308;border-radius:3px;
    padding:12px 14px;font-size:0.73em;color:#4a6a8a;line-height:1.85;letter-spacing:0.03em;
  }
  .elb-disclaimer-box .hl{color:#eab308;}

  .elb-tag{display:inline-block;font-size:0.64em;letter-spacing:0.1em;padding:2px 6px;border-radius:2px;font-weight:700;margin-left:6px;}
  .elb-tag-new{background:rgba(34,197,94,0.12);color:#22c55e;border:1px solid rgba(34,197,94,0.25);}
  .elb-tag-fix{background:rgba(79,195,247,0.1);color:#4fc3f7;border:1px solid rgba(79,195,247,0.2);}
  .elb-tag-imp{background:rgba(234,179,8,0.1);color:#eab308;border:1px solid rgba(234,179,8,0.2);}

  /* ── Colour scheme swatch picker ── */
  .elb-scheme-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:6px;}
  .elb-scheme-card{
    background:#0b1828;border:1px solid #0f1e2d;border-radius:4px;
    cursor:pointer;padding:0;overflow:hidden;position:relative;
    transition:border-color 0.15s,border-width 0.1s;text-align:left;
    font-family:inherit;color:inherit;
  }
  .elb-scheme-card:hover{border-color:#2a4a6a;}
  .elb-scheme-sel{border:2px solid #4fc3f7 !important;}
  .elb-scheme-preview{width:100%;height:56px;overflow:hidden;flex-shrink:0;}
  .elb-scheme-name{
    font-size:0.73em;letter-spacing:0.08em;color:#4a6a8a;
    padding:5px 7px 6px;display:block;line-height:1.3;
  }
  .elb-scheme-sel .elb-scheme-name{color:#4fc3f7;}
  .elb-scheme-tick{
    position:absolute;top:5px;right:5px;
    background:#4fc3f7;color:#0a0d12;border-radius:50%;
    font-size:0.73em;font-weight:700;width:15px;height:15px;
    display:flex;align-items:center;justify-content:center;line-height:1;
  }

  @media (max-width: 540px){
    .elb-scheme-grid{grid-template-columns:repeat(2,1fr);}
    .elb-form-row{grid-template-columns:1fr;}
    .elb-modal-footer{flex-direction:column;align-items:stretch;}
    .elb-footer-actions{justify-content:flex-end;}
  }
`;
