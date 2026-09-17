import { useState, useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { db } from "./firebase";
import { doc, setDoc, getDoc, getDocs, collection } from "firebase/firestore";
import SettingsModal, { DEFAULT_SETTINGS, ACCENT_MIGRATION } from "./SettingsModal";
import ExportImportModal from "./ExportImportModal";
import SearchModal from "./SearchModal";
import RouteMapModal from "./RouteMapModal";
import HowToGuideModal from "./HowToGuideModal";
import FeedbackModal from "./FeedbackModal";
import BrandBanner from "@brand/BrandBanner";
import UpdatePrompt from "@brand/UpdatePrompt";
import { CHANGELOG } from "./changelog";
import { currentVersion } from "@brand/Changelog";
import {
  MONTHS, EMPTY_ROW, YEARS,
  getDaysInMonth, makeMonthRows, normalizeMonthRows, initialData,
  calcFlightTimes,
} from "./logbookCalculations";
import {
  DUTY_LOG_SYNC_URL, DUTY_LOG_CODE_RE, timeCols,
  FTL_POPUPS,
} from "./logbookConstants";
import { ToolbarSyncChip, TabLogbookIcon, TabSummaryIcon, TabLimitsIcon } from "./ELogbookIcons";
import { makeThemeCss } from "./theme";
import FlightSummaryTab from "./FlightSummaryTab";
import LogbookTab from "./LogbookTab";
import LimitsRecencyTab from "./LimitsRecencyTab";

// Single source of truth: the app's displayed version is always the newest
// changelog entry, so it can never drift out of sync with the changelog.
const APP_VERSION = currentVersion(CHANGELOG);

const dlNorm = (s) => (s || "").trim().toUpperCase();

// Extracts just the "HH:MM" portion from a "DD Mon YYYY · HH:MM" display string.
const timeOnly = (full) => (full ? full.split(" · ").pop() : "—");

// ─── Main component ────────────────────────────────────────────────────────────

export default function ELogbook2026({ user, onLogout, onDeleteAccount, onReauthAndDelete, onReauthAndDeleteGoogle, onReauthAndDeleteGooglePopup, userProvider, update, updateReady }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(initialData);
  const [editingCell, setEditingCell] = useState(null);
  const [activeTab, setActiveTab] = useState("logbook");
  const [saveStatus, setSaveStatus] = useState("idle");
  const [saveError, setSaveError] = useState(""); // stores last error message for display
  const [lastSaveTime, setLastSaveTime] = useState(""); // Format: "DD MMM YYYY • HH:MM:SS"
  const [refreshStatus] = useState("idle");
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | error
  const [lastSyncTime, setLastSyncTime] = useState("");
  const [syncConflict, setSyncConflict] = useState(null); // { cloudData } when conflict detected
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // ── NEW ──
  const [activePopup, setActivePopup] = useState(null); // popup id string or null
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const settingsRef = useRef(DEFAULT_SETTINGS); // always mirrors latest settings for use in async closures
  const dataRef = useRef(initialData()); // initialised to match data state — prevents {} being written if a save fires before first effect run
  const dataLoadedRef = useRef(false); // true only after a successful loadData — prevents saving initialData() over real data
  const [dataLoaded, setDataLoaded] = useState(false);
  const localDirtyRef = useRef(false); // true if local data changed since last cloud sync — used for conflict detection
  const saveChipDebounceRef = useRef(null); // debounce: saving → saved (1 s after last keystroke)
  const saveChipFadeRef     = useRef(null); // saved → fading (after 2 s display)
  const saveChipIdleRef     = useRef(null); // fading → idle (after 0.5 s fade)
  const [migrating, setMigrating] = useState(false); // true while pulling existing data from Firestore on first load
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState(null); // null → SettingsModal defaults to "profile"
  const [previewSettings, setPreviewSettings] = useState(null); // live preview while settings modal is open
  const [exportImportOpen, setExportImportOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pulseRowId, setPulseRowId] = useState(null); // briefly highlights a row after a search jump
  const pulseTimerRef = useRef(null);
  const [routeMapOpen, setRouteMapOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [dutyLogEntries, setDutyLogEntries] = useState([]); // flat [{ isoDate, sector, log }] fetched from linked Duty Log
  const [dutyLogStatus, setDutyLogStatus] = useState({ state: "idle" }); // idle | loading | connected | invalid | not-found | error
  const dutyLogRemarkAppliedRef = useRef(new Set()); // row ids already auto-filled/appended this session — avoids re-appending on every render
  const [lastDutyLogCheckTime, setLastDutyLogCheckTime] = useState(""); // "DD Mon YYYY · HH:MM" of last successful Duty Log check
  const dutyLogFetchingRef = useRef(false); // guards against overlapping fetches when refocus/reconnect fire close together
  const [dutyLogFlash, setDutyLogFlash] = useState(false); // brief bold ✓/✗ flash right after a check completes
  const dutyLogFlashTimerRef = useRef(null);
  const [expandedRowIdx, setExpandedRowIdx] = useState(null); // accordion — one row's detail panel open at a time
  const [confirmDeleteRowIdx, setConfirmDeleteRowIdx] = useState(null); // inline two-step delete confirm
  // Branded confirmation modal (replaces window.confirm)
  const [confirmDialog, setConfirmDialog] = useState(null); // { title, body, resolve }
  const confirmResolveRef = useRef(null);

  // Show a branded confirm dialog; returns Promise<boolean>
  const showConfirm = (title, body) => new Promise(resolve => {
    confirmResolveRef.current = resolve;
    setConfirmDialog({ title, body });
  });
  const handleConfirmYes = () => {
    setConfirmDialog(null);
    confirmResolveRef.current?.(true);
  };
  const handleConfirmNo = () => {
    setConfirmDialog(null);
    confirmResolveRef.current?.(false);
  };

  // ── Data loading — triggered by user prop from App.jsx ──
  // useEffect on user prop replaces onAuthStateChanged listener — App.jsx owns auth state.
  // dataLoadedRef guards against re-loading on token-refresh re-renders (user ref changes hourly).
  useEffect(() => {
    if (user) {
      if (!dataLoadedRef.current) {
        loadData(user.uid);
        loadProfile(user.uid);
      }
    } else {
      dataLoadedRef.current = false;
      // Cancel any pending confirmation dialog so stale resolve refs don't linger
      if (confirmResolveRef.current) {
        confirmResolveRef.current(false);
        confirmResolveRef.current = null;
      }
      setConfirmDialog(null);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps


  // ── Handle import — called directly by ExportImportModal ──
  // Returns true on success. Throws on save failure so the modal can show a specific error.
  const handleImport = async (importedData) => {
    dataLoadedRef.current = true; // import replaces data — treat as loaded
    setData(importedData);
    const ok = saveData(importedData);
    if (!ok) throw new Error("Local save failed — data is loaded in app. Use SAVE NOW to retry.");
  };

  // ── Per-year logbook storage ──────────────────────────────────────────────
  // Flight rows live in one Firestore doc per year (users/{uid}/logbook/{year})
  // instead of embedded in the single logbook/data doc, so no document can grow
  // unbounded over a multi-decade career. The logbook/data doc keeps only
  // settings + updatedAt and still gates sync/conflict detection with one
  // timestamp — the per-year split is a storage-layer change only, the existing
  // whole-logbook sync/conflict control flow is unchanged.

  // Fetch every year doc and merge into a flat `data`-shaped object (monthIdx-year keys).
  const fetchAllYearsData = async (uid) => {
    const snap = await getDocs(collection(db, "users", uid, "logbook"));
    const merged = {};
    snap.forEach(docSnap => {
      if (docSnap.id === "data") return; // the settings/pointer doc, not a year
      const months = docSnap.data().months || {};
      Object.entries(months).forEach(([monthIdx, rows]) => {
        merged[`${monthIdx}-${docSnap.id}`] = rows;
      });
    });
    return merged;
  };

  // Write a `data`-shaped object out to its per-year docs. Only touches years
  // present in dataToSave — other years already in Firestore are left alone.
  const pushYearsData = async (uid, dataToSave) => {
    const byYear = {};
    Object.keys(dataToSave).forEach(monthKey => {
      const rows = dataToSave[monthKey];
      if (!Array.isArray(rows)) return;
      const [monthIdx, year] = monthKey.split("-");
      if (!byYear[year]) byYear[year] = {};
      byYear[year][monthIdx] = rows;
    });
    await Promise.all(Object.entries(byYear).map(([year, months]) =>
      setDoc(doc(db, "users", uid, "logbook", year), { months }, { merge: true })
    ));
  };

  // ── Helper: apply a Firestore docData snapshot to React state ──
  // `yearsData`, when provided, is the already-fetched per-year merge and takes
  // priority. Falls back to docData.logbookData for not-yet-migrated legacy docs.
  const applyDocData = (docData, yearsData) => {
    const raw = (yearsData && Object.keys(yearsData).length > 0) ? yearsData : docData.logbookData;
    // Guard: {} is truthy in JS — never overwrite local state with an empty map
    if (raw && Object.keys(raw).length > 0) {
      const normalized = {};
      Object.keys(raw).forEach(key => {
        const [mIdx] = key.split("-").map(Number);
        normalized[key] = normalizeMonthRows(raw[key], mIdx, null);
      });
      setData(normalized);
    }
    if (docData.settings) {
      const merged = { ...DEFAULT_SETTINGS, ...docData.settings };
      if (!Array.isArray(merged.carryForward) || !merged.carryForward.some(r => r.type)) {
        merged.carryForward = DEFAULT_SETTINGS.carryForward;
      }
      settingsRef.current = merged;
      setSettings(merged);
    }
  };

  // ── localStorage helpers ──
  const lsKey            = (uid) => `elb_data_${uid}`;
  const lsSettingsKey    = (uid) => `elb_settings_${uid}`;
  const lsSaveKey        = (uid) => `elb_last_local_save_${uid}`;
  const lsSyncDisplayKey = (uid) => `elb_last_sync_display_${uid}`;
  const lsDutyLogCheckKey = (uid) => `elb_last_dutylog_check_${uid}`;
  const lsDutyLogDataKey  = (uid) => `elb_last_dutylog_data_${uid}`;

  // ── Background cloud check ──
  // Silently fetches Firestore updatedAt and compares to local lastSyncedAt.
  // If cloud is newer and this device has unsynced local edits, opens the sync
  // conflict modal so the user can choose. If local has no unsynced edits, pulls
  // the cloud data in automatically — nothing to lose, nothing to ask about.
  const checkCloudSync = async (uid) => {
    if (!navigator.onLine) return;
    try {
      const ref  = doc(db, "users", uid, "logbook", "data");
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const cloudData      = snap.data();
      const cloudUpdatedAt = cloudData.updatedAt ? new Date(cloudData.updatedAt).getTime() : 0;
      const lastSyncedAt   = localStorage.getItem(lsSaveKey(uid));
      const lastSyncedMs   = lastSyncedAt ? new Date(lastSyncedAt).getTime() : 0;
      if (!(cloudUpdatedAt > lastSyncedMs && cloudUpdatedAt > 0 && lastSyncedMs > 0)) return;

      if (localDirtyRef.current) {
        // Cloud is newer AND local has unsaved changes — genuine conflict, let user decide.
        const cloudYearsData = await fetchAllYearsData(uid);
        setSyncConflict({ cloudData: { ...cloudData, logbookData: cloudYearsData } });
        return;
      }

      // Cloud is newer but local has no changes since last sync — silent pull
      const cloudYearsData = await fetchAllYearsData(uid);
      applyDocData(cloudData, cloudYearsData);
      if (Object.keys(cloudYearsData).length > 0) localStorage.setItem(lsKey(uid), JSON.stringify(cloudYearsData));
      if (cloudData.settings)    localStorage.setItem(lsSettingsKey(uid), JSON.stringify(cloudData.settings));
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const displayStr = `${dateStr} · ${timeStr}`;
      localStorage.setItem(lsSaveKey(uid), now.toISOString());
      localStorage.setItem(lsSyncDisplayKey(uid), displayStr);
      setLastSyncTime(displayStr);
      localDirtyRef.current = false;
      setSyncStatus("synced");
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch (err) {
      console.warn("Background cloud check failed:", err);
    }
  };

  // ── Load data — localStorage first, Firestore fallback (migration) ──
  const loadData = async (uid) => {
    try {
      const localRaw      = localStorage.getItem(lsKey(uid));
      const localSettings = localStorage.getItem(lsSettingsKey(uid));

      if (localRaw) {
        // Local data exists — use it directly (instant, no network)
        const parsed = JSON.parse(localRaw);
        applyDocData({
          logbookData: parsed,
          settings: localSettings ? JSON.parse(localSettings) : null,
        });
        dataLoadedRef.current = true;
        setDataLoaded(true);

        // Restore last sync display timestamp so toolbar shows it even offline
        const storedSyncDisplay = localStorage.getItem(lsSyncDisplayKey(uid));
        if (storedSyncDisplay) setLastSyncTime(storedSyncDisplay);

        // Restore last Duty Log check timestamp so its toolbar chip isn't blank on load
        const storedDutyLogCheck = localStorage.getItem(lsDutyLogCheckKey(uid));
        if (storedDutyLogCheck) setLastDutyLogCheckTime(storedDutyLogCheck);

        // Restore last-fetched Duty Log entries so crew/remarks/badge still show offline
        const storedDutyLogData = localStorage.getItem(lsDutyLogDataKey(uid));
        if (storedDutyLogData) {
          try { setDutyLogEntries(JSON.parse(storedDutyLogData)); } catch { /* corrupt cache — ignore */ }
        }

        // Background cloud check — runs silently, opens conflict modal if cloud is newer
        checkCloudSync(uid);
        return;
      }

      // No local data — first load or new device — pull from Firestore
      setMigrating(true);
      const ref  = doc(db, "users", uid, "logbook", "data");
      const snap = await getDoc(ref);
      dataLoadedRef.current = true;
      setDataLoaded(true);
      if (snap.exists()) {
        const docData = snap.data();
        let yearsData = await fetchAllYearsData(uid);
        if (Object.keys(yearsData).length === 0 && docData.logbookData && Object.keys(docData.logbookData).length > 0) {
          // Legacy doc, never split into per-year docs yet — one-time additive
          // migration. The legacy logbookData field is left untouched either way,
          // so this is safe to retry if it fails partway.
          await pushYearsData(uid, docData.logbookData).catch(err => console.error("Year-split migration failed:", err));
          yearsData = docData.logbookData;
        }
        applyDocData(docData, yearsData);
        // Persist to localStorage so future loads are instant
        if (Object.keys(yearsData).length > 0) localStorage.setItem(lsKey(uid), JSON.stringify(yearsData));
        if (docData.settings)    localStorage.setItem(lsSettingsKey(uid), JSON.stringify(docData.settings));
        const now = new Date();
        const syncIso = now.toISOString();
        const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        const displayStr = `${dateStr} · ${timeStr}`;
        localStorage.setItem(lsSaveKey(uid), syncIso);
        localStorage.setItem(lsSyncDisplayKey(uid), displayStr);
        setLastSyncTime(displayStr);
        localDirtyRef.current = false;
      }
      setMigrating(false);
    } catch (err) {
      console.error("Load error:", err);
      dataLoadedRef.current = true;
      setDataLoaded(true);
      setMigrating(false);
    }
  };

  // ── Load profile data and merge into settings (migration fallback) ──
  const loadProfile = async (uid) => {
    try {
      const profileRef = doc(db, "users", uid, "profile", "data");
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        const profileData = profileSnap.data();
        const updated = {
          ...settingsRef.current,
          // logbook/data settings take priority; profile/data is migration fallback only
          fullName: settingsRef.current.fullName || profileData.fullName || "",
          airline: settingsRef.current.airline || profileData.airline || profileData.organization || "",
          licenceNumber: settingsRef.current.licenceNumber || profileData.licenceNumber || "",
          licenceType: settingsRef.current.licenceType || profileData.licenceType || "ATPL(A)",
          homeBase: settingsRef.current.homeBase || profileData.homeBase || "",
        };
        settingsRef.current = updated;
        setSettings(updated);
      }
    } catch (profileErr) {
      console.error("Profile load error:", profileErr);
    }
  };

  // ── Warn before tab close if localStorage save errored ──
  useEffect(() => {
    const handler = (e) => {
      if (saveStatus === "error") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus]);

  // ── Track online/offline status + cloud check on reconnect ──
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      // Run cloud check when connection is restored — conflict modal opens if cloud is ahead
      if (user?.uid) checkCloudSync(user.uid);
      fetchDutyLog();
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cloud check on app resume (tab/PWA comes back to foreground) ──
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && user?.uid && navigator.onLine) {
        checkCloudSync(user.uid);
        fetchDutyLog();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keep settingsRef in sync so saveData never reads a stale closure ──
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // ── Keep dataRef in sync ──
  useEffect(() => { dataRef.current = data; }, [data]);

  // ── Save-on-change: write to localStorage on every data update ──
  // localStorage is synchronous and instant — no network, no interval needed.
  // Skip until dataLoadedRef is true to avoid overwriting real data with empty initialData().
  useEffect(() => {
    if (!dataLoadedRef.current) return;
    saveData(data);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync data-theme attribute on <html> for brand.css dark/light tokens ──
  // Also mirrors to a global localStorage key (not user-scoped) so index.html's
  // pre-paint script can restore the right theme before settings load.
  useEffect(() => {
    const theme = settings.theme || "dark";
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("cb-theme", theme);
  }, [settings.theme]);

  // ── One-time accent migration: legacy hex → preset id ──
  useEffect(() => {
    if (!settings.accentPreset && settings.accentColor) {
      const migrated = ACCENT_MIGRATION[settings.accentColor] || "gradient";
      const next = { ...settings, accentPreset: migrated };
      settingsRef.current = next;
      setSettings(next);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── On-load cleanup: trim previous month's empty rows once data is ready ──
  useEffect(() => {
    if (!dataLoaded) return;
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const prevKey   = `${prevMonth}-${prevYear}`;
    setData(prev => {
      const rows = prev[prevKey];
      if (!rows) return prev;
      const trimmed = rows.filter(row => !Object.keys(EMPTY_ROW()).every(k => !row[k]));
      if (trimmed.length === rows.length) return prev;
      return { ...prev, [prevKey]: trimmed };
    });
  }, [dataLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Midnight cleanup: trim empty rows from the previous month ──
  useEffect(() => {
    let dailyTimer;
    const cleanPrevMonth = () => {
      if (!dataLoadedRef.current) return;
      const now = new Date();
      const m = now.getMonth();
      const y = now.getFullYear();
      const prevMonth = m === 0 ? 11 : m - 1;
      const prevYear  = m === 0 ? y - 1 : y;
      const prevKey   = `${prevMonth}-${prevYear}`;
      setData(prev => {
        const rows = prev[prevKey];
        if (!rows) return prev;
        const trimmed = rows.filter(row => !Object.keys(EMPTY_ROW()).every(k => !row[k]));
        if (trimmed.length === rows.length) return prev;
        return { ...prev, [prevKey]: trimmed };
      });
    };
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    const msToMidnight = midnight - now.getTime();
    const timer = setTimeout(() => {
      cleanPrevMonth();
      dailyTimer = setInterval(cleanPrevMonth, 86400000);
    }, msToMidnight);
    return () => {
      clearTimeout(timer);
      if (dailyTimer) clearInterval(dailyTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save settings to localStorage ──
  const saveSettings = (next) => {
    settingsRef.current = next;
    setSettings(next);
    if (!user) return;
    try {
      localStorage.setItem(lsSettingsKey(user.uid), JSON.stringify(next));
    } catch (e) {
      console.error("Settings save error:", e);
    }
  };

  // Briefly flashes the Duty Log toolbar chip bold/bright (✓ or ✗), mirroring
  // the Cloud chip's transient syncStatus "synced"/"error" window.
  const triggerDutyLogFlash = (ms) => {
    clearTimeout(dutyLogFlashTimerRef.current);
    setDutyLogFlash(true);
    dutyLogFlashTimerRef.current = setTimeout(() => setDutyLogFlash(false), ms);
  };

  // ── Duty Log link — reusable fetch, called on mount/code-change, refocus, and reconnect ──
  const fetchDutyLog = () => {
    const code = settingsRef.current.dutyLogSyncCode;
    if (!code || !DUTY_LOG_CODE_RE.test(code)) return; // idle/invalid reset is handled by the effect below
    if (dutyLogFetchingRef.current) return; // refocus/reconnect firing close together — avoid duplicate requests
    dutyLogFetchingRef.current = true;
    setDutyLogStatus({ state: "loading" });
    fetch(`${DUTY_LOG_SYNC_URL}?code=${encodeURIComponent(code)}`)
      .then(async r => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => null) }))
      .then(({ ok, status, body }) => {
        if (settingsRef.current.dutyLogSyncCode !== code) return; // code changed mid-flight — stale result
        if (!ok) {
          setDutyLogEntries([]);
          if (user?.uid) localStorage.removeItem(lsDutyLogDataKey(user.uid));
          setDutyLogStatus({ state: status === 404 ? "not-found" : "invalid" });
          triggerDutyLogFlash(5000);
          return;
        }
        const logs = body?.logs || [];
        const flat = [];
        for (const log of logs) {
          for (const sector of (log.sectors || [])) {
            flat.push({ isoDate: log.date, sector, log });
          }
        }
        setDutyLogEntries(flat);
        if (user?.uid) localStorage.setItem(lsDutyLogDataKey(user.uid), JSON.stringify(flat));
        setDutyLogStatus({ state: "connected", count: logs.length });
        dutyLogRemarkAppliedRef.current = new Set(); // new data — allow re-checking prefill/append
        const now = new Date();
        const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
        const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        const displayStr = `${dateStr} · ${timeStr}`;
        setLastDutyLogCheckTime(displayStr);
        if (user?.uid) localStorage.setItem(lsDutyLogCheckKey(user.uid), displayStr);
        triggerDutyLogFlash(3000);
      })
      .catch(() => {
        if (settingsRef.current.dutyLogSyncCode === code) {
          setDutyLogStatus({ state: "error" });
          triggerDutyLogFlash(5000);
        }
      })
      .finally(() => { dutyLogFetchingRef.current = false; });
  };

  useEffect(() => {
    if (!dataLoaded) return; // settings still at defaults pre-load — don't treat that as the user clearing their code
    const code = settings.dutyLogSyncCode;
    if (!code) {
      setDutyLogEntries([]);
      if (user?.uid) localStorage.removeItem(lsDutyLogDataKey(user.uid));
      setDutyLogStatus({ state: "idle" });
      return;
    }
    if (!DUTY_LOG_CODE_RE.test(code)) {
      setDutyLogEntries([]);
      if (user?.uid) localStorage.removeItem(lsDutyLogDataKey(user.uid));
      setDutyLogStatus({ state: "invalid" });
      return;
    }
    fetchDutyLog();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoaded, settings.dutyLogSyncCode]);

  // Finds the Duty Log sector matching a logbook row, by date + departure/arrival.
  // row.date is a bare day-of-month string in this component; combine with the
  // currently selected month/year to get an ISO date comparable to Duty Log's.
  const findDutyLogMatch = (row) => {
    if (!dutyLogEntries.length || !row.date || !row.departure || !row.arrival) return null;
    const day = parseInt(row.date, 10);
    if (!day) return null;
    const isoDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return dutyLogEntries.find(e =>
      e.isoDate === isoDate &&
      dlNorm(e.sector.from) === dlNorm(row.departure) &&
      dlNorm(e.sector.dest) === dlNorm(row.arrival)
    ) || null;
  };

  // Merge a matched Duty Log sector's remark AND the duty's log-level notes into the
  // row's Remarks field — each appended with its own tag if not already present.
  // Guarded on dataLoaded so this never touches `updateCell`/`data` before the app has
  // finished its initial load (this effect is declared above that gate for stable hook order).
  useEffect(() => {
    if (!dataLoaded || !dutyLogEntries.length) return;
    const mk = `${selectedMonth}-${selectedYear}`;
    const monthRows = data[mk] || [];
    monthRows.forEach((row, idx) => {
      const appliedKey = `${mk}:${row.id}`; // row.id resets per month, so scope the key to the month too
      if (dutyLogRemarkAppliedRef.current.has(appliedKey)) return;
      const match = findDutyLogMatch(row);
      if (!match) return;
      dutyLogRemarkAppliedRef.current.add(appliedKey);

      let merged = row.remarks || "";
      const append = (tag, text) => {
        const trimmed = (text || "").trim();
        if (!trimmed || merged.includes(trimmed)) return;
        merged = merged.trim() ? `${merged}\n\n[${tag}] ${trimmed}` : `[${tag}] ${trimmed}`;
      };
      append("Duty Log - Sector", match.sector.remark);
      append("Duty Log - Notes", match.log.notes);

      if (merged !== (row.remarks || "")) updateCell(idx, "remarks", merged);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoaded, dutyLogEntries, data, selectedMonth, selectedYear]);

  // ── Sync local data to/from Firestore (manual, user-triggered) ──
  // 1. PULL: fetch Firestore document and compare updatedAt timestamp with last local sync.
  // 2. If Firestore is newer → show conflict modal (user chooses Keep Local or Keep Cloud).
  // 3. If no conflict → PUSH local data to Firestore.
  const syncData = async () => {
    if (!user || syncStatus === "syncing" || !isOnline) return;
    setSyncStatus("syncing");
    if (settings.dutyLogSyncCode) fetchDutyLog(); // piggyback Duty Log refresh on manual sync taps
    try {
      const ref = doc(db, "users", user.uid, "logbook", "data");
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Sync timed out")), 15000)
      );

      // PULL — check if Firestore has newer data than last sync
      const snap = await Promise.race([getDoc(ref), timeoutPromise]);
      if (snap.exists()) {
        const cloudData      = snap.data();
        const cloudUpdatedAt = cloudData.updatedAt ? new Date(cloudData.updatedAt).getTime() : 0;
        const lastSyncedAt   = localStorage.getItem(lsSaveKey(user.uid));
        const lastSyncedMs   = lastSyncedAt ? new Date(lastSyncedAt).getTime() : 0;

        if (cloudUpdatedAt > lastSyncedMs && cloudUpdatedAt > 0 && lastSyncedMs > 0) {
          if (localDirtyRef.current) {
            // Cloud is newer AND local has unsaved changes — genuine conflict, let user decide.
            // Fetch the per-year data now so the Keep Cloud button has it ready.
            const cloudYearsData = await fetchAllYearsData(user.uid);
            setSyncStatus("idle");
            setSyncConflict({ cloudData: { ...cloudData, logbookData: cloudYearsData } });
            return;
          } else {
            // Cloud is newer but local has no changes since last sync — silent pull
            const cloudYearsData = await fetchAllYearsData(user.uid);
            applyDocData(cloudData, cloudYearsData);
            if (Object.keys(cloudYearsData).length > 0) localStorage.setItem(lsKey(user.uid), JSON.stringify(cloudYearsData));
            if (cloudData.settings)    localStorage.setItem(lsSettingsKey(user.uid), JSON.stringify(cloudData.settings));
            const now = new Date();
            const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
            const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
            const displayStr = `${dateStr} · ${timeStr}`;
            localStorage.setItem(lsSaveKey(user.uid), now.toISOString());
            localStorage.setItem(lsSyncDisplayKey(user.uid), displayStr);
            setLastSyncTime(displayStr);
            localDirtyRef.current = false;
            setSyncStatus("synced");
            setTimeout(() => setSyncStatus("idle"), 3000);
            return;
          }
        }
      }

      // No conflict — PUSH local data to Firestore
      const cleanData = {};
      Object.keys(dataRef.current).forEach(monthKey => {
        const rows = dataRef.current[monthKey];
        if (!Array.isArray(rows)) return;
        cleanData[monthKey] = rows.map((row, idx) => ({ ...row, id: idx + 1 }));
      });
      await pushYearsData(user.uid, cleanData);
      const settingsToSave = sanitizeForFirestore(settingsRef.current);
      await Promise.race([
        setDoc(ref, { settings: settingsToSave, updatedAt: new Date().toISOString() }, { merge: true }),
        timeoutPromise,
      ]);

      // Record sync timestamp
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const displayStr = `${dateStr} · ${timeStr}`;
      localStorage.setItem(lsSaveKey(user.uid), now.toISOString());
      localStorage.setItem(lsSyncDisplayKey(user.uid), displayStr);
      setLastSyncTime(displayStr);
      localDirtyRef.current = false;
      setSyncStatus("synced");
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch (e) {
      console.error("Sync error:", e);
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 5000);
    }
  };

  // ── Conflict resolution: Keep Local — push local data directly over cloud ──
  const resolveKeepLocal = async () => {
    setSyncConflict(null);
    setSyncStatus("syncing");
    try {
      const ref = doc(db, "users", user.uid, "logbook", "data");
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Sync timed out")), 15000)
      );
      const cleanData = {};
      Object.keys(dataRef.current).forEach(monthKey => {
        const rows = dataRef.current[monthKey];
        if (!Array.isArray(rows)) return;
        cleanData[monthKey] = rows.map((row, idx) => ({ ...row, id: idx + 1 }));
      });
      await pushYearsData(user.uid, cleanData);
      const settingsToSave = sanitizeForFirestore(settingsRef.current);
      await Promise.race([
        setDoc(ref, { settings: settingsToSave, updatedAt: new Date().toISOString() }, { merge: true }),
        timeoutPromise,
      ]);
      const now = new Date();
      const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const displayStr = `${dateStr} · ${timeStr}`;
      localStorage.setItem(lsSaveKey(user.uid), now.toISOString());
      localStorage.setItem(lsSyncDisplayKey(user.uid), displayStr);
      setLastSyncTime(displayStr);
      localDirtyRef.current = false;
      setSyncStatus("synced");
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch (e) {
      console.error("resolveKeepLocal error:", e);
      setSyncStatus("error");
      setTimeout(() => setSyncStatus("idle"), 5000);
    }
  };

  // ── Conflict resolution: Keep Cloud — pull cloud data into local ──
  const resolveKeepCloud = () => {
    if (!syncConflict?.cloudData) return;
    applyDocData(syncConflict.cloudData);
    const { logbookData, settings: cloudSettings } = syncConflict.cloudData;
    if (logbookData) localStorage.setItem(lsKey(user.uid), JSON.stringify(logbookData));
    if (cloudSettings) localStorage.setItem(lsSettingsKey(user.uid), JSON.stringify(cloudSettings));
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const displayStr = `${dateStr} · ${timeStr}`;
    localStorage.setItem(lsSaveKey(user.uid), now.toISOString());
    localStorage.setItem(lsSyncDisplayKey(user.uid), displayStr);
    setLastSyncTime(displayStr);
    localDirtyRef.current = false;
    setSyncConflict(null);
    setSyncStatus("synced");
    setTimeout(() => setSyncStatus("idle"), 3000);
  };

  // ── Save data to Firestore ──
  // Strip NaN, Infinity, and undefined — Firestore rejects all three
  const sanitizeForFirestore = (val) => {
    if (Array.isArray(val)) return val.map(sanitizeForFirestore);
    if (val !== null && typeof val === "object") {
      const out = {};
      for (const [k, v] of Object.entries(val)) {
        if (v === undefined) continue;
        out[k] = sanitizeForFirestore(v);
      }
      return out;
    }
    if (typeof val === "number" && !isFinite(val)) return 0; // NaN / Infinity → 0
    return val;
  };

  const saveData = (dataOverride) => {
    if (!user) return true;
    // Never save before loadData has completed — prevents overwriting real data with initialData() empty rows
    if (!dataLoadedRef.current) return false;

    // ── Visual: show SAVING... immediately, transition to SAVED after 1s of no edits ──
    // The actual localStorage write is instant — this is purely for user feedback.
    setSaveStatus("saving");
    clearTimeout(saveChipDebounceRef.current);
    clearTimeout(saveChipFadeRef.current);
    clearTimeout(saveChipIdleRef.current);
    saveChipDebounceRef.current = setTimeout(() => {
      setSaveStatus("saved");
      saveChipFadeRef.current = setTimeout(() => {
        setSaveStatus("fading");
        saveChipIdleRef.current = setTimeout(() => setSaveStatus("idle"), 500);
      }, 2000);
    }, 1000);

    try {
      // Regenerate IDs sequentially for each month to prevent duplicates
      const cleanData = {};
      const dataToSave = dataOverride || dataRef.current;
      Object.keys(dataToSave).forEach(monthKey => {
        const rows = dataToSave[monthKey];
        if (!Array.isArray(rows)) return;
        cleanData[monthKey] = rows.map((row, idx) => ({ ...row, id: idx + 1 }));
      });

      // Write to localStorage — instant, no network required
      // NOTE: lsSaveKey is intentionally NOT updated here — it tracks cloud sync time only,
      // not local save time. Updating it here would fool the conflict detection into thinking
      // local data is newer than Firestore, suppressing the cloud-newer banner.
      localStorage.setItem(lsKey(user.uid), JSON.stringify(cleanData));
      localStorage.setItem(lsSettingsKey(user.uid), JSON.stringify(settingsRef.current));

      // Mark local as dirty — used by conflict detection to distinguish Scenario 1 vs 2
      localDirtyRef.current = true;

      const now = new Date();
      const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setLastSaveTime(`${dateStr} · ${timeStr}`);
      return true;
    } catch (e) {
      console.error("Save error:", e);
      setSaveError(e?.message || "Unknown error");
      setSaveStatus("error");
      return false;
    }
  };

  // ── Loading screen ──
  // Inject theme CSS vars early so loading/login screens are also themed
  const themeCss = makeThemeCss(previewSettings || settings);

  // These hooks must run on every render (not skipped by the !user early
  // return below) — React requires the same hooks in the same order every
  // time. Each one already no-ops safely before login (empty pulseRowId,
  // no #root table yet), so hoisting them here changes nothing behaviorally.
  const monthKey = `${selectedMonth}-${selectedYear}`;

  // Scrolls the pulsing row into view once its month has rendered.
  useEffect(() => {
    if (pulseRowId == null) return;
    const el = document.querySelector(`[data-search-row="${pulseRowId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [pulseRowId, selectedMonth, selectedYear]);

  useEffect(() => () => { if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current); }, []);

  if (!user) {
    return (
      <>
        <style>{themeCss}</style>
        <div style={{ background: "var(--elb-bg, #0a0d12)", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--elb-font, 'Courier New', monospace)", color: "var(--elb-acc, #4fc3f7)" }}>
        <div style={{ textAlign: "center" }}>
          <img src="/brand/icons/icon-72.png" alt="ClaudeBorne" width="36" height="36" style={{ marginBottom: 12, display: "block", margin: "0 auto 12px" }} />
          <div style={{ fontSize: 13, letterSpacing: "0.2em" }}>LOADING eLOGBOOK...</div>
        </div>
      </div>
      </>
    );
  }


  const updateCell = async (rowIdx, field, value) => {
    // Aircraft type: normalise to uppercase and warn if genuinely new type
    if (field === "type" && value && value.trim()) {
      const normalized = value.trim().toUpperCase();
      // Build set of known types from all logbook data (already stored uppercase)
      const existingTypes = new Set(
        Object.values(data).flatMap(rows =>
          Array.isArray(rows)
            ? rows.map(r => (r.type || "").trim().toUpperCase()).filter(Boolean)
            : []
        )
      );
      if (existingTypes.size > 0 && !existingTypes.has(normalized)) {
        const confirmed = await showConfirm(
          `Add aircraft type "${normalized}"?`,
          `This is a new aircraft type not found in your logbook. Adding it creates a separate recency tracker for takeoff & landing recency and autoland recency. Flights logged on other types will not count toward this type's currency.`
        );
        if (!confirmed) return;
      }
      // Proceed with normalised uppercase value
      value = normalized;
    }

    setData(prev => {
      let current = [...(prev[monthKey] || makeMonthRows(selectedMonth, selectedYear))];
      // Extend stored rows if the edited row is beyond what's been saved (virtual display rows)
      while (current.length <= rowIdx) {
        current.push({ id: current.length + 1, ...EMPTY_ROW() });
      }
      // Normalize time inputs (HHMM format) to HH:MM format
      let normalizedValue = value;
      if (timeCols.includes(field) && value && value.trim()) {
        const trimmed = value.trim();
        if (!trimmed.includes(":")) {
          // Convert HHMM to HH:MM
          const digitsOnly = trimmed.replace(/\D/g, "");
          if (digitsOnly.length >= 3) {
            const h = digitsOnly.slice(0, -2).padStart(2, "0");
            const m = digitsOnly.slice(-2).padStart(2, "0");
            normalizedValue = `${h}:${m}`;
          } else if (digitsOnly.length === 2) {
            normalizedValue = `00:${digitsOnly.padStart(2, "0")}`;
          } else if (digitsOnly.length === 1) {
            normalizedValue = `0${digitsOnly}:00`;
          }
        }
        // Reject impossible flight times (hours >= 24 or minutes >= 60)
        if (normalizedValue?.includes(":")) {
          const [hh, mm] = normalizedValue.split(":").map(Number);
          if (hh >= 24 || mm >= 60) normalizedValue = "";
        }
      }
      // Normalise date input: strip month/year if user types "15/05" or "15/05/2026" — store only the day number
      // The month is already encoded in the month key; day number is all that's needed.
      if (field === "date" && normalizedValue) {
        const parts = normalizedValue.split("/");
        if (parts.length >= 2) {
          // "15/05" → "15",  "15/05/2026" → "15"
          normalizedValue = parts[0].replace(/^0+/, "") || parts[0]; // strip leading zeros except "0"
        }
        // Reject days that don't exist in the currently selected month (e.g. "31" in February)
        const dayNum = parseInt(normalizedValue, 10);
        const maxDay = getDaysInMonth(selectedMonth, selectedYear);
        if (!dayNum || dayNum < 1 || dayNum > maxDay) normalizedValue = "";
      }
      const AUTO_CAPTAIN_RANKS = ["Flight Examiner", "Flight Instructor", "Captain"];
      const updatedRow = { ...current[rowIdx], [field]: normalizedValue };
      // Multi-sector same day: copy type/markings/captain from the row directly above
      // when its date matches, but never clobber values the user already entered.
      if (field === "date" && normalizedValue && current[rowIdx - 1]?.date === normalizedValue) {
        const prevRow = current[rowIdx - 1];
        ["type", "markings", "captain"].forEach(f => {
          if (!updatedRow[f] && prevRow[f]) updatedRow[f] = prevRow[f];
        });
      }
      if (field === "date" && normalizedValue && AUTO_CAPTAIN_RANKS.includes(settingsRef.current.defaultRank) && !updatedRow.captain) {
        updatedRow.captain = "SELF";
      }
      const newRows = current.map((r, i) => i === rowIdx ? updatedRow : r);
      return { ...prev, [monthKey]: newRows };
    });
  };

  const deleteRow = (rowIdx) => {
    setData(prev => {
      const current = prev[monthKey] || makeMonthRows(selectedMonth, selectedYear);
      const newRows = current.filter((_, i) => i !== rowIdx);
      const finalRows = newRows.length > 0 ? newRows : [{ id: 1, ...EMPTY_ROW() }];
      return { ...prev, [monthKey]: finalRows };
    });
  };

  const addSector = () => {
    setData(prev => {
      const current = prev[monthKey] || makeMonthRows(selectedMonth, selectedYear);
      // Always strictly higher than any existing id — current.length + 1 alone
      // can collide once a row's been deleted (ids aren't renumbered on delete).
      const newId = Math.max(0, ...current.map(r => r.id)) + 1;
      const seeded = {
        ...EMPTY_ROW(),
        type:     settings.defaultAircraftType || "",
        markings: settings.defaultMarkings     || "",
        captain:  settings.defaultCaptain      || "",
      };
      return { ...prev, [monthKey]: [...current, { id: newId, ...seeded }] };
    });
  };

  const handleMonthChange = (newMonthIdx) => {
    setSelectedMonth(newMonthIdx);
    setEditingCell(null);
    setExpandedRowIdx(null);
    setConfirmDeleteRowIdx(null);
  };

  const handleYearChange = (newYear) => {
    setSelectedYear(newYear);
    setEditingCell(null);
    setExpandedRowIdx(null);
    setConfirmDeleteRowIdx(null);
  };

  const goToToday = () => {
    const now = new Date();
    setSelectedMonth(now.getMonth());
    setSelectedYear(now.getFullYear());
    setEditingCell(null);
    setExpandedRowIdx(null);
    setConfirmDeleteRowIdx(null);
  };
  const isCurrentPeriod = selectedMonth === new Date().getMonth() && selectedYear === new Date().getFullYear();

  const stepMonth = (delta) => {
    let newMonth = selectedMonth + delta;
    let newYear = selectedYear;
    if (newMonth < 0) { newMonth = 11; newYear -= 1; }
    else if (newMonth > 11) { newMonth = 0; newYear += 1; }
    if (newYear < YEARS[0] || newYear > YEARS[YEARS.length - 1]) return;
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
    setEditingCell(null);
    setExpandedRowIdx(null);
    setConfirmDeleteRowIdx(null);
  };
  const isFirstPeriod = selectedYear === YEARS[0] && selectedMonth === 0;
  const isLastPeriod = selectedYear === YEARS[YEARS.length - 1] && selectedMonth === 11;

  // Jumps to a search result's month/year and briefly pulses its row.
  const handleSearchJump = (hit) => {
    setSelectedMonth(hit.monthIdx);
    setSelectedYear(hit.year);
    setEditingCell(null);
    setExpandedRowIdx(null);
    setConfirmDeleteRowIdx(null);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    setPulseRowId(hit.row.id);
    pulseTimerRef.current = setTimeout(() => setPulseRowId(null), 3500);
  };

  const settingsButtonTitle = update.needRefresh ? "Settings · update available" : "Settings";


  // ── Toolbar sync chips — Cloud + Duty Log, computed fresh each render ──
  const cloudChipState = syncStatus === "syncing" ? "busy" : syncStatus === "error" ? "bad" : "ok";
  // syncStatus sits at "synced"/"error" only for the transient window checkCloudSync/syncData
  // hold it there before reverting to "idle" — reuse that window as the flash trigger directly.
  const cloudChipFlash = syncStatus === "synced" || syncStatus === "error";
  const cloudChipCompact = cloudChipState === "busy" ? "…" : timeOnly(lastSyncTime);
  const cloudChipFull = cloudChipState === "bad"
    ? `Sync failed${lastSyncTime ? ` — last OK ${lastSyncTime}` : ""}`
    : lastSyncTime ? `Cloud sync — ${lastSyncTime}` : "Not synced yet";

  const dutyLogChipState = dutyLogStatus.state === "loading" ? "busy"
    : ["invalid", "not-found", "error"].includes(dutyLogStatus.state) ? "bad"
    : "ok";
  const dutyLogChipCompact = dutyLogChipState === "busy" ? "…" : timeOnly(lastDutyLogCheckTime);
  const dutyLogReasonText = {
    invalid: "Invalid code",
    "not-found": "No backup found",
    error: "Couldn't reach server",
  }[dutyLogStatus.state];
  const dutyLogChipFull = dutyLogChipState === "bad"
    ? `Duty Log — ${dutyLogReasonText}${lastDutyLogCheckTime ? ` · last OK ${lastDutyLogCheckTime}` : ""}`
    : lastDutyLogCheckTime
      ? `Duty Log — ${lastDutyLogCheckTime}${dutyLogStatus.count != null ? ` · ${dutyLogStatus.count} log${dutyLogStatus.count === 1 ? "" : "s"} found` : ""}`
      : "Checking…";

  const saveChipState = saveStatus === "saving" ? "busy" : saveStatus === "error" ? "bad" : "ok";
  const saveChipFlash = saveStatus === "saved";
  const saveChipCompact = saveChipState === "busy" ? "…" : timeOnly(lastSaveTime);
  const saveChipFull = saveChipState === "bad"
    ? "Save failed — click to retry"
    : lastSaveTime ? `Saved to local storage — ${lastSaveTime}` : "Not saved yet";

  // Sync status chips — shared between the phone-only chip row and the
  // desktop/tablet period row (where they sit right-aligned next to the
  // month/year picker) so there's one source of truth for both.
  const syncChipsGroup = (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <ToolbarSyncChip
        state={saveChipState}
        flash={saveChipFlash}
        identityColor="#22c55e"
        compact={saveChipCompact}
        full={saveChipFull}
        onActivate={() => { if (saveChipState === "bad") saveData(data); }}
        icon={
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
          </svg>
        }
      />
      {isOnline && (
        <ToolbarSyncChip
          state={cloudChipState}
          flash={cloudChipFlash}
          identityColor="#3FE0C5"
          compact={cloudChipCompact}
          full={cloudChipFull}
          icon={
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
            </svg>
          }
        />
      )}
      {isOnline && settings.dutyLogSyncCode && (
        <ToolbarSyncChip
          state={dutyLogChipState}
          flash={dutyLogFlash}
          identityColor="#fb923c"
          compact={dutyLogChipCompact}
          full={dutyLogChipFull}
          icon={
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="3" width="16" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/>
            </svg>
          }
        />
      )}
    </div>
  );

  // Month/year selects — shared between the desktop period row and the phone
  // merged row (see elb-iconrow-desktop / elb-merged-phone below) so there's
  // only one set of handlers, even though it renders in two DOM locations.
  // `abbreviateMonth` shortens the option labels for the phone merged row,
  // where the full month name plus the icon toolbar doesn't fit one line.
  const renderMonthYearSelects = (abbreviateMonth) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <select value={selectedMonth} onChange={e => handleMonthChange(Number(e.target.value))} style={selectStyle}>
        {MONTHS.map((m, i) => <option key={i} value={i}>{(abbreviateMonth ? m.slice(0, 3) : m).toUpperCase()}</option>)}
      </select>
      <select value={selectedYear} onChange={e => handleYearChange(Number(e.target.value))} style={{ ...selectStyle, minWidth: 90 }}>
        {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
  const monthYearSelects = renderMonthYearSelects(false);
  const monthYearSelectsPhone = renderMonthYearSelects(true);

  // Icon toolbar buttons — shared between the desktop position (top-right,
  // next to the title) and the phone merged row (next to the month/year
  // selects, with the nav arrows/today button dropped for space).
  const iconButtonsRow = (
    <>
      {refreshStatus === "refreshing" && (
        <span style={{ fontSize: 11, color: "#f5c542", letterSpacing: "0.1em", fontWeight: 700 }}>REFRESHING...</span>
      )}
      {/* Offline indicator */}
      {!isOnline && (
        <span style={{ fontSize: 11, color: "#f5c542", letterSpacing: "0.1em", fontWeight: 700, background: "rgba(245,197,66,0.1)", border: "1px solid rgba(245,197,66,0.3)", borderRadius: 3, padding: "2px 8px" }}>
          ✈ OFFLINE
        </span>
      )}
      {/* SYNC button */}
      <button
        onClick={syncData}
        disabled={syncStatus === "syncing" || !isOnline}
        title={!isOnline ? "Offline — connect to sync" : syncStatus === "syncing" ? "Syncing…" : "Sync to cloud"}
        style={{
          ...iconBtnStyle,
          color: !isOnline ? "#2a4a6a" : syncStatus === "synced" ? "#22c55e" : syncStatus === "error" ? "#ef4444" : syncStatus === "syncing" ? "#f5c542" : "#3FE0C5",
          borderColor: !isOnline ? "#1e3a5f" : syncStatus === "synced" ? "#22c55e" : syncStatus === "error" ? "#ef4444" : syncStatus === "syncing" ? "#f5c542" : "#1e3a5f",
          opacity: (syncStatus === "syncing" || !isOnline) ? 0.4 : 1,
          cursor: (syncStatus === "syncing" || !isOnline) ? "not-allowed" : "pointer",
        }}
      >
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ animation: syncStatus === "syncing" ? "spin 1s linear infinite" : "none" }}
        >
          <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
      </button>
      {/* Search */}
      <button onClick={() => setSearchOpen(true)} title="Search logbook" style={iconBtnStyle}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </button>
      {/* Export/Import */}
      <button onClick={() => setExportImportOpen(true)} title="Export / Import" style={iconBtnStyle}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          <polyline points="18 7 23 7 23 9"/>
          <line x1="23" y1="8" x2="16" y2="8"/>
          <polyline points="6 17 1 17 1 15"/>
          <line x1="1" y1="16" x2="8" y2="16"/>
        </svg>
      </button>
      {/* Route Map */}
      <button onClick={() => setRouteMapOpen(true)} title="Route map" style={iconBtnStyle}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z"/>
          <path d="M8 2v16"/>
          <path d="M16 6v16"/>
        </svg>
      </button>
      {/* Settings */}
      <button
        onClick={() => { setSettingsInitialTab(null); setSettingsOpen(true); }}
        title={settingsButtonTitle}
        style={{
          ...iconBtnStyle,
          color: settingsOpen ? "#4fc3f7" : "#3FE0C5",
          borderColor: settingsOpen ? "#4fc3f7" : "#1e3a5f",
          background: settingsOpen ? "rgba(79,195,247,0.1)" : "transparent",
          position: "relative",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        {update.needRefresh && (
          <span style={{
            position: "absolute", top: -3, left: -3,
            width: 9, height: 9, borderRadius: "50%",
            background: "#3FE0C5",
            border: "1px solid var(--elb-bg, #0a0d12)",
          }} />
        )}
      </button>
      {/* Sign Out */}
      <button
        onClick={onLogout}
        title="Sign out"
        style={{
          ...iconBtnStyle,
          color: "#3FE0C5",
          borderColor: "var(--elb-border, #1e3a5f)",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--elb-border, #1e3a5f)"; e.currentTarget.style.color = "#3FE0C5"; }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </button>
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
    <div className="elb-app-root" style={{
      background: "var(--elb-bg, #0a0d12)",
      minHeight: "100vh",
      overflowX: "hidden",
      fontFamily: "var(--elb-font, 'Courier New', Courier, monospace)",
      color: "var(--elb-txt, #c8d6e5)",
      filter: ((previewSettings || settings).theme === "dark" && Number((previewSettings || settings).brightness) > 0 && Number((previewSettings || settings).brightness) < 100)
        ? `brightness(${(previewSettings || settings).brightness}%)`
        : undefined,
    }}>
      <style>{`
        @keyframes spin      { from { transform: rotate(0deg);   } to { transform: rotate(360deg); } }
        @keyframes fadeIn    { from { opacity: 0;                } to { opacity: 1;                } }
        @keyframes blink     { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes popIn     { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:scale(1); } }
        @keyframes cb-pulse  { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(0.75); } }
        @keyframes row-pulse { 0%, 100% { background-color: transparent; }
                                15%, 55% { background-color: rgba(79,195,247,0.5); }
                                35%, 75% { background-color: rgba(79,195,247,0.08); } }
        ${themeCss}
        /* ── Topbar responsive ── */
        .elb-topbar {
          overflow: hidden;
        }
        .elb-topbar-brand {
          flex: 0 0 auto;
          min-width: 0;
        }
        .elb-topbar-right {
          flex: 0 0 auto;
          min-width: 0;
        }
        .elb-topbar-usertext {
          min-width: 0;
          overflow: hidden;
        }
        .elb-topbar-username {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
          display: block;
        }
        .elb-pageheader {
          gap: 6px;
        }
        .elb-iconrow-desktop { display: flex; }
        .elb-pageheader-period { display: flex; }
        .elb-merged-phone { display: none; }
        .elb-chiprow-phone { display: none; }
        @media (max-width: 640px) {
          .elb-topbar-caam { display: none; }
          .elb-topbar-username { max-width: clamp(80px, 32vw, 180px); }
          .elb-pageheader-top { flex-direction: column; }
          .elb-pageheader-right { width: 100%; }
          .elb-pageheader { gap: 2px; }
          .elb-iconrow-desktop { display: none; }
          .elb-pageheader-period { display: none; }
          .elb-merged-phone { display: flex; }
          .elb-chiprow-phone { display: flex; }
          .elb-merged-phone button { padding: 4px 5px !important; }
          .elb-merged-phone svg { width: 14px !important; height: 14px !important; }
          .elb-merged-phone select { padding: 4px 6px !important; font-size: 13px !important; min-width: 60px !important; }
          .elb-app-root { display: flex; flex-direction: column; }
          .elb-app-main { flex: 1; min-height: 0; }
          .elb-footer-active-period { display: none; }
        }
        /* Desktop-only sticky footer: pins the footer to the bottom of the
           viewport instead of it trailing after a block of empty space when
           the table content doesn't fill a tall screen. iPad/tablet (up to
           1024px) and phone keep the plain document-flow footer. */
        @media (min-width: 1025px) {
          .elb-app-root { display: flex; flex-direction: column; }
          .elb-app-main { flex: 1; min-height: 0; }
        }
      `}</style>

      {/* Desktop-only (>=1025px) sticky-footer wrapper — pins the footer to the
          bottom of the viewport instead of leaving it stranded above a block of
          empty space when the table content is shorter than the screen. Tablet
          (iPad) and phone are unaffected — see .elb-app-main media query below. */}
      <div className="elb-app-main">

      {/* ── TOPBAR ── */}
      <div className="elb-topbar" style={{
        background: "var(--cb-surface-0, #0a1020)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        height: 60,
        paddingTop: "env(safe-area-inset-top, 0px)",
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
      }}>
        {/* LEFT: Brand banner with corner chevrons */}
        <div className="elb-topbar-brand" style={{ alignSelf: "stretch", display: "flex", alignItems: "center", flexShrink: 0 }}>
          <BrandBanner subtitle="PILOT eLOGBOOK" />
        </div>

        {/* RIGHT: User info + avatar */}
        <div className="elb-topbar-right" style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto", paddingRight: 20 }}>
          <div className="elb-topbar-usertext" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
            <span className="elb-topbar-username" style={{
              fontFamily: "'Tourney',system-ui,sans-serif",
              fontWeight: 700, fontSize: 12, letterSpacing: "0.14em",
              color: "var(--elb-txt,#e8f4fd)", lineHeight: 1,
            }}>
              {(settings.fullName || user.displayName || user.email || "").toUpperCase()}
            </span>
            {(settings.airline || settings.licenceType || settings.licenceNumber) && (
              <span style={{
                fontFamily: "'JetBrains Mono','Courier New',monospace",
                fontSize: 9, letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.30)", lineHeight: 1,
              }}>
                {[settings.airline, [settings.licenceType, settings.licenceNumber].filter(Boolean).join("/")].filter(Boolean).join(" · ").toUpperCase()}
              </span>
            )}
          </div>
          {user.photoURL ? (
            <img src={user.photoURL} alt="avatar" style={{ width: 30, height: 30, borderRadius: "50%", border: "1.5px solid #3FE0C5", flexShrink: 0 }} />
          ) : (
            <div style={{
              width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg,#3FE0C5 0%,#3B8DFF 55%,#5B6BFF 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Tourney',system-ui,sans-serif", fontWeight: 700, fontSize: 14, color: "#0a1020",
            }}>
              {(settings.fullName || user.displayName || user.email || "?")[0].toUpperCase()}
            </div>
          )}
        </div>
      </div>

      {/* ── PAGE HEADER ── */}
      <div className="elb-pageheader" style={{
        background: "linear-gradient(135deg, var(--elb-bghd,#0d1117) 0%, var(--elb-bgalt,#161d2a) 100%)",
        borderBottom: "1px solid var(--elb-bdr,#1e3a5f)",
        padding: "18px 24px",
        display: "flex", flexDirection: "column",
        flexShrink: 0,
      }}>
        <div className="elb-pageheader-top" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        {/* LEFT: Title */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.22em", lineHeight: 1 }}>
            <span style={{ fontFamily: "'Tourney',system-ui,sans-serif", fontWeight: 700, fontSize: 36, letterSpacing: "0.02em", color: "var(--elb-txt,#e8f4fd)" }}>{MONTHS[selectedMonth]}</span>
            <span style={{ fontFamily: "'Tourney',system-ui,sans-serif", fontWeight: 700, fontSize: 36, letterSpacing: "0.02em", background: "linear-gradient(135deg,#3FE0C5 0%,#3B8DFF 55%,#5B6BFF 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>{selectedYear}</span>
          </div>
        </div>

        {/* RIGHT: sync/utility toolbar + save chip */}
        <div className="elb-pageheader-right" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          {/* Icon buttons row — desktop/tablet position; hidden on phone, see elb-merged-phone below */}
          <div className="elb-iconrow-desktop" style={{ gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
            {iconButtonsRow}
          </div>
        </div>
        </div>

        {/* PHONE-ONLY: month/year selects + icon toolbar merged into one row (nav arrows/today dropped for space) */}
        <div className="elb-merged-phone" style={{ alignItems: "center", justifyContent: "space-between", columnGap: 4, rowGap: 8, flexWrap: "wrap" }}>
          {monthYearSelectsPhone}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {iconButtonsRow}
          </div>
        </div>

        {/* PHONE-ONLY: sync chips get their own row (desktop/tablet render them inside the period row below, next to the month/year picker) */}
        <div className="elb-chiprow-phone" style={{ justifyContent: "flex-end", alignItems: "center", marginTop: 12 }}>
          {syncChipsGroup}
        </div>

        {/* PERIOD ROW (desktop/tablet only): prev/next month + month/year selects + today, left; sync chips, right */}
        <div className="elb-pageheader-period" style={{ alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={() => stepMonth(-1)}
              disabled={isFirstPeriod}
              title="Previous month"
              style={{
                ...iconBtnStyle,
                color: isFirstPeriod ? "#3a4a5a" : "#3FE0C5",
                opacity: isFirstPeriod ? 0.4 : 1,
                cursor: isFirstPeriod ? "not-allowed" : "pointer",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            {monthYearSelects}
            <button
              onClick={() => stepMonth(1)}
              disabled={isLastPeriod}
              title="Next month"
              style={{
                ...iconBtnStyle,
                color: isLastPeriod ? "#3a4a5a" : "#3FE0C5",
                opacity: isLastPeriod ? 0.4 : 1,
                cursor: isLastPeriod ? "not-allowed" : "pointer",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            {activeTab === "logbook" && (
              <button
                onClick={goToToday}
                disabled={isCurrentPeriod}
                title="Go to today"
                style={{
                  ...iconBtnStyle,
                  color: isCurrentPeriod ? "#3a4a5a" : "#3FE0C5",
                  borderColor: isCurrentPeriod ? "var(--elb-border, #1e3a5f)" : "#1e3a5f",
                  opacity: isCurrentPeriod ? 0.4 : 1,
                  cursor: isCurrentPeriod ? "not-allowed" : "pointer",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </button>
            )}
          </div>
          {syncChipsGroup}
        </div>

        </div>

        {/* ── TABS ── */}
        {/* Scroll clipping lives on this outer wrapper only — the inner row (below)
            needs to stay unclipped so the active tab's -1px bleed can actually
            paint over the divider instead of being cut off by overflow. */}
        <div style={{ overflowX: "auto", overflowY: "hidden" }}>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", borderBottom: "1px solid var(--elb-border, #1e3a5f)" }}>
          {[
            { id: "logbook",  icon: <TabLogbookIcon />, label: "LOGBOOK" },
            { id: "summary",  icon: <TabSummaryIcon />, label: "FLIGHT SUMMARY" },
            { id: "ftl",      icon: <TabLimitsIcon />,  label: "LIMITS & RECENCY" },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: activeTab === tab.id ? "var(--elb-bg, #0a0d12)" : "transparent",
              borderTop: activeTab === tab.id ? "2px solid var(--elb-acc, #4fc3f7)" : "1px solid var(--elb-border, #1e3a5f)",
              borderLeft: "1px solid var(--elb-border, #1e3a5f)",
              borderRight: "1px solid var(--elb-border, #1e3a5f)",
              borderBottom: activeTab === tab.id ? "1px solid var(--elb-bg, #0a0d12)" : "1px solid var(--elb-border, #1e3a5f)",
              borderRadius: "5px 5px 0 0",
              color: activeTab === tab.id ? "var(--elb-acc, #4fc3f7)" : "var(--elb-txt-muted, #5a7a9a)",
              padding: "7px 18px",
              fontSize: 13,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontFamily: "var(--elb-font, 'Courier New', monospace)",
              marginBottom: activeTab === tab.id ? "-1px" : 0,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}>{tab.icon}{tab.label}</button>
          ))}
        </div>
        </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: "18px 24px" }}>

        {/* ── LOGBOOK TAB ── */}
        {activeTab === "logbook" && (
          <LogbookTab
            data={data}
            settings={settings}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            editingCell={editingCell}
            setEditingCell={setEditingCell}
            expandedRowIdx={expandedRowIdx}
            setExpandedRowIdx={setExpandedRowIdx}
            confirmDeleteRowIdx={confirmDeleteRowIdx}
            setConfirmDeleteRowIdx={setConfirmDeleteRowIdx}
            pulseRowId={pulseRowId}
            setActivePopup={setActivePopup}
            updateCell={updateCell}
            deleteRow={deleteRow}
            addSector={addSector}
            findDutyLogMatch={findDutyLogMatch}
          />
        )}

        {/* ── SUMMARY TAB ── */}
        {activeTab === "summary" && (
          <FlightSummaryTab
            data={data}
            settings={settings}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            setSelectedMonth={setSelectedMonth}
            setSelectedYear={setSelectedYear}
            setActiveTab={setActiveTab}
          />
        )}

        {/* ── FTL & RECENCY TAB ── */}
        {activeTab === "ftl" && (
          <LimitsRecencyTab
            data={data}
            settings={settings}
            setActivePopup={setActivePopup}
          />
        )}
      </div>

      {/* ── REGULATORY REFERENCE POPUP ── */}
      {activePopup && (() => {
        const p = FTL_POPUPS[activePopup];
        if (!p) return null;
        return (
          <div
            onClick={e => { if (e.target === e.currentTarget) setActivePopup(null); }}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.68)",
              zIndex: 1000,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 20,
            }}
          >
            <div style={{
              background: "var(--cb-surface-1, #141a2e)",
              border: "1px solid var(--cb-line-2, #1e3a5f)",
              borderTop: "2px solid var(--cb-accent, #4fc3f7)",
              borderRadius: 6,
              padding: "20px 22px 18px",
              maxWidth: 480, width: "100%",
              boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
              animation: "popIn 0.15s ease",
              fontFamily: "var(--elb-font, 'Courier New', monospace)",
            }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "var(--elb-hint-sz)", letterSpacing: "0.16em", color: "var(--cb-accent, #4fc3f7)", marginBottom: 5, textAlign: "left" }}>{p.para}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cb-ink, #e8ecf5)", letterSpacing: "0.07em", lineHeight: 1.45, textAlign: "left" }}>{p.title}</div>
                </div>
                <button
                  onClick={() => setActivePopup(null)}
                  style={{
                    background: "transparent", border: "1px solid var(--cb-line-2, #1e3a5f)", borderRadius: 3,
                    color: "var(--cb-ink-dim, #7c87a3)", fontFamily: "var(--elb-font, 'Courier New', monospace)", fontSize: 12,
                    width: 22, height: 22, cursor: "pointer", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--cb-line-2, #1e3a5f)"; e.currentTarget.style.color = "var(--cb-ink-dim, #7c87a3)"; }}
                >✕</button>
              </div>
              <div style={{ height: 1, background: "var(--cb-line-2, #1e3a5f)", marginBottom: 14 }} />
              {/* Body */}
              <div
                style={{ fontSize: "var(--elb-desc-sz)", color: "var(--cb-ink-2, #b8c0d4)", lineHeight: 1.9, letterSpacing: "0.03em", textAlign: "left" }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(p.body) }}
              />
              {/* Note */}
              {p.note && (
                <div
                  style={{
                    marginTop: 14, padding: "9px 12px",
                    background: "rgba(79,195,247,0.06)",
                    borderLeft: "2px solid var(--cb-accent, #4fc3f7)",
                    borderRadius: "0 3px 3px 0",
                    fontSize: "var(--elb-hint-sz)", color: "var(--cb-ink-2, #b8c0d4)", lineHeight: 1.75, letterSpacing: "0.03em", textAlign: "left",
                  }}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(p.note) }}
                />
              )}
            </div>
          </div>
        );
      })()}

      {/* ── AUTOSAVE ERROR MODAL ── */}
      {saveStatus === "error" && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setSaveStatus("idle"); setSaveError(""); } }}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.72)",
            zIndex: 3000,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <div style={{
            background: "var(--cb-surface-1, #141a2e)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderTop: "2px solid #ef4444",
            borderRadius: 6,
            padding: "20px 22px 18px",
            maxWidth: 420, width: "100%",
            boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
            animation: "popIn 0.15s ease",
            fontFamily: "var(--elb-font, 'Courier New', monospace)",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: "var(--elb-hint-sz)", letterSpacing: "0.16em", color: "#ef4444", marginBottom: 5 }}>SAVE ERROR</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cb-ink, #e8ecf5)", letterSpacing: "0.07em" }}>SAVE FAILED</div>
              </div>
              <button
                onClick={() => { setSaveStatus("idle"); setSaveError(""); }}
                style={{
                  background: "transparent", border: "1px solid var(--cb-line-2, #1e3a5f)", borderRadius: 3,
                  color: "var(--cb-ink-dim, #7c87a3)", fontFamily: "var(--elb-font, 'Courier New', monospace)", fontSize: 12,
                  width: 22, height: 22, cursor: "pointer", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--cb-line-2, #1e3a5f)"; e.currentTarget.style.color = "var(--cb-ink-dim, #7c87a3)"; }}
              >✕</button>
            </div>
            <div style={{ height: 1, background: "rgba(239,68,68,0.2)", marginBottom: 14 }} />
            {/* Message */}
            <div style={{ fontSize: 13, color: "var(--cb-ink-2, #b8c0d4)", lineHeight: 1.7, marginBottom: 14 }}>
              Could not save to the cloud. Your local changes are preserved — use Retry to try again.
              {saveError && (
                <div style={{ marginTop: 8, fontSize: 11, color: "var(--cb-ink-dim, #7c87a3)", fontFamily: "var(--elb-font, 'Courier New', monospace)", letterSpacing: "0.05em" }}>
                  {saveError}
                </div>
              )}
            </div>
            {/* Action Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => { setSaveStatus("idle"); setSaveError(""); }}
                style={{
                  background: "transparent", border: "1px solid var(--cb-line-2, #1e3a5f)", borderRadius: 4,
                  color: "var(--cb-ink-dim, #7c87a3)", fontFamily: "var(--elb-font, 'Courier New', monospace)",
                  fontSize: 11, letterSpacing: "0.12em", padding: "6px 16px", cursor: "pointer",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--cb-accent, #4fc3f7)"; e.currentTarget.style.color = "var(--cb-accent, #4fc3f7)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--cb-line-2, #1e3a5f)"; e.currentTarget.style.color = "var(--cb-ink-dim, #7c87a3)"; }}
              >DISMISS</button>
              <button
                onClick={() => { setSaveStatus("dirty"); saveData(data); }}
                style={{
                  background: "rgba(239,68,68,0.10)", border: "1px solid #ef4444", borderRadius: 4,
                  color: "#ef4444", fontFamily: "var(--elb-font, 'Courier New', monospace)",
                  fontSize: 11, letterSpacing: "0.12em", padding: "6px 20px", cursor: "pointer",
                  fontWeight: 700,
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.18)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.10)"}
              >↺ RETRY</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SETTINGS MODAL ── */}
      <SettingsModal
        open={settingsOpen}
        initialTab={settingsInitialTab}
        onClose={() => { setSettingsOpen(false); setPreviewSettings(null); setSettingsInitialTab(null); }}
        settings={settings}
        onSave={saveSettings}
        dutyLogStatus={dutyLogStatus}
        onPreview={setPreviewSettings}
        userEmail={user?.email}
        onDeleteAccount={onDeleteAccount}
        onReauthAndDelete={onReauthAndDelete}
        onReauthAndDeleteGoogle={onReauthAndDeleteGoogle}
        onReauthAndDeleteGooglePopup={onReauthAndDeleteGooglePopup}
        userProvider={userProvider}
        onFeedback={() => setFeedbackOpen(true)}
        onGuide={() => setGuideOpen(true)}
        needRefresh={update.needRefresh}
        updateServiceWorker={update.updateServiceWorker}
        checkForUpdate={update.checkForUpdate}
        checkingUpdate={update.checkingUpdate}
        updateChecked={update.updateChecked}
        currentBuildVersion={update.current.version}
      />

      {/* ── BRANDED CONFIRM DIALOG (replaces window.confirm) ── */}
      {confirmDialog && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 3000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          fontFamily: "var(--elb-font, 'Courier New', monospace)",
        }}>
          <div style={{
            background: "var(--elb-bg2, #141a2e)", border: "1px solid var(--elb-border, #1a3050)",
            borderTop: "2px solid var(--elb-acc, #3FE0C5)", borderRadius: 4,
            width: "100%", maxWidth: 420, padding: "24px 24px 20px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.85)",
          }}>
            <div style={{ fontSize: "var(--elb-th-sz)", letterSpacing: "0.1em", color: "var(--elb-acc, #3FE0C5)", marginBottom: 8 }}>
              CONFIRM ACTION
            </div>
            <div style={{ fontSize: "var(--elb-td-sz)", fontWeight: 700, color: "var(--elb-txt, #e8ecf5)", marginBottom: 12, letterSpacing: "0.04em" }}>
              {confirmDialog.title}
            </div>
            <div style={{ fontSize: "var(--elb-hint-sz)", color: "var(--elb-txt-muted, #b8c0d4)", lineHeight: 1.7, marginBottom: 20 }}>
              {confirmDialog.body}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={handleConfirmNo} style={{
                background: "transparent", border: "1px solid var(--elb-border, #1a3050)",
                color: "var(--elb-txt-muted, #b8c0d4)", fontFamily: "inherit",
                fontSize: "var(--elb-hint-sz)", letterSpacing: "0.1em", padding: "7px 18px",
                cursor: "pointer", borderRadius: 3,
              }}>CANCEL</button>
              <button onClick={handleConfirmYes} style={{
                background: "rgba(63,224,197,0.1)", border: "1px solid var(--elb-acc, #3FE0C5)",
                color: "var(--elb-acc, #3FE0C5)", fontFamily: "inherit",
                fontSize: "var(--elb-hint-sz)", letterSpacing: "0.1em", padding: "7px 18px",
                cursor: "pointer", borderRadius: 3, fontWeight: 700,
              }}>CONFIRM</button>
            </div>
          </div>
        </div>
      )}

      {/* ── EXPORT/IMPORT MODAL ── */}
      <ExportImportModal
        open={exportImportOpen}
        onClose={() => setExportImportOpen(false)}
        monthData={data}
        settings={settings}
        user={user}
        onImport={handleImport}
        computeFlightTimes={(row, year, monthIdx) => calcFlightTimes(row, settings.dayNightMethod, year, monthIdx)}
      />

      {/* ── SEARCH MODAL ── */}
      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        monthData={data}
        dutyLogEntries={dutyLogEntries}
        onJumpTo={handleSearchJump}
      />

      {/* ── ROUTE MAP MODAL ── */}
      <RouteMapModal
        open={routeMapOpen}
        onClose={() => setRouteMapOpen(false)}
        monthData={data}
      />

      {/* ── FEEDBACK MODAL ── */}
      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        user={user}
      />

      {/* ── HOW-TO GUIDE MODAL ── */}
      <HowToGuideModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        version={APP_VERSION}
      />


      {/* ── SYNC CONFLICT MODAL ── */}
      {/* Shown when Firestore has newer data than this device's last sync. Fully blocking by
          design — no dismiss, no click-outside, no Escape — a wrong guess here loses real data,
          so unlike the update toast there's no safe default/countdown; the user must choose. */}
      {syncConflict && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)", zIndex: 4000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div style={{
            width: "min(360px, 100%)",
            background: "var(--cb-surface-1, #141a2e)",
            border: "1px solid rgba(245,197,66,0.3)",
            borderRadius: 10, padding: "18px 18px 16px",
            boxShadow: "0 20px 56px rgba(0,0,0,0.55)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                background: "#f5c542", boxShadow: "0 0 0 3px rgba(245,197,66,0.2)",
              }} />
              <span style={{
                fontFamily: "var(--elb-font, 'Courier New', monospace)", fontSize: 10,
                letterSpacing: "0.14em", color: "#f5c542", textTransform: "uppercase",
              }}>
                Sync conflict
              </span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cb-ink, #e8ecf5)", letterSpacing: "0.02em", marginBottom: 10 }}>
              Cloud has newer data
            </div>
            <div style={{ fontSize: 12.5, color: "var(--cb-ink-2, #b8c0d4)", lineHeight: 1.6, marginBottom: 16 }}>
              Another device synced after your last sync here. Pick which version to keep — the other will be overwritten.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={resolveKeepLocal}
                style={{
                  flex: 1, background: "transparent", border: "1px solid var(--cb-line-2, #1e3a5f)", borderRadius: 6,
                  color: "var(--cb-ink-dim, #7c87a3)", fontFamily: "var(--elb-font, 'Courier New', monospace)",
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                  padding: "10px 0", cursor: "pointer", opacity: 0.7,
                }}
              >Keep local</button>
              <button
                onClick={resolveKeepCloud}
                style={{
                  flex: 1, background: "#f5c542", border: "none", borderRadius: 6,
                  color: "#241a03", fontFamily: "var(--elb-font, 'Courier New', monospace)",
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                  padding: "10px 0", cursor: "pointer",
                }}
              >Keep cloud</button>
            </div>
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontFamily: "var(--elb-font, 'Courier New', monospace)", fontSize: 9.5,
              color: "var(--cb-ink-dim, #7c87a3)", marginTop: 12, paddingTop: 10,
              borderTop: "1px solid rgba(255,255,255,0.07)",
            }}>
              <span>LOCAL SYNCED · {lastSyncTime || "—"}</span>
              <span>CLOUD UPDATED · {syncConflict.cloudData?.updatedAt
                ? new Date(syncConflict.cloudData.updatedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + " · " + new Date(syncConflict.cloudData.updatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
                : "—"}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── PWA UPDATE PROMPT ── */}
      {/* Toast is non-blocking so it can show any time; isBusy only defers the automatic countdown-fire, not a manual click */}
      <UpdatePrompt
        ready={updateReady}
        update={update}
        isBusy={saveStatus === "saving"}
      />

      {/* ── MIGRATION OVERLAY ── */}
      {/* Shown once on first load when pulling existing data from Firestore into localStorage */}
      {migrating && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(10,16,32,0.92)", zIndex: 5000,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--elb-font, 'Courier New', monospace)",
        }}>
          <div style={{ textAlign: "center", color: "var(--elb-acc, #3FE0C5)" }}>
            <img src="/brand/icons/icon-72.png" alt="ClaudeBorne" width="40" height="40" style={{ display: "block", margin: "0 auto 14px" }} />
            <div style={{ fontSize: 13, letterSpacing: "0.18em", marginBottom: 8 }}>MIGRATING YOUR DATA</div>
            <div style={{ fontSize: 11, letterSpacing: "0.1em", color: "#7c87a3" }}>
              One-time setup · Your logbook is moving to local storage
            </div>
          </div>
        </div>
      )}

      </div>
      {/* ── FOOTER ── */}
      <div style={{
        padding: "10px 24px",
        borderTop: "1px solid #111820",
        fontSize: 11,
        color: "#2a4a6a",
        letterSpacing: "0.12em",
        display: "flex",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 8,
      }}>
        <span>eLOGBOOK {APP_VERSION} · CAAM</span>
        <span>CAD 1901 · MCAR 2016 Part 69 &amp; Part 74</span>
        <span className="elb-footer-active-period">{MONTHS[selectedMonth].toUpperCase()} {selectedYear} ACTIVE</span>
      </div>
    </div>
    </>
  );
}

const iconBtnStyle = {
  background: "transparent",
  border: "1px solid var(--elb-border, #1e3a5f)",
  borderRadius: 4,
  color: "#3FE0C5",
  cursor: "pointer",
  padding: "5px 7px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "color 0.15s, border-color 0.15s",
};

const selectStyle = {
  background: "var(--elb-bg2, #0d1520)",
  border: "1px solid var(--elb-border, #1e3a5f)",
  borderRadius: 4,
  color: "var(--elb-acc, #4fc3f7)",
  fontSize: 15,
  fontFamily: "'Courier New', monospace",
  fontWeight: 700,
  padding: "6px 10px",
  letterSpacing: "0.08em",
  cursor: "pointer",
  outline: "none",
  minWidth: 140,
  colorScheme: "dark",
};

