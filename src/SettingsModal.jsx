import { useEffect, useRef, useState } from "react";
import GoogleSignInButton from "./GoogleSignInButton";
import { CHANGELOG } from "./changelog";
import Changelog, { currentVersion } from "@brand/Changelog";
import SettingsWindow, { SettingsSection, SettingsRow, Seg, Switch, Reveal } from "@brand/SettingsWindow";
import { useExitAnim } from "./useExitAnim";
import Select from "./Select";
import DatePicker from "./DatePicker";
import { useEscClose } from "./useEscClose";
import { useScrollLock } from "./useScrollLock";
import { ANIM_SPEED_MS } from "./logbookConstants";

// ════════════════════════════════════════════════════════════════════
//  ClaudeBorne · eLogbook — Settings (the brand kit's shared SettingsWindow)
// ════════════════════════════════════════════════════════════════════

// ── Exports ─────────────────────────────────────────────────────────

export const ACCENT_PRESETS = [
  { id: "gradient", name: "ClaudeBorne", colors: ["#3FE0C5", "#3B8DFF", "#5B6BFF"], single: "#3FE0C5" },
  { id: "emerald",  name: "Emerald",     colors: ["#10d983"],                        single: "#10d983" },
  { id: "gold",     name: "Gold",        colors: ["#eab308"],                        single: "#eab308" },
  { id: "rose",     name: "Rose",        colors: ["#f43f5e"],                        single: "#f43f5e" },
  { id: "violet",   name: "Violet",      colors: ["#a855f7"],                        single: "#a855f7" },
];

export const ACCENT_MIGRATION = {
  "#4fc3f7": "gradient",
  "#f5c542": "gold",
  "#22c55e": "emerald",
  "#a78bfa": "violet",
  "#fb923c": "gold",
  "#f472b6": "rose",
  "#ef4444": "rose",
  "#2dd4bf": "gradient",
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
  tableDensity: "compact",
  fontType: "courier",
  brightness: 100,
  accentPreset: "gradient",
  columnDensity: "narrow",
  autoHideEmptyCols: true,
  panelExpandAnimation: true,
  animEnabled: true,
  animStyle: "slide",
  animSpeed: "normal",
  // Preferences
  dateFormat: "D",
  rowsPerPage: 15,
  weekStart: "monday",
  mapFollow: "cruise",
  dayNightMethod: "fixed",
  useStandardFormula: true,
  preFlightBuffer: 75,
  postFlightBuffer: 15,
  dutyLogSyncCode: "",
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
// The standard ClaudeBorne Settings window: tabs on the left, the chosen tab on the right.
const SETTINGS_TABS = [
  { id: "profile",    label: "Profile",    hint: "pilot · licence · airline",     icon: "user" },
  { id: "appearance", label: "Appearance", hint: "theme · text · table · motion", icon: "palette" },
  { id: "logbook",    label: "Logbook",    hint: "display · hours · duty · sync", icon: "logbook" },
  { id: "about",      label: "About",      hint: "help · update · changelog",     icon: "about" },
];
// tab ids used before the Settings redesign
const OLD_TAB_IDS = { preferences: "logbook", misc: "about" };


// ── Per-tab defaults, for RESTORE DEFAULTS (Profile and About have none) ──
const TAB_DEFAULTS = {
  appearance: {
    theme: "dark",
    fontSize: 14,
    tableDensity: "compact",
    columnDensity: "narrow",
    autoHideEmptyCols: true,
    fontType: "courier",
    brightness: 100,
    accentPreset: "gradient",
    panelExpandAnimation: true,
    animEnabled: true,
    animStyle: "slide",
    animSpeed: "normal",
  },
  logbook: {
    dateFormat: "D",
    rowsPerPage: 15,
    weekStart: "monday",
    mapFollow: "cruise",
    dayNightMethod: "fixed",
    useStandardFormula: true,
    preFlightBuffer: 75,
    postFlightBuffer: 15,
  },
};

// A typed change (a name, a code) is saved once typing pauses; a click saves at once.
const SAVE_DELAY_MS = 500;


// ════════════════════════════════════════════════════════════════════
//  Main component
// ════════════════════════════════════════════════════════════════════
export default function SettingsModal({ open, onClose, settings, onSave, onPreview, userEmail, onDeleteAccount, onReauthAndDelete, onReauthAndDeleteGoogle, onReauthAndDeleteGooglePopup, userProvider, onFeedback, onGuide, needRefresh, updateServiceWorker, checkForUpdate, checkingUpdate, updateChecked, currentBuildVersion, autoUpdateDisabled, setAutoUpdateDisabled, initialTab, dutyLogStatus }) {
  const startTab = OLD_TAB_IDS[initialTab] || initialTab || "profile";
  const [tab, setTab]               = useState(startTab);
  const [draft, setDraft]           = useState(settings || DEFAULT_SETTINGS);
  const [savedFlash, setSavedFlash] = useState(false);
  const [footState, setFootState]   = useState(null); // null | "ask" | "done" (RESTORE DEFAULTS)
  const { mounted, closing } = useExitAnim(open);
  useScrollLock(mounted);
  const dirty = useRef(false);
  const draftRef = useRef(draft);
  useEffect(() => { draftRef.current = draft; }, [draft]);

  // Reset tab/flash when Settings opens. If a caller passed initialTab, honour it on each open.
  useEffect(() => {
    if (open) {
      setTab(OLD_TAB_IDS[initialTab] || initialTab || "profile");
      setSavedFlash(false);
      setFootState(null);
    }
  }, [open, initialTab]);

  // Sync draft from settings only when Settings opens — NOT on every settings
  // reference change while open (the cloud save's onSnapshot confirmation fires
  // setSettings with a new object reference, which would reset the draft mid-edit).
  useEffect(() => {
    if (open) {
      setDraft({ ...DEFAULT_SETTINGS, ...(settings || {}) });
      dirty.current = false;
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save as you go: every change is saved shortly after it is made.
  const save = () => {
    if (!dirty.current) return;
    dirty.current = false;
    onSave({ ...draftRef.current, settingsSavedAt: new Date().toISOString() });
    setSavedFlash(true);
  };
  useEffect(() => {
    if (!open || !dirty.current) return undefined;
    const t = setTimeout(save, SAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [draft, open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!savedFlash) return undefined;
    const t = setTimeout(() => setSavedFlash(false), 1800);
    return () => clearTimeout(t);
  }, [savedFlash]);

  // Closing saves anything still waiting first.
  const close = () => { save(); onClose(); };
  useEscClose(open, close);

  // Live preview — push draft to parent on every change so the app
  // re-renders with the new theme/font/density behind the window.
  // The text size eases toward its target each frame so the app grows/shrinks
  // smoothly while dragging; with animations off it applies instantly.
  const shownSizeRef = useRef(null);
  useEffect(() => {
    if (!open || !onPreview) { shownSizeRef.current = null; return; }
    const target = Number(draft.fontSize) || 14;
    if (shownSizeRef.current == null || draft.animEnabled === false) shownSizeRef.current = target;
    let raf;
    const step = () => {
      const diff = target - shownSizeRef.current;
      shownSizeRef.current = Math.abs(diff) < 0.02 ? target : shownSizeRef.current + diff * 0.25;
      onPreview({ ...draft, fontSize: shownSizeRef.current });
      if (shownSizeRef.current !== target) raf = requestAnimationFrame(step);
    };
    step();
    return () => cancelAnimationFrame(raf);
  }, [draft, open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;

  const upd = (patch) => { dirty.current = true; setDraft((prev) => ({ ...prev, ...patch })); };
  const changeTab = (id) => { setTab(id); setFootState(null); };

  const restoreDefaults = () => {
    const defaults = TAB_DEFAULTS[tab];
    if (!defaults) return;
    upd(defaults);
    setFootState("done");
    setTimeout(() => setFootState((s) => (s === "done" ? null : s)), 1800);
  };

  const tabLabel = SETTINGS_TABS.find((t) => t.id === tab)?.label || "";
  let footer = <span className={savedFlash ? "cbs-ok" : ""}>{savedFlash ? "✓ Saved" : "Changes save as you go"}</span>;
  if (TAB_DEFAULTS[tab]) {
    footer = footState === "ask" ? (
      <div className="cbs-foot-btns">
        <span className="cbs-ask">Put {tabLabel} back to defaults?</span>
        <button type="button" className="cbs-btn" onClick={() => setFootState(null)}>Cancel</button>
        <button type="button" className="cbs-btn primary" onClick={restoreDefaults}>Restore</button>
      </div>
    ) : footState === "done" ? (
      <span className="cbs-ok">✓ Defaults restored</span>
    ) : (
      <div className="cbs-foot-btns">
        {savedFlash && <span className="cbs-ok">✓ Saved</span>}
        <button type="button" className="cbs-btn" onClick={() => setFootState("ask")}>Restore defaults</button>
      </div>
    );
  }

  const anim = { style: draft.animStyle === "stagger" ? "cascade" : draft.animStyle, ms: draft.animEnabled === false ? 0 : ANIM_SPEED_MS[draft.animSpeed] || ANIM_SPEED_MS.normal };

  return (
    <>
      <style>{settingsCss}</style>
      <SettingsWindow appName="eLogbook" version={currentVersion(CHANGELOG)} tabs={SETTINGS_TABS} active={tab}
        onTab={changeTab} onClose={close} closing={closing} anim={anim} footer={footer} zIndex={2090}>
        {tab === "profile"    && <ProfileTab    d={draft} upd={upd} userEmail={userEmail} onDeleteAccount={onDeleteAccount} onReauthAndDelete={onReauthAndDelete} onReauthAndDeleteGoogle={onReauthAndDeleteGoogle} onReauthAndDeleteGooglePopup={onReauthAndDeleteGooglePopup} userProvider={userProvider} />}
        {tab === "appearance" && <AppearanceTab d={draft} upd={upd} />}
        {tab === "logbook"    && <LogbookTab    d={draft} upd={upd} dutyLogStatus={dutyLogStatus} />}
        {tab === "about"      && <AboutTab onFeedback={onFeedback} onGuide={onGuide} needRefresh={needRefresh} updateServiceWorker={updateServiceWorker} checkForUpdate={checkForUpdate} checkingUpdate={checkingUpdate} updateChecked={updateChecked} currentBuildVersion={currentBuildVersion} autoUpdateDisabled={autoUpdateDisabled} setAutoUpdateDisabled={setAutoUpdateDisabled} />}
      </SettingsWindow>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
//  PROFILE TAB
// ════════════════════════════════════════════════════════════════════
function ProfileTab({ d, upd, userEmail, onDeleteAccount, onReauthAndDelete, onReauthAndDeleteGoogle, onReauthAndDeleteGooglePopup, userProvider }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError]     = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [needsGoogleReauth, setNeedsGoogleReauth] = useState(false);
  const [password, setPassword]           = useState('');
  const isGoogle = userProvider === 'google.com';

  return (
    <>
      <SettingsSection title="Pilot">
        <SettingsRow label="Full name" wide>
          <TextInput value={d.fullName || ""} onChange={(v) => upd({ fullName: v })} placeholder="Your full name" />
        </SettingsRow>
        <SettingsRow label="Date of birth" wide>
          <DatePicker className="cbs-input" value={d.dateOfBirth || ""} onChange={(v) => upd({ dateOfBirth: v })} />
        </SettingsRow>
        <SettingsRow label="Staff ID" wide>
          <TextInput value={d.staffId || ""} onChange={(v) => upd({ staffId: v })} placeholder="e.g. AK-12345" />
        </SettingsRow>
        <SettingsRow label="Email address" hint="Linked to your account. Cannot be changed here." wide>
          <TextInput value={userEmail || ""} readOnly />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Licence">
        <SettingsRow label="Licence type" wide>
          <Picker value={d.licenceType || "ATPL(A)"} options={["ATPL(A)", "CPL(A)", "MPL", "PPL(A)"]} onChange={(v) => upd({ licenceType: v })} />
        </SettingsRow>
        <SettingsRow label="Licence number" wide>
          <TextInput value={d.licenceNumber || ""} onChange={(v) => upd({ licenceNumber: v })} placeholder="e.g. MY-ATPL-001234" />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Operator">
        <SettingsRow label="Airline" wide>
          <TextInput value={d.airline || ""} onChange={(v) => upd({ airline: v })} placeholder="e.g. Batik Air Malaysia" />
        </SettingsRow>
        <SettingsRow label="Default rank" hint="Fills in SELF as captain when you enter new sectors" wide>
          <Picker
            value={d.defaultRank || ""}
            options={["", "Flight Examiner", "Flight Instructor", "Captain", "Senior First Officer", "First Officer", "Second Officer", "Cadet"]}
            labels={["— Select rank —", "Flight Examiner", "Flight Instructor", "Captain", "Senior First Officer", "First Officer", "Second Officer", "Cadet"]}
            onChange={(v) => upd({ defaultRank: v })}
          />
        </SettingsRow>
        <SettingsRow label="Home base" wide>
          <TextInput value={d.homeBase || ""} onChange={(v) => upd({ homeBase: v })} placeholder="e.g. WMKK · Kuala Lumpur" />
        </SettingsRow>
      </SettingsSection>

      {/* ── DELETE ACCOUNT ── */}
      <SettingsSection title="Account">
        <SettingsRow full>
          <div style={{ width: "100%" }}>
      {!confirmDelete ? (
        <button
          type="button"
          className="sm-delete-trigger elb-fade"
          onClick={() => { setConfirmDelete(true); setDeleteError(null); setNeedsPassword(false); setNeedsGoogleReauth(false); setPassword(''); }}
        >
          <span className="sm-delete-trigger-label">Delete account &amp; all data</span>
          <span className="sm-delete-trigger-hint">Permanently removes your account and all logbook data. This cannot be undone.</span>
        </button>
      ) : needsPassword ? (
        /* ── Password re-auth prompt (email/password users) ── */
        <div key="pw" className="sm-delete-confirm elb-anim-rise">
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
      ) : needsGoogleReauth ? (
        /* ── Google re-auth prompt (Google users) — uses GIS so it works on PWA ── */
        <div key="google" className="sm-delete-confirm elb-anim-rise">
          <div className="sm-delete-warn">⚠ Confirm your identity</div>
          <div className="sm-delete-body">
            For your security, confirm with Google to permanently delete your account and all logbook data.
            {deleteLoading && <span style={{ display: 'block', marginTop: 8, color: '#f5c542' }}>Deleting…</span>}
          </div>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
            <GoogleSignInButton
              active={true}
              disabled={deleteLoading}
              onCredential={async (idToken) => {
                setDeleteLoading(true);
                setDeleteError(null);
                try {
                  if (onReauthAndDeleteGoogle) await onReauthAndDeleteGoogle(idToken);
                  // On success the app unmounts this modal as auth state goes null.
                } catch (err) {
                  setDeleteLoading(false);
                  setDeleteError(err.message || 'Re-authentication failed. Please try again.');
                }
              }}
              onFallback={async () => {
                // GIS unavailable — fall back to popup-based Google re-auth + delete.
                setDeleteLoading(true);
                setDeleteError(null);
                try {
                  if (onReauthAndDeleteGooglePopup) await onReauthAndDeleteGooglePopup();
                  setDeleteLoading(false);
                } catch (err) {
                  setDeleteLoading(false);
                  setDeleteError(err.message || 'Account deletion failed. Please try again.');
                }
              }}
            />
          </div>
          <div className="sm-delete-actions" style={{ marginTop: 10, justifyContent: 'center' }}>
            <button type="button" className="cb-btn-ghost" disabled={deleteLoading}
              onClick={() => { setNeedsGoogleReauth(false); setDeleteError(null); }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* ── Initial confirmation panel ── */
        <div key="confirm" className="sm-delete-confirm elb-anim-rise">
          <div className="sm-delete-warn">⚠ This cannot be undone</div>
          <div className="sm-delete-body">
            All logbook data, carry-forward hours, and your eLOGBOOK account will be permanently deleted.
            {isGoogle
              ? ' You may be asked to confirm with Google before deletion proceeds.'
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
                  } else if (err.code === 'needs-google-reauth') {
                    // Google user needs to re-confirm with Google (GIS — works on PWA)
                    setNeedsGoogleReauth(true);
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
        <div className="elb-fade" style={{
          marginTop: 10, padding: "8px 12px",
          background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.35)",
          borderRadius: 4, fontSize: "calc(11px * var(--fs))",
          color: "#ef4444", letterSpacing: "0.04em", lineHeight: 1.5,
        }}>
          ⚠ {deleteError}
        </div>
      )}
          </div>
        </SettingsRow>
      </SettingsSection>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
//  APPEARANCE TAB
// ════════════════════════════════════════════════════════════════════
function AppearanceTab({ d, upd }) {
  const theme      = d.theme        || "dark";
  const fontSize   = Math.min(18, Math.max(12, Number(d.fontSize) || 14));
  const density    = d.tableDensity === "relaxed" ? "relaxed" : "compact";
  const fontType   = d.fontType     || "courier";
  const brightness = Number(d.brightness) || 100;
  const accentPreset = d.accentPreset || "gradient";
  const animOn = d.animEnabled !== false;

  return (
    <>
      <SettingsSection title="Theme">
        <SettingsRow label="Mode">
          <Seg label="Theme" value={theme} onChange={(v) => upd({ theme: v })}
            options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} />
        </SettingsRow>
        <Reveal open={theme === "dark"}>
          <SettingsRow label="Brightness" hint="Dark theme only" full>
            <SmSlider min={60} max={100} step={1} value={brightness} onChange={(v) => upd({ brightness: v })}
              ticks={["60", "70", "80", "90", "100"]} unit="%" />
          </SettingsRow>
        </Reveal>
        <SettingsRow label="Accent" full>
          <div className="sm-accent-grid">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`sm-accent${accentPreset === p.id ? " on" : ""}`}
                onClick={() => upd({ accentPreset: p.id })}
                aria-label={p.name}
                aria-pressed={accentPreset === p.id}
              >
                <span
                  className="sm-accent-swatch"
                  style={{ background: p.colors.length > 1 ? `linear-gradient(135deg, ${p.colors.join(", ")})` : p.single }}
                />
                <span className="sm-accent-name">{p.name}</span>
              </button>
            ))}
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Text">
        <SettingsRow label="Font family" full>
          <div className="sm-font-grid">
            {FONT_CHOICES.map((f) => (
              <button key={f.id} type="button" className={`sm-font${fontType === f.id ? " on" : ""}`}
                aria-pressed={fontType === f.id} onClick={() => upd({ fontType: f.id })}>
                <span className="sm-font-sample" style={{ fontFamily: f.css }}>{f.sample}</span>
                <span className="sm-font-name">{f.name}</span>
              </button>
            ))}
          </div>
        </SettingsRow>
        <SettingsRow label="Text size" full>
          <SmSlider min={12} max={18} step={0.1} value={fontSize} onChange={(v) => upd({ fontSize: v })}
            ticks={["12", "13", "14", "15", "16", "17", "18"]} unit="px" />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Table">
        <SettingsRow label="Rows">
          <Seg label="Row density" value={density} onChange={(v) => upd({ tableDensity: v })}
            options={[{ value: "compact", label: "Compact" }, { value: "relaxed", label: "Relaxed" }]} />
        </SettingsRow>
        <SettingsRow label="Columns">
          <Seg label="Column density" value={d.columnDensity === "wide" ? "wide" : "narrow"} onChange={(v) => upd({ columnDensity: v })}
            options={[{ value: "narrow", label: "Narrow" }, { value: "wide", label: "Wide" }]} />
        </SettingsRow>
        <SettingsRow label="Auto-hide empty columns">
          <Switch label="Auto-hide empty columns" on={d.autoHideEmptyCols !== false} onChange={(v) => upd({ autoHideEmptyCols: v })} />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Animation">
        <SettingsRow label="Enable animations" hint="Also off when your device has reduced motion turned on">
          <Switch label="Enable animations" on={animOn} onChange={(v) => upd({ animEnabled: v })} />
        </SettingsRow>
        <Reveal open={animOn}>
          <SettingsRow label="Animate row detail panel">
            <Switch label="Animate row detail panel" on={d.panelExpandAnimation !== false} onChange={(v) => upd({ panelExpandAnimation: v })} />
          </SettingsRow>
          <SettingsRow label="Transition style" wide>
            <Seg label="Transition style"
              value={["slide", "rise", "stagger"].includes(d.animStyle) ? d.animStyle : "slide"}
              onChange={(v) => upd({ animStyle: v })}
              options={[{ value: "slide", label: "Slide" }, { value: "rise", label: "Fade rise" }, { value: "stagger", label: "Cascade" }]} />
          </SettingsRow>
          <SettingsRow label="Speed" wide>
            <Seg label="Animation speed" value={d.animSpeed || "normal"} onChange={(v) => upd({ animSpeed: v })}
              options={[{ value: "normal", label: "Normal" }, { value: "slow", label: "Slow" }, { value: "slower", label: "Slower" }]} />
          </SettingsRow>
        </Reveal>
      </SettingsSection>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
//  LOGBOOK TAB
// ════════════════════════════════════════════════════════════════════
function LogbookTab({ d, upd, dutyLogStatus }) {
  const rows = d.carryForward || [CF_EMPTY()];
  const dlStatus = dutyLogStatus || { state: "idle" };
  const dlStatusText = {
    loading:   { text: "Checking…", color: "var(--elb-txt-muted, #7c87a3)" },
    connected: { text: `✓ Connected — ${dlStatus.count ?? 0} log${dlStatus.count === 1 ? "" : "s"} found`, color: "#3FE0C5" },
    invalid:   { text: "Invalid code — check it matches the format from Duty Log", color: "#ef4444" },
    "not-found": { text: "No backup found for this code", color: "#ef4444" },
    error:     { text: "Couldn't reach Duty Log — check your connection", color: "#ef4444" },
  }[dlStatus.state];

  return (
    <>
      <SettingsSection title="Display">
        <SettingsRow label="Date format" wide>
          <Seg label="Date format" value={d.dateFormat || "D"} onChange={(v) => upd({ dateFormat: v })}
            options={[{ value: "D", label: "D" }, { value: "DD", label: "DD" }, { value: "DD MMM", label: "DD MMM" }]} />
        </SettingsRow>
        <SettingsRow label="Rows per page" wide>
          <Picker value={String(d.rowsPerPage || 15)} options={["10", "15", "20", "30", "50"]}
            labels={["10 rows", "15 rows (default)", "20 rows", "30 rows", "50 rows"]}
            onChange={(v) => upd({ rowsPerPage: Number(v) })} />
        </SettingsRow>
        <SettingsRow label="Calendar week starts on">
          <Seg label="Week starts on" value={d.weekStart || "monday"} onChange={(v) => upd({ weekStart: v })}
            options={[{ value: "monday", label: "Monday" }, { value: "sunday", label: "Sunday" }]} />
        </SettingsRow>
        <SettingsRow label="Map: follow the aircraft" wide>
          <Picker value={d.mapFollow || "cruise"} options={["cruise", "frame", "zoom", "pan"]}
            labels={["Cruise (default)", "Frame", "Close", "Pan"]} onChange={(v) => upd({ mapFollow: v })} />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Carry-forward hours">
        <SettingsRow hint="Hours flown before this logbook, by aircraft type" full>
          <div style={{ width: "100%" }}>
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
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Day / night">
        <SettingsRow label="Method" wide>
          <Seg label="Day and night method" value={d.dayNightMethod || "fixed"} onChange={(v) => upd({ dayNightMethod: v })}
            options={[{ value: "fixed", label: "Fixed bands" }, { value: "sunrise", label: "Dynamic" }]} />
        </SettingsRow>
        <SmHint>
          <b>Fixed Bands</b> · Night = 11:30 – 23:30 UTC. Same boundaries everywhere.<br />
          <b>Dynamic</b> · Night = civil twilight (−6°) tracked minute by minute along the route. Falls back to Fixed if either airport is unavailable.
        </SmHint>
      </SettingsSection>

      <SettingsSection title="Duty buffers">
        <SettingsRow label="Apply standard formula" hint="Adds a pre- and post-flight buffer to each sector">
          <Switch label="Apply standard formula" on={!!d.useStandardFormula} onChange={(v) => upd({ useStandardFormula: v })} />
        </SettingsRow>
        <Reveal open={!!d.useStandardFormula}>
          <SettingsRow label="Pre-flight buffer" wide>
            <Picker value={String(d.preFlightBuffer ?? 75)} options={["60", "75", "90", "120"]}
              labels={["60 min", "75 min (default)", "90 min", "120 min"]} onChange={(v) => upd({ preFlightBuffer: Number(v) })} />
          </SettingsRow>
          <SettingsRow label="Post-flight buffer" wide>
            <Picker value={String(d.postFlightBuffer ?? 15)} options={["10", "15", "30", "45"]}
              labels={["10 min", "15 min (default)", "30 min", "45 min"]} onChange={(v) => upd({ postFlightBuffer: Number(v) })} />
          </SettingsRow>
        </Reveal>
      </SettingsSection>

      <SettingsSection title="Duty log link">
        <SettingsRow label="Sync code" hint="From the Pilot Utility Suite (SuperApp)" wide>
          <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: 6 }}>
            <TextInput value={d.dutyLogSyncCode || ""} onChange={(v) => upd({ dutyLogSyncCode: v.trim().toUpperCase() })} placeholder="e.g. 7K2Q-9XPL-4M1V" />
            {dlStatusText && (
              <div className="elb-fade" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: dlStatusText.color }}>
                {dlStatus.state === "loading" && (
                  <span style={{ display: "inline-block", animation: "sm-spin 0.7s linear infinite", fontSize: 12, lineHeight: 1 }}>↻</span>
                )}
                <span>{dlStatusText.text}</span>
              </div>
            )}
          </div>
        </SettingsRow>
      </SettingsSection>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
//  ABOUT TAB
// ════════════════════════════════════════════════════════════════════
function AboutTab({ onFeedback, onGuide, needRefresh, updateServiceWorker, checkForUpdate, checkingUpdate, updateChecked, currentBuildVersion, autoUpdateDisabled, setAutoUpdateDisabled }) {
  return (
    <>
      <SettingsSection title="Support">
        <SettingsRow full>
          <div className="cbs-btns">
            <button type="button" className="cbs-btn" onClick={onGuide}>📖 How-to guide</button>
            <button type="button" className="cbs-btn" onClick={onFeedback}>💬 Send feedback</button>
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="App update">
        <SettingsRow label="Version"
          hint={checkingUpdate ? "Checking…" : needRefresh ? "A new version is ready" : updateChecked ? "You have the latest version" : null}>
          <span className={"cbs-value" + (needRefresh ? "" : " on")}>{currentVersion(CHANGELOG)} · build {currentBuildVersion}</span>
        </SettingsRow>
        <SettingsRow full>
          {needRefresh ? (
            <button type="button" className="cbs-btn primary" onClick={() => updateServiceWorker(true)}>Update now</button>
          ) : (
            <button type="button" className="cbs-btn" onClick={checkForUpdate} disabled={checkingUpdate}>
              {checkingUpdate ? "Checking…" : "Check for updates"}
            </button>
          )}
        </SettingsRow>
        <SettingsRow label="Disable auto-update">
          <Switch label="Disable auto-update" on={!!autoUpdateDisabled} onChange={setAutoUpdateDisabled} />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Changelog">
        <SettingsRow full>
          <Changelog changelog={CHANGELOG} />
        </SettingsRow>
      </SettingsSection>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
//  Sub-components
// ════════════════════════════════════════════════════════════════════

function TextInput({ value, onChange, readOnly = false, placeholder = "" }) {
  return (
    <input
      className="cbs-input"
      value={value}
      readOnly={readOnly}
      placeholder={placeholder}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
    />
  );
}

function Picker({ value, options, labels, onChange, disabled }) {
  return (
    <Select
      className="cbs-select"
      value={value}
      disabled={disabled}
      onChange={onChange}
      options={options.map((o, i) => ({ value: o, label: labels ? labels[i] : o }))}
    />
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
      <div className="sm-slider-value">{Math.round(value * 10) / 10}{unit}</div>
    </div>
  );
}

function SmHint({ children }) {
  return <div className="sm-hint">{children}</div>;
}

// ════════════════════════════════════════════════════════════════════
//  Embedded CSS — the Settings window itself is styled by brand.css (.cbs-*);
//  these are the eLogbook-only pieces inside it.
// ════════════════════════════════════════════════════════════════════
const settingsCss = `
  /* The window follows the user's accent and font size */
  .cbs, .cbs-scrim { --cbs-acc: var(--cb-accent, var(--cb-mint)); }
  .cbs .cbs-input { width: 100%; }
  .cbs .cbs-select { width: 100%; text-align: left; background-image: none; } /* Select draws its own arrow */
  @container (min-width: 471px) { .cbs .cbs-row.wide .cbs-row-c { width: 260px; } }


  @keyframes sm-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

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
    text-align: justify;
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
  @media (max-width: 640px) {
    .sm-accent-grid { grid-template-columns: repeat(3, 1fr); }
    .sm-font-grid { grid-template-columns: repeat(3, 1fr); }
  }
`;
