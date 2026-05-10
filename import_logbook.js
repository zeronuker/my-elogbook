// ─────────────────────────────────────────────────────────────────────────────
// eLOGBOOK — Historical Data Import Script v4
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import pkg from "xlsx";
const { readFile: xlsxReadFile, utils } = pkg;
import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import dotenv from "dotenv";
dotenv.config();

// ── Firebase config ───────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            process.env.VITE_FIREBASE_API_KEY,
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.VITE_FIREBASE_APP_ID,
};

const USER_UID = "7y9YNq9ZtYa6B1u3w2DQneRBzMa2";

// ── IATA → ICAO ───────────────────────────────────────────────────────────────
const IATA_TO_ICAO = {
  AOR:"WMKA", ATQ:"VIAR", BKI:"WBKK", BNE:"YBBN",
  BOM:"VABB", BTH:"WIDD", BTU:"WBGB", BKK:"VTBS",
  DMK:"VTBD", CAN:"ZGGG", CGK:"WIII", CGO:"ZHCC",
  COK:"VOCI", CSX:"ZGHA", DAC:"VGHS", DEL:"VIDP",
  DIL:"WPDL", DPS:"WADD", DXB:"OMDB", HDY:"VTSS",
  HKG:"VHHH", HKT:"VTSP", ICN:"RKSI", JHB:"WMKJ",
  KBR:"WMKC", KBV:"VTSG", KCH:"WBGG", KIX:"RJBB",
  KMG:"ZPPP", KNO:"WIMM", KUL:"WMKK", LGK:"WMKL",
  LHE:"OPLA", LOP:"WADL", MEL:"YMML", MLE:"VRMM",
  MYY:"WBGR", NRT:"RJAA", OKA:"ROAH", PEN:"WMKP",
  PER:"YPPH", PLM:"WIPP", SBW:"WBGS", SDK:"WBKD",
  SIN:"WSSS", SYD:"YSSY", SYX:"ZJSY", SZB:"WMSA",
  TPE:"RCTP", TRZ:"VOTR", TWU:"WBKT", TXN:"ZSTX",
};

// ── Excel serial date → { day, month0, year } ─────────────────────────────────
function excelSerialToDate(serial) {
  // JS Date: serial 25569 = 1 Jan 1970
  const d = new Date((serial - 25569) * 86400000);
  return { day: d.getUTCDate(), month0: d.getUTCMonth(), year: d.getUTCFullYear() };
}

// ── Serial → "DD/MM/YYYY" ─────────────────────────────────────────────────────
function formatDate(serial) {
  const { day, month0, year } = excelSerialToDate(serial);
  return `${String(day).padStart(2,"0")}/${String(month0+1).padStart(2,"0")}/${year}`;
}

// ── Fractional day → "HH:MM" ─────────────────────────────────────────────────
function fracToHHMM(frac) {
  if (frac === null || frac === undefined) return "";
  const f = typeof frac === "number" ? frac : parseFloat(frac);
  if (isNaN(f)) return "";
  // Remove integer part (date component if combined datetime)
  const timeFrac = f % 1;
  const totalMins = Math.round(timeFrac * 24 * 60);
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

// ── IATA → ICAO ───────────────────────────────────────────────────────────────
function toICAO(iata) {
  if (!iata) return "";
  const code = String(iata).trim().toUpperCase();
  if (IATA_TO_ICAO[code]) return IATA_TO_ICAO[code];
  if (code.length === 4) return code;
  console.warn(`  ⚠  Unknown IATA: "${code}" — kept as-is`);
  return code;
}

// ── Month key matching app format: "monthIndex-year" ─────────────────────────
function getMonthKey(serial) {
  const { month0, year } = excelSerialToDate(serial);
  return `${month0}-${year}`;
}

// ── Empty row ─────────────────────────────────────────────────────────────────
function emptyRow(id) {
  return {
    id, date:"", type:"", markings:"", captain:"", cap:"",
    departure:"", arrival:"", std:"", sta:"",
    dayP1:"", dayP1US:"", dayP2:"",
    nightP1:"", nightP1US:"", nightP2:"", total:"",
  };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  eLOGBOOK — Historical Import Script v4");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
  const xlsxPath  = path.join(__dirname, "LOGBOOK.xlsx");

  if (!fs.existsSync(xlsxPath)) {
    console.error(`\n❌  LOGBOOK.xlsx not found at: ${xlsxPath}\n`);
    process.exit(1);
  }

  console.log(`\n📂  Reading: ${xlsxPath}`);

  // raw:true = keep numbers as numbers (dates stay as serials, times as fractions)
  const wb   = xlsxReadFile(xlsxPath, { cellDates: false });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = utils.sheet_to_json(ws, { raw: true, defval: null });

  console.log(`    ${rows.length} rows found.\n`);

  // Print first row for debugging
  console.log("🔍  First row raw values:");
  const firstRow = rows[0];
  for (const [k, v] of Object.entries(firstRow)) {
    console.log(`    "${k}" = ${JSON.stringify(v)} (${typeof v})`);
  }
  console.log("");

  const logbookData = {};
  let rowCount = 0;
  let skipCount = 0;

  for (const row of rows) {
    const dateSerial = row["Date (dd/mm/yyyy)"] ?? row["Date"];
    const markings   = String(row["Markings"] ?? "").trim().toUpperCase();
    const type       = String(row["Type"]     ?? "").trim().toUpperCase();
    const depIATA    = String(row["DEP"]      ?? "").trim().toUpperCase();
    const arrIATA    = String(row["ARR"]      ?? "").trim().toUpperCase();
    const stdRaw     = row["STD (UTC)"] ?? row["STD"];
    const staRaw     = row["STA (UTC)"] ?? row["STA"];
    const p1         = String(row["P1"] ?? "").trim().toUpperCase();
    const p2         = String(row["P2"] ?? "").trim().toUpperCase();

    if (!dateSerial || typeof dateSerial !== "number") {
      skipCount++;
      continue;
    }

    const dateStr = formatDate(dateSerial);
    const key     = getMonthKey(dateSerial);
    const dep     = toICAO(depIATA);
    const arr     = toICAO(arrIATA);
    const std     = fracToHHMM(stdRaw);
    const sta     = fracToHHMM(staRaw);
    const cap     = p1 === "YES" ? "P1" : p2 === "YES" ? "P2" : "";

    if (!logbookData[key]) logbookData[key] = [];

    logbookData[key].push({
      ...emptyRow(logbookData[key].length + 1),
      date: dateStr,
      markings,
      type,
      captain: "SELF",
      cap,
      departure: dep,
      arrival:   arr,
      std,
      sta,
    });

    rowCount++;
  }

  // Pad each month to minimum 15 rows
  for (const key of Object.keys(logbookData)) {
    while (logbookData[key].length < 15) {
      logbookData[key].push(emptyRow(logbookData[key].length + 1));
    }
  }

  // Sort keys by year then month for display
  const MONTH_NAMES = ["January","February","March","April","May","June",
                       "July","August","September","October","November","December"];

  const months = Object.keys(logbookData).sort((a, b) => {
    const [am, ay] = a.split("-").map(Number);
    const [bm, by] = b.split("-").map(Number);
    return ay !== by ? ay - by : am - bm;
  });

  console.log(`✅  Parsed ${rowCount} sectors across ${months.length} months.`);
  if (skipCount > 0) console.log(`⚠   ${skipCount} rows skipped.`);
  console.log("\n📅  Months detected:");
  for (const k of months) {
    const [m, y] = k.split("-").map(Number);
    const realCount = logbookData[k].filter(r => r.date !== "").length;
    console.log(`    ${MONTH_NAMES[m]} ${y}  —  ${realCount} real sectors`);
  }

  // Push to Firebase
  console.log("\n🔥  Connecting to Firebase...");
  const app = initializeApp(firebaseConfig);
  const db  = getFirestore(app);
  const ref = doc(db, "users", USER_UID, "logbook", "data");
  console.log(`📤  Writing to: users/${USER_UID}/logbook/data`);

  await setDoc(ref, { logbookData, updatedAt: new Date().toISOString() });

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  ✅  IMPORT COMPLETE! ${rowCount} sectors across ${months.length} months.`);
  console.log("  Open claudeborne.my, sign in, and your data is there.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  process.exit(0);
}

main().catch(err => {
  console.error("\n❌  Import failed:", err.message);
  console.error(err);
  process.exit(1);
});
