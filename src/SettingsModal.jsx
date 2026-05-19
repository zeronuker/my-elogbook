import { useEffect, useState } from "react";

// ════════════════════════════════════════════════════════════════════
//  ClaudeBorne · eLogbook — Settings Modal (v6 brand rewrite)
// ════════════════════════════════════════════════════════════════════

// ── Exports ─────────────────────────────────────────────────────────

export const ACCENT_PRESETS = [
  { id: "gradient", name: "ClaudeBorne", colors: ["#3FE0C5", "#3B8DFF", "#5B6BFF"], single: "#3FE0C5" },
  { id: "mint",     name: "Mint",        colors: ["#3FE0C5"],                        single: "#3FE0C5" },
  { id: "blue",     name: "Blue",        colors: ["#3B8DFF"],                        single: "#3B8DFF" },
  { id: "violet",   name: "Violet",      colors: ["#5B6BFF"],                        single: "#5B6BFF" },
  { id: "amber",    name: "Amber",       colors: ["#FFB37C"],                        single: "#FFB37C" },
];

export const ACCENT_MIGRATION = {
  "#4fc3f7": "mint",
  "#f5c542": "amber",
  "#22c55e": "mint",
  "#a78bfa": "violet",
  "#fb923c": "amber",
  "#f472b6": "violet",
  "#ef4444": "amber",
  "#2dd4bf": "mint",
};

export const FONT_CHOICES = [
  { id: "jetbrains", name: "JetBrains Mono", sample: "0123 ABab", css: "'JetBrains Mono', monospace" },
  { id: "ibmplex",   name: "IBM Plex Mono",  sample: "0123 ABab", css: "'IBM Plex Mono', monospace" },
  { id: "roboto",    name: "Roboto Mono",    sample: "0123 ABab", css: "'Roboto Mono', monospace" },
  { id: "space",     name: "Space Mono",     sample: "0123 ABab", css: "'Space Mono', monospace" },
  { id: "courier",   name: "Courier New",    sample: "0123 ABab", css: "'Courier Prime', 'Courier New', monospace" },
];

export const DEFAULT_SETTINGS = {
  // Profile
  fullName: "",
  dateOfBirth: "",
  staffId: "",
  licenceNumber: "",
  licenceType: "ATPL(A)",
  airline: "",
  defaultRank: "",
  homeBase: "",
  defaultAircraftType: "",
  defaultMarkings: "",
  defaultCaptain: "",
  // Carry forward
  carryForward: [
    { type: "", dayP1: "", dayP1US: "", dayP2: "", nightP1: "", nightP1US: "", nightP2: "" },
  ],
  // Appearance
  theme: "dark",
  fontSize: 14,
  tableDensity: "default",
  fontType: "courier",
  brightness: 100,
  accentPreset: "gradient",
  // Preferences
  dateFormat: "D",
  rowsPerPage: 15,
  autoSaveInterval: "5",
  dayNightMethod: "fixed",
  useStandardFormula: true,
  preFlightBuffer: 75,
  postFlightBuffer: 15,
};

// ── Carry-forward helpers ────────────────────────────────────────────
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

// ── Tabs ─────────────────────────────────────────────────────────────
const SETTINGS_TABS = [
  { id: "profile",     label: "Profile",     hint: "name · airline · licence" },
  { id: "appearance",  label: "Appearance",  hint: "theme · font · density" },
  { id: "preferences", label: "Preferences", hint: "date · auto-save · day/night" },
  { id: "changelog",   label: "Changelog",   hint: "version history" },
];

// ── Changelog data ────────────────────────────────────────────────────
const CHANGELOG = [
  {
    v: "v6.0", date: "May 2026", current: true,
    title: "ClaudeBorne brand rollout",
    notes: [
      "Full visual rebuild — new logo, typography, surfaces, and gradient accents.",
      "Appearance settings curated to a brand-safe palette (5 accent presets).",
      "Day/Night column headers now carry sun/moon glyphs for color-blind safety.",
      "Save status chip in page header — 5 states: auto-save off / unsaved / saving / saved / error (with retry).",
      "Dirty state: chip pulses amber when there are unsaved changes.",
      "PWA manifest wired — app is installable from supported browsers.",
      "window.confirm() replaced with branded confirmation modal.",
      "Remarks, Regulatory reference, Save error modals migrated to CB tokens — work in light mode.",
      "Save error modal now has a Retry button; dismiss returns to dirty (not idle).",
      "Annual overview table: ☀ DAY / ☾ NIGHT column group headers added.",
      "Hardcoded dark-only hex in cell editor, FTL cards, and save button replaced with CB tokens.",
    ],
  },
  {
    v: "v5.6", date: "May 2026", current: false,
    title: "Carry-forward fix · refresh polish",
    notes: [
      "Carry-forward hours over 9:59 no longer zero out on save.",
      "Refresh button has minimum 800ms spinner + proper error state.",
      "Profile settings no longer overwritten by stale legacy profile document on load.",
      "Footer version corrected (was showing v5.5).",
    ],
  },
  {
    v: "v5.5", date: "April 2026", current: false,
    title: "Onboarding stability",
    notes: [
      "Auth race-condition fix — no more reload-to-continue after sign-up.",
      "Error messages now clear when navigating between onboarding screens.",
    ],
  },
  {
    v: "v5.4", date: "March 2026", current: false,
    title: "PDF export removed",
    notes: [
      "Excel export remains; PDF will be reintroduced with a print stylesheet.",
    ],
  },
];

// ── Auto-save options ─────────────────────────────────────────────────
const AUTO_SAVE_OPTIONS = [
  { value: "0",  label: "Off"  },
  { value: "1",  label: "1m"   },
  { value: "5",  label: "5m"   },
  { value: "10", label: "10m"  },
  { value: "30", label: "30m"  },
];

// ════════════════════════════════════════════════════════════════════
//  Main component
// ════════════════════════════════════════════════════════════════════
export default function SettingsModal({ open, onClose, settings, onSave, userEmail, onDeleteAccount }) {
  const [tab, setTab]               = useState("profile");
  const [draft, setDraft]           = useState(settings || DEFAULT_SETTINGS);
  const [savedFlash, setSavedFlash] = useState(false);

  // Reset tab/flash when modal opens
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

  // ESC key closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const upd = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    await onSave(draft);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 3000);
  };

  return (
    <>
      <style>{settingsCss}</style>
      <div className="sm-backdrop" onClick={onClose} />
      <div className="sm-modal" role="dialog" aria-modal="true" aria-label="Settings">

        {/* ── HEAD ── */}
        <header className="sm-head">
          <div>
            <div className="sm-eyebrow">// settings</div>
            <h2 className="sm-title">Settings</h2>
          </div>
          <button className="sm-close" onClick={onClose} aria-label="Close">
            <SmCloseIcon />
          </button>
        </header>

        {/* ── TABS ── */}
        <nav className="sm-tabs">
          {SETTINGS_TABS.map((st) => (
            <button
              key={st.id}
              className={`sm-tab${tab === st.id ? " on" : ""}`}
              onClick={() => setTab(st.id)}
            >
              <span className="sm-tab-label">{st.label}</span>
              <span className="sm-tab-hint">{st.hint}</span>
            </button>
          ))}
        </nav>

        {/* ── BODY ── */}
        <div className="sm-body">
          {tab === "profile"     && <ProfileTab     d={draft} upd={upd} userEmail={userEmail} onDeleteAccount={onDeleteAccount} />}
          {tab === "appearance"  && <AppearanceTab  d={draft} upd={upd} />}
          {tab === "preferences" && <PreferencesTab d={draft} upd={upd} />}
          {tab === "changelog"   && <ChangelogTab />}
        </div>

        {/* ── FOOT ── */}
        <footer className="sm-foot">
          <div className={`sm-foot-note${savedFlash ? " saved" : ""}`}>
            {savedFlash ? "// ✓ saved" : "// changes save to your account · synced across devices"}
          </div>
          <div className="sm-foot-btns">
            <button className="cb-btn-ghost" onClick={onClose}>Cancel</button>
            <button className="cb-btn-primary" onClick={() => { handleSave(); onClose(); }}>Done</button>
          </div>
        </footer>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
//  PROFILE TAB
// ════════════════════════════════════════════════════════════════════
function ProfileTab({ d, upd, userEmail, onDeleteAccount }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rows = d.carryForward || [CF_EMPTY()];

  return (
    <div className="sm-tab-content">

      <SmSectionHead title="Pilot" hint="// shown in header · used for SELF auto-fill" />

      <SmField label="Full name">
        <SmInput
          value={d.fullName || ""}
          onChange={(v) => upd({ fullName: v })}
          placeholder="Your full name"
        />
      </SmField>
      <SmField label="Date of birth">
        <SmInputDate
          value={d.dateOfBirth || ""}
          onChange={(v) => upd({ dateOfBirth: v })}
        />
      </SmField>
      <SmField label="Staff ID">
        <SmInput
          value={d.staffId || ""}
          onChange={(v) => upd({ staffId: v })}
          placeholder="e.g. AK-12345"
        />
      </SmField>
      <SmField label="Email address" hint="Linked to your account. Cannot be changed here.">
        <SmInput value={userEmail || ""} readOnly />
      </SmField>

      <SmSectionHead title="Licence" hint="// CAAM regulatory data" />

      <SmField label="Licence type">
        <SmSelect
          value={d.licenceType || "ATPL(A)"}
          options={["ATPL(A)", "CPL(A)", "MPL", "PPL(A)"]}
          onChange={(v) => upd({ licenceType: v })}
        />
      </SmField>
      <SmField label="Licence number">
        <SmInput
          value={d.licenceNumber || ""}
          onChange={(v) => upd({ licenceNumber: v })}
          placeholder="e.g. MY-ATPL-001234"
        />
      </SmField>

      <SmSectionHead title="Operator" hint="// airline / organisation" />

      <SmField label="Airline">
        <SmInput
          value={d.airline || ""}
          onChange={(v) => upd({ airline: v })}
          placeholder="e.g. Batik Air Malaysia"
        />
      </SmField>
      <SmField label="Default rank" hint="Triggers auto-fill of SELF as captain when entering new sectors.">
        <SmSelect
          value={d.defaultRank || ""}
          options={["", "Flight Examiner", "Flight Instructor", "Captain", "Senior First Officer", "First Officer", "Second Officer", "Cadet"]}
          labels={["— Select rank —", "Flight Examiner", "Flight Instructor", "Captain", "Senior First Officer", "First Officer", "Second Officer", "Cadet"]}
          onChange={(v) => upd({ defaultRank: v })}
        />
      </SmField>
      <SmField label="Home base">
        <SmInput
          value={d.homeBase || ""}
          onChange={(v) => upd({ homeBase: v })}
          placeholder="e.g. WMKK · Kuala Lumpur"
        />
      </SmField>

      <SmSectionHead title="Carry-forward hours" hint="// per aircraft type · prior totals" />
      <div style={{ overflowX: "auto" }}>
        <table className="sm-cf-table">
          <thead>
            <tr>
              <th>Aircraft Type</th>
              <th>Day P1</th>
              <th>Day P1 U/S</th>
              <th>Day P2</th>
              <th>Night P1</th>
              <th>Night P1 U/S</th>
              <th>Night P2</th>
              <th>Total</th>
              <th style={{ width: 24 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const setRow = (patch) => {
                const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
                upd({ carryForward: next });
              };
              return (
                <tr key={i}>
                  <td>
                    <input
                      className="sm-cf-input sm-cf-input-type"
                      type="text"
                      value={row.type || ""}
                      onChange={(e) => setRow({ type: e.target.value.toUpperCase() })}
                      placeholder="B737"
                    />
                  </td>
                  {CF_FIELDS.map((field) => (
                    <td key={field}>
                      <input
                        className="sm-cf-input"
                        type="text"
                        value={row[field] || ""}
                        onChange={(e) => setRow({ [field]: e.target.value })}
                        placeholder="00:00"
                      />
                    </td>
                  ))}
                  <td className="sm-cf-total-cell">
                    {cfRowTotal(row) || <span style={{ opacity: 0.3 }}>—</span>}
                  </td>
                  <td className="sm-cf-action-cell">
                    {rows.length > 1 && (
                      <button
                        type="button"
                        className="sm-cf-remove"
                        title="Remove row"
                        onClick={() => upd({ carryForward: rows.filter((_, idx) => idx !== i) })}
                      >
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
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button
          type="button"
          className="sm-cf-add"
          onClick={() => upd({ carryForward: [...rows, CF_EMPTY()] })}
        >
          + Add aircraft type
        </button>
        {rows.some((r) => !r.type) && (
          <button
            type="button"
            className="sm-cf-add sm-cf-add-danger"
            onClick={() => {
              const filtered = rows.filter((r) => r.type);
              upd({ carryForward: filtered.length ? filtered : [CF_EMPTY()] });
            }}
          >
            ✕ Remove empty rows
          </button>
        )}
      </div>

      {/* ── DELETE ACCOUNT ── */}
      <SmSectionHead title="Account" hint="// danger zone" />
      {!confirmDelete ? (
        <button
          type="button"
          className="sm-delete-trigger"
          onClick={() => setConfirmDelete(true)}
        >
          <span className="sm-delete-trigger-label">Delete account &amp; all data</span>
          <span className="sm-delete-trigger-hint">Permanently removes your account and all logbook data. This cannot be undone.</span>
        </button>
      ) : (
        <div className="sm-delete-confirm">
          <div className="sm-delete-warn">⚠ This cannot be undone</div>
          <div className="sm-delete-body">
            All logbook data, carry-forward hours, and your eLOGBOOK account will be permanently
            deleted. You will be asked to re-authenticate with Google before deletion proceeds.
          </div>
          <div className="sm-delete-actions">
            <button type="button" className="cb-btn-ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="cb-btn-danger"
              onClick={() => { setConfirmDelete(false); onDeleteAccount && onDeleteAccount(); }}
            >
              Confirm Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  APPEARANCE TAB
// ════════════════════════════════════════════════════════════════════
function AppearanceTab({ d, upd }) {
  const theme      = d.theme        || "dark";
  const fontSize   = Math.min(18, Math.max(12, Number(d.fontSize) || 14));
  const density    = d.tableDensity || "default";
  const fontType   = d.fontType     || "courier";
  const brightness = Number(d.brightness) || 100;
  const accentPreset = d.accentPreset || "gradient";

  const fontCss = FONT_CHOICES.find((f) => f.id === fontType)?.css || "'Courier New', monospace";

  return (
    <div className="sm-tab-content">

      <SmSectionHead title="Theme" hint="// dark for cockpit / night ops · light for tarmac / daylight" />
      <SmRow>
        <SmSegmented
          value={theme}
          onChange={(v) => upd({ theme: v })}
          options={[
            { value: "dark",  label: "Dark"  },
            { value: "light", label: "Light" },
          ]}
        />
      </SmRow>

      {theme === "dark" && (
        <div className="sm-section-inline">
          <SmField
            label="Brightness"
            hint={`Filter applied to the entire app for night-vision adaptation. Currently ${brightness}%.`}
          >
            <SmSlider
              min={60} max={100} step={5}
              value={brightness}
              onChange={(v) => upd({ brightness: v })}
              ticks={["60", "70", "80", "90", "100"]}
              unit="%"
            />
          </SmField>
        </div>
      )}

      <SmSectionHead title="Accent" hint="// 5 curated brand presets" />
      <div className="sm-curated-note">
        Curated to the ClaudeBorne palette. The previous 8 free-pick accents (Cyan / Amber / Green /
        Purple / Orange / Pink / Red / Teal) are not available in v6 — your selection has been
        migrated to the nearest brand-safe equivalent.
      </div>
      <SmRow>
        <div className="sm-accent-grid">
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.id}
              className={`sm-accent${accentPreset === p.id ? " on" : ""}`}
              onClick={() => upd({ accentPreset: p.id })}
              aria-label={p.name}
            >
              <span
                className="sm-accent-swatch"
                style={{
                  background:
                    p.colors.length > 1
                      ? `linear-gradient(135deg, ${p.colors.join(", ")})`
                      : p.single,
                }}
              />
              <span className="sm-accent-name">{p.name}</span>
            </button>
          ))}
        </div>
      </SmRow>

      <SmSectionHead title="Font family" hint="// 5 monospace choices · keeps tabular alignment" />
      <SmRow>
        <div className="sm-font-grid">
          {FONT_CHOICES.map((f) => (
            <button
              key={f.id}
              className={`sm-font${fontType === f.id ? " on" : ""}`}
              onClick={() => upd({ fontType: f.id })}
            >
              <span className="sm-font-sample" style={{ fontFamily: f.css }}>{f.sample}</span>
              <span className="sm-font-name">{f.name}</span>
            </button>
          ))}
        </div>
      </SmRow>

      <SmSectionHead title="Text size" hint="// 12 – 18 px · scales table + body text" />
      <SmRow>
        <SmSlider
          min={12} max={18} step={1}
          value={fontSize}
          onChange={(v) => upd({ fontSize: v })}
          ticks={["12", "13", "14", "15", "16", "17", "18"]}
          unit="px"
        />
      </SmRow>
      <div
        className="sm-font-preview"
        style={{ fontFamily: fontCss, fontSize }}
      >
        WMKK → OMDB &nbsp;·&nbsp; STD 23:45 &nbsp;·&nbsp; B737 &nbsp;·&nbsp; 9M-XXX
      </div>

      <SmSectionHead title="Table density" hint="// row padding in the logbook table" />
      <SmRow>
        <SmSegmented
          value={density}
          onChange={(v) => upd({ tableDensity: v })}
          options={[
            { value: "compact", label: "Compact" },
            { value: "default", label: "Default" },
            { value: "relaxed", label: "Relaxed", note: "tap-friendly" },
          ]}
        />
      </SmRow>

    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  PREFERENCES TAB
// ════════════════════════════════════════════════════════════════════
function PreferencesTab({ d, upd }) {
  const autoSave = String(d.autoSaveInterval ?? "5");

  return (
    <div className="sm-tab-content">

      <SmSectionHead title="Logbook display" />

      <SmField label="Date format" hint="Controls how the DATE column appears in the logbook">
        <SmSegmented
          value={d.dateFormat || "D"}
          onChange={(v) => upd({ dateFormat: v })}
          options={[
            { value: "D",      label: "D"      },
            { value: "DD",     label: "DD"     },
            { value: "DD MMM", label: "DD MMM" },
          ]}
        />
      </SmField>

      <SmField label="Rows per page" hint="Minimum rows shown per month in logbook">
        <SmSelect
          value={String(d.rowsPerPage || 15)}
          options={["10", "15", "20", "30", "50"]}
          labels={["10 rows", "15 rows (default)", "20 rows", "30 rows", "50 rows"]}
          onChange={(v) => upd({ rowsPerPage: Number(v) })}
        />
      </SmField>

      <SmSectionHead title="Saving" />

      <SmField label="Auto-save interval" hint="Saves your work in the background. Set to Off if you prefer manual control.">
        <SmSegmented
          value={autoSave}
          onChange={(v) => upd({ autoSaveInterval: v })}
          options={AUTO_SAVE_OPTIONS}
        />
      </SmField>

      <SmSectionHead title="Day / Night calculation" hint="// CAD-6 Part-1 vs simple time bands" />

      <SmField label="Method">
        <SmSegmented
          value={d.dayNightMethod || "fixed"}
          onChange={(v) => upd({ dayNightMethod: v })}
          options={[
            { value: "fixed",   label: "Fixed bands"    },
            { value: "sunrise", label: "Sunrise/sunset" },
          ]}
        />
      </SmField>

      <SmHint>
        <b>Fixed</b> · Night = 11:30 – 23:30 UTC. Same boundaries everywhere.<br />
        <b>Sunrise / sunset</b> · Night = sunset + 20 min → sunrise − 20 min at departure airport (CAD-6). Falls back to Fixed for airports not in database.
      </SmHint>

      <SmSectionHead title="Duty buffers" hint="// for FTL cumulative duty calculations" />

      <SmField label="Apply standard formula" hint="Adds pre + post buffer to each sector. Turn off to set duty = flight time exactly.">
        <SmToggle
          checked={!!d.useStandardFormula}
          onChange={(v) => upd({ useStandardFormula: v })}
        />
      </SmField>

      <SmField label="Pre-flight buffer" hint="Default: 75 min (1 hr 15 min)">
        <SmSelect
          value={String(d.preFlightBuffer ?? 75)}
          options={["60", "75", "90", "120"]}
          labels={["60 min", "75 min (default)", "90 min", "120 min"]}
          onChange={(v) => upd({ preFlightBuffer: Number(v) })}
        />
      </SmField>

      <SmField label="Post-flight buffer" hint="Default: 15 min">
        <SmSelect
          value={String(d.postFlightBuffer ?? 15)}
          options={["10", "15", "30", "45"]}
          labels={["10 min", "15 min (default)", "30 min", "45 min"]}
          onChange={(v) => upd({ postFlightBuffer: Number(v) })}
        />
      </SmField>

    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  CHANGELOG TAB
// ════════════════════════════════════════════════════════════════════
function ChangelogTab() {
  return (
    <div className="sm-tab-content sm-changelog">
      {CHANGELOG.map((e, i) => (
        <article key={e.v} className={`sm-cl-entry${e.current ? " current" : ""}`}>
          <div className="sm-cl-head">
            <span className="sm-cl-v">{e.v}</span>
            <span className="sm-cl-date">{e.date}</span>
            {e.current && <span className="sm-cl-now">// you are here</span>}
          </div>
          <h4 className="sm-cl-title">{e.title}</h4>
          <ul className="sm-cl-notes">
            {e.notes.map((n, j) => <li key={j}>{n}</li>)}
          </ul>
        </article>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Sub-components
// ════════════════════════════════════════════════════════════════════

function SmSectionHead({ title, hint }) {
  return (
    <div className="sm-sh">
      <h3 className="sm-sh-title">{title}</h3>
      {hint && <span className="sm-sh-hint">{hint}</span>}
    </div>
  );
}

function SmField({ label, hint, children }) {
  return (
    <div className="sm-field">
      <div className="sm-field-meta">
        <label className="sm-field-label">{label}</label>
        {hint && <div className="sm-field-hint">{hint}</div>}
      </div>
      <div className="sm-field-control">{children}</div>
    </div>
  );
}

function SmRow({ children }) {
  return <div className="sm-row">{children}</div>;
}

function SmInput({ value, onChange, readOnly = false, placeholder = "" }) {
  return (
    <input
      className="sm-input"
      value={value}
      readOnly={readOnly}
      placeholder={placeholder}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
    />
  );
}

function SmInputDate({ value, onChange }) {
  return (
    <input
      className="sm-input sm-input-date"
      type="date"
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
    />
  );
}

function SmSelect({ value, options, labels, onChange }) {
  return (
    <select
      className="sm-select"
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
    >
      {options.map((o, i) => (
        <option key={o} value={o}>{labels ? labels[i] : o}</option>
      ))}
    </select>
  );
}

function SmSegmented({ value, onChange, options }) {
  return (
    <div className="sm-seg">
      {options.map((o) => (
        <button
          key={o.value}
          className={`sm-seg-item${value === o.value ? " on" : ""}`}
          onClick={() => onChange && onChange(o.value)}
        >
          {o.label}
          {o.note && <span className="sm-seg-note">· {o.note}</span>}
        </button>
      ))}
    </div>
  );
}

function SmSlider({ min, max, step, value, onChange, ticks = [], unit = "" }) {
  return (
    <div className="sm-slider-wrap">
      <input
        type="range"
        className="sm-slider"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange && onChange(Number(e.target.value))}
      />
      {ticks.length > 0 && (
        <div className="sm-slider-ticks">
          {ticks.map((t) => <span key={t}>{t}</span>)}
        </div>
      )}
      <div className="sm-slider-value">{value}{unit}</div>
    </div>
  );
}

function SmToggle({ checked, onChange }) {
  return (
    <div
      className={`sm-toggle${checked ? " on" : ""}`}
      onClick={() => onChange && onChange(!checked)}
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") onChange && onChange(!checked); }}
    >
      <div className="sm-toggle-knob" />
    </div>
  );
}

function SmHint({ children }) {
  return <div className="sm-hint">{children}</div>;
}

function SmCloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="6" y1="18" x2="18" y2="6" />
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Embedded CSS
// ════════════════════════════════════════════════════════════════════
const settingsCss = `
  /* ── CB token layer (dark default) ─────────────────────────────── */
  .sm-backdrop, .sm-modal {
    --cb-surface-0: #0a1020;
    --cb-surface-1: #141a2e;
    --cb-surface-2: #1b2340;
    --cb-surface-3: #232c4d;
    --cb-mint:   #3FE0C5;
    --cb-blue:   #3B8DFF;
    --cb-violet: #5B6BFF;
    --cb-grad: linear-gradient(135deg, var(--cb-mint) 0%, var(--cb-blue) 55%, var(--cb-violet) 100%);
    --cb-ink:     #e8ecf5;
    --cb-ink-2:   #b8c0d4;
    --cb-ink-dim: #7c87a3;
    --cb-line:   rgba(255,255,255,0.07);
    --cb-line-2: rgba(255,255,255,0.12);
    --cb-font-display: 'Tourney', system-ui, sans-serif;
    --cb-font-body:    'Inter', system-ui, sans-serif;
    --cb-font-mono:    'JetBrains Mono', ui-monospace, monospace;
    --fs: 1;
  }

  /* Google Fonts — load Tourney & JetBrains Mono */
  @import url('https://fonts.googleapis.com/css2?family=Tourney:wght@500;700;900&family=JetBrains+Mono:wght@400;500;700&display=swap');

  /* ── Backdrop ───────────────────────────────────────────────────── */
  .sm-backdrop {
    position: fixed; inset: 0;
    background: rgba(10, 16, 32, 0.6);
    backdrop-filter: blur(3px);
    z-index: 2090;
  }

  /* ── Modal shell ────────────────────────────────────────────────── */
  .sm-modal {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 880px;
    max-width: 92vw;
    max-height: 88vh;
    background: var(--cb-surface-1);
    border: 1px solid var(--cb-line-2);
    box-shadow: 0 30px 80px rgba(0,0,0,0.5);
    display: flex; flex-direction: column;
    z-index: 2100;
    animation: smPopIn 0.18s ease;
    font-family: var(--cb-font-body);
    color: var(--cb-ink);
    font-size: 14px;
  }
  @keyframes smPopIn {
    from { opacity:0; transform: translate(-50%,-50%) scale(0.96) translateY(6px); }
    to   { opacity:1; transform: translate(-50%,-50%) scale(1) translateY(0); }
  }

  /* ── Header ─────────────────────────────────────────────────────── */
  .sm-head {
    padding: 22px 28px 18px;
    border-bottom: 1px solid var(--cb-line);
    display: flex; justify-content: space-between; align-items: flex-start;
    background: linear-gradient(180deg, rgba(63,224,197,0.04), transparent);
    flex-shrink: 0;
  }
  .sm-eyebrow {
    font-family: var(--cb-font-mono);
    font-size: calc(10px * var(--fs));
    letter-spacing: 0.26em;
    text-transform: uppercase;
    color: var(--cb-mint);
    margin-bottom: 6px;
  }
  .sm-title {
    font-family: var(--cb-font-display);
    font-weight: 700;
    font-size: calc(28px * var(--fs));
    letter-spacing: 0.03em;
    margin: 0;
    line-height: 1;
    color: var(--cb-ink);
  }
  .sm-close {
    width: 32px; height: 32px; background: transparent;
    border: 1px solid var(--cb-line-2);
    color: var(--cb-ink-2);
    cursor: pointer; display: grid; place-items: center;
    flex-shrink: 0;
    transition: color 120ms, border-color 120ms;
  }
  .sm-close:hover { color: var(--cb-mint); border-color: var(--cb-mint); }

  /* ── Tab nav ────────────────────────────────────────────────────── */
  .sm-tabs {
    display: grid; grid-template-columns: repeat(4, 1fr);
    background: var(--cb-surface-0);
    border-bottom: 1px solid var(--cb-line);
    flex-shrink: 0;
  }
  .sm-tab {
    background: transparent; border: 0;
    color: var(--cb-ink-2);
    padding: 14px 18px;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    text-align: left;
    transition: all 140ms;
    display: flex; flex-direction: column; gap: 3px;
  }
  .sm-tab + .sm-tab { border-left: 1px solid var(--cb-line); }
  .sm-tab:hover { color: var(--cb-ink); }
  .sm-tab.on {
    color: var(--cb-mint);
    border-bottom-color: var(--cb-mint);
    background: rgba(63,224,197,0.04);
  }
  .sm-tab-label {
    font-family: var(--cb-font-display);
    font-weight: 700;
    font-size: calc(14px * var(--fs));
    letter-spacing: 0.04em;
  }
  .sm-tab-hint {
    font-family: var(--cb-font-mono);
    font-size: calc(9px * var(--fs));
    letter-spacing: 0.16em;
    color: var(--cb-ink-dim);
    text-transform: uppercase;
  }

  /* ── Body ───────────────────────────────────────────────────────── */
  .sm-body {
    flex: 0 0 auto; overflow-y: auto;
    padding: 24px 28px;
    max-height: calc(88vh - 220px);
  }
  .sm-body::-webkit-scrollbar { width: 4px; }
  .sm-body::-webkit-scrollbar-track { background: transparent; }
  .sm-body::-webkit-scrollbar-thumb { background: var(--cb-line-2); border-radius: 2px; }

  .sm-tab-content { display: flex; flex-direction: column; gap: 4px; }

  /* ── Section head ───────────────────────────────────────────────── */
  .sm-sh {
    margin-top: 18px; margin-bottom: 12px;
    display: flex; align-items: baseline; justify-content: space-between; gap: 16px;
  }
  .sm-sh:first-child { margin-top: 0; }
  .sm-sh-title {
    font-family: var(--cb-font-display);
    font-weight: 700;
    font-size: calc(16px * var(--fs));
    margin: 0;
    letter-spacing: 0.03em;
    color: var(--cb-ink);
  }
  .sm-sh-hint {
    font-family: var(--cb-font-mono);
    font-size: calc(10px * var(--fs));
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--cb-ink-dim);
    white-space: nowrap;
  }

  .sm-section-inline {
    margin: 4px 0 8px;
    padding: 14px 16px;
    background: var(--cb-surface-0);
    border: 1px dashed var(--cb-line-2);
  }

  /* ── Field row ──────────────────────────────────────────────────── */
  .sm-field {
    display: flex;
    align-items: center;
    gap: 18px;
    padding: 10px 0;
    border-bottom: 1px dashed var(--cb-line);
    text-align: left;
  }
  .sm-field:last-child { border-bottom: 0; }
  .sm-field-meta { flex: 1; min-width: 0; }
  .sm-field-label {
    font-size: calc(13px * var(--fs));
    font-weight: 400;
    color: var(--cb-ink);
    display: block;
    text-align: left;
  }
  .sm-field-hint {
    font-size: calc(11.5px * var(--fs));
    color: var(--cb-ink-dim);
    line-height: 1.5;
    margin-top: 3px;
  }
  .sm-field-control { flex-shrink: 0; display: flex; align-items: center; gap: 8px; }

  .sm-row { padding: 4px 0 12px; }

  /* ── Inputs & selects ───────────────────────────────────────────── */
  .sm-input, .sm-select {
    background: var(--cb-surface-0);
    border: 1px solid var(--cb-line-2);
    color: var(--cb-ink);
    font-family: var(--cb-font-body);
    font-size: calc(12.5px * var(--fs));
    padding: 7px 12px;
    min-width: 200px;
    outline: none;
    transition: border-color 120ms;
  }
  .sm-input:focus, .sm-select:focus { border-color: var(--cb-mint); }
  .sm-input[readonly] { color: var(--cb-ink-2); opacity: 0.65; }
  .sm-input-date { min-width: 160px; }
  .sm-select { cursor: pointer; }

  /* ── Segmented control ──────────────────────────────────────────── */
  .sm-seg {
    display: inline-flex;
    border: 1px solid var(--cb-line-2);
    background: var(--cb-surface-0);
    padding: 3px;
    gap: 2px;
  }
  .sm-seg-item {
    background: transparent; border: 0;
    color: var(--cb-ink-2);
    font-family: var(--cb-font-mono);
    font-size: calc(11px * var(--fs));
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 7px 14px;
    cursor: pointer;
    transition: all 120ms;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .sm-seg-item:hover { color: var(--cb-ink); }
  .sm-seg-item.on {
    background-image: var(--cb-grad);
    color: var(--cb-surface-0);
    font-weight: 600;
  }
  .sm-seg-note {
    font-size: calc(9px * var(--fs));
    letter-spacing: 0.12em;
    opacity: 0.7;
    text-transform: none;
  }

  /* ── Curated note ───────────────────────────────────────────────── */
  .sm-curated-note {
    background: rgba(63,224,197,0.06);
    border-left: 2px solid var(--cb-mint);
    padding: 10px 14px;
    margin: 8px 0;
    font-size: calc(12px * var(--fs));
    color: var(--cb-ink-2);
    line-height: 1.5;
  }

  /* ── Accent grid ────────────────────────────────────────────────── */
  .sm-accent-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .sm-accent {
    background: var(--cb-surface-0);
    border: 1px solid var(--cb-line-2);
    cursor: pointer;
    padding: 12px;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    transition: all 140ms;
  }
  .sm-accent:hover { border-color: var(--cb-ink-2); }
  .sm-accent.on { border-color: var(--cb-mint); box-shadow: inset 0 0 0 1px var(--cb-mint); }
  .sm-accent-swatch { width: 28px; height: 28px; border: 1px solid var(--cb-line); }
  .sm-accent-name {
    font-family: var(--cb-font-mono);
    font-size: calc(10px * var(--fs));
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--cb-ink-2);
  }
  .sm-accent.on .sm-accent-name { color: var(--cb-mint); }

  /* ── Font grid ──────────────────────────────────────────────────── */
  .sm-font-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .sm-font {
    background: var(--cb-surface-0);
    border: 1px solid var(--cb-line-2);
    cursor: pointer;
    padding: 14px 10px;
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    transition: all 140ms;
  }
  .sm-font:hover { border-color: var(--cb-ink-2); }
  .sm-font.on { border-color: var(--cb-mint); box-shadow: inset 0 0 0 1px var(--cb-mint); }
  .sm-font-sample { font-size: calc(18px * var(--fs)); color: var(--cb-ink); letter-spacing: 0.04em; }
  .sm-font-name {
    font-family: var(--cb-font-mono);
    font-size: calc(9px * var(--fs));
    letter-spacing: 0.14em;
    color: var(--cb-ink-dim);
    text-transform: uppercase;
    text-align: center;
  }
  .sm-font.on .sm-font-name { color: var(--cb-mint); }

  /* Font preview strip */
  .sm-font-preview {
    padding: 8px 12px;
    background: var(--cb-surface-0);
    border: 1px solid var(--cb-line);
    color: var(--cb-ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 4px;
  }

  /* ── Slider ─────────────────────────────────────────────────────── */
  .sm-slider-wrap { display: flex; flex-direction: column; gap: 6px; max-width: 480px; width: 100%; }
  .sm-slider {
    -webkit-appearance: none; appearance: none;
    width: 100%; height: 4px;
    background: var(--cb-surface-0);
    border: 1px solid var(--cb-line-2);
    cursor: pointer;
    outline: none;
  }
  .sm-slider::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 16px; height: 16px;
    background-image: var(--cb-grad);
    cursor: pointer; border: 0;
  }
  .sm-slider::-moz-range-thumb {
    width: 16px; height: 16px;
    background-image: var(--cb-grad);
    cursor: pointer; border: 0;
  }
  .sm-slider-ticks {
    display: flex; justify-content: space-between;
    font-family: var(--cb-font-mono);
    font-size: calc(9px * var(--fs));
    color: var(--cb-ink-dim);
    letter-spacing: 0.1em;
  }
  .sm-slider-value {
    font-family: var(--cb-font-mono);
    font-size: calc(11px * var(--fs));
    color: var(--cb-mint);
    letter-spacing: 0.14em;
    text-align: right;
  }

  /* ── Toggle ─────────────────────────────────────────────────────── */
  .sm-toggle {
    width: 40px; height: 22px;
    background: var(--cb-surface-2);
    border: 1px solid var(--cb-line-2);
    border-radius: 12px;
    position: relative; cursor: pointer;
    transition: background 140ms;
    flex-shrink: 0;
  }
  .sm-toggle.on { background-image: var(--cb-grad); border-color: transparent; }
  .sm-toggle-knob {
    position: absolute; top: 2px; left: 2px;
    width: 16px; height: 16px;
    background: var(--cb-ink);
    border-radius: 50%;
    transition: left 140ms;
  }
  .sm-toggle.on .sm-toggle-knob { left: 20px; background: var(--cb-surface-0); }

  /* ── Hint block ─────────────────────────────────────────────────── */
  .sm-hint {
    background: var(--cb-surface-0);
    border: 1px solid var(--cb-line);
    padding: 12px 16px;
    margin: 6px 0;
    font-family: var(--cb-font-mono);
    font-size: calc(11px * var(--fs));
    color: var(--cb-ink-2);
    line-height: 1.7;
    letter-spacing: 0.04em;
  }
  .sm-hint b { color: var(--cb-mint); font-weight: 500; }

  /* ── Carry-forward table ────────────────────────────────────────── */
  .sm-cf-table { width: 100%; border-collapse: collapse; font-size: calc(12px * var(--fs)); margin-top: 8px; min-width: 560px; }
  .sm-cf-table th {
    text-align: left; padding: 8px 8px 8px 0;
    font-family: var(--cb-font-mono);
    font-size: calc(10px * var(--fs));
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--cb-ink-dim);
    border-bottom: 1px solid var(--cb-line);
    white-space: nowrap;
  }
  .sm-cf-table td {
    padding: 4px 4px 4px 0;
    border-bottom: 1px solid var(--cb-line);
    font-family: var(--cb-font-body);
  }
  .sm-cf-input {
    width: 100%; background: transparent; border: none; outline: none;
    color: var(--cb-ink);
    font-family: var(--cb-font-mono); font-size: calc(12px * var(--fs));
    text-align: center; padding: 5px 4px; min-width: 52px;
  }
  .sm-cf-input:focus { background: rgba(63,224,197,0.04); }
  .sm-cf-input::placeholder { color: var(--cb-line-2); }
  .sm-cf-input-type { text-align: left; padding-left: 2px; min-width: 72px; }
  .sm-cf-total-cell {
    text-align: center; color: var(--cb-mint); font-weight: 700;
    font-family: var(--cb-font-mono); font-size: calc(12px * var(--fs));
    white-space: nowrap; padding: 4px 8px;
  }
  .sm-cf-action-cell { text-align: center; width: 20px; }
  .sm-cf-remove {
    background: transparent; border: none; color: var(--cb-ink-dim);
    cursor: pointer; font-size: 0.85em; padding: 3px 5px;
    transition: color 120ms;
  }
  .sm-cf-remove:hover { color: #ef4444; }
  .sm-cf-add {
    background: transparent;
    border: 1px dashed var(--cb-line-2);
    color: var(--cb-ink-dim);
    font-family: var(--cb-font-mono); font-size: calc(11px * var(--fs));
    letter-spacing: 0.1em; text-transform: uppercase;
    padding: 8px 16px; cursor: pointer;
    transition: all 140ms;
  }
  .sm-cf-add:hover { border-color: var(--cb-mint); color: var(--cb-mint); }
  .sm-cf-add-danger { color: rgba(239,68,68,0.7); border-color: rgba(239,68,68,0.3); }
  .sm-cf-add-danger:hover { border-color: #ef4444; color: #ef4444; }

  /* ── Delete account section ─────────────────────────────────────── */
  .sm-delete-trigger {
    display: flex; flex-direction: column; gap: 4px;
    width: 100%; padding: 12px 14px; text-align: left;
    background: rgba(239,68,68,0.04);
    border: 1px solid rgba(239,68,68,0.2);
    cursor: pointer; transition: background 140ms, border-color 140ms;
    font-family: inherit;
  }
  .sm-delete-trigger:hover { background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.4); }
  .sm-delete-trigger-label { font-size: calc(13px * var(--fs)); color: #ef4444; font-weight: 600; }
  .sm-delete-trigger-hint { font-size: calc(11px * var(--fs)); color: var(--cb-ink-dim); }

  .sm-delete-confirm {
    background: rgba(239,68,68,0.05);
    border: 1px solid rgba(239,68,68,0.25);
    border-left: 3px solid #ef4444;
    padding: 14px 16px;
  }
  .sm-delete-warn {
    font-size: calc(12px * var(--fs));
    font-weight: 700; letter-spacing: 0.15em;
    color: #ef4444; margin-bottom: 8px;
    font-family: var(--cb-font-mono);
    text-transform: uppercase;
  }
  .sm-delete-body {
    font-size: calc(12px * var(--fs));
    color: var(--cb-ink-2); line-height: 1.7; margin-bottom: 14px;
  }
  .sm-delete-actions { display: flex; gap: 8px; justify-content: flex-end; }

  /* ── Footer ─────────────────────────────────────────────────────── */
  .sm-foot {
    padding: 16px 28px;
    border-top: 1px solid var(--cb-line);
    display: flex; justify-content: space-between; align-items: center;
    background: var(--cb-surface-1);
    flex-shrink: 0;
  }
  .sm-foot-note {
    font-family: var(--cb-font-mono);
    font-size: calc(10px * var(--fs));
    color: var(--cb-ink-dim);
    letter-spacing: 0.16em;
    transition: color 200ms;
  }
  .sm-foot-note.saved { color: var(--cb-mint); }
  .sm-foot-btns { display: flex; gap: 8px; }

  /* ── Buttons ────────────────────────────────────────────────────── */
  .cb-btn-ghost {
    background: transparent;
    border: 1px solid var(--cb-line-2);
    color: var(--cb-ink-2);
    font-family: var(--cb-font-mono);
    font-size: calc(10px * var(--fs));
    letter-spacing: 0.18em; text-transform: uppercase;
    padding: 8px 14px; cursor: pointer;
    transition: color 120ms, border-color 120ms;
  }
  .cb-btn-ghost:hover { color: var(--cb-mint); border-color: var(--cb-mint); }
  .cb-btn-primary {
    background-image: var(--cb-grad);
    border: 0;
    color: var(--cb-surface-0);
    font-family: var(--cb-font-mono);
    font-size: calc(10px * var(--fs));
    letter-spacing: 0.18em; text-transform: uppercase; font-weight: 600;
    padding: 8px 18px; cursor: pointer;
    transition: filter 120ms;
  }
  .cb-btn-primary:hover { filter: brightness(1.1); }
  .cb-btn-danger {
    background: rgba(239,68,68,0.12);
    border: 1px solid #ef4444;
    color: #ef4444;
    font-family: var(--cb-font-mono);
    font-size: calc(10px * var(--fs));
    letter-spacing: 0.18em; text-transform: uppercase;
    padding: 8px 14px; cursor: pointer;
    transition: background 120ms;
  }
  .cb-btn-danger:hover { background: rgba(239,68,68,0.22); }

  /* ── Changelog tab ──────────────────────────────────────────────── */
  .sm-changelog { gap: 0; text-align: left; }
  .sm-cl-entry { padding: 18px 0; border-bottom: 1px solid var(--cb-line); }
  .sm-cl-entry:last-child { border-bottom: 0; }
  .sm-cl-entry.current {
    background: rgba(63,224,197,0.04);
    margin: 0 -28px;
    padding: 18px 28px;
  }
  .sm-cl-head { display: flex; gap: 14px; align-items: baseline; margin-bottom: 6px; }
  .sm-cl-v {
    font-family: var(--cb-font-display);
    font-weight: 700;
    font-size: calc(20px * var(--fs));
    background-image: var(--cb-grad);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    letter-spacing: 0.04em;
  }
  .sm-cl-date {
    font-family: var(--cb-font-mono);
    font-size: calc(10px * var(--fs));
    letter-spacing: 0.18em;
    color: var(--cb-ink-dim);
    text-transform: uppercase;
  }
  .sm-cl-now {
    font-family: var(--cb-font-mono);
    font-size: calc(10px * var(--fs));
    letter-spacing: 0.18em;
    color: var(--cb-mint);
    text-transform: uppercase;
    margin-left: auto;
  }
  .sm-cl-title {
    font-family: var(--cb-font-display);
    font-weight: 500;
    font-size: calc(15px * var(--fs));
    margin: 0 0 10px;
    color: var(--cb-ink-2);
    letter-spacing: 0.02em;
  }
  .sm-cl-notes { margin: 0; padding-left: 18px; }
  .sm-cl-notes li {
    font-size: calc(12.5px * var(--fs));
    color: var(--cb-ink-2);
    line-height: 1.6;
    padding: 3px 0;
  }
  .sm-cl-notes li::marker { color: var(--cb-mint); }

  /* ── Responsive ─────────────────────────────────────────────────── */
  @media (max-width: 600px) {
    .sm-modal { max-height: 96vh; }
    .sm-head { padding: 16px 18px 14px; }
    .sm-body { padding: 16px 18px; max-height: calc(96vh - 200px); }
    .sm-foot { padding: 12px 18px; flex-direction: column; align-items: stretch; gap: 10px; }
    .sm-foot-btns { justify-content: flex-end; }
    .sm-accent-grid { grid-template-columns: repeat(3, 1fr); }
    .sm-font-grid { grid-template-columns: repeat(3, 1fr); }
    .sm-cl-entry.current { margin: 0 -18px; padding: 16px 18px; }
  }
`;
