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
  { id: "emerald",  name: "Emerald",     colors: ["#10d983"],                        single: "#10d983" },
  { id: "rose",     name: "Rose",        colors: ["#f43f5e"],                        single: "#f43f5e" },
  { id: "cyan",     name: "Cyan",        colors: ["#06b6d4"],                        single: "#06b6d4" },
  { id: "gold",     name: "Gold",        colors: ["#eab308"],                        single: "#eab308" },
  { id: "coral",    name: "Coral",       colors: ["#f97316"],                        single: "#f97316" },
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
  columnDensity: "default",
  hiddenColumns: [],
  // Preferences
  dateFormat: "D",
  rowsPerPage: 15,
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
  { id: "misc",        label: "Misc",        hint: "help · changelog" },
];

// ── Changelog data ────────────────────────────────────────────────────
const CHANGELOG = [
  {
    v: "v6.7.1", date: "May 2026", current: true,
    title: "Hotfix — account deletion order",
    notes: [
      "FIX: Account deletion now removes Firestore data before invalidating the auth user. Previous order could leave logbook data orphaned in the cloud if Firestore was slow to acknowledge the auth-token revocation between deleteUser() and the subsequent deleteDoc() calls.",
    ],
  },
  {
    v: "v6.7", date: "May 2026", current: false,
    title: "Column hide actually hides · gear badge · toast reminder",
    notes: [
      "FIX: Hiding a column now removes it entirely from the table — previously it was reduced to a 13-pixel stub that still took horizontal space, defeating the purpose of hiding.",
      "FIX: AIRCRAFT and SECTORS group headers now disappear when both their sub-columns are hidden — previously the group label stayed visible above empty stubs.",
      "NEW: Gear icon carries a count badge whenever columns are hidden — at a glance you can see how many are tucked away.",
      "NEW: Toast strip above the table briefly appears when you hide a column (or on page load if any are hidden) — auto-fades after 5 seconds, or click ✕ to dismiss.",
      "NEW: Clicking the badge or toast opens Settings directly on the Appearance tab to manage column visibility.",
    ],
  },
  {
    v: "v6.6.1", date: "May 2026", current: false,
    title: "Hotfix — revert PWA redirect auth",
    notes: [
      "FIX: Revert v6.6 PWA redirect-based Google sign-in — installed PWAs were landing on the welcome page after Google sign-in with no auth. Reverted to popup-based flow (same as v6.5 behaviour on PWA).",
      "IMP: Desktop Google sign-in improvements from v6.6 retained — auto-recovery reload, 20s timeout, ad-blocker error messages all still active.",
      "PWA Google sign-in fix is in progress via a different approach (Google Identity Services); v6.6.1 restores PWA users to v6.5 behaviour in the meantime.",
    ],
  },
  {
    v: "v6.6", date: "May 2026", current: false,
    title: "Google sign-in reliability (desktop)",
    notes: [
      "FIX: Google sign-in on desktop browsers with ad blockers / popup blockers now shows a clear error message instead of silently failing.",
      "NEW: Auto-recovery safety net — if Google sign-in succeeds but the UI gets stuck on the login screen, the app now auto-reloads to recover (one-shot per session, no manual refresh needed).",
      "IMP: Sign-in attempt now times out after 20 seconds with an actionable error message — no more permanently stuck \"LOGGING IN...\" button.",
    ],
  },
  {
    v: "v6.5", date: "May 2026", current: false,
    title: "How-To Guide · UI polish · export fix",
    notes: [
      "NEW: In-app How-To Guide — 8 sections covering getting started, installing the app, logging flights, day/night calculation, carry forward hours, syncing, exporting, and settings.",
      "IMP: Toolbar icons enlarged and colour updated to mint for consistency.",
      "IMP: Export/Import icon stroke weight corrected to match other toolbar icons.",
      "IMP: How-To Guide and Send Feedback banners now equal size in Settings.",
      "IMP: Landing page logo updated to C Mark.",
      "FIX: Excel export Summary and Flights tabs showed 0:00:00 for all day/night/total columns — flight times are now computed correctly during export.",
    ],
  },
  {
    v: "v6.4", date: "May 2026", current: false,
    title: "Local-first architecture · PWA · offline support · manual sync",
    notes: [
      "NEW: Local-first architecture — all data now saves to device storage instantly. No network required to save.",
      "NEW: Manual SYNC button — push your logbook to the cloud and pull to other devices on demand.",
      "NEW: Sync conflict modal — when another device has newer cloud data, choose Keep Local or Keep Cloud.",
      "NEW: Offline indicator — toolbar shows OFFLINE chip when internet is unavailable; SYNC button disabled.",
      "NEW: PWA support — install C·B eLogBook on iOS and Android home screens. App loads and works fully offline after first install.",
      "NEW: Auto-update prompt — notifies you when a new version is available, updates safely after saves complete.",
      "IMP: Save-on-change — data writes to device storage on every edit. Auto-save interval setting removed.",
      "IMP: Existing users migrated automatically on first load — your Firestore data is pulled to local storage seamlessly.",
      "IMP: Last synced timestamp now persists across sessions — toolbar always shows when data was last pushed to cloud, even offline.",
      "IMP: Cloud-newer check now runs on reconnect and when app returns to foreground — banner appears automatically if another device has synced.",
      "IMP: Sync no longer shows conflict modal when local data is unchanged — silently pulls cloud data if no local edits exist since last sync.",
      "IMP: Save chip reworked — SAVING... (yellow, animated) transitions to SAVED TO LOCAL STORAGE (green) after editing pauses. SAVE NOW button removed.",
      "FIX: Last-synced timestamp was incorrectly updated on every local save — conflict detection now works correctly across multiple devices.",
      "FIX: Excel export Summary and Flights tabs showed 0:00:00 for all day/night/total columns — flight times are now computed correctly during export.",
    ],
  },
  {
    v: "v6.3", date: "May 2026", current: false,
    title: "In-app feedback · bug reports · feature requests",
    notes: [
      "NEW: In-app feedback system — Report a Bug and Suggest a Feature now open a native modal instead of an external link.",
      "Feedback submissions are stored in Firestore and include user email, app version, and timestamp — no extra login required.",
    ],
  },
  {
    v: "v6.2", date: "May 2026", current: false,
    title: "Column visibility · UX polish · live preview",
    notes: [
      "Column visibility: toggle any logbook column on/off from Settings → Appearance.",
      "DAY and NIGHT groups each enforce a minimum of 1 visible column.",
      "Hidden columns show a narrow rotated stub in the table header — click stub to restore.",
      "Appearance tab: all changes now apply as a live preview before saving.",
      "Changelog: current version always visible; older versions collapsed behind a toggle.",
      "Support: Report a Bug and Suggest a Feature merged into a single banner.",
      "Settings modal stays open after Save — manual close only.",
      "Light mode now applies correctly inside the Settings modal.",
      "Font family and size changes now apply inside Settings modal.",
      "Manual save no longer incorrectly triggers 'AUTOSAVE FAILED' error.",
      "Limits & Recency — all status banners and info text left-aligned.",
      "Remarks modal — REMARKS title left-aligned.",
      "Footer updated to CAD 1901 · MCAR 2016 Part 69 & Part 74.",
      "FIX: Firebase token refresh (every ~1 hr) no longer reloads Firestore and wipes unsaved local data.",
      "FIX: Export now includes manually-entered flights (day-number date format was silently excluded).",
      "FIX: Import modal now shows an explicit error if the cloud save fails instead of silently showing success.",
      "FIX: Re-importing Excel no longer creates duplicate rows for manually-entered flights.",
      "FIX: Browser close warning now fires when last save errored (not just when dirty).",
      "FIX: loadData no longer calls setData({}) when Firestore logbookData is an empty map — prevents wiping unsaved local data.",
      "FIX: Dates entered as DD/MM or DD/MM/YYYY are normalised to day-number on input — prevents silent export omission.",
      "FIX: Export now includes rows with DD/MM format dates (e.g. '15/05') in addition to day-number and DD/MM/YYYY formats.",
      "FIX: SAVE NOW and auto-save now always use the live React state — stale ref could previously cause logbookData to be wiped from Firestore.",
      "Column visibility revamped — DAY, NIGHT, and TOTAL columns are now always visible; only TYPE, MARKINGS, CAPTAIN, HOC, PF, DEP, ARR, STD, STA are toggleable.",
      "FIX: Hiding columns in Settings no longer resets on the 3rd toggle — auto-save was overwriting the Settings draft mid-edit via Firestore onSnapshot.",
      "FIX: Settings Save button no longer disappears off-screen on small screens — footer now always stays anchored to the bottom of the modal.",
      "FIX: Hiding a column no longer shifts all subsequent data cells left — hidden columns now render a narrow stub td to keep header and data rows aligned.",
      "FIX: Hiding a solo column (CAPTAIN, HOC, PF, STD, STA, TOTAL) no longer shifts sub-header row — stub now correctly spans both header rows.",
      "Real-time multi-device sync: app now stays live with Firestore — changes saved on any device appear on all other open devices within seconds.",
      "Sync conflict protection: if another device saves while you have unsaved local changes, a banner prompts you to Save Mine or Discard & Sync.",
    ],
  },
  {
    v: "v6.1", date: "May 2026", current: false,
    title: "Settings overhaul · save chip fix",
    notes: [
      "Profile tab: all data fields standardised to identical width.",
      "Accent palette expanded from 5 to 10 presets: added Emerald, Rose, Cyan, Gold, Coral.",
      "Accent swatches now span full modal width.",
      "Table density split into two independent controls — Row (Compact / Default / Relaxed) and Column (Narrow / Default / Wide).",
      "Save chip: auto-save off + no prior save shows AUTO-SAVE OFF · NOT YET SAVED.",
      "Save chip: after manual save with auto-save off, shows SAVED · timestamp persistently.",
      "SAVE NOW button turns amber when auto-save is disabled.",
      "Per-tab reset to default added to settings footer — Appearance and Preferences tabs only.",
      "Miscellaneous tab reinstated with support action cards (How-to Guide, Report a Bug, Suggest a Feature) and changelog.",
      "Tab bar: full-width border line added beneath tabs.",
      "FTL fix: day/night method setting now correctly applied to cumulative FTL calculations.",
      "Export/Import: native alert() dialogs replaced with inline branded status messages.",
    ],
  },
  {
    v: "v6.0", date: "May 2026", current: false,
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

// ── Per-tab reset defaults ────────────────────────────────────────────
const TAB_DEFAULTS = {
  appearance: {
    theme: "dark",
    fontSize: 14,
    tableDensity: "default",
    columnDensity: "default",
    fontType: "courier",
    brightness: 100,
    accentPreset: "gradient",
    hiddenColumns: [],
  },
  preferences: {
    dateFormat: "D",
    rowsPerPage: 15,
      dayNightMethod: "fixed",
    useStandardFormula: true,
    preFlightBuffer: 75,
    postFlightBuffer: 15,
  },
};


// ════════════════════════════════════════════════════════════════════
//  Main component
// ════════════════════════════════════════════════════════════════════
export default function SettingsModal({ open, onClose, settings, onSave, onPreview, userEmail, onDeleteAccount, onReauthAndDelete, userProvider, onFeedback, onGuide, needRefresh, updateServiceWorker, checkForUpdate, checkingUpdate, updateChecked, initialTab }) {
  const [tab, setTab]               = useState(initialTab || "profile");
  const [draft, setDraft]           = useState(settings || DEFAULT_SETTINGS);
  const [savedFlash, setSavedFlash] = useState(false);
  const [resetFlash, setResetFlash] = useState(false);

  // Reset tab/flash when modal opens. If a caller passed initialTab (e.g. the
  // hidden-columns chip/badge), honour it on each open — otherwise default to profile.
  useEffect(() => {
    if (open) {
      setTab(initialTab || "profile");
      setSavedFlash(false);
    }
  }, [open, initialTab]);

  // Sync draft from settings only when the modal opens — NOT on every settings
  // reference change while open (auto-save writes settings to Firestore, the
  // onSnapshot confirmation fires setSettings with a new object reference, which
  // was resetting the draft mid-edit and discarding unsaved column/appearance changes).
  useEffect(() => {
    if (open) {
      setDraft({ ...DEFAULT_SETTINGS, ...(settings || {}) });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ESC key closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Live preview — push draft to parent on every change so the app
  // re-renders with the new theme/font/density behind the modal
  useEffect(() => {
    if (open && onPreview) onPreview(draft);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const upd = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    await onSave(draft);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 3000);
  };

  const handleResetTab = () => {
    const defaults = TAB_DEFAULTS[tab];
    if (!defaults) return;
    setDraft(prev => ({ ...prev, ...defaults }));
    setResetFlash(true);
    setTimeout(() => setResetFlash(false), 2000);
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
          {SETTINGS_TABS.map((st) => {
            // Hidden-columns badge on the Appearance tab (matches the gear-icon badge
            // shown in the toolbar). Only renders when at least one toggleable column
            // is currently hidden in the user's settings.
            const showHiddenBadge =
              st.id === "appearance" &&
              (draft.hiddenColumns || []).filter(k => !ALWAYS_VISIBLE.includes(k)).length > 0;
            const hiddenCount = showHiddenBadge
              ? (draft.hiddenColumns || []).filter(k => !ALWAYS_VISIBLE.includes(k)).length
              : 0;
            return (
              <button
                key={st.id}
                className={`sm-tab${tab === st.id ? " on" : ""}`}
                onClick={() => setTab(st.id)}
                style={{ position: "relative" }}
              >
                <span className="sm-tab-label">{st.label}</span>
                <span className="sm-tab-hint">{st.hint}</span>
                {showHiddenBadge && (
                  <span
                    title={`${hiddenCount} hidden column${hiddenCount > 1 ? "s" : ""}`}
                    style={{
                      position: "absolute", top: 6, right: 8,
                      background: "#3FE0C5", color: "#0a0d12",
                      borderRadius: "50%", minWidth: 14, height: 14,
                      fontSize: 9, fontWeight: 700, lineHeight: "14px",
                      textAlign: "center", padding: "0 3px",
                      border: "1px solid var(--cb-surface-1, #141a2e)",
                      fontFamily: "'JetBrains Mono','Courier New',monospace",
                    }}
                  >{hiddenCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* ── BODY ── */}
        <div className="sm-body">
          {tab === "profile"     && <ProfileTab     d={draft} upd={upd} userEmail={userEmail} onDeleteAccount={onDeleteAccount} onReauthAndDelete={onReauthAndDelete} userProvider={userProvider} />}
          {tab === "appearance"  && <AppearanceTab  d={draft} upd={upd} />}
          {tab === "preferences" && <PreferencesTab d={draft} upd={upd} />}
          {tab === "misc"        && <MiscTab onFeedback={onFeedback} onGuide={onGuide} needRefresh={needRefresh} updateServiceWorker={updateServiceWorker} checkForUpdate={checkForUpdate} checkingUpdate={checkingUpdate} updateChecked={updateChecked} />}
        </div>

        {/* ── FOOT ── */}
        <footer className="sm-foot">
          <div className={`sm-foot-note${savedFlash ? " saved" : resetFlash ? " reset" : ""}`}>
            {savedFlash ? "// ✓ saved" : resetFlash ? "// tab reset to defaults" : "// changes save to your account · synced across devices"}
          </div>
          <div className="sm-foot-btns">
            {TAB_DEFAULTS[tab] && (
              <button className="cb-btn-reset" onClick={handleResetTab}>Reset tab</button>
            )}
            <button className="cb-btn-ghost" onClick={onClose}>Cancel</button>
            <button className="cb-btn-primary" onClick={handleSave}>Save</button>
          </div>
        </footer>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
//  PROFILE TAB
// ════════════════════════════════════════════════════════════════════
function ProfileTab({ d, upd, userEmail, onDeleteAccount, onReauthAndDelete, userProvider }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError]     = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword]           = useState('');
  const isGoogle = userProvider === 'google.com';
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
          onClick={() => { setConfirmDelete(true); setDeleteError(null); setNeedsPassword(false); setPassword(''); }}
        >
          <span className="sm-delete-trigger-label">Delete account &amp; all data</span>
          <span className="sm-delete-trigger-hint">Permanently removes your account and all logbook data. This cannot be undone.</span>
        </button>
      ) : needsPassword ? (
        /* ── Password re-auth prompt (email/password users) ── */
        <div className="sm-delete-confirm">
          <div className="sm-delete-warn">⚠ Confirm your identity</div>
          <div className="sm-delete-body">
            Enter your password to permanently delete your account and all logbook data.
          </div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Your password"
            disabled={deleteLoading}
            style={{
              width: "100%", marginTop: 10, padding: "8px 10px",
              background: "var(--elb-bg, #0a0d12)", border: "1px solid var(--elb-border, #1e3a5f)",
              borderRadius: 4, color: "var(--elb-txt, #c8d6e5)",
              fontFamily: "var(--elb-font, 'Courier New', monospace)",
              fontSize: "calc(12px * var(--fs))", letterSpacing: "0.05em", boxSizing: "border-box",
            }}
          />
          <div className="sm-delete-actions" style={{ marginTop: 10 }}>
            <button type="button" className="cb-btn-ghost" disabled={deleteLoading}
              onClick={() => { setNeedsPassword(false); setPassword(''); setDeleteError(null); }}>
              Cancel
            </button>
            <button
              type="button"
              className="cb-btn-danger"
              disabled={deleteLoading || !password}
              onClick={async () => {
                setDeleteLoading(true);
                setDeleteError(null);
                try {
                  if (onReauthAndDelete) await onReauthAndDelete(password);
                } catch (err) {
                  setDeleteLoading(false);
                  setDeleteError(err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
                    ? 'Incorrect password. Please try again.'
                    : err.message || 'Deletion failed. Please try again.');
                }
              }}
            >
              {deleteLoading ? 'Deleting...' : 'Delete Account'}
            </button>
          </div>
        </div>
      ) : (
        /* ── Initial confirmation panel ── */
        <div className="sm-delete-confirm">
          <div className="sm-delete-warn">⚠ This cannot be undone</div>
          <div className="sm-delete-body">
            All logbook data, carry-forward hours, and your eLOGBOOK account will be permanently deleted.
            {isGoogle
              ? ' You will be redirected to Google to confirm your identity before deletion proceeds.'
              : ' You will be asked to enter your password to confirm.'}
          </div>
          <div className="sm-delete-actions">
            <button type="button" className="cb-btn-ghost" disabled={deleteLoading}
              onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="cb-btn-danger"
              disabled={deleteLoading}
              onClick={async () => {
                setDeleteLoading(true);
                setDeleteError(null);
                try {
                  await (onDeleteAccount && onDeleteAccount());
                  setDeleteLoading(false);
                } catch (err) {
                  setDeleteLoading(false);
                  if (err.code === 'auth/requires-recent-login') {
                    // Email/password user needs password prompt
                    setNeedsPassword(true);
                  } else {
                    setDeleteError(err.message || 'Account deletion failed. Please try again.');
                  }
                }
              }}
            >
              {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      )}
      {deleteError && (
        <div style={{
          marginTop: 10, padding: "8px 12px",
          background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.35)",
          borderRadius: 4, fontSize: "calc(11px * var(--fs))",
          color: "#ef4444", letterSpacing: "0.04em", lineHeight: 1.5,
        }}>
          ⚠ {deleteError}
        </div>
      )}
    </div>
  );
}

// ── Column visibility definitions ──────────────────────────────────────────────
// DAY (P1, P1U/S, P2), NIGHT (P1, P1U/S, P2) and TOTAL are always visible.
// Only these columns are user-toggleable:
const COL_TOGGLE_DEFS = [
  { key: "type",        label: "TYPE",         group: "AIRCRAFT" },
  { key: "markings",    label: "MARKINGS",     group: "AIRCRAFT" },
  { key: "captain",     label: "CAPTAIN",      group: null       },
  { key: "cap",         label: "HOC",          group: null       },
  { key: "pilotFlying", label: "PILOT FLYING", group: null       },
  { key: "departure",   label: "DEP",          group: "SECTORS"  },
  { key: "arrival",     label: "ARR",          group: "SECTORS"  },
  { key: "std",         label: "STD",          group: null       },
  { key: "sta",         label: "STA",          group: null       },
];

// Columns that can never be hidden — filtered out of hiddenColumns on load (migration)
const ALWAYS_VISIBLE = ["dayP1","dayP1US","dayP2","nightP1","nightP1US","nightP2","total"];

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

      <SmSectionHead title="Table density" hint="// row height · column width" />
      <SmRow>
        <div className="sm-density-grid">
          <div className="sm-density-col">
            <div className="sm-density-label">ROWS</div>
            <SmSegmented
              value={density}
              onChange={(v) => upd({ tableDensity: v })}
              options={[
                { value: "compact", label: "Compact" },
                { value: "default", label: "Default" },
                { value: "relaxed", label: "Relaxed" },
              ]}
            />
          </div>
          <div className="sm-density-col">
            <div className="sm-density-label">COLUMNS</div>
            <SmSegmented
              value={d.columnDensity || "default"}
              onChange={(v) => upd({ columnDensity: v })}
              options={[
                { value: "narrow",  label: "Narrow"  },
                { value: "default", label: "Default" },
                { value: "wide",    label: "Wide"    },
              ]}
            />
          </div>
        </div>
      </SmRow>

      {(() => {
        const hidden = new Set(d.hiddenColumns || []);

        const toggle = (key) => {
          if (hidden.has(key)) {
            upd({ hiddenColumns: (d.hiddenColumns || []).filter(k => k !== key) });
          } else {
            upd({ hiddenColumns: [...(d.hiddenColumns || []), key] });
          }
        };

        return (
          <>
            <SmSectionHead title="Column visibility" hint="// click any chip to hide or restore" />
            <SmRow>
              <div className="sm-col-vis-grid">
                {COL_TOGGLE_DEFS.map(def => {
                  const isHidden = hidden.has(def.key);
                  return (
                    <button
                      key={def.key}
                      className={`sm-col-chip${isHidden ? "" : " on"}`}
                      onClick={() => toggle(def.key)}
                      title={isHidden ? `Show ${def.label}` : `Hide ${def.label}`}
                    >
                      {def.label}
                    </button>
                  );
                })}
              </div>
            </SmRow>
            {(d.hiddenColumns || []).length > 0 && (
              <div className="sm-col-vis-hint">
                {(d.hiddenColumns || []).length} column{(d.hiddenColumns || []).length > 1 ? "s" : ""} hidden · click any chip above to restore individually, or{" "}
                <button className="sm-col-vis-reset" onClick={() => upd({ hiddenColumns: [] })}>show all</button>
              </div>
            )}
          </>
        );
      })()}

    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  PREFERENCES TAB
// ════════════════════════════════════════════════════════════════════
function PreferencesTab({ d, upd }) {
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
//  MISC TAB
// ════════════════════════════════════════════════════════════════════
const MISC_CARDS = [
  {
    id: "guide",
    icon: "📖",
    title: "HOW-TO GUIDE",
    desc: "Setup, features, and workflows",
    href: "https://docs.claudeborne.my",
  },
];

function MiscTab({ onFeedback, onGuide, needRefresh, updateServiceWorker, checkForUpdate, checkingUpdate, updateChecked }) {
  const [showHistory, setShowHistory] = useState(false);
  const currentEntry = CHANGELOG.find(e => e.current);
  const pastEntries  = CHANGELOG.filter(e => !e.current);

  return (
    <div className="sm-tab-content">

      <SmSectionHead title="Support" hint="// guides · feedback · bugs" />
      <div className="sm-misc-cards">
        {MISC_CARDS.map(card => (
          <button
            key={card.id}
            onClick={onGuide}
            className="sm-misc-card"
          >
            <span className="sm-misc-card-icon">{card.icon}</span>
            <div className="sm-misc-card-body">
              <div className="sm-misc-card-title">{card.title}</div>
              <div className="sm-misc-card-desc">{card.desc}</div>
            </div>
            <span className="sm-misc-card-arrow">→</span>
          </button>
        ))}
        {/* Single feedback banner */}
        <button className="sm-misc-card" onClick={onFeedback}>
          <span className="sm-misc-card-icon">💬</span>
          <div className="sm-misc-card-body">
            <div className="sm-misc-card-title">SEND FEEDBACK</div>
            <div className="sm-misc-card-desc">Report a bug or suggest a feature</div>
          </div>
          <span className="sm-misc-card-arrow">→</span>
        </button>
      </div>

      <SmSectionHead title="App Update" hint="// check for new version" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0 16px' }}>
        {needRefresh ? (
          <button
            onClick={() => updateServiceWorker(true)}
            style={{ background: 'var(--elb-acc)', color: '#0a0f1e', border: 'none', borderRadius: 4, padding: '6px 14px', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer' }}
          >
            UPDATE NOW
          </button>
        ) : (
          <button
            onClick={checkForUpdate}
            disabled={checkingUpdate}
            style={{ background: 'transparent', color: checkingUpdate ? 'var(--elb-txt-muted)' : 'var(--elb-acc)', border: '1px solid currentColor', borderRadius: 4, padding: '6px 14px', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', cursor: checkingUpdate ? 'default' : 'pointer', opacity: checkingUpdate ? 0.6 : 1 }}
          >
            {checkingUpdate ? 'CHECKING...' : 'CHECK FOR UPDATES'}
          </button>
        )}
        {updateChecked && !needRefresh && (
          <span style={{ fontSize: 11, color: '#3FE0C5', letterSpacing: '0.06em' }}>✓ UP TO DATE</span>
        )}
        {needRefresh && !checkingUpdate && (
          <span style={{ fontSize: 11, color: 'var(--elb-acc)', letterSpacing: '0.06em' }}>NEW VERSION AVAILABLE</span>
        )}
      </div>

      <SmSectionHead title="Changelog" hint="// version history" />
      <div className="sm-changelog">
        {/* Current version — always visible */}
        {currentEntry && (
          <article key={currentEntry.v} className="sm-cl-entry current">
            <div className="sm-cl-head">
              <span className="sm-cl-v">{currentEntry.v}</span>
              <span className="sm-cl-date">{currentEntry.date}</span>
              <span className="sm-cl-now">// you are here</span>
            </div>
            <h4 className="sm-cl-title">{currentEntry.title}</h4>
            <ul className="sm-cl-notes">
              {currentEntry.notes.map((n, j) => <li key={j}>{n}</li>)}
            </ul>
          </article>
        )}

        {/* Toggle for past versions */}
        {pastEntries.length > 0 && (
          <button
            onClick={() => setShowHistory(v => !v)}
            className="sm-cl-history-toggle"
          >
            <span>{showHistory ? "▲" : "▼"}</span>
            <span>{showHistory ? "Hide" : "Show"} previous versions ({pastEntries.length})</span>
          </button>
        )}

        {/* Past versions — collapsed by default */}
        {showHistory && pastEntries.map((e) => (
          <article key={e.v} className="sm-cl-entry">
            <div className="sm-cl-head">
              <span className="sm-cl-v">{e.v}</span>
              <span className="sm-cl-date">{e.date}</span>
            </div>
            <h4 className="sm-cl-title">{e.title}</h4>
            <ul className="sm-cl-notes">
              {e.notes.map((n, j) => <li key={j}>{n}</li>)}
            </ul>
          </article>
        ))}
      </div>

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
  /* ── CB token layer ─────────────────────────────────────────────
     Surface, ink, line, font, and fs tokens are intentionally NOT
     set here — they inherit from :root which is managed by
     makeThemeCss() in elogbook_2026_v5_1.jsx. This allows the
     settings modal to respond to the user's theme, font, and
     font-size settings.
  ── */
  .sm-backdrop, .sm-modal {
    --cb-mint:         #3FE0C5;
    --cb-blue:         #3B8DFF;
    --cb-violet:       #5B6BFF;
    --cb-grad:         linear-gradient(135deg, #3FE0C5, #3B8DFF);
    --cb-font-display: 'Tourney', system-ui, sans-serif;
  }

  /* Google Fonts — load Tourney & JetBrains Mono */
  @import url('https://fonts.googleapis.com/css2?family=Tourney:wght@500;700;900&family=JetBrains+Mono:wght@400;500;700&display=swap');

  /* ── Backdrop ───────────────────────────────────────────────────── */
  .sm-backdrop {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.45);
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
    flex: 1 1 auto; overflow-y: auto;
    padding: 24px 28px;
    min-height: 0; /* required: allows flex child to shrink below content size so footer stays visible */
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
  .sm-field-control { flex-shrink: 0; display: flex; align-items: center; gap: 8px; width: 240px; }

  .sm-row { padding: 4px 0 12px; }

  /* ── Inputs & selects ───────────────────────────────────────────── */
  .sm-input, .sm-select {
    background: var(--cb-surface-0);
    border: 1px solid var(--cb-line-2);
    color: var(--cb-ink);
    font-family: var(--cb-font-body);
    font-size: calc(12.5px * var(--fs));
    padding: 7px 12px;
    width: 100%;
    outline: none;
    transition: border-color 120ms;
  }
  .sm-input:focus, .sm-select:focus { border-color: var(--cb-mint); }
  .sm-input[readonly] { color: var(--cb-ink-2); opacity: 0.65; }
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

  /* ── Accent grid ────────────────────────────────────────────────── */
  .sm-accent-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .sm-density-grid { display: flex; gap: 32px; flex-wrap: wrap; align-items: flex-start; }
  .sm-density-col { display: flex; flex-direction: column; gap: 8px; }
  .sm-density-label { font-family: var(--cb-font-mono); font-size: calc(10px * var(--fs)); letter-spacing: 0.2em; color: var(--cb-ink-dim); text-transform: uppercase; }
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
    text-align: left;
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
  .sm-foot-note.reset { color: var(--cb-ink-2); }
  .sm-foot-btns { display: flex; gap: 8px; }

  /* ── Buttons ────────────────────────────────────────────────────── */
  .cb-btn-reset {
    background: transparent;
    border: 1px solid var(--cb-line-2);
    color: var(--cb-ink-dim);
    font-family: var(--cb-font-mono);
    font-size: calc(10px * var(--fs));
    letter-spacing: 0.18em; text-transform: uppercase;
    padding: 8px 14px; cursor: pointer;
    transition: color 120ms, border-color 120ms;
    margin-right: 8px;
  }
  .cb-btn-reset:hover { color: var(--cb-ink-2); border-color: var(--cb-ink-2); }
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

  /* ── Misc tab ───────────────────────────────────────────────────── */
  .sm-misc-cards { display: flex; flex-direction: column; gap: 8px; margin-bottom: 4px; }
  .sm-misc-card {
    display: flex; align-items: center; gap: 14px;
    padding: 14px 16px;
    background: var(--cb-surface-0);
    border: 1px solid var(--cb-line-2);
    border-left: 3px solid var(--cb-mint);
    text-decoration: none;
    transition: background 120ms, border-left-color 120ms;
    box-sizing: border-box; width: 100%;
    cursor: pointer; text-align: left;
    font-family: inherit; font-size: inherit;
    line-height: inherit;
    -webkit-appearance: none; appearance: none;
    border-radius: 0;
  }
  .sm-misc-card:hover { background: var(--cb-surface-2); border-left-color: var(--cb-blue); }
  .sm-misc-card-icon { font-size: 20px; flex-shrink: 0; line-height: 1; }
  .sm-misc-card-body { flex: 1; min-width: 0; }
  .sm-misc-card-title {
    font-family: var(--cb-font-mono);
    font-size: calc(11px * var(--fs));
    letter-spacing: 0.16em;
    color: var(--cb-ink);
    font-weight: 600;
    margin-bottom: 3px;
    text-align: left;
  }
  .sm-misc-card-desc {
    font-size: calc(11.5px * var(--fs));
    color: var(--cb-ink-2);
    letter-spacing: 0.02em;
    text-align: left;
  }
  .sm-misc-card-split {
    flex-direction: column;
    align-items: stretch;
    padding: 0;
    gap: 0;
  }
  .sm-misc-split-item {
    display: flex; align-items: center; gap: 14px;
    padding: 14px 16px;
    text-decoration: none;
    transition: background 120ms;
    flex: 1;
    text-align: left;
    justify-content: flex-start;
  }
  .sm-misc-split-item:hover { background: var(--cb-surface-2); }
  .sm-misc-split-divider {
    height: 1px;
    background: var(--cb-line);
    margin: 0 16px;
  }
  .sm-misc-card-arrow {
    font-size: 16px;
    color: var(--cb-ink-dim);
    flex-shrink: 0;
  }

  /* ── Changelog (inside Misc tab) ────────────────────────────────── */
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
  .sm-cl-history-toggle {
    display: flex; align-items: center; gap: 8px;
    width: 100%; padding: 10px 0;
    background: transparent; border: none; border-bottom: 1px dashed var(--cb-line-2);
    color: var(--cb-ink-dim); font-family: var(--cb-font-mono);
    font-size: calc(11px * var(--fs)); letter-spacing: 0.1em;
    cursor: pointer; text-align: left;
    transition: color 120ms;
  }
  .sm-cl-history-toggle:hover { color: var(--cb-mint); }

  /* ── Column visibility chips ─────────────────────────────────────── */
  .sm-col-vis-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 2px 0;
  }
  .sm-col-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border: 1px solid var(--cb-line-2);
    background: transparent;
    color: var(--cb-ink-dim);
    font-family: var(--cb-font-mono, 'JetBrains Mono', monospace);
    font-size: calc(10px * var(--fs));
    letter-spacing: 0.07em;
    cursor: pointer;
    opacity: 0.45;
    transition: all 0.15s;
    border-radius: 2px;
  }
  .sm-col-chip.on {
    border-color: var(--cb-accent, #3FE0C5);
    color: var(--cb-ink);
    opacity: 1;
  }
  .sm-col-chip.locked {
    cursor: not-allowed;
    opacity: 0.25;
  }
  .sm-col-chip:hover:not(.locked) {
    border-color: var(--cb-accent, #3FE0C5);
    opacity: 0.75;
  }
  .sm-col-chip-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
  }
  .sm-col-vis-hint {
    margin-top: 8px;
    font-family: var(--cb-font-mono);
    font-size: calc(10px * var(--fs));
    color: var(--cb-ink-dim);
    letter-spacing: 0.05em;
  }
  .sm-col-vis-reset {
    background: transparent;
    border: none;
    color: var(--cb-mint);
    font-family: var(--cb-font-mono);
    font-size: calc(10px * var(--fs));
    letter-spacing: 0.05em;
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .sm-col-vis-reset:hover { opacity: 0.7; }

  /* ── Responsive ─────────────────────────────────────────────────── */
  @media (max-width: 600px) {
    .sm-modal { max-height: 96vh; }
    .sm-head { padding: 16px 18px 14px; }
    .sm-body { padding: 16px 18px; }
    .sm-foot { padding: 12px 18px; flex-direction: column; align-items: stretch; gap: 10px; }
    .sm-foot-btns { justify-content: flex-end; }
    .sm-accent-grid { grid-template-columns: repeat(3, 1fr); }
    .sm-font-grid { grid-template-columns: repeat(3, 1fr); }
    .sm-cl-entry.current { margin: 0 -18px; padding: 16px 18px; }
  }
`;
