// One-off generator for the standalone eLogBook PWA icon set.
// Rasterizes the hand-authored SVGs in public/brand/icons/elogbook/ into the
// PNG sizes needed for iOS/Android/favicons. Run with: node scripts/generate-brand-icons.mjs
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const FONT_CSS_URL = 'https://fonts.googleapis.com/css2?family=Tourney:wght@900&display=swap';

async function getTourneyFont() {
  const cachePath = join(tmpdir(), 'tourney-900.ttf');
  if (existsSync(cachePath)) return cachePath;
  const css = await fetch(FONT_CSS_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
  const fontUrl = css.match(/url\(([^)]+)\)/)[1];
  const buf = await fetch(fontUrl).then((r) => r.arrayBuffer());
  writeFileSync(cachePath, Buffer.from(buf));
  return cachePath;
}

const SIZES = [
  { file: 'favicon-16.png', size: 16 },
  { file: 'favicon-32.png', size: 32 },
  { file: 'icon-72.png', size: 72 },
  { file: 'apple-touch-icon-120.png', size: 120 },
  { file: 'apple-touch-icon-152.png', size: 152 },
  { file: 'apple-touch-icon-167.png', size: 167 },
  { file: 'apple-touch-icon-180.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
];

const APPS = ['elogbook'];

async function main() {
  const fontPath = await getTourneyFont();

  for (const app of APPS) {
    const dir = join('public', 'brand', 'icons', app);
    const regularSvg = readFileSync(join(dir, 'icon-source.svg'), 'utf8');
    const maskableSvg = readFileSync(join(dir, 'icon-source-maskable.svg'), 'utf8');

    for (const { file, size } of SIZES) {
      const resvg = new Resvg(regularSvg, {
        fitTo: { mode: 'width', value: size },
        font: { fontFiles: [fontPath], loadSystemFonts: false, defaultFontFamily: 'Tourney' },
      });
      writeFileSync(join(dir, file), resvg.render().asPng());
    }

    const maskable = new Resvg(maskableSvg, {
      fitTo: { mode: 'width', value: 512 },
      font: { fontFiles: [fontPath], loadSystemFonts: false, defaultFontFamily: 'Tourney' },
    });
    writeFileSync(join(dir, 'icon-maskable-512.png'), maskable.render().asPng());

    console.log(`Generated icons for ${app}`);
  }
}

main();
