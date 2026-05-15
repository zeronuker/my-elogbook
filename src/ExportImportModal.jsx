import { useEffect, useState } from "react";
import * as XLSX from "xlsx";

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

export default function ExportImportModal({ open, onClose, monthData, settings, user }) {
  const [tab, setTab] = useState("export");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [file, setFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [exportStatus, setExportStatus] = useState(null);

  useEffect(() => {
    if (open) {
      const today = new Date();
      setDateFrom(`${today.getFullYear()}-01-01`);
      setDateTo(today.toISOString().split("T")[0]);
      setTab("export");
      setFile(null);
      setImportPreview(null);
      setImportStatus(null);
      setExportStatus(null);

      // Debug: Log data structure
      console.log('=== EXPORT MODAL OPENED ===');
      console.log('monthData type:', typeof monthData);
      console.log('monthData keys:', monthData ? Object.keys(monthData) : 'null');
      if (monthData) {
        const firstKey = Object.keys(monthData)[0];
        console.log('First key:', firstKey);
        console.log('First month data:', monthData[firstKey]);
        if (monthData[firstKey] && monthData[firstKey].length > 0) {
          console.log('First row sample:', monthData[firstKey][0]);
        }
      }
    }
  }, [open, monthData]);

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

    console.log('=== DATE RANGE DEBUG ===');
    console.log('dateFrom:', dateFrom, 'toDate:', dateTo);
    console.log('monthData:', monthData);
    console.log('monthData.keys:', Object.keys(monthData));
    console.log('monthData type:', typeof monthData);

    if (!monthData || typeof monthData !== 'object' || Object.keys(monthData).length === 0) {
      console.log('ERROR: monthData is empty or invalid');
      return [];
    }

    Object.entries(monthData).forEach(([key, monthRows]) => {
      console.log(`Processing key: ${key}, rows:`, monthRows);

      const [monthIdx, year] = key.split('-');
      if (!monthIdx || !year) {
        console.log(`Invalid key format: ${key}`);
        return;
      }

      const month = String(parseInt(monthIdx) + 1).padStart(2, '0');

      if (!Array.isArray(monthRows)) {
        console.log(`monthRows is not array for key ${key}, type:`, typeof monthRows);
        return;
      }

      monthRows.forEach((row, idx) => {
        if (!row || !row.date) {
          console.log(`Row ${idx} has no date:`, row);
          return;
        }

        const day = String(row.date).padStart(2, '0');
        const fullDateStr = `${year}-${month}-${day}`;
        const rowDate = new Date(fullDateStr + 'T00:00:00Z');
        const inRange = rowDate >= fromDate && rowDate <= toDate;

        console.log(`Row ${idx}: date=${row.date}, full=${fullDateStr}, inRange=${inRange}`);

        if (inRange) {
          rows.push(row);
        }
      });
    });

    console.log('Total rows found:', rows.length);
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

  const exportToExcel = () => {
    const rows = getRowsInDateRange().sort((a, b) => new Date(a.date) - new Date(b.date));
    if (rows.length === 0) {
      alert("No flights found in selected date range");
      return;
    }

    const wb = XLSX.utils.book_new();

    // SHEET 1: PILOT PROFILE
    const profileData = [
      ["PILOT PROFILE"],
      [],
      ["Name", settings?.fullName || ""],
      ["License Number", settings?.licenceNumber || ""],
      ["License Type", settings?.licenceType || ""],
      ["Airline", settings?.airline || ""],
      ["Home Base", settings?.homeBase || ""],
      ["Report Period", `${formatDateForExcel(dateFrom)} to ${formatDateForExcel(dateTo)}`],
    ];
    const wsProfile = XLSX.utils.aoa_to_sheet(profileData);
    wsProfile['!cols'] = [{ wch: 20 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsProfile, "Profile");

    // SHEET 2: CARRY FORWARD HOURS
    const cf = settings?.carryForward?.[0] || {};
    const cfData = [
      ["CARRY FORWARD HOURS"],
      [],
      ["Category", "Hours"],
      ["Day P1", cf.dayP1 || "0:00"],
      ["Day P1 U/S", cf.dayP1US || "0:00"],
      ["Day P2", cf.dayP2 || "0:00"],
      ["Night P1", cf.nightP1 || "0:00"],
      ["Night P1 U/S", cf.nightP1US || "0:00"],
      ["Night P2", cf.nightP2 || "0:00"],
    ];
    const wsCF = XLSX.utils.aoa_to_sheet(cfData);
    wsCF['!cols'] = [{ wch: 20 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsCF, "Carry Forward");

    // SHEET 3: FLIGHT DETAILS (sorted by date, all 20 fields)
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

    const flightData = rows.map(row => COLUMN_ORDER.map(col => {
      if (col === 'date') return formatDateForExcel(row.date);
      return row[col] || "";
    }));

    const wsFlights = XLSX.utils.aoa_to_sheet([flightHeaders, ...flightData]);
    const colWidths = [14, 10, 12, 12, 6, 8, 8, 11, 11, 8, 8, 10, 12, 10, 10, 12, 10, 10, 10, 10];
    wsFlights['!cols'] = colWidths.map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(wb, wsFlights, "Flights");

    // SHEET 4: MONTHLY SUMMARY
    const monthlySummary = {};
    rows.forEach(row => {
      if (!row.date) return;
      const date = new Date(row.date + 'T00:00:00Z');
      const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
      if (!monthlySummary[monthKey]) {
        monthlySummary[monthKey] = { dayP1: 0, dayP1US: 0, dayP2: 0, nightP1: 0, nightP1US: 0, nightP2: 0, flights: 0, total: 0 };
      }
      monthlySummary[monthKey].dayP1 += parseTimeToMinutes(row.dayP1) || 0;
      monthlySummary[monthKey].dayP1US += parseTimeToMinutes(row.dayP1US) || 0;
      monthlySummary[monthKey].dayP2 += parseTimeToMinutes(row.dayP2) || 0;
      monthlySummary[monthKey].nightP1 += parseTimeToMinutes(row.nightP1) || 0;
      monthlySummary[monthKey].nightP1US += parseTimeToMinutes(row.nightP1US) || 0;
      monthlySummary[monthKey].nightP2 += parseTimeToMinutes(row.nightP2) || 0;
      monthlySummary[monthKey].flights += 1;
      monthlySummary[monthKey].total += parseTimeToMinutes(row.total) || 0;
    });

    const summaryHeaders = ["Month", "Day P1", "Day P1 U/S", "Day P2", "Night P1", "Night P1 U/S", "Night P2", "Flights", "Total"];
    const summaryData = Object.entries(monthlySummary)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => [
        month,
        minutesToTime(data.dayP1),
        minutesToTime(data.dayP1US),
        minutesToTime(data.dayP2),
        minutesToTime(data.nightP1),
        minutesToTime(data.nightP1US),
        minutesToTime(data.nightP2),
        data.flights,
        minutesToTime(data.total),
      ]);

    const grandTotal = {
      dayP1: parseTimeToMinutes(cf.dayP1) + summaryData.reduce((sum, row) => sum + parseTimeToMinutes(row[1]), 0),
      dayP1US: parseTimeToMinutes(cf.dayP1US) + summaryData.reduce((sum, row) => sum + parseTimeToMinutes(row[2]), 0),
      dayP2: parseTimeToMinutes(cf.dayP2) + summaryData.reduce((sum, row) => sum + parseTimeToMinutes(row[3]), 0),
      nightP1: parseTimeToMinutes(cf.nightP1) + summaryData.reduce((sum, row) => sum + parseTimeToMinutes(row[4]), 0),
      nightP1US: parseTimeToMinutes(cf.nightP1US) + summaryData.reduce((sum, row) => sum + parseTimeToMinutes(row[5]), 0),
      nightP2: parseTimeToMinutes(cf.nightP2) + summaryData.reduce((sum, row) => sum + parseTimeToMinutes(row[6]), 0),
      flights: summaryData.reduce((sum, row) => sum + row[7], 0),
      total: parseTimeToMinutes(cf.dayP1) + parseTimeToMinutes(cf.dayP1US) + parseTimeToMinutes(cf.dayP2) + parseTimeToMinutes(cf.nightP1) + parseTimeToMinutes(cf.nightP1US) + parseTimeToMinutes(cf.nightP2) + summaryData.reduce((sum, row) => sum + parseTimeToMinutes(row[8]), 0),
    };

    summaryData.push(["GRAND TOTAL", minutesToTime(grandTotal.dayP1), minutesToTime(grandTotal.dayP1US), minutesToTime(grandTotal.dayP2), minutesToTime(grandTotal.nightP1), minutesToTime(grandTotal.nightP1US), minutesToTime(grandTotal.nightP2), grandTotal.flights, minutesToTime(grandTotal.total)]);

    const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryData]);
    wsSummary['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    const fileName = `ClaudeBorne_${dateFrom}_to_${dateTo}.xlsx`;
    XLSX.writeFile(wb, fileName);

    setExportStatus({ success: true, count: rows.length });
    setTimeout(() => setExportStatus(null), 3000);
  };

  // Helper functions for time conversion
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


  const handleExport = () => {
    if (!dateFrom || !dateTo) {
      alert("Please select date range");
      return;
    }
    exportToExcel();
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

    try {
      const buffer = await selectedFile.arrayBuffer();

      if (!selectedFile.name.endsWith(".xlsx")) {
        setImportStatus({ error: "Only .xlsx files are supported" });
        return;
      }

      const workbook = XLSX.read(buffer, { type: "array" });

      // Auto-detect "Flights" sheet
      const flightsSheetName = workbook.SheetNames.find(name => name.toLowerCase() === 'flights');
      if (!flightsSheetName) {
        setImportStatus({ error: 'No "Flights" sheet found in workbook' });
        return;
      }

      const sheet = workbook.Sheets[flightsSheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet);

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

  const validateImportData = (data, headerMap) => {
    const validRows = [];
    const errors = [];
    let duplicateCount = 0;

    data.forEach((row, idx) => {
      const date = row[headerMap.date]?.toString().trim();
      const departure = row[headerMap.departure]?.toString().trim();
      const arrival = row[headerMap.arrival]?.toString().trim();

      // Check required fields
      if (!date) {
        errors.push({ row: idx, reason: 'Missing date' });
        return;
      }
      if (!departure) {
        errors.push({ row: idx, reason: 'Missing departure' });
        return;
      }
      if (!arrival) {
        errors.push({ row: idx, reason: 'Missing arrival' });
        return;
      }

      // Normalize date format
      let normalizedDate = date;
      try {
        // Handle DD-MMM-YYYY format from export
        if (/^\d{2}-\w{3}-\d{4}$/.test(date)) {
          const [day, month, year] = date.split('-');
          const monthNum = new Date(`${month} 1`).getMonth() + 1;
          normalizedDate = `${year}-${String(monthNum).padStart(2, '0')}-${day}`;
        }
      } catch (e) {
        // Keep original date if parsing fails
      }

      // Check if flight already exists in logbook
      const existsInLogbook = Object.values(monthData).some(monthRows =>
        monthRows.some(r =>
          r.date === normalizedDate && r.departure === departure && r.arrival === arrival
        )
      );

      if (existsInLogbook) {
        duplicateCount++;
        return;
      }

      // Build complete row with all fields using headerMap
      const newRow = {};
      for (const [fieldName, headerName] of Object.entries(headerMap)) {
        newRow[fieldName] = row[headerName]?.toString() || "";
      }
      newRow.date = normalizedDate;

      validRows.push(newRow);
    });

    return { validRows, errors, duplicateCount };
  };

  const handleImport = () => {
    if (!importPreview || importPreview.validRows.length === 0) {
      alert("No valid rows to import");
      return;
    }

    // Update monthData with new rows
    const newMonthData = JSON.parse(JSON.stringify(monthData));
    let addedCount = 0;

    importPreview.validRows.forEach(row => {
      const date = new Date(row.date);
      const monthIdx = date.getMonth();
      const year = date.getFullYear();
      const key = `${monthIdx}-${year}`;

      if (!newMonthData[key]) {
        newMonthData[key] = [];
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

    // Return updated monthData to parent
    // (Parent component will handle state update)
    window.dispatchEvent(new CustomEvent("importComplete", {
      detail: { monthData: newMonthData, addedCount, skippedCount: importPreview.duplicateCount, errorCount: importPreview.errors.length }
    }));

    setImportStatus({
      success: true,
      added: addedCount,
      skipped: importPreview.duplicateCount,
      errors: importPreview.errors.length,
    });

    setTimeout(() => {
      onClose();
    }, 2000);
  };

  if (!open) return null;

  return (
    <div className="elb-export-overlay" onClick={handleBackdrop}>
      <style>{exportImportCss}</style>
      <div className="elb-export-modal" role="dialog" aria-modal="true" aria-label="Export/Import">

        {/* ── HEADER ── */}
        <div className="elb-modal-header">
          <div>
            <div className="elb-modal-label">DATA MANAGEMENT</div>
            <div className="elb-modal-title">🌐 EXPORT / IMPORT</div>
          </div>
          <button className="elb-modal-close" onClick={onClose} title="Close">✕</button>
        </div>

        {/* ── TABS ── */}
        <div className="elb-export-tabs">
          <button
            className={"elb-etab" + (tab === "export" ? " active" : "")}
            onClick={() => setTab("export")}
          >
            ⬇ EXPORT
          </button>
          <button
            className={"elb-etab" + (tab === "import" ? " active" : "")}
            onClick={() => setTab("import")}
          >
            ⬆ IMPORT
          </button>
        </div>

        {/* ── CONTENT ── */}
        <div className="elb-export-content">
          {tab === "export" && (
            <div>
              <div className="elb-form-field">
                <label className="elb-form-label">FROM (YYYY-MM-DD)</label>
                <input
                  type="text"
                  className="elb-form-input"
                  placeholder="2025-01-01"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
              </div>

              <div className="elb-form-field">
                <label className="elb-form-label">TO (YYYY-MM-DD)</label>
                <input
                  type="text"
                  className="elb-form-input"
                  placeholder="2026-04-30"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </div>


              {exportStatus?.success && (
                <div className="elb-status-success">
                  ✓ {exportStatus.count} flights exported
                </div>
              )}

              <button className="elb-btn-primary" onClick={handleExport}>
                ⬇ EXPORT
              </button>
            </div>
          )}

          {tab === "import" && (
            <div>
              <div className="elb-form-field">
                <label className="elb-form-label">SELECT FILE</label>
                <input
                  type="file"
                  accept=".xlsx"
                  className="elb-form-input"
                  onChange={handleFileSelect}
                />
                <p className="elb-help-text">.xlsx files only</p>
              </div>

              {file && (
                <div className="elb-file-info">
                  <p className="elb-file-name">{file.name}</p>
                </div>
              )}

              {importPreview && (
                <div className="elb-preview-box">
                  <p className="elb-preview-title">PREVIEW</p>
                  {importPreview.errors.length > 0 && (
                    <div className="elb-errors">
                      <p className="elb-error-label">⚠ {importPreview.errors.length} ERRORS:</p>
                      {importPreview.errors.map((err, i) => (
                        <p key={i} className="elb-error-item">
                          Row {err.row}: {err.reason}
                        </p>
                      ))}
                    </div>
                  )}
                  <table className="elb-preview-table">
                    <tbody>
                      <tr>
                        <td>Valid flights:</td>
                        <td className="elb-count-success">{importPreview.validRows.length}</td>
                      </tr>
                      <tr>
                        <td>Existing (skipped):</td>
                        <td className="elb-count-warning">{importPreview.duplicateCount}</td>
                      </tr>
                      <tr>
                        <td>Errors (skipped):</td>
                        <td className="elb-count-error">{importPreview.errors.length}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {importStatus?.error && (
                <div className="elb-status-error">
                  ✗ {importStatus.error}
                </div>
              )}

              {importStatus?.warning && (
                <div className="elb-status-warning">
                  ⚠ {importStatus.warning}
                </div>
              )}

              {importStatus?.success && (
                <div className="elb-status-success">
                  ✓ {importStatus.added} flights added, {importStatus.skipped} skipped
                </div>
              )}

              <div className="elb-import-actions">
                <button
                  className="elb-btn-primary"
                  onClick={handleImport}
                  disabled={!importPreview || importPreview.validRows.length === 0}
                >
                  📤 IMPORT ({importPreview?.validRows.length || 0} valid)
                </button>
                <button className="elb-btn-ghost" onClick={() => {
                  setFile(null);
                  setImportPreview(null);
                  setImportStatus(null);
                }}>
                  CLEAR
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="elb-modal-footer">
          <button className="elb-btn-ghost" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}

const exportImportCss = `
  .elb-export-overlay{
    position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:2000;
    display:flex;align-items:center;justify-content:center;padding:20px;
    font-family:'Courier New',monospace;animation:elbFadeIn 0.2s ease-out;
  }

  @keyframes elbFadeIn{from{opacity:0;}to{opacity:1;}}

  .elb-export-modal{
    background:#0d1520;border:1px solid #1a3050;border-top:2px solid #4fc3f7;
    border-radius:5px;width:100%;max-width:520px;max-height:85vh;
    display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.5);
    animation:elbPopIn 0.3s cubic-bezier(0.16,1,0.3,1);
  }

  @keyframes elbPopIn{from{opacity:0;transform:scale(0.96) translateY(8px);}to{opacity:1;transform:scale(1) translateY(0);}}

  .elb-modal-header{
    display:flex;align-items:center;justify-content:space-between;
    padding:14px 20px 0;flex-shrink:0;
  }
  .elb-modal-label{font-size:0.85em;letter-spacing:0.2em;color:#4fc3f7;margin-bottom:4px;}
  .elb-modal-title{font-size:1.27em;font-weight:700;color:#e8f4fd;letter-spacing:0.05em;}
  .elb-modal-close{
    background:transparent;border:1px solid #1a3050;color:#4a6a8a;
    font-family:inherit;font-size:1em;width:26px;height:26px;border-radius:3px;
    cursor:pointer;transition:all 0.15s;
  }
  .elb-modal-close:hover{background:rgba(79,195,247,0.08);color:#4fc3f7;border-color:#4fc3f7;}
  .elb-modal-close:active{transform:scale(0.94);}

  .elb-export-tabs{
    display:flex;gap:0;border-bottom:1px solid #1e3a5f;background:#0a0d12;margin-top:12px;
  }
  .elb-etab{
    flex:1;padding:10px;background:#0a0d12;border:none;border-bottom:2px solid #0a0d12;
    color:#b8d6e5;font-family:inherit;font-size:0.9em;letter-spacing:0.1em;cursor:pointer;
    transition:all 0.15s;
  }
  .elb-etab:hover{color:#4fc3f7;}
  .elb-etab.active{
    background:#0b1320;border-bottom:2px solid #4fc3f7;color:#4fc3f7;
  }

  .elb-export-content{
    flex:1;overflow-y:auto;padding:16px 20px;
  }

  .elb-form-field{margin-bottom:14px;}
  .elb-form-label{
    display:block;font-size:0.75em;letter-spacing:0.1em;color:#4fc3f7;margin-bottom:6px;
  }
  .elb-form-input{
    width:100%;padding:8px;background:#0b1828;border:1px solid #1a3050;border-radius:2px;
    color:#9bbcd4;font-family:inherit;font-size:0.9em;box-sizing:border-box;
    transition:border 0.15s;
  }
  .elb-form-input:focus{outline:none;border-color:#4fc3f7;box-shadow:0 0 0 2px rgba(79,195,247,0.1);}

  .elb-format-options{display:flex;gap:8px;}
  .elb-radio-option{
    flex:1;display:flex;align-items:center;gap:6px;padding:8px 10px;
    background:#0b1320;border:1px solid #1a3050;border-radius:2px;cursor:pointer;
    color:#9bbcd4;font-size:0.85em;transition:all 0.15s;
  }
  .elb-radio-option:hover{border-color:#4fc3f7;color:#4fc3f7;}
  .elb-radio-option input[type="radio"]{cursor:pointer;}

  .elb-help-text{
    font-size:0.75em;color:#7ab8d4;margin:4px 0 0;opacity:0.8;
  }

  .elb-file-info{
    padding:10px;background:#0b1320;border:1px solid #1a3050;border-radius:2px;margin-bottom:12px;
  }
  .elb-file-name{margin:0;font-size:0.85em;color:#9bbcd4;}

  .elb-preview-box{
    padding:12px;background:#0b1320;border:1px solid #1a3050;border-radius:2px;margin-bottom:12px;
  }
  .elb-preview-title{
    margin:0 0 8px;font-size:0.75em;letter-spacing:0.1em;color:#7ab8d4;
  }

  .elb-errors{
    margin-bottom:10px;padding:10px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);
    border-radius:2px;
  }
  .elb-error-label{margin:0;font-size:0.85em;color:#ef4444;font-weight:600;}
  .elb-error-item{margin:4px 0;font-size:0.8em;color:#9bbcd4;}

  .elb-preview-table{
    width:100%;font-size:0.8em;border-collapse:collapse;
  }
  .elb-preview-table tr{border-bottom:1px solid #1a3050;}
  .elb-preview-table td{padding:6px 0;color:#9bbcd4;}
  .elb-preview-table td:last-child{text-align:right;font-weight:600;}

  .elb-count-success{color:#22c55e;}
  .elb-count-warning{color:#f5c542;}
  .elb-count-error{color:#ef4444;}

  .elb-status-success{
    padding:10px;background:rgba(34,197,94,0.1);border:1px solid #22c55e;border-radius:2px;
    margin-bottom:12px;color:#22c55e;font-size:0.9em;font-weight:600;
  }
  .elb-status-error{
    padding:10px;background:rgba(239,68,68,0.1);border:1px solid #ef4444;border-radius:2px;
    margin-bottom:12px;color:#ef4444;font-size:0.9em;font-weight:600;
  }
  .elb-status-warning{
    padding:10px;background:rgba(245,197,66,0.1);border:1px solid #f5c542;border-radius:2px;
    margin-bottom:12px;color:#f5c542;font-size:0.9em;font-weight:600;
  }

  .elb-import-actions{display:flex;gap:8px;}
  .elb-btn-primary{
    flex:1;padding:10px;background:rgba(79,195,247,0.1);border:1px solid #4fc3f7;border-radius:2px;
    color:#4fc3f7;font-family:inherit;font-size:0.9em;cursor:pointer;font-weight:600;
    letter-spacing:0.05em;transition:all 0.15s;
  }
  .elb-btn-primary:hover:not(:disabled){background:rgba(79,195,247,0.15);box-shadow:0 0 0 2px rgba(79,195,247,0.2);}
  .elb-btn-primary:active:not(:disabled){transform:scale(0.98);}
  .elb-btn-primary:disabled{opacity:0.4;cursor:not-allowed;}

  .elb-btn-ghost{
    flex:1;padding:10px;background:transparent;border:1px solid #1a3050;border-radius:2px;
    color:#b8d6e5;font-family:inherit;font-size:0.9em;cursor:pointer;
    letter-spacing:0.05em;transition:all 0.15s;
  }
  .elb-btn-ghost:hover{border-color:#4fc3f7;color:#4fc3f7;}
  .elb-btn-ghost:active{transform:scale(0.98);}

  .elb-modal-footer{
    padding:12px 20px;border-top:1px solid #1e3a5f;background:#0a0d12;flex-shrink:0;
    display:flex;gap:8px;justify-content:flex-end;
  }
`;
