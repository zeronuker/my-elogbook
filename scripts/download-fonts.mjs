#!/usr/bin/env node
/**
 * Downloads Google Fonts as woff2 files to public/fonts/
 * and generates public/brand/fonts.css with @font-face declarations.
 *
 * Run once: node scripts/download-fonts.mjs
 * Re-run to add new fonts — already-downloaded files are skipped.
 */
import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT      = path.resolve(__dirname, '..')
const FONTS_DIR = path.join(ROOT, 'public', 'fonts')
const CSS_OUT   = path.join(ROOT, 'public', 'brand', 'fonts.css')

// Chrome 120 UA — tells Google Fonts to serve woff2 format
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// Only download latin + latin-ext subsets (sufficient for this app)
const WANTED_SUBSETS = new Set(['latin', 'latin-ext'])

const FONT_DEFS = [
  { family: 'Tourney',        slug: 'tourney',        weights: [500, 700, 900] },
  { family: 'Inter',          slug: 'inter',          weights: [400, 500, 600, 700] },
  { family: 'JetBrains Mono', slug: 'jetbrains-mono', weights: [400, 500, 700] },
  { family: 'IBM Plex Mono',  slug: 'ibm-plex-mono',  weights: [400, 500, 700] },
  { family: 'Roboto Mono',    slug: 'roboto-mono',    weights: [400, 500, 700] },
  { family: 'Space Mono',     slug: 'space-mono',     weights: [400, 700] },
  { family: 'Courier Prime',  slug: 'courier-prime',  weights: [400, 700] },
  { family: 'Chakra Petch',   slug: 'chakra-petch',   weights: [500, 600, 700] },
]

// ── HTTP helpers ─────────────────────────────────────────────────────────────

async function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': UA } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchBuffer(res.headers.location).then(resolve, reject)
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        return
      }
      const chunks = []
      res.on('data', c => chunks.push(Buffer.from(c)))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    })
    req.on('error', reject)
  })
}

const fetchText = async url => (await fetchBuffer(url)).toString('utf8')

// ── CSS parser ───────────────────────────────────────────────────────────────

function parseFontFaceBlocks(css) {
  const blocks = []
  // Google Fonts CSS format: each @font-face is preceded by a /* subset */ comment
  const pattern = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]+)\}/g
  let m
  while ((m = pattern.exec(css)) !== null) {
    const subset = m[1].trim()
    const body   = m[2]

    const weightMatch = body.match(/font-weight:\s*(\d+)/)
    const styleMatch  = body.match(/font-style:\s*(\w+)/)
    const urlMatch    = body.match(/url\((https:\/\/[^)]+\.woff2)\)/)
    const rangeMatch  = body.match(/unicode-range:\s*([^;]+)/)

    if (!weightMatch || !urlMatch) continue
    // Skip italic variants
    if (styleMatch && styleMatch[1] !== 'normal') continue

    blocks.push({
      subset,
      weight:       parseInt(weightMatch[1]),
      woff2Url:     urlMatch[1],
      unicodeRange: rangeMatch ? rangeMatch[1].trim() : '',
    })
  }
  return blocks
}

// ── Per-family download ──────────────────────────────────────────────────────

async function downloadFamily(def, allDecls) {
  const { family, slug, weights } = def
  const familyParam = family.replace(/ /g, '+')
  const cssUrl = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weights.join(';')}&display=swap`

  console.log(`\n▸ ${family} [${weights.join(', ')}]`)
  let css
  try {
    css = await fetchText(cssUrl)
  } catch (e) {
    console.error(`  ERROR fetching CSS: ${e.message}`)
    return
  }

  const blocks = parseFontFaceBlocks(css)
  if (blocks.length === 0) {
    console.warn(`  WARNING: no @font-face blocks parsed — check CSS format`)
    return
  }

  const dir = path.join(FONTS_DIR, slug)
  fs.mkdirSync(dir, { recursive: true })

  for (const block of blocks) {
    if (!WANTED_SUBSETS.has(block.subset)) continue
    if (!weights.includes(block.weight)) continue

    const fileName = `${slug}-${block.weight}-${block.subset}.woff2`
    const filePath = path.join(dir, fileName)

    if (fs.existsSync(filePath)) {
      console.log(`  ✓ ${fileName} (cached)`)
    } else {
      try {
        const buf = await fetchBuffer(block.woff2Url)
        fs.writeFileSync(filePath, buf)
        console.log(`  ↓ ${fileName} (${Math.round(buf.length / 1024)}kb)`)
      } catch (e) {
        console.error(`  ERROR downloading ${fileName}: ${e.message}`)
        continue
      }
    }

    allDecls.push({
      family,
      weight:       block.weight,
      subset:       block.subset,
      unicodeRange: block.unicodeRange,
      localPath:    `/fonts/${slug}/${fileName}`,
    })
  }
}

// ── CSS generator ────────────────────────────────────────────────────────────

function generateCSS(decls) {
  // Group by family for readable output
  const byFamily = {}
  for (const d of decls) {
    if (!byFamily[d.family]) byFamily[d.family] = []
    byFamily[d.family].push(d)
  }

  let css = `/* ================================================================
   ClaudeBorne · Self-hosted web fonts
   Generated by scripts/download-fonts.mjs — do not edit by hand.
   Source: Google Fonts (OFL-1.1 / Apache 2.0 licensed)
   Load once from index.html: <link rel="stylesheet" href="/brand/fonts.css" />
   ================================================================ */\n\n`

  for (const [family, entries] of Object.entries(byFamily)) {
    css += `/* ── ${family} ${'─'.repeat(Math.max(0, 55 - family.length))} */\n`
    for (const d of entries) {
      css += `@font-face {\n`
      css += `  font-family: '${d.family}';\n`
      css += `  font-style: normal;\n`
      css += `  font-weight: ${d.weight};\n`
      css += `  font-display: swap;\n`
      css += `  src: url('${d.localPath}') format('woff2');\n`
      if (d.unicodeRange) css += `  unicode-range: ${d.unicodeRange};\n`
      css += `}\n`
    }
    css += `\n`
  }

  return css
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('ClaudeBorne font downloader\n')
  fs.mkdirSync(FONTS_DIR, { recursive: true })

  const allDecls = []
  for (const def of FONT_DEFS) {
    await downloadFamily(def, allDecls)
  }

  if (allDecls.length === 0) {
    console.error('\nNo fonts downloaded — check network or CSS parsing.')
    process.exit(1)
  }

  const css = generateCSS(allDecls)
  fs.writeFileSync(CSS_OUT, css)

  console.log(`\n✓ ${allDecls.length} font files ready in public/fonts/`)
  console.log(`✓ ${CSS_OUT} written`)
}

main().catch(e => { console.error(e); process.exit(1) })
