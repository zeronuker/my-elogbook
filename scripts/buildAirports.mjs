// Run once to generate src/airportCoords.json
// Usage: node scripts/buildAirports.mjs

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../src/airportCoords.json');

// Minimal CSV parser — handles quoted fields
function parseCSV(text) {
  const rows = [];
  const lines = text.replace(/\r/g, '').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = [];
    let field = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { cols.push(field); field = ''; }
      else { field += c; }
    }
    cols.push(field);
    rows.push(cols);
  }
  return rows;
}

console.log('Fetching OurAirports data...');
const res  = await fetch('https://davidmegginson.github.io/ourairports-data/airports.csv');
const text = await res.text();
const rows = parseCSV(text);

const header = rows[0];
const iIcao  = header.indexOf('ident');
const iLat   = header.indexOf('latitude_deg');
const iLon   = header.indexOf('longitude_deg');
const iType  = header.indexOf('type');

if (iIcao === -1) { console.error('Header parse failed:', header.slice(0,6)); process.exit(1); }

const SKIP  = new Set(['heliport', 'seaplane_base', 'balloonport', 'closed']);
const coords = {};

for (let i = 1; i < rows.length; i++) {
  const cols = rows[i];
  if (!cols[iType] || SKIP.has(cols[iType])) continue;
  const icao = cols[iIcao];
  const lat  = parseFloat(cols[iLat]);
  const lon  = parseFloat(cols[iLon]);
  if (icao && icao.length >= 3 && !isNaN(lat) && !isNaN(lon)) {
    coords[icao] = [+lat.toFixed(4), +lon.toFixed(4)];
  }
}

writeFileSync(OUT, JSON.stringify(coords));
console.log(`Done — ${Object.keys(coords).length} airports written to src/airportCoords.json`);
