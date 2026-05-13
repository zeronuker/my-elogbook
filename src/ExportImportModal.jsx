import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";

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

export default function ExportImportModal({ open, onClose, monthData }) {
  const [tab, setTab] = useState("export");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [format, setFormat] = useState("excel");
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
    }
  }, [open]);

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
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    const rows = [];

    Object.entries(monthData).forEach(([key, monthRows]) => {
      monthRows.forEach(row => {
        if (!row.date) return;
        const rowDate = new Date(row.date);
        if (rowDate >= from && rowDate <= to) {
          rows.push(row);
        }
      });
    });

    return rows;
  };

  const exportToExcel = () => {
    const rows = getRowsInDateRange();
    if (rows.length === 0) {
      alert("No flights found in selected date range");
      return;
    }

    const flatRows = rows.map(row => {
      const obj = {};
      COLUMN_ORDER.forEach(col => {
        obj[col] = row[col] || "";
      });
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(flatRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Logbook");

    const fileName = `ClaudeBorne_${dateFrom}_to_${dateTo}.xlsx`;
    XLSX.writeFile(wb, fileName);

    setExportStatus({ success: true, count: rows.length });
    setTimeout(() => setExportStatus(null), 3000);
  };

  const exportToPDF = () => {
    const rows = getRowsInDateRange();
    if (rows.length === 0) {
      alert("No flights found in selected date range");
      return;
    }

    const flatRows = rows.map(row => {
      return COLUMN_ORDER.map(col => row[col] || "");
    });

    const doc = new jsPDF({ orientation: "landscape" });
    doc.autoTable({
      head: [COLUMN_ORDER],
      body: flatRows,
      startY: 10,
      styles: {
        font: "courier",
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [31, 58, 95],
        textColor: [79, 195, 247],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [13, 21, 32],
      },
    });

    const fileName = `ClaudeBorne_${dateFrom}_to_${dateTo}.pdf`;
    doc.save(fileName);

    setExportStatus({ success: true, count: rows.length });
    setTimeout(() => setExportStatus(null), 3000);
  };

  const handleExport = () => {
    if (!dateFrom || !dateTo) {
      alert("Please select date range");
      return;
    }
    if (format === "excel") {
      exportToExcel();
    } else {
      exportToPDF();
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // IMPORT LOGIC
  // ─────────────────────────────────────────────────────────────────

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportPreview(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      let data = [];

      if (selectedFile.name.endsWith(".xlsx")) {
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(sheet);
      } else {
        setImportStatus({ error: "PDF import not yet implemented. Use Excel format." });
        return;
      }

      // Validate and create preview
      const { validRows, errors, existing, duplicateCount } = validateImportData(data);

      setImportPreview({
        totalDetected: data.length,
        validRows,
        errors,
        existing,
        duplicateCount,
      });
    } catch (err) {
      setImportStatus({ error: `Failed to read file: ${err.message}` });
    }
  };

  const validateImportData = (data) => {
    const validRows = [];
    const errors = [];
    let duplicateCount = 0;

    data.forEach((row, idx) => {
      const date = row.date?.trim();
      const departure = row.departure?.trim();
      const arrival = row.arrival?.trim();

      // Check required fields
      if (!date) {
        errors.push({ row: idx + 1, reason: 'Missing date' });
        return;
      }
      if (!departure) {
        errors.push({ row: idx + 1, reason: 'Missing departure' });
        return;
      }
      if (!arrival) {
        errors.push({ row: idx + 1, reason: 'Missing arrival' });
        return;
      }

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        errors.push({ row: idx + 1, reason: 'Invalid date format (use YYYY-MM-DD)' });
        return;
      }

      // Check if flight already exists in logbook
      const existsInLogbook = Object.values(monthData).some(monthRows =>
        monthRows.some(r =>
          r.date === date && r.departure === departure && r.arrival === arrival
        )
      );

      if (existsInLogbook) {
        duplicateCount++;
        return; // Skip, don't add to validRows
      }

      validRows.push(row);
    });

    return { validRows, errors, existing: duplicateCount, duplicateCount };
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
                <label className="elb-form-label">FROM</label>
                <input
                  type="date"
                  className="elb-form-input"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
              </div>

              <div className="elb-form-field">
                <label className="elb-form-label">TO</label>
                <input
                  type="date"
                  className="elb-form-input"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
              </div>

              <div className="elb-form-field">
                <label className="elb-form-label">FORMAT</label>
                <div className="elb-format-options">
                  <label className="elb-radio-option">
                    <input
                      type="radio"
                      name="format"
                      value="excel"
                      checked={format === "excel"}
                      onChange={e => setFormat(e.target.value)}
                    />
                    EXCEL
                  </label>
                  <label className="elb-radio-option">
                    <input
                      type="radio"
                      name="format"
                      value="pdf"
                      checked={format === "pdf"}
                      onChange={e => setFormat(e.target.value)}
                    />
                    PDF
                  </label>
                </div>
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
                  accept=".xlsx,.pdf"
                  className="elb-form-input"
                  onChange={handleFileSelect}
                />
                <p className="elb-help-text">.xlsx or .pdf files only</p>
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
