// Country of an airport from its ICAO code. Codes are handed out by region, so the first one or two
// letters give the country; the few airports that break the pattern are listed in EXACT.
// A code that matches nothing returns null and is left out of the "countries visited" count.
const EXACT = { WBSB: "Brunei", GCCC: "Spain", LXGB: "Gibraltar" };

const TWO = {
  // Southeast and South Asia
  WM: "Malaysia", WB: "Malaysia", WS: "Singapore", WI: "Indonesia", WA: "Indonesia", WQ: "Indonesia", WR: "Indonesia", WP: "Timor-Leste",
  VT: "Thailand", VV: "Vietnam", VD: "Cambodia", VL: "Laos", VY: "Myanmar", VH: "Hong Kong", VM: "Macau",
  VA: "India", VE: "India", VI: "India", VO: "India", VC: "Sri Lanka", VR: "Maldives", VG: "Bangladesh", VN: "Nepal", VQ: "Bhutan",
  // East Asia
  RJ: "Japan", RO: "Japan", RK: "South Korea", RC: "Taiwan", RP: "Philippines",
  ZK: "North Korea", ZM: "Mongolia", ZB: "China", ZG: "China", ZH: "China", ZJ: "China", ZL: "China", ZP: "China", ZS: "China", ZU: "China", ZW: "China", ZY: "China",
  // Oceania and Pacific
  AY: "Papua New Guinea", NZ: "New Zealand", NF: "Fiji", NG: "Kiribati", NS: "Samoa", NT: "French Polynesia", NV: "Vanuatu", NW: "New Caledonia", NC: "Cook Islands",
  PA: "United States", PH: "United States", PG: "Guam", PK: "Marshall Islands", PT: "Micronesia", PW: "United States", PM: "United States", PJ: "United States",
  // Middle East and Central Asia
  OE: "Saudi Arabia", OM: "UAE", OT: "Qatar", OB: "Bahrain", OK: "Kuwait", OO: "Oman", OJ: "Jordan", OL: "Lebanon", OS: "Syria", OI: "Iran", OR: "Iraq", OY: "Yemen", OP: "Pakistan", OA: "Afghanistan",
  UA: "Kazakhstan", UB: "Azerbaijan", UC: "Kyrgyzstan", UD: "Armenia", UG: "Georgia", UK: "Ukraine", UM: "Belarus", UT: "Uzbekistan", UZ: "Uzbekistan",
  // Europe
  EG: "United Kingdom", EI: "Ireland", EH: "Netherlands", EB: "Belgium", EL: "Luxembourg", ED: "Germany", ET: "Germany", EK: "Denmark", EN: "Norway", ES: "Sweden", EF: "Finland",
  EP: "Poland", EV: "Latvia", EY: "Lithuania", EE: "Estonia", BI: "Iceland", BG: "Greenland", BK: "Kosovo",
  LF: "France", LE: "Spain", LI: "Italy", LP: "Portugal", LS: "Switzerland", LO: "Austria", LK: "Czechia", LH: "Hungary", LG: "Greece", LT: "Turkey", LR: "Romania", LB: "Bulgaria",
  LD: "Croatia", LJ: "Slovenia", LZ: "Slovakia", LY: "Serbia", LQ: "Bosnia and Herzegovina", LW: "North Macedonia", LA: "Albania", LM: "Malta", LC: "Cyprus", LL: "Israel", LU: "Moldova",
  // Africa
  DA: "Algeria", DT: "Tunisia", DN: "Nigeria", DG: "Ghana", DI: "Ivory Coast", DR: "Niger", DF: "Burkina Faso", DX: "Togo", DB: "Benin",
  GM: "Morocco", GO: "Senegal", GQ: "Mauritania", GA: "Mali", GB: "Gambia", GF: "Sierra Leone", GG: "Guinea-Bissau", GL: "Liberia", GU: "Guinea", GV: "Cape Verde", GC: "Spain",
  HE: "Egypt", HL: "Libya", HS: "Sudan", HA: "Ethiopia", HK: "Kenya", HT: "Tanzania", HU: "Uganda", HR: "Rwanda", HB: "Burundi", HC: "Somalia", HD: "Djibouti", HH: "Eritrea",
  FA: "South Africa", FB: "Botswana", FC: "Congo", FD: "Eswatini", FE: "Central African Republic", FG: "Equatorial Guinea", FI: "Mauritius", FK: "Cameroon", FL: "Zambia",
  FM: "Madagascar", FN: "Angola", FO: "Gabon", FP: "Sao Tome and Principe", FQ: "Mozambique", FS: "Seychelles", FT: "Chad", FV: "Zimbabwe", FW: "Malawi", FX: "Lesotho", FY: "Namibia", FZ: "DR Congo",
  // Americas
  MM: "Mexico", MG: "Guatemala", MH: "Honduras", MN: "Nicaragua", MR: "Costa Rica", MP: "Panama", MS: "El Salvador", MZ: "Belize", MY: "Bahamas", MK: "Jamaica", MU: "Cuba", MD: "Dominican Republic", MT: "Haiti",
  TJ: "Puerto Rico", TT: "Trinidad and Tobago", TB: "Barbados", TX: "Bermuda",
  SB: "Brazil", SA: "Argentina", SC: "Chile", SK: "Colombia", SE: "Ecuador", SP: "Peru", SV: "Venezuela", SU: "Uruguay", SL: "Bolivia", SG: "Paraguay", SM: "Suriname", SY: "Guyana",
};

// A single letter is enough only where one country holds the whole block.
const ONE = { K: "United States", C: "Canada", Y: "Australia", U: "Russia" };

export function countryOf(icao) {
  const c = String(icao || "").toUpperCase().trim();
  if (EXACT[c]) return EXACT[c];
  return TWO[c.slice(0, 2)] || ONE[c[0]] || null;
}
