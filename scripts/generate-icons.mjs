#!/usr/bin/env node
/**
 * Generates all PWA icon PNGs from a programmatic SVG.
 * Requires: fontkit, sharp (devDependencies)
 * Run: node scripts/generate-icons.mjs
 */
import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as fontkit from 'fontkit'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'public', 'brand', 'icons')
fs.mkdirSync(OUT, { recursive: true })

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// ── HTTP helpers ────────────────────────────────────────────────────────────

async function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const req = mod.get(url, { headers: { 'User-Agent': UA } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchBuffer(res.headers.location).then(resolve, reject)
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

// ── Font download ────────────────────────────────────────────────────────────

async function downloadFont() {
  // Prefer the self-hosted file (populated by scripts/download-fonts.mjs)
  const localPath = path.join(ROOT, 'public', 'fonts', 'tourney', 'tourney-700-latin.woff2')
  if (fs.existsSync(localPath)) {
    console.log('Using local Tourney 700 font:', localPath)
    return fs.readFileSync(localPath)
  }
  // Fallback: fetch from Google Fonts (requires network)
  console.log('Local font not found — fetching from Google Fonts...')
  const cssUrl =
    'https://fonts.googleapis.com/css2?family=Tourney:wght@700&display=swap'
  const css = await fetchText(cssUrl)
  for (const block of css.split('@font-face')) {
    if (!block.includes('U+0000-00FF')) continue
    const m = block.match(/url\((https:\/\/[^)]+\.woff2)\)/)
    if (m) {
      const woff2Url = m[1]
      console.log('Downloading woff2:', woff2Url)
      return fetchBuffer(woff2Url)
    }
  }
  throw new Error('Could not locate latin woff2 URL in Google Fonts CSS response')
}

// ── Glyph path → SVG d string (font coordinates, y-up) ──────────────────────

function glyphToD(glyphPath) {
  // fontkit Path exposes a .commands array
  if (glyphPath.commands && Array.isArray(glyphPath.commands)) {
    let d = ''
    for (const c of glyphPath.commands) {
      const a = c.args
      switch (c.command) {
        case 'moveTo':
          d += `M${a[0]},${a[1]}`
          break
        case 'lineTo':
          d += `L${a[0]},${a[1]}`
          break
        // cubic bezier (fontkit uses multiple names across versions)
        case 'curveTo':
        case 'bezierCurveTo':
        case 'cubicCurveTo':
          d += `C${a[0]},${a[1]},${a[2]},${a[3]},${a[4]},${a[5]}`
          break
        // quadratic bezier
        case 'qCurveTo':
        case 'quadraticCurveTo':
        case 'conicCurveTo':
          d += `Q${a[0]},${a[1]},${a[2]},${a[3]}`
          break
        case 'closePath':
          d += 'Z'
          break
      }
    }
    return d
  }
  // Fallback: fontkit also exposes .toSVG() on older builds
  if (typeof glyphPath.toSVG === 'function') return glyphPath.toSVG()
  return ''
}

// ── SVG builder ──────────────────────────────────────────────────────────────

const TEAL  = '#3dd9cc'
const WHITE = '#ffffff'
const W     = 512  // base canvas size

function buildSVG(font, maskable = false) {
  const upm       = font.unitsPerEm
  const fontSize  = 150        // px at 512×512
  const fsc       = fontSize / upm   // font → SVG scale
  const ls        = 1.5        // letter-spacing px between chars
  // Shrink content for maskable so OS masking never clips it
  const cs        = maskable ? 0.74 : 1.0

  // Font vertical metrics (in font units → px)
  const asc = ((font.ascent  ?? font.ascender  ?? upm * 0.80)) * fsc
  const dsc = Math.abs((font.descent ?? font.descender ?? upm * 0.20)) * fsc

  // Measure total advance width of a string
  function measureWidth(text) {
    return text.split('').reduce((sum, ch, i) => {
      const g = font.glyphForCodePoint(ch.codePointAt(0))
      return sum + g.advanceWidth * fsc + (i < text.length - 1 ? ls : 0)
    }, 0)
  }

  // Compute vertical layout (centered in W×W canvas)
  const rowH   = asc + dsc
  const gap    = 20
  const blockH = (rowH * 2 + gap) * cs
  const blockTop = (W - blockH) / 2

  const y1   = blockTop + asc * cs                         // row-1 baseline
  const divY = y1 + dsc * cs + (gap * cs) / 2             // divider y
  const y2   = divY + (gap * cs) / 2 + asc * cs           // row-2 baseline

  // Render one row of text as SVG <g> elements
  function renderRow(text, outlineIdx, baseline) {
    const totalW = measureWidth(text) * cs
    let x = (W - totalW) / 2
    let out = ''

    text.split('').forEach((ch, i) => {
      const g       = font.glyphForCodePoint(ch.codePointAt(0))
      const advance = g.advanceWidth * fsc * cs
      const sc      = fsc * cs
      const d       = glyphToD(g.path)

      const isOutline = (i === outlineIdx)
      // stroke-width is in pre-transform font units, so divide by sc
      const strokeW   = isOutline ? (3.5 / sc).toFixed(2) : '0'

      out +=
        `<g transform="translate(${x.toFixed(2)},${baseline.toFixed(2)}) ` +
        `scale(${sc.toFixed(7)},${(-sc).toFixed(7)})">` +
        `<path d="${d}" fill="${isOutline ? 'none' : WHITE}" ` +
        `stroke="${isOutline ? TEAL : 'none'}" stroke-width="${strokeW}"/>` +
        `</g>\n`

      x += advance + (i < text.length - 1 ? ls * cs : 0)
    })
    return out
  }

  // Divider line — ~70% of canvas width (matches sample)
  const divW  = W * 0.70 * cs
  const divX1 = (W - divW) / 2
  const divX2 = divX1 + divW

  // Border layout:
  //   gap      = dark strip between icon clip edge and outer edge of teal line
  //   bWidth   = width of the clean teal border line (no glow)
  //   bCenter  = center of the border stroke, inset from clip edge
  // A separate wide blurred rect provides the ambient glow at the icon edge.
  const edgeGap = 5   // px dark strip between icon clip edge and outer edge of teal line
  const bWidth  = 14  // clean border stroke width
  const bCenter = edgeGap + bWidth / 2   // = 12
  const rx      = 90

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}">
<defs>
  <radialGradient id="bg" cx="50%" cy="50%" r="70.7%">
    <stop offset="0%" stop-color="#0D1E30"/>
    <stop offset="100%" stop-color="#081420"/>
  </radialGradient>
  <filter id="edge-glow" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur stdDeviation="6"/>
  </filter>
  <clipPath id="clip">
    <rect width="${W}" height="${W}" rx="${rx}" ry="${rx}"/>
  </clipPath>
</defs>
<g clip-path="url(#clip)">
  <!-- background -->
  <rect width="${W}" height="${W}" fill="url(#bg)"/>
  <!-- ambient glow at icon edge: wide blurred stroke centered on clip boundary (outer half clipped) -->
  <rect width="${W}" height="${W}" rx="${rx}" ry="${rx}"
    fill="none" stroke="${TEAL}" stroke-width="40" stroke-opacity="0.18"
    filter="url(#edge-glow)"/>
  <!-- clean teal border line: thin, no glow, inset ${edgeGap}px from edge -->
  <rect x="${bCenter}" y="${bCenter}" width="${W - bCenter * 2}" height="${W - bCenter * 2}"
    rx="${rx - bCenter}" ry="${rx - bCenter}"
    fill="none" stroke="${TEAL}" stroke-width="${bWidth}"/>
  <!-- row 1: eLOG  (e outlined) -->
  ${renderRow('eLOG', 0, y1)}<!-- row 2: BOOK  (B outlined) -->
  ${renderRow('BOOK', 0, y2)}<!-- divider -->
  <line x1="${divX1.toFixed(2)}" y1="${divY.toFixed(2)}"
    x2="${divX2.toFixed(2)}" y2="${divY.toFixed(2)}"
    stroke="${TEAL}" stroke-width="1" opacity="0.4"/>
</g>
</svg>`
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const fontBuf = await downloadFont()

  console.log('Parsing font with fontkit...')
  const font = fontkit.create(fontBuf)
  console.log(`  Family: ${font.familyName ?? 'Tourney'}, UPM: ${font.unitsPerEm}`)

  const svgNormal   = buildSVG(font, false)
  const svgMaskable = buildSVG(font, true)

  const icons = [
    { file: 'favicon-16.png',           size: 16,  svg: svgNormal   },
    { file: 'favicon-32.png',           size: 32,  svg: svgNormal   },
    { file: 'apple-touch-icon-180.png', size: 180, svg: svgNormal   },
    { file: 'icon-192.png',             size: 192, svg: svgNormal   },
    { file: 'icon-512.png',             size: 512, svg: svgNormal   },
    { file: 'icon-maskable-512.png',    size: 512, svg: svgMaskable },
  ]

  for (const { file, size, svg } of icons) {
    const outPath = path.join(OUT, file)
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(outPath)
    console.log(`  ✓ ${file} (${size}×${size})`)
  }

  console.log('\nAll icons written to public/brand/icons/')
}

main().catch(e => { console.error(e); process.exit(1) })
