import { useEffect, useState } from "react";
import ExcelJS from "exceljs";

const DARK_COCKPIT_THEME = {
  bg:        "#0a0d12",
  bg2:       "#0b1320",
  bgInput:   "#0b1828",
  accent:    "#4fc3f7",
  border:    "#1e3a5f",
  border2:   "#1a3050",
  text:      "#ffffff",
  textMuted: "#b8d6e5",
  textDim:   "#7a9aaa",
};

const COLUMN_ORDER = [
  "date", "type", "markings", "captain", "cap", "pilotFlying", "sectors",
  "departure", "arrival", "std", "sta", "dayP1", "dayP1US", "dayP2",
  "nightP1", "nightP1US", "nightP2", "total", "remarks", "autoland"
];

export default function ExportImportModal({ open, onClose, monthData, settings, user, onImport, computeFlightTimes }) {
  const [tab, setTab] = useState("export");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [file, setFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [exportStatus, setExportStatus] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [persisted, setPersisted] = useState(null);
  const [backupStatus, setBackupStatus] = useState(null);
  const [restoreFileName, setRestoreFileName] = useState(null);

  useEffect(() => {
    if (open) {
      const today = new Date();
      // Only reset date range if blank — preserve last-used values on reopen
      if (!dateFrom) setDateFrom(`${today.getFullYear()}-01-01`);
      if (!dateTo) setDateTo(today.toISOString().split("T")[0]);
      setTab("export");
      setFile(null);
      setImportPreview(null);
      setImportStatus(null);
      setExportStatus(null);
      setBackupStatus(null);
      setRestoreFileName(null);
      navigator.storage?.persisted?.().then(setPersisted);
    }
  }, [open]);

  // ── Full app backup (raw localStorage data + settings) — separate from the
  // XLSX flight export above, which is for filing/sharing, not disaster recovery.
  const handleBackupDownload = () => {
    const backup = {
      data: JSON.parse(localStorage.getItem(`elb_data_${user.uid}`) || "null"),
      settings: JSON.parse(localStorage.getItem(`elb_settings_${user.uid}`) || "null"),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `elogbook-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBackupRestore = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setRestoreFileName(f.name);
    try {
      const backup = JSON.parse(await f.text());
      if (!backup.data) throw new Error("File missing logbook data");
      localStorage.setItem(`elb_data_${user.uid}`, JSON.stringify(backup.data));
      if (backup.settings) localStorage.setItem(`elb_settings_${user.uid}`, JSON.stringify(backup.settings));
      setBackupStatus({ success: true });
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setBackupStatus({ error: err.message || "Invalid backup file" });
    }
  };

  // ESC closes
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // ─────────────────────────────────────────────────────────────────
  // EXPORT LOGIC
  // ─────────────────────────────────────────────────────────────────

  const getRowsInDateRange = () => {
    if (!dateFrom || !dateTo) return [];

    const fromDate = new Date(dateFrom + 'T00:00:00Z');
    const toDate = new Date(dateTo + 'T23:59:59Z');
    const rows = [];

    if (!monthData || typeof monthData !== 'object') return [];

    Object.entries(monthData).forEach(([key, monthRows]) => {
      if (!Array.isArray(monthRows)) return;

      // key is "{monthIdx}-{year}" e.g. "4-2026" = May 2026
      const [monthIdxStr, yearStr] = key.split('-');
      const keyMonthIdx = parseInt(monthIdxStr); // 0-based
      const keyYear     = parseInt(yearStr);

      monthRows.forEach(row => {
        if (!row || !row.date) return;

        let rowDate;
        if (typeof row.date === 'string' && row.date.includes('/')) {
          const parts = row.date.split('/');
          if (parts.length === 3) {
            // Full DD/MM/YYYY (imported rows)
            const day   = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year  = parts[2];
            rowDate = new Date(`${year}-${month}-${day}T00:00:00Z`);
          } else if (parts.length === 2) {
            // DD/MM entered manually (e.g. "15/05") — reconstruct year from month key
            const day = parseInt(parts[0]);
            if (!day || isNaN(day) || day < 1 || day > 31) return;
            const month = String(keyMonthIdx + 1).padStart(2, '0');
            const dayStr = String(day).padStart(2, '0');
            rowDate = new Date(`${keyYear}-${month}-${dayStr}T00:00:00Z`);
          } else {
            return;
          }
        } else {
          // Day number only (e.g. "12") — reconstruct using the month key
          const day = parseInt(row.date);
          if (!day || isNaN(day) || day < 1 || day > 31) return;
          const month = String(keyMonthIdx + 1).padStart(2, '0');
          const year  = String(keyYear);
          const dayStr = String(day).padStart(2, '0');
          rowDate = new Date(`${year}-${month}-${dayStr}T00:00:00Z`);
        }

        if (rowDate >= fromDate && rowDate <= toDate) {
          // Attach a normalised full-date string so export sorting works correctly
          rows.push({ ...row, _fullDate: rowDate, _monthIdx: keyMonthIdx, _year: keyYear });
        }
      });
    });

    return rows;
  };

  const formatDateForExcel = (dateStr) => {
    if (!dateStr) return "";
    try {
      const date = typeof dateStr === 'string' ? new Date(dateStr + 'T00:00:00Z') : new Date(dateStr);
      const day = String(date.getUTCDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[date.getUTCMonth()];
      const year = date.getUTCFullYear();
      return `${day}-${month}-${year}`;
    } catch (e) {
      return dateStr || "";
    }
  };

  const dateToExcelSerial = (dateStr) => {
    if (!dateStr || !dateStr.includes('/')) return null;
    const [d, m, y] = dateStr.split('/');
    const date = new Date(`${y}-${m}-${d}`);
    const epoch = new Date(1900, 0, 1);
    const diff = date - epoch;
    return Math.floor(diff / (24 * 60 * 60 * 1000)) + 2;
  };

  const timeToDecimal = (timeStr) => {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h + m / 60) / 24;
  };

  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr || typeof timeStr !== "string") return 0;
    const parts = timeStr.trim().split(":");
    if (parts.length !== 2) return 0;
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    return h * 60 + m;
  };

  const minutesToTime = (mins) => {
    if (!mins) return "0:00";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}:${String(m).padStart(2, "0")}`;
  };

  const getAllRows = () => {
    if (!monthData || typeof monthData !== 'object') return [];
    const rows = [];
    Object.entries(monthData).forEach(([key, monthRows]) => {
      if (!Array.isArray(monthRows)) return;
      const [monthIdxStr, yearStr] = key.split('-');
      const keyMonthIdx = parseInt(monthIdxStr);
      const keyYear     = parseInt(yearStr);
      monthRows.forEach(row => {
        if (!row || !row.date) return;
        let rowDate;
        if (typeof row.date === 'string' && row.date.includes('/')) {
          const parts = row.date.split('/');
          if (parts.length === 3) {
            const day   = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            rowDate = new Date(`${parts[2]}-${month}-${day}T00:00:00Z`);
          } else if (parts.length === 2) {
            const day = parseInt(parts[0]);
            if (!day || isNaN(day) || day < 1 || day > 31) return;
            const month = String(keyMonthIdx + 1).padStart(2, '0');
            rowDate = new Date(`${keyYear}-${month}-${String(day).padStart(2, '0')}T00:00:00Z`);
          } else return;
        } else {
          const day = parseInt(row.date);
          if (!day || isNaN(day) || day < 1 || day > 31) return;
          const month = String(keyMonthIdx + 1).padStart(2, '0');
          rowDate = new Date(`${keyYear}-${month}-${String(day).padStart(2, '0')}T00:00:00Z`);
        }
        rows.push({ ...row, _fullDate: rowDate, _monthIdx: keyMonthIdx, _year: keyYear });
      });
    });
    return rows;
  };

  // Core export — accepts a pre-filtered/sorted rows array and a period label for the Profile sheet.
  const exportToExcel = async (rows, periodLabel) => {
    if (rows.length === 0) {
      setExportStatus({ error: "No flights found" });
      return;
    }

    const wb = new ExcelJS.Workbook();

    // SHEET 1: PILOT PROFILE
    const wsProfile = wb.addWorksheet("Profile");
    wsProfile.columns = [{ width: 20 }, { width: 40 }];
    wsProfile.addRows([
      ["PILOT PROFILE"],
      [],
      ["Name", settings?.fullName || ""],
      ["License Number", settings?.licenceNumber || ""],
      ["License Type", settings?.licenceType || ""],
      ["Airline", settings?.airline || ""],
      ["Home Base", settings?.homeBase || ""],
      ["Report Period", periodLabel],
    ]);

    // SHEET 2: CARRY FORWARD BY AIRCRAFT TYPE
    const cfByType = {};
    (settings?.carryForward || []).forEach(cf => {
      if (cf.type) cfByType[cf.type] = cf;
    });
    const cfRows = [
      ["CARRY FORWARD HOURS"],
      [],
      ["Aircraft Type", "Day P1", "Day P1 U/S", "Day P2", "Night P1", "Night P1 U/S", "Night P2"],
    ];
    Object.entries(cfByType).forEach(([type, cf]) => {
      cfRows.push([
        type,
        timeToDecimal(cf.dayP1 || "0:00"),
        timeToDecimal(cf.dayP1US || "0:00"),
        timeToDecimal(cf.dayP2 || "0:00"),
        timeToDecimal(cf.nightP1 || "0:00"),
        timeToDecimal(cf.nightP1US || "0:00"),
        timeToDecimal(cf.nightP2 || "0:00"),
      ]);
    });
    const wsCF = wb.addWorksheet("Carry Forward");
    wsCF.columns = [{ width: 15 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }];
    wsCF.addRows(cfRows);
    for (let i = 4; i <= cfRows.length; i++) {
      ["B", "C", "D", "E", "F", "G"].forEach(col => {
        const cell = wsCF.getCell(`${col}${i}`);
        if (cell.value !== null && cell.value !== undefined && cell.value !== "") {
          cell.numFmt = "[h]:mm:ss";
        }
      });
    }

    // SHEET 3: FLIGHT DETAILS with proper date/time formats
    const flightHeaders = COLUMN_ORDER.map(col => {
      const headerMap = {
        date: "DATE", type: "TYPE", markings: "MARKINGS", captain: "CAPTAIN",
        cap: "CAP", pilotFlying: "FLYING", sectors: "SECTORS",
        departure: "DEPARTURE", arrival: "ARRIVAL", std: "STD", sta: "STA",
        dayP1: "DAY P1", dayP1US: "DAY P1 U/S", dayP2: "DAY P2",
        nightP1: "NIGHT P1", nightP1US: "NIGHT P1 U/S", nightP2: "NIGHT P2",
        total: "TOTAL", remarks: "REMARKS", autoland: "AUTOLAND"
      };
      return headerMap[col] || col.toUpperCase();
    });

    const flightData = rows.map(row => {
      const ft = computeFlightTimes ? computeFlightTimes(row, row._year, row._monthIdx) : {};
      const ftTotalMins = ["dayP1","dayP1US","dayP2","nightP1","nightP1US","nightP2"]
        .reduce((acc, k) => acc + parseTimeToMinutes(ft[k] || ""), 0);
      return COLUMN_ORDER.map(col => {
        if (col === "date") {
          if (row._fullDate) {
            const epoch = new Date(Date.UTC(1900, 0, 1));
            return Math.floor((row._fullDate - epoch) / 86400000) + 2;
          }
          return dateToExcelSerial(row.date);
        }
        if (["dayP1", "dayP1US", "dayP2", "nightP1", "nightP1US", "nightP2"].includes(col)) {
          return timeToDecimal(ft[col] || "");
        }
        if (col === "total") return timeToDecimal(minutesToTime(ftTotalMins));
        if (["std", "sta"].includes(col)) return timeToDecimal(row[col]);
        return row[col] || "";
      });
    });

    const wsFlights = wb.addWorksheet("Flights");
    wsFlights.columns = [
      { width: 14 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 6 }, { width: 8 },
      { width: 8 }, { width: 11 }, { width: 11 }, { width: 8 }, { width: 8 }, { width: 10 },
      { width: 12 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 10 }, { width: 10 },
      { width: 10 }, { width: 10 },
    ];
    wsFlights.addRow(flightHeaders);
    flightData.forEach(row => wsFlights.addRow(row));
    for (let i = 2; i <= flightData.length + 1; i++) {
      wsFlights.getCell(`A${i}`).numFmt = "dd-mm-yyyy";
      ["J", "K", "L", "M", "N", "O", "P", "Q"].forEach(col => {
        const cell = wsFlights.getCell(`${col}${i}`);
        if (cell.value !== null && cell.value !== undefined && cell.value !== "") {
          cell.numFmt = "[h]:mm:ss";
        }
      });
    }

    // SHEET 4: MONTHLY SUMMARY
    const monthlySummary = {};
    rows.forEach(row => {
      if (!row._fullDate) return;
      const ft = computeFlightTimes ? computeFlightTimes(row, row._year, row._monthIdx) : {};
      const m = String(row._fullDate.getUTCMonth() + 1).padStart(2, "0");
      const y = String(row._fullDate.getUTCFullYear());
      const monthKey = `${y}-${m}`;
      if (!monthlySummary[monthKey]) {
        monthlySummary[monthKey] = { dayP1: 0, dayP1US: 0, dayP2: 0, nightP1: 0, nightP1US: 0, nightP2: 0, flights: 0, total: 0 };
      }
      monthlySummary[monthKey].dayP1 += parseTimeToMinutes(ft.dayP1 || "") || 0;
      monthlySummary[monthKey].dayP1US += parseTimeToMinutes(ft.dayP1US || "") || 0;
      monthlySummary[monthKey].dayP2 += parseTimeToMinutes(ft.dayP2 || "") || 0;
      monthlySummary[monthKey].nightP1 += parseTimeToMinutes(ft.nightP1 || "") || 0;
      monthlySummary[monthKey].nightP1US += parseTimeToMinutes(ft.nightP1US || "") || 0;
      monthlySummary[monthKey].nightP2 += parseTimeToMinutes(ft.nightP2 || "") || 0;
      monthlySummary[monthKey].flights += 1;
      const ftTotalMins = ["dayP1","dayP1US","dayP2","nightP1","nightP1US","nightP2"]
        .reduce((acc, k) => acc + parseTimeToMinutes(ft[k] || ""), 0);
      monthlySummary[monthKey].total += ftTotalMins;
    });

    const summaryHeaders = ["Month", "Day P1", "Day P1 U/S", "Day P2", "Night P1", "Night P1 U/S", "Night P2", "Flights", "Total"];
    const summaryRows = Object.entries(monthlySummary)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({ month, ...data }));

    const cfTotals = { dayP1: 0, dayP1US: 0, dayP2: 0, nightP1: 0, nightP1US: 0, nightP2: 0 };
    Object.values(cfByType).forEach(cf => {
      cfTotals.dayP1 += parseTimeToMinutes(cf.dayP1) || 0;
      cfTotals.dayP1US += parseTimeToMinutes(cf.dayP1US) || 0;
      cfTotals.dayP2 += parseTimeToMinutes(cf.dayP2) || 0;
      cfTotals.nightP1 += parseTimeToMinutes(cf.nightP1) || 0;
      cfTotals.nightP1US += parseTimeToMinutes(cf.nightP1US) || 0;
      cfTotals.nightP2 += parseTimeToMinutes(cf.nightP2) || 0;
    });

    const grandTotal = {
      dayP1:   cfTotals.dayP1   + summaryRows.reduce((s, r) => s + r.dayP1, 0),
      dayP1US: cfTotals.dayP1US + summaryRows.reduce((s, r) => s + r.dayP1US, 0),
      dayP2:   cfTotals.dayP2   + summaryRows.reduce((s, r) => s + r.dayP2, 0),
      nightP1: cfTotals.nightP1 + summaryRows.reduce((s, r) => s + r.nightP1, 0),
      nightP1US: cfTotals.nightP1US + summaryRows.reduce((s, r) => s + r.nightP1US, 0),
      nightP2: cfTotals.nightP2 + summaryRows.reduce((s, r) => s + r.nightP2, 0),
      flights: summaryRows.reduce((s, r) => s + r.flights, 0),
      total:   Object.values(cfTotals).reduce((a, b) => a + b, 0) + summaryRows.reduce((s, r) => s + r.total, 0),
    };

    const summaryData = summaryRows.map(row => [
      row.month,
      timeToDecimal(minutesToTime(row.dayP1)),
      timeToDecimal(minutesToTime(row.dayP1US)),
      timeToDecimal(minutesToTime(row.dayP2)),
      timeToDecimal(minutesToTime(row.nightP1)),
      timeToDecimal(minutesToTime(row.nightP1US)),
      timeToDecimal(minutesToTime(row.nightP2)),
      row.flights,
      timeToDecimal(minutesToTime(row.total)),
    ]);
    summaryData.push([
      "GRAND TOTAL",
      timeToDecimal(minutesToTime(grandTotal.dayP1)),
      timeToDecimal(minutesToTime(grandTotal.dayP1US)),
      timeToDecimal(minutesToTime(grandTotal.dayP2)),
      timeToDecimal(minutesToTime(grandTotal.nightP1)),
      timeToDecimal(minutesToTime(grandTotal.nightP1US)),
      timeToDecimal(minutesToTime(grandTotal.nightP2)),
      grandTotal.flights,
      timeToDecimal(minutesToTime(grandTotal.total)),
    ]);

    const wsSummary = wb.addWorksheet("Summary");
    wsSummary.columns = [{ width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 10 }, { width: 12 }];
    wsSummary.addRow(summaryHeaders);
    summaryData.forEach(row => wsSummary.addRow(row));
    for (let i = 2; i <= summaryData.length + 1; i++) {
      ["B", "C", "D", "E", "F", "G", "I"].forEach(col => {
        const cell = wsSummary.getCell(`${col}${i}`);
        if (cell.value !== null && cell.value !== undefined && cell.value !== "") {
          cell.numFmt = "[h]:mm:ss";
        }
      });
    }

    // Trigger browser download
    const fileName = `ClaudeBorne_${periodLabel.replace(/\s+/g, "_").replace(/\//g, "-")}.xlsx`;
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportStatus({ success: true, count: rows.length });
    setTimeout(() => setExportStatus(null), 3000);
  };

  const handleExport = () => {
    if (!dateFrom || !dateTo) {
      setExportStatus({ error: "Please select a date range" });
      return;
    }
    const rows = getRowsInDateRange().sort((a, b) => (a._fullDate || 0) - (b._fullDate || 0));
    if (rows.length === 0) {
      setExportStatus({ error: "No flights found in selected date range" });
      return;
    }
    const periodLabel = `${dateFrom.split('-').reverse().join('-')} to ${dateTo.split('-').reverse().join('-')}`;
    setIsExporting(true);
    exportToExcel(rows, periodLabel).finally(() => setIsExporting(false));
  };

  const handleExportAll = () => {
    const rows = getAllRows().sort((a, b) => (a._fullDate || 0) - (b._fullDate || 0));
    if (rows.length === 0) {
      setExportStatus({ error: "No flights found" });
      return;
    }
    setIsExporting(true);
    exportToExcel(rows, "All flights").finally(() => setIsExporting(false));
  };

  // ─────────────────────────────────────────────────────────────────
  // IMPORT LOGIC
  // ─────────────────────────────────────────────────────────────────

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportPreview(null);
    setImportStatus(null);

    if (!selectedFile.name.endsWith(".xlsx")) {
      setImportStatus({ error: "Only .xlsx files are supported" });
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setImportStatus({ error: "File too large (max 10 MB). Please select a valid .xlsx export." });
      return;
    }

    try {
      const buffer = await selectedFile.arrayBuffer();

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);

      // Auto-detect "Flights" sheet
      const ws = wb.worksheets.find(s => s.name.toLowerCase() === "flights");
      if (!ws) {
        setImportStatus({ error: 'No "Flights" sheet found in workbook' });
        return;
      }

      // Read headers from row 1
      const headers = [];
      ws.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber - 1] = cell.value?.toString() || "";
      });

      // Convert rows to array-of-objects matching the format validateImportData expects
      const rawData = [];
      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const obj = {};
        headers.forEach((header, idx) => {
          obj[header] = row.getCell(idx + 1).value ?? "";
        });
        if (Object.values(obj).some(v => v !== null && v !== undefined && v !== "")) {
          rawData.push(obj);
        }
      });

      if (rawData.length === 0) {
        setImportStatus({ error: 'Flights sheet is empty' });
        return;
      }

      // Get headers from first row
      const headerRow = rawData[0];
      const detectedHeaders = Object.keys(headerRow);

      // Create column mapping (case-insensitive)
      const headerMap = {};
      const missingColumns = [];
      const duplicateColumns = [];

      const expectedHeaderMap = {
        date: "DATE", type: "TYPE", markings: "MARKINGS", captain: "CAPTAIN",
        cap: "CAP", pilotFlying: "FLYING", sectors: "SECTORS",
        departure: "DEPARTURE", arrival: "ARRIVAL", std: "STD", sta: "STA",
        dayP1: "DAY P1", dayP1US: "DAY P1 U/S", dayP2: "DAY P2",
        nightP1: "NIGHT P1", nightP1US: "NIGHT P1 U/S", nightP2: "NIGHT P2",
        total: "TOTAL", remarks: "REMARKS", autoland: "AUTOLAND"
      };

      // Map columns (case-insensitive)
      for (const [fieldName, expectedHeader] of Object.entries(expectedHeaderMap)) {
        const matchedHeader = detectedHeaders.find(h => h.toUpperCase() === expectedHeader.toUpperCase());
        if (matchedHeader) {
          headerMap[fieldName] = matchedHeader;
        } else {
          missingColumns.push(expectedHeader);
        }
      }

      // Check for duplicates (multiple columns mapping to same field)
      const reverseMap = {};
      for (const [field, header] of Object.entries(headerMap)) {
        if (reverseMap[header]) duplicateColumns.push(header);
        reverseMap[header] = field;
      }

      // Show warning if columns missing or duplicated
      if (missingColumns.length > 0 || duplicateColumns.length > 0) {
        const warnings = [];
        if (missingColumns.length > 0) warnings.push(`Missing: ${missingColumns.join(', ')}`);
        if (duplicateColumns.length > 0) warnings.push(`Duplicates: ${duplicateColumns.join(', ')}`);
        setImportStatus({ warning: warnings.join(' | ') });
      }

      // Validate and create preview
      const { validRows, errors, duplicateCount } = validateImportData(rawData, headerMap);

      setImportPreview({
        totalDetected: rawData.length - 1,
        validRows,
        errors,
        duplicateCount,
        headerMap,
      });
    } catch (err) {
      setImportStatus({ error: `Failed to read file: ${err.message}` });
    }
  };

  const excelDateToDD_MM_YYYY = (excelDate) => {
    let dateObj;
    if (typeof excelDate === 'number') {
      // Excel serial date: days since 1900-01-01
      dateObj = new Date((excelDate - 25569) * 86400 * 1000);
    } else if (excelDate instanceof Date) {
      dateObj = excelDate;
    } else {
      return null;
    }
    const day = String(dateObj.getUTCDate()).padStart(2, '0');
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const year = dateObj.getUTCFullYear();
    return `${day}/${month}/${year}`;
  };

  const validateImportData = (data, headerMap) => {
    const validRows = [];
    const errors = [];
    let duplicateCount = 0;

    data.forEach((row, idx) => {
      let dateRaw = row[headerMap.date];
      const departure = row[headerMap.departure]?.toString().trim();
      const arrival = row[headerMap.arrival]?.toString().trim();

      // Convert Excel dates (number or Date object) to DD/MM/YYYY string
      let date;
      if (typeof dateRaw === 'number' || dateRaw instanceof Date) {
        date = excelDateToDD_MM_YYYY(dateRaw);
      } else {
        date = dateRaw?.toString().trim();
      }

      // Check required fields
      if (!date) {
        errors.push({ row: idx, reason: 'Missing date' });
        return;
      }

      // Validate DD/MM/YYYY structure for all dates regardless of source type
      // (covers malformed Excel serial → NaN/NaN/NaN output and bad plain-text strings)
      {
        const dateParts = date.split('/');
        const dd = parseInt(dateParts[0]), mm = parseInt(dateParts[1]), yyyy = parseInt(dateParts[2]);
        if (dateParts.length !== 3 || !dd || !mm || !yyyy || dd < 1 || dd > 31 || mm < 1 || mm > 12 || yyyy < 1900 || yyyy > 2100) {
          errors.push({ row: idx, reason: `Invalid date format: ${date}` });
          return;
        }
      }
      if (!departure) {
        errors.push({ row: idx, reason: 'Missing departure' });
        return;
      }
      if (!arrival) {
        errors.push({ row: idx, reason: 'Missing arrival' });
        return;
      }

      // Normalize date format: convert DD/MM/YYYY to YYYY-MM-DD
      let normalizedDate = date;
      try {
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
          const [day, month, year] = date.split('/');
          normalizedDate = `${year}-${month}-${day}`;
        } else if (/^\d{2}-\w{3}-\d{4}$/.test(date)) {
          // Handle DD-MMM-YYYY format from export
          const [day, month, year] = date.split('-');
          const monthNum = new Date(`${month} 1`).getMonth() + 1;
          normalizedDate = `${year}-${String(monthNum).padStart(2, '0')}-${day}`;
        }
      } catch (e) {
        // Keep original date if parsing fails
      }

      // Check if flight already exists in logbook.
      // Handles both DD/MM/YYYY (imported rows) and day-number (manually entered rows).
      const existsInLogbook = Object.entries(monthData).some(([key, monthRows]) => {
        if (!Array.isArray(monthRows)) return false;
        const [monthIdxStr, yearStr] = key.split('-');
        const keyMonthIdx = parseInt(monthIdxStr); // 0-based
        const keyYear = parseInt(yearStr);
        return monthRows.some(r => {
          if (!r.date) return false;
          let rDateNorm;
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(r.date)) {
            // DD/MM/YYYY — imported rows
            const [day, month, year] = r.date.split('/');
            rDateNorm = `${year}-${month}-${day}`;
          } else {
            // Day number only — manually entered rows; reconstruct from month key
            const dayNum = parseInt(r.date);
            if (!dayNum || isNaN(dayNum) || dayNum < 1 || dayNum > 31) return false;
            rDateNorm = `${keyYear}-${String(keyMonthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          }
          return rDateNorm === normalizedDate && r.departure === departure && r.arrival === arrival;
        });
      });

      if (existsInLogbook) {
        duplicateCount++;
        return;
      }

      // Build complete row with all fields using headerMap
      const newRow = {};
      for (const [fieldName, headerName] of Object.entries(headerMap)) {
        const val = row[headerName];
        // Convert time values (timedelta from Excel) to HH:MM format
        if (['std', 'sta', 'dayP1', 'dayP1US', 'dayP2', 'nightP1', 'nightP1US', 'nightP2', 'total'].includes(fieldName) && val !== null && val !== undefined && val !== "") {
          if (typeof val === 'number') {
            // Excel time value: stored as fraction of a day (e.g., 0.10416... = 2.5 hrs)
            const totalMinutes = Math.round(val * 24 * 60);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            newRow[fieldName] = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          } else if (val instanceof Date) {
            // ExcelJS returns Date objects for time-formatted cells (base date 1899-12-30)
            const hours = val.getUTCHours();
            const minutes = val.getUTCMinutes();
            newRow[fieldName] = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          } else {
            newRow[fieldName] = val?.toString().trim() || "";
          }
        } else {
          newRow[fieldName] = val?.toString() || "";
        }
      }
      // Store date in DD/MM/YYYY format for logbook
      const [yyyy, mm, dd] = normalizedDate.split('-');
      newRow.date = `${dd}/${mm}/${yyyy}`;
      // Normalise aircraft type to uppercase so it groups correctly in Grand Total
      if (newRow.type) newRow.type = newRow.type.trim().toUpperCase();

      validRows.push(newRow);
    });

    return { validRows, errors, duplicateCount };
  };

  const handleImport = async () => {
    if (!importPreview || importPreview.validRows.length === 0) {
      setImportStatus({ error: "No valid rows to import" });
      return;
    }

    // Update monthData with new rows
    const newMonthData = JSON.parse(JSON.stringify(monthData));
    let addedCount = 0;

    importPreview.validRows.forEach(row => {
      const [dd, mm, yyyy] = row.date.split('/');
      const monthIdx = parseInt(mm) - 1;
      const year = parseInt(yyyy);
      const key = `${monthIdx}-${year}`;

      if (!newMonthData[key]) {
        newMonthData[key] = [];
      } else {
        newMonthData[key] = newMonthData[key].filter(row => row.date && row.date.trim());
      }

      // Create row object with all fields
      const newRow = {
        id: newMonthData[key].length + 1,
        ...Object.fromEntries(
          COLUMN_ORDER.map(col => [col, row[col] || ""])
        ),
      };

      newMonthData[key].push(newRow);
      addedCount++;
    });

    // Sort rows within each month by date (chronological order)
    Object.keys(newMonthData).forEach(key => {
      newMonthData[key].sort((a, b) => {
        const aDate = a.date ? new Date(a.date.split('/').reverse().join('-')) : new Date(0);
        const bDate = b.date ? new Date(b.date.split('/').reverse().join('-')) : new Date(0);
        return aDate - bDate;
      });
      // Reassign IDs after sorting
      newMonthData[key].forEach((row, idx) => {
        row.id = idx + 1;
      });
    });

    setImportStatus({ saving: true });
    try {
      await onImport(newMonthData);
      setImportStatus({
        success: true,
        added: addedCount,
        skipped: importPreview.duplicateCount,
        errors: importPreview.errors.length,
      });
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (e) {
      // Data is loaded in the app (setData ran) but Firestore save failed.
      // Keep modal open so user sees the error and can retry manually.
      setImportStatus({
        error: e?.message || "Cloud save failed — data is loaded in app. Use SAVE NOW to retry.",
      });
    }
  };

  if (!open) return null;

  const TABS = [
    { id: "export", label: "Export", hint: "date range · xlsx" },
    { id: "import", label: "Import", hint: "xlsx · preview" },
    { id: "backup", label: "Backup", hint: "json · restore" },
  ];

  return (
    <>
      <style>{exportImportCss}</style>
      <div className="eim-backdrop" onClick={handleBackdrop} />
      <div className="eim-modal" role="dialog" aria-modal="true" aria-label="Export/Import">

        {/* ── HEAD ── */}
        <header className="eim-head">
          <div>
            <div className="eim-eyebrow">// data</div>
            <h2 className="eim-title">Export / Import</h2>
          </div>
          <button className="eim-close" onClick={onClose} aria-label="Close">✕</button>
        </header>

        {/* ── TABS ── */}
        <nav className="eim-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={"eim-tab" + (tab === t.id ? " on" : "")}
              onClick={() => setTab(t.id)}
            >
              <span className="eim-tab-label">{t.label}</span>
              <span className="eim-tab-hint">{t.hint}</span>
            </button>
          ))}
        </nav>

        {/* ── BODY ── */}
        <div className="eim-body">
          {tab === "export" && (
            <div className="eim-pane">
              <div className="eim-sh"><h3 className="eim-sh-title">Date range</h3><span className="eim-sh-hint">flights · xlsx</span></div>

              <div className="eim-daterow">
                <div className="eim-datefield">
                  <label>From</label>
                  <input type="date" className="eim-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div className="eim-datefield">
                  <label>To</label>
                  <input type="date" className="eim-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
              </div>

              {exportStatus?.error && <div className="eim-note error">✗ {exportStatus.error}</div>}
              {exportStatus?.success && <div className="eim-note ok">✓ {exportStatus.count} flights exported</div>}

              <div className="eim-actions">
                <button className="eim-btn-primary" onClick={handleExport} disabled={isExporting}
                  style={{ opacity: isExporting ? 0.7 : 1, cursor: isExporting ? "wait" : "pointer" }}>
                  {isExporting ? "Generating…" : "Export"}
                </button>
                <button className="eim-btn-ghost" onClick={handleExportAll} disabled={isExporting}
                  style={{ opacity: isExporting ? 0.7 : 1, cursor: isExporting ? "wait" : "pointer" }}>
                  {isExporting ? "Generating…" : "Export all"}
                </button>
              </div>
            </div>
          )}

          {tab === "import" && (
            <div className="eim-pane">
              <div className="eim-sh"><h3 className="eim-sh-title">Select file</h3><span className="eim-sh-hint">xlsx only</span></div>

              <div className="eim-field">
                <div className="eim-field-meta">
                  <span className="eim-field-label">Flights export</span>
                  <div className="eim-field-hint">Reads the "Flights" sheet from a previously exported workbook.</div>
                </div>
                <div className="eim-field-control">
                  <input type="file" id="eim-import-file" accept=".xlsx" className="eim-fileinput" onChange={handleFileSelect} />
                  <label htmlFor="eim-import-file" className="eim-filebtn">Choose file</label>
                </div>
              </div>
              {file && <div className="eim-filename">{file.name}</div>}

              {importPreview && (
                <>
                  <div className="eim-sh"><h3 className="eim-sh-title">Preview</h3></div>
                  <div className="eim-preview">
                    {importPreview.errors.length > 0 && (
                      <div className="eim-errors">
                        <p className="eim-error-label">⚠ {importPreview.errors.length} errors:</p>
                        {importPreview.errors.map((err, i) => (
                          <p key={i} className="eim-error-item">Row {err.row}: {err.reason}</p>
                        ))}
                      </div>
                    )}
                    <table className="eim-ptable">
                      <tbody>
                        <tr><td>Valid flights</td><td style={{ color: "#22c55e" }}>{importPreview.validRows.length}</td></tr>
                        <tr><td>Existing (skipped)</td><td style={{ color: "#f5c542" }}>{importPreview.duplicateCount}</td></tr>
                        <tr><td>Errors (skipped)</td><td style={{ color: "#ef4444" }}>{importPreview.errors.length}</td></tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {importStatus?.error && <div className="eim-note error">✗ {importStatus.error}</div>}
              {importStatus?.warning && <div className="eim-note warn">⚠ {importStatus.warning}</div>}
              {importStatus?.saving && <div className="eim-note warn">⏳ Saving to cloud...</div>}
              {importStatus?.success && <div className="eim-note ok">✓ {importStatus.added} flights added, {importStatus.skipped} skipped</div>}

              <div className="eim-actions">
                <button
                  className="eim-btn-primary"
                  onClick={handleImport}
                  disabled={!importPreview || importPreview.validRows.length === 0}
                >
                  Import ({importPreview?.validRows.length || 0} valid)
                </button>
                <button className="eim-btn-ghost" onClick={() => {
                  setFile(null);
                  setImportPreview(null);
                  setImportStatus(null);
                }}>
                  Clear
                </button>
              </div>
            </div>
          )}

          {tab === "backup" && (
            <div className="eim-pane">
              {persisted !== null && (
                <div className={"eim-note " + (persisted ? "ok" : "warn")}>
                  {persisted ? "Persistent storage granted — data protected from browser cleanup." : "Persistent storage not granted — data may be cleared under storage pressure."}
                </div>
              )}

              <div className="eim-sh"><h3 className="eim-sh-title">Full app backup</h3><span className="eim-sh-hint">json</span></div>
              <div className="eim-field">
                <div className="eim-field-meta">
                  <span className="eim-field-label">Download backup</span>
                  <div className="eim-field-hint">Saves flight data, settings and profile to one file you keep yourself.</div>
                </div>
                <div className="eim-field-control">
                  <button className="eim-btn-primary" style={{ width: "100%" }} onClick={handleBackupDownload}>Download .json</button>
                </div>
              </div>

              <div className="eim-sh"><h3 className="eim-sh-title">Restore</h3></div>
              <div className="eim-field">
                <div className="eim-field-meta">
                  <span className="eim-field-label">Restore from backup</span>
                  <div className="eim-field-hint">Overwrites current local data and reloads the app.</div>
                </div>
                <div className="eim-field-control">
                  <input type="file" id="eim-backup-file" accept=".json" className="eim-fileinput" onChange={handleBackupRestore} />
                  <label htmlFor="eim-backup-file" className="eim-filebtn">Choose file</label>
                </div>
              </div>
              {restoreFileName && <div className="eim-filename">{restoreFileName}</div>}

              {backupStatus?.error && <div className="eim-note error">✗ {backupStatus.error}</div>}
              {backupStatus?.success && <div className="eim-note ok">✓ Restored — reloading...</div>}
            </div>
          )}
        </div>

        {/* ── FOOT ── */}
        <footer className="eim-foot">
          <div className="eim-foot-note">// changes apply immediately · no save needed</div>
          <div className="eim-foot-btns">
            <button className="eim-btn-ghost" onClick={onClose}>Close</button>
          </div>
        </footer>
      </div>
    </>
  );
}

const exportImportCss = `
  .eim-backdrop, .eim-modal{
    --cb-mint: #3FE0C5;
    --cb-grad: linear-gradient(135deg, #3FE0C5, #3B8DFF);
    --cb-font-display: 'Tourney', system-ui, sans-serif;
  }

  .eim-backdrop{
    position:fixed;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(3px);z-index:2090;
  }

  .eim-modal{
    position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
    width:480px;max-width:92vw;max-height:88vh;
    background:var(--cb-surface-1);border:1px solid var(--cb-line-2);
    display:flex;flex-direction:column;box-shadow:0 30px 80px rgba(0,0,0,0.5);
    z-index:2100;animation:eimPopIn 0.18s ease;
    font-family:var(--cb-font-body);color:var(--cb-ink);font-size:14px;text-align:left;
  }

  @keyframes eimPopIn{from{opacity:0;transform:translate(-50%,-50%) scale(0.96) translateY(6px);}to{opacity:1;transform:translate(-50%,-50%) scale(1) translateY(0);}}

  /* ── Header ── */
  .eim-head{
    padding:20px 24px 16px;border-bottom:1px solid var(--cb-line);
    display:flex;justify-content:space-between;align-items:flex-start;flex-shrink:0;
    background:linear-gradient(180deg, rgba(63,224,197,0.04), transparent);
  }
  .eim-eyebrow{
    font-family:var(--cb-font-mono);font-size:calc(10px * var(--fs));letter-spacing:0.26em;
    text-transform:uppercase;color:var(--cb-mint);margin-bottom:6px;
  }
  .eim-title{
    font-family:var(--cb-font-display);font-weight:700;font-size:calc(24px * var(--fs));
    letter-spacing:0.03em;margin:0;line-height:1;color:var(--cb-ink);
  }
  .eim-close{
    width:30px;height:30px;background:transparent;border:1px solid var(--cb-line-2);
    color:var(--cb-ink-2);cursor:pointer;display:grid;place-items:center;flex-shrink:0;
    transition:color 120ms, border-color 120ms;
  }
  .eim-close:hover{color:var(--cb-mint);border-color:var(--cb-mint);}

  /* ── Tabs ── */
  .eim-tabs{
    display:grid;grid-template-columns:repeat(3,1fr);
    background:var(--cb-surface-0);border-bottom:1px solid var(--cb-line);flex-shrink:0;
  }
  .eim-tab{
    background:transparent;border:0;color:var(--cb-ink-2);padding:13px 16px;cursor:pointer;
    border-bottom:2px solid transparent;text-align:left;transition:all 140ms;
    display:flex;flex-direction:column;gap:3px;font-family:inherit;
  }
  .eim-tab + .eim-tab{border-left:1px solid var(--cb-line);}
  .eim-tab:hover{color:var(--cb-ink);}
  .eim-tab.on{color:var(--cb-mint);border-bottom-color:var(--cb-mint);background:rgba(63,224,197,0.04);}
  .eim-tab-label{font-family:var(--cb-font-display);font-weight:700;font-size:calc(13px * var(--fs));letter-spacing:0.04em;}
  .eim-tab-hint{font-family:var(--cb-font-mono);font-size:calc(9px * var(--fs));letter-spacing:0.14em;color:var(--cb-ink-dim);text-transform:uppercase;}

  /* ── Body ── */
  .eim-body{flex:1 1 auto;overflow-y:auto;padding:20px 24px;min-height:0;}
  .eim-body::-webkit-scrollbar{width:4px;}
  .eim-body::-webkit-scrollbar-track{background:transparent;}
  .eim-body::-webkit-scrollbar-thumb{background:var(--cb-line-2);border-radius:2px;}
  .eim-pane{display:flex;flex-direction:column;gap:4px;}

  .eim-sh{margin-top:16px;margin-bottom:10px;display:flex;align-items:baseline;justify-content:space-between;gap:16px;}
  .eim-sh:first-child{margin-top:0;}
  .eim-sh-title{font-family:var(--cb-font-display);font-weight:700;font-size:calc(15px * var(--fs));margin:0;letter-spacing:0.03em;color:var(--cb-ink);}
  .eim-sh-hint{font-family:var(--cb-font-mono);font-size:calc(9px * var(--fs));letter-spacing:0.14em;text-transform:uppercase;color:var(--cb-ink-dim);white-space:nowrap;}

  .eim-field{display:flex;align-items:center;gap:16px;padding:9px 0;border-bottom:1px dashed var(--cb-line);}
  .eim-field:last-child{border-bottom:0;}
  .eim-field-meta{flex:1;min-width:0;}
  .eim-field-label{font-size:calc(12.5px * var(--fs));color:var(--cb-ink);display:block;}
  .eim-field-hint{font-size:calc(11px * var(--fs));color:var(--cb-ink-dim);line-height:1.5;margin-top:3px;}
  .eim-field-control{flex-shrink:0;width:190px;}

  .eim-input{
    background:var(--cb-surface-0);border:1px solid var(--cb-line-2);color:var(--cb-ink);
    font-family:var(--cb-font-body);font-size:calc(12.5px * var(--fs));padding:7px 10px;
    width:100%;outline:none;box-sizing:border-box;transition:border-color 120ms;
  }
  .eim-input:focus{border-color:var(--cb-mint);}

  .eim-fileinput{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;}
  .eim-filebtn{
    display:inline-block;width:100%;text-align:center;box-sizing:border-box;
    background:transparent;border:1px solid var(--cb-line-2);color:var(--cb-ink-2);
    font-family:var(--cb-font-mono);font-size:calc(10px * var(--fs));letter-spacing:0.14em;
    text-transform:uppercase;padding:7px 10px;cursor:pointer;transition:all 120ms;
  }
  .eim-filebtn:hover{color:var(--cb-mint);border-color:var(--cb-mint);}
  .eim-filename{
    margin-top:8px;padding:8px 10px;background:var(--cb-surface-0);border:1px solid var(--cb-line-2);
    font-size:calc(11.5px * var(--fs));color:var(--cb-mint);word-break:break-all;
  }

  .eim-daterow{display:flex;gap:12px;padding:9px 0;border-bottom:1px dashed var(--cb-line);}
  .eim-datefield{flex:1;min-width:0;}
  .eim-datefield label{
    font-family:var(--cb-font-mono);font-size:calc(10px * var(--fs));letter-spacing:0.12em;
    text-transform:uppercase;color:var(--cb-ink-dim);display:block;margin-bottom:5px;
  }

  .eim-preview{padding:12px;background:var(--cb-surface-0);border:1px solid var(--cb-line-2);margin-bottom:10px;}
  .eim-ptable{width:100%;font-size:calc(12px * var(--fs));border-collapse:collapse;}
  .eim-ptable tr{border-bottom:1px dashed var(--cb-line);}
  .eim-ptable td{padding:5px 0;color:var(--cb-ink-2);}
  .eim-ptable td:last-child{text-align:right;font-weight:700;}

  .eim-errors{margin-bottom:10px;padding:10px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);}
  .eim-error-label{margin:0;font-size:calc(12px * var(--fs));color:#ef4444;font-weight:600;}
  .eim-error-item{margin:4px 0;font-size:calc(11px * var(--fs));color:var(--cb-ink-2);}

  .eim-note{padding:9px 10px;font-size:calc(11.5px * var(--fs));margin-bottom:10px;border:1px solid;font-weight:600;}
  .eim-note.ok{background:rgba(34,197,94,0.08);border-color:#22c55e;color:#22c55e;}
  .eim-note.error{background:rgba(239,68,68,0.08);border-color:#ef4444;color:#ef4444;}
  .eim-note.warn{background:rgba(245,197,66,0.08);border-color:#f5c542;color:#f5c542;}

  .eim-actions{display:flex;gap:8px;margin-top:14px;}

  /* ── Footer ── */
  .eim-foot{
    padding:14px 24px;border-top:1px solid var(--cb-line);flex-shrink:0;
    display:flex;justify-content:space-between;align-items:center;
  }
  .eim-foot-note{font-family:var(--cb-font-mono);font-size:calc(9.5px * var(--fs));color:var(--cb-ink-dim);letter-spacing:0.14em;}
  .eim-foot-btns{display:flex;gap:8px;}

  /* ── Buttons ── */
  .eim-btn-ghost{
    flex:1;background:transparent;border:1px solid var(--cb-line-2);color:var(--cb-ink-2);
    font-family:var(--cb-font-mono);font-size:calc(10px * var(--fs));letter-spacing:0.16em;
    text-transform:uppercase;padding:8px 14px;cursor:pointer;transition:color 120ms, border-color 120ms;
  }
  .eim-btn-ghost:hover{color:var(--cb-mint);border-color:var(--cb-mint);}
  .eim-btn-primary{
    flex:1;background-image:var(--cb-grad);border:0;color:var(--cb-surface-0);
    font-family:var(--cb-font-mono);font-size:calc(10px * var(--fs));letter-spacing:0.16em;
    text-transform:uppercase;font-weight:600;padding:8px 14px;cursor:pointer;transition:filter 120ms;
  }
  .eim-btn-primary:hover:not(:disabled){filter:brightness(1.1);}
  .eim-btn-primary:disabled{opacity:0.4;cursor:not-allowed;}

  @media (max-width: 560px){
    .eim-modal{width:94vw;}
    .eim-field{flex-direction:column;align-items:stretch;gap:8px;}
    .eim-field-control{width:100%;}
  }
`;
