// Phone-fit check: opens the running dev server at several phone widths and
// reports anything that sticks out past the left/right edge of the screen.
//
//   1. npm run dev            (in another terminal; server on :5173)
//   2. npm run check:fit
//
// Env: BASE_URL (default http://localhost:5173), WIDTHS (default 320,360,375,414),
//      CHROME_PATH (default: Chrome in Program Files).
// Exits 1 if anything sticks out. Uses a throw-away Chrome profile, so it never
// touches your dev login-bypass setting.
import puppeteer from 'puppeteer-core'

const BASE = process.env.BASE_URL || 'http://localhost:5173'
const WIDTHS = (process.env.WIDTHS || '320,360,375,414').split(',').map(Number)
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const SETTLE_MS = 1600 // window/tab animations (~260ms) plus headroom

// Runs inside the page. Lists elements poking past the screen edge, except
// inside a box that scrolls sideways on purpose (tables) and the guide's
// drawn illustrations (checked through the guide pane instead).
const findOverflow = () => {
  const W = document.documentElement.clientWidth
  const scrolls = e => {
    for (let p = e.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX
      if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true
    }
    return false
  }
  const bad = []
  for (const e of document.querySelectorAll('body *')) {
    if (e instanceof SVGElement || e.closest('.leaflet-container, .htg-content')) continue
    const r = e.getBoundingClientRect()
    const cs = getComputedStyle(e)
    if (!r.width || !r.height || cs.visibility === 'hidden' || cs.opacity === '0') continue
    if ((r.right > W + 0.5 || r.left < -0.5) && !scrolls(e)) {
      bad.push(`${e.tagName.toLowerCase()}.${String(e.className).slice(0, 24)} ${Math.round(r.left)}..${Math.round(r.right)}`)
    }
  }
  const pane = document.querySelector('.htg-pane')
  if (pane && pane.scrollWidth > pane.clientWidth + 1) bad.push(`guide pane scrolls sideways ${pane.scrollWidth}/${pane.clientWidth}`)
  return bad.slice(0, 4)
}

const failures = []
const run = async width => {
  process.stdout.write(`${width}px `) // one dot per screen checked, x = something sticks out
  const page = await (await browser.createBrowserContext()).newPage()
  await page.setViewport({ width, height: 800 })
  const check = async label => {
    await sleep(SETTLE_MS)
    const bad = await page.evaluate(findOverflow)
    process.stdout.write(bad.length ? 'x' : '.')
    if (bad.length) failures.push(`${width}px  ${label}: ${bad.join(' | ')}`)
  }
  const click = (selector, text = '', n = 0) => page.evaluate((s, t, i) => {
    const hits = [...document.querySelectorAll(s)].filter(e => e.textContent.trim().toUpperCase().includes(t))
    hits[i]?.click()
    return !!hits[i]
  }, selector, text.toUpperCase(), n)
  const esc = () => page.keyboard.press('Escape').then(() => sleep(900))

  // Real login flow (landing, log in, sign up): ?reallogin=1 in this throw-away profile only.
  await page.goto(`${BASE}/?reallogin=1`)
  await page.waitForSelector('.onb-screen.active')
  await check('landing')
  for (const [card, label] of [['LOG IN', 'log in'], ['SIGN UP FREE', 'sign up']]) {
    await page.evaluate(t => [...document.querySelectorAll('.onb-screen.active div')]
      .filter(e => e.textContent.trim().toUpperCase().startsWith(t) && e.children.length < 6 && e.getBoundingClientRect().height > 100)
      .pop()?.click(), card)
    await check(label)
    await click('.onb-screen.active button', '← BACK')
    await sleep(900)
  }

  // Logged-in app via the dev bypass.
  await page.goto(`${BASE}/?devbypass=1`)
  await page.waitForSelector('.elb-maintab', { timeout: 30000 })
  for (const tab of ['LOGBOOK', 'FLIGHT SUMMARY', 'COMPLIANCE']) {
    await click('.elb-maintab', tab)
    await check(`tab ${tab}`)
  }
  for (const n of [0, 1]) { await click('.elb-subtab', '', n); await check(`compliance sub-tab ${n + 1}`) }

  for (const title of ['Search logbook', 'Export / Import', 'Route map']) {
    await page.click(`button[title="${title}"]`)
    await check(title)
    await esc()
  }

  await page.click('button[title^="Settings"]')
  await sleep(SETTLE_MS)
  const tabs = await page.$$eval('.sm-tab', ts => ts.length)
  for (let i = 0; i < tabs; i++) {
    await page.evaluate(n => document.querySelectorAll('.sm-tab')[n].click(), i)
    await check(`settings tab ${i + 1}`)
  }
  await click('.sm-tab', 'MISC')
  await sleep(SETTLE_MS)
  await click('.sm-misc-card', '', 1) // feedback
  await check('feedback')
  await esc()
  await click('.sm-misc-card', '', 0) // how-to guide
  await sleep(SETTLE_MS)
  const chapters = await page.$$eval('.htg-select option', o => o.length)
  for (let i = 0; i < chapters; i++) {
    await page.select('.htg-select', String(i))
    await check(`guide chapter ${i + 1}`)
  }
  await page.close()
  console.log()
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
try {
  for (const w of WIDTHS) await run(w)
} finally {
  await browser.close()
}
if (failures.length) {
  console.error(`\nSticks out past the screen edge:\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
console.log(`OK: nothing sticks out at ${WIDTHS.join(', ')} px`)
