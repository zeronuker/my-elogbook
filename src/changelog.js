// Version labels follow Eledger's scheme: first entry is v1.0, each
// subsequent entry is +0.1, up to a max of x.10 — the entry after any x.10
// rolls to (x+1).0. One entry per release (not per commit — a release here
// can bundle several commits). Oldest first below (rendered newest-first in
// the UI by the shared @brand/Changelog component).
export const CHANGELOG = [
  {
    v: "v1.0", date: "March 2026",
    title: "PDF export removed",
    notes: [
      "DEP: PDF export removed for now; Excel export remains.",
    ],
  },
  {
    v: "v1.1", date: "April 2026",
    title: "Onboarding stability",
    notes: [
      "FIX: Auth race condition fixed: no more reload-to-continue after sign-up.",
      "FIX: Error messages now clear when moving between onboarding screens.",
    ],
  },
  {
    v: "v1.2", date: "May 2026",
    title: "Carry-forward hours fix",
    notes: [
      "FIX: Carry-forward hours over 9:59 no longer zero out on save.",
      "FIX: Profile settings were overwritten by a stale legacy profile on load; they are now kept.",
    ],
  },
  {
    v: "v1.3", date: "May 2026",
    title: "ClaudeBorne brand rollout",
    notes: [
      "NEW: Full visual rebuild: new logo, typography, surfaces and gradient accents.",
      "NEW: Five brand-safe accent presets in Appearance settings.",
      "NEW: Day/Night column headers carry sun/moon glyphs, for colour-blind safety.",
      "NEW: Save status chip in the page header: auto-save off, unsaved, saving, saved or error (with Retry).",
      "NEW: PWA manifest: the app is installable from supported browsers.",
      "IMP: Browser confirm popups replaced with a branded confirmation modal.",
      "IMP: Remarks, Regulatory reference and Save error windows now work in light mode.",
    ],
  },
  {
    v: "v1.4", date: "May 2026",
    title: "Settings overhaul",
    notes: [
      "NEW: Accent palette expanded from 5 to 10 presets.",
      "NEW: Table density split into Row (Compact / Default / Relaxed) and Column (Narrow / Default / Wide).",
      "NEW: Settings has a per-tab reset to default for the Appearance and Preferences tabs.",
      "NEW: Misc tab returns, with How-to Guide, Report a Bug and Suggest a Feature cards, plus the changelog.",
      "IMP: Save chip now shows AUTO-SAVE OFF · NOT YET SAVED, and SAVED · time after a manual save.",
      "FIX: The day/night method setting is now applied to cumulative FTL calculations.",
    ],
  },
  {
    v: "v1.5", date: "May 2026",
    title: "Real-time sync & column visibility",
    notes: [
      "NEW: Real-time multi-device sync: changes saved on one device appear on your other open devices within seconds.",
      "NEW: Sync conflict protection: if another device saves while you have unsaved changes, a banner offers Save Mine or Discard & Sync.",
      "NEW: Column visibility: turn logbook columns on or off from Settings → Appearance.",
      "IMP: Appearance changes now apply as a live preview before you save.",
      "FIX: The hourly sign-in token refresh no longer reloads Firestore and wipes unsaved local data.",
      "FIX: SAVE NOW and auto-save could wipe your cloud logbook from stale data; they now always use the live data.",
      "FIX: Export now includes manually entered flights, including dates typed as DD/MM or DD/MM/YYYY.",
      "FIX: Re-importing Excel no longer duplicates manually entered rows.",
      "FIX: The Import window now shows an error if the cloud save fails, instead of a false success.",
      "FIX: The browser-close warning now also fires when the last save failed.",
    ],
  },
  {
    v: "v1.6", date: "May 2026",
    title: "In-app feedback",
    notes: [
      "NEW: Report a Bug and Suggest a Feature open an in-app form; submissions are stored with your email, app version and time.",
    ],
  },
  {
    v: "v1.7", date: "May 2026",
    title: "Local-first, offline & PWA",
    notes: [
      "NEW: Local-first: every edit saves to device storage instantly, with no network needed. Existing users are migrated automatically.",
      "NEW: Manual SYNC button pushes your logbook to the cloud and pulls it to other devices.",
      "NEW: Sync conflict window: when another device has newer cloud data, choose Keep Local or Keep Cloud.",
      "NEW: OFFLINE chip in the toolbar when there's no internet; SYNC is disabled.",
      "NEW: PWA support: install C·B eLogBook on iOS and Android home screens; it works fully offline after install.",
      "NEW: Auto-update prompt when a new version is available; it updates safely after saves complete.",
      "IMP: The cloud is checked for newer data on reconnect and when the app returns to the foreground; with no local edits it pulls silently.",
      "IMP: Last-synced time is remembered across sessions, even offline.",
      "FIX: Last-synced time was updated on every local save, breaking conflict detection across devices.",
      "FIX: Excel export Summary and Flights tabs showed 0:00:00 for all day, night and total columns.",
    ],
  },
  {
    v: "v1.8", date: "May 2026",
    title: "In-app How-To Guide",
    notes: [
      "NEW: In-app How-To Guide with 8 sections: getting started, installing, logging flights, day/night, carry forward, syncing, exporting and settings.",
    ],
  },
  {
    v: "v1.9", date: "May 2026",
    title: "Google sign-in reliability (desktop)",
    notes: [
      "FIX: Google sign-in with an ad or popup blocker now shows a clear error and times out after 20 seconds, instead of sticking on \"LOGGING IN...\".",
      "NEW: If Google sign-in succeeds but the screen stays on login, the app reloads itself once to recover.",
    ],
  },
  {
    v: "v1.10", date: "May 2026",
    title: "Hotfix: revert PWA redirect sign-in",
    notes: [
      "FIX: Installed PWAs landed on the welcome page after Google sign-in; reverted to the popup flow. Desktop sign-in improvements stay.",
    ],
  },
  {
    v: "v2.0", date: "May 2026",
    title: "Column hide actually hides",
    notes: [
      "FIX: Hiding a column now removes it fully from the table; before, a 13px stub still took space.",
      "NEW: The gear icon shows a count badge while columns are hidden.",
      "NEW: A toast appears when you hide a column or load with hidden columns; tap it or the badge to open Appearance settings.",
    ],
  },
  {
    v: "v2.1", date: "May 2026",
    title: "Hotfix: account deletion order",
    notes: [
      "FIX: Account deletion now removes cloud data before signing the user out, so no logbook data is left orphaned.",
    ],
  },
  {
    v: "v2.2", date: "June 2026",
    title: "Every column toggleable",
    notes: [
      "NEW: Every logbook column can now be hidden, including DAY/NIGHT P1, P1 U/S, P2 and TOTAL.",
      "IMP: Limits & Recency disclaimer shortened, and regulation references corrected to CAD 1901 and MCAR 2016 Part 69 & 74.",
    ],
  },
  {
    v: "v2.3", date: "June 2026",
    title: "Route-based day/night calculation",
    notes: [
      "NEW: Day/night method upgraded to a route calculation: night is counted minute by minute along the great-circle route when the sun is below civil twilight (-6°).",
      "IMP: It accounts for time zones, so an eastbound flight landing into sunrise correctly logs its last stretch as day.",
      "IMP: Departure and arrival airports both drive the result; if either is unknown, it falls back to fixed bands and highlights the code.",
    ],
  },
  {
    v: "v2.4", date: "June 2026",
    title: "Google sign-in rebuilt with Google Identity Services",
    notes: [
      "NEW: Google sign-in now works reliably on installed PWAs (iPad / Android home-screen apps) with no stuck login screen.",
      "IMP: Desktop sign-in is more robust against ad and popup blockers, and falls back to the popup if the Google script is blocked.",
    ],
  },
  {
    v: "v2.5", date: "June 2026",
    title: "Google account deletion works on PWA",
    notes: [
      "FIX: Deleting a Google account from an installed PWA now works; re-confirming your identity no longer gets stuck.",
    ],
  },
  {
    v: "v2.6", date: "June 2026",
    title: "Account deletion polish",
    notes: [
      "NEW: After deleting your account you see a clear \"ACCOUNT DELETED\" confirmation.",
      "NEW: Right to erasure: feedback you submitted is anonymised (email and ID removed) when you delete your account.",
      "IMP: An interrupted account deletion now resumes and finishes cleanly on the next launch.",
    ],
  },
  {
    v: "v2.8", date: "June 2026",
    title: "Hotfix: sign-up & sign-in flow",
    notes: [
      "FIX: New Google sign-ups now go through onboarding instead of dropping straight into the logbook.",
      "FIX: Email sign-up no longer bounces back to the landing page while waiting for email verification.",
      "FIX: After verifying your email, logging in no longer sticks on \"Setting up your logbook\".",
      "NEW: Forgot password: the login screen link now sends a reset email.",
    ],
  },
  {
    v: "v2.9", date: "June 2026",
    title: "Sign-in & account deletion reliability",
    notes: [
      "FIX: Email and password typed on the login and forgot-password screens no longer get wiped mid-entry.",
      "FIX: Logging in after a password reset no longer sticks on \"Setting up your logbook\".",
      "IMP: Deleting your account now confirms your identity first; cancelling deletes nothing.",
      "NEW: \"Resend verification email\" now works, with a 30-second cooldown.",
      "FIX: The app detects your verification link immediately instead of staying on \"check your email\".",
      "FIX: New versions now prompt automatically: the app re-checks every 30 minutes and whenever you reopen it.",
      "NEW: Export All exports every flight to Excel without picking a date range.",
      "IMP: Day/Night method \"Route (sun)\" renamed \"Dynamic\".",
      "NEW: Empty rows from the previous month are trimmed automatically at midnight when the month changes.",
    ],
  },
  {
    v: "v2.10", date: "June 2026",
    title: "Adaptive logbook width",
    notes: [
      "IMP: The logbook sizes itself to fit all columns on any desktop screen, with no horizontal scrolling.",
      "IMP: You can delete any row, including empty ones; Rows Per Page is only a default for new months.",
      "IMP: Remarks and autoland moved onto the row number: tap it to open the row's window; a coloured dot shows gold (remarks), purple (autoland) or green (both).",
      "FIX: Added HTTP security headers (CSP, X-Frame-Options, X-Content-Type-Options) against clickjacking and MIME sniffing.",
    ],
  },
  {
    v: "v3.0", date: "June 2026",
    title: "Brand banner & self-hosted fonts",
    notes: [
      "NEW: New top-bar brand banner: outlined \"C\", gradient CLAUDEBORNE wordmark and PILOT eLOGBOOK subtitle.",
      "IMP: All fonts are self-hosted and Google Fonts is no longer loaded, so ad blockers can't break them; Content Security Policy tightened.",
      "FIX: On mobile, choosing the Logbook tab no longer wraps all tabs onto two lines.",
    ],
  },
  {
    v: "v3.1", date: "June 2026",
    title: "Security & reliability hardening",
    notes: [
      "FIX: \"Keep Local Data\" after a sync conflict no longer triggers a second conflict popup.",
      "NEW: Warning banner when the app can't save to your device (e.g. private browsing).",
      "IMP: Import rejects files over 10 MB immediately with a clear error.",
      "IMP: Excel import/export library replaced with ExcelJS, which is actively maintained.",
      "IMP: Pilot notes and remarks are sanitised before display.",
    ],
  },
  {
    v: "v3.2", date: "June 2026",
    title: "Custom icon set replaces emoji",
    notes: [
      "IMP: Landing, sign-in and verification screens and the main tab icons use custom brand SVG icons instead of emoji, identical on every device.",
    ],
  },
  {
    v: "v3.3", date: "June 2026",
    title: "Animated launch splash",
    notes: [
      "NEW: Animated splash on launch: the C mark fades in, the frame draws on, then the CLAUDEBORNE wordmark appears.",
    ],
  },
  {
    v: "v3.4", date: "June 2026",
    title: "Route map",
    notes: [
      "NEW: Route Map plots every sector in a date range on a world map, with a colour-graded great-circle line per route and PNG export.",
      "NEW: Choose a basemap: vector world outline (default), CARTO Dark, Esri Satellite or Stadia Dark.",
      "IMP: A route flown more than once is drawn once.",
    ],
  },
  {
    v: "v3.5", date: "July 2026",
    title: "Day/night accuracy & duty-hour fixes",
    notes: [
      "FIX: Takeoff/landing recency now uses the sun's position at the moment of departure or arrival, not total daylight over the flight.",
      "FIX: Duty-hour totals (7/14/28-day) no longer overcount multi-sector days; the buffer applies once per duty day.",
      "FIX: Entering a day that doesn't exist in the month (e.g. 31 in February) is now rejected.",
      "NEW: A warning appears when two flights on the same date have overlapping STD-STA times.",
      "IMP: Flight data now syncs as one document per year, removing a long-term storage limit; existing data migrates automatically.",
    ],
  },
  {
    v: "v3.6", date: "July 2026",
    title: "Multi-sector auto-fill",
    notes: [
      "NEW: Adding a row with the same date as the row above auto-fills aircraft type, markings and captain into empty fields only.",
    ],
  },
  {
    v: "v3.7", date: "July 2026",
    title: "Auto-hide empty flight-time columns",
    notes: [
      "NEW: DAY and NIGHT columns that are empty for a past month collapse into a slim marker; tap it to show them again. Can be turned off in Appearance.",
      "DEP: The manual per-column hide setting is removed; all other columns are always shown.",
      "NEW: \"Go to today\" button next to the period selector jumps back to the current month.",
      "FIX: Opening the app with locally cached data now checks the cloud and pulls newer data, or opens the sync conflict window.",
    ],
  },
  {
    v: "v3.8", date: "August 2026",
    title: "Inline row panel & duplicate row",
    notes: [
      "NEW: Tapping a row number expands an inline panel instead of a popup, one row open at a time.",
      "NEW: \"Duplicate previous row\" on empty rows copies date, type, registration, captain and role, and sets departure to the previous arrival; times, remarks and autoland are never copied.",
      "IMP: Remarks and the AUTOLAND checkbox save immediately, and Delete is now a labelled button in the panel with a confirm for rows with data.",
      "FIX: The Add sector button is now always visible, in the MONTHLY TOTALS row on desktop and floating on touch devices.",
    ],
  },
  {
    v: "v3.9", date: "August 2026",
    title: "Duty Log Link",
    notes: [
      "NEW: Link your Duty Log app with a sync code (Settings → Preferences): sectors match by date and airports, and crew names and positions show in the sector panel.",
      "NEW: Duty Log's sector remark merges into your Remarks without overwriting or duplicating on re-sync.",
    ],
  },
  {
    v: "v3.10", date: "September 2026",
    title: "Logbook search",
    notes: [
      "NEW: Search any flight by airport, markings, captain, Duty Log crew or remarks across all months; picking a result jumps to that month and highlights the row.",
      "NEW: Prev / next month arrows beside the period selector.",
      "FIX: Duty Log crew, remarks and notes no longer disappear when you go offline; the last sync is cached on the device.",
      "IMP: Page header and tab bar reworked for phones, so content isn't clipped and the table no longer drags the page sideways.",
    ],
  },
  {
    v: "v4.0", date: "September 2026",
    title: "Duty Log matching for repeated routes",
    notes: [
      "FIX: Duty Log matching no longer misassigns crew and remarks when the same route is flown more than once in a duty; the closest scheduled time (STD) wins, and search uses the same logic.",
      "NEW: A match that can't be confirmed within 1 minute of STD is flagged with an amber dot, badge and warning line.",
    ],
  },
  {
    v: "v4.1", date: "October 2026",
    title: "Disable auto-update setting",
    notes: [
      "NEW: Settings → Misc → App Update has a \"Disable auto-update\" switch; \"Check for updates\" still works manually.",
    ],
  },
  {
    v: "v4.2", date: "October 2026",
    title: "Compliance tab & duty-limit fixes",
    notes: [
      "NEW: Limits & Recency becomes Compliance, with Flight & Duty and Recency sub tabs; the status banner shows under Flight & Duty only.",
      "FIX: The 7, 14 and 28-day duty limits counted one day too many; they now cover exactly 7, 14 and 28 days.",
      "FIX: The 28-day flight time limit now counts today plus the previous 27 days, so a flight exactly 28 days ago no longer counts.",
      "IMP: Regulation text matches CAD 1901, CAD 6 Part 1, MCAR 2016 and CAGM 6008(III); the recency popup cites CAD 6 para 9.4.1.",
      "IMP: The autoland card is now a reference log (last autoland and 6-month count); the unsupported \"3 in 6 months\" status is gone.",
      "IMP: Limits turn yellow at 80% (was 90%) on the banner and limit cards, and the banner is reworded.",
      "NEW: Transition animations for tabs, Settings sub-tabs and dialogs, with Settings → Appearance → Animation for on/off, style and speed.",
      "FIX: iPadOS 27 drew a blur over the top of the installed app; the status bar now blends into the top bar. Re-add the Home Screen icon once to apply.",
      "FIX: On iPad landscape the installed app left an empty strip on each side; it now fills the full width.",
    ],
  },
  {
    v: "v4.3", date: "October 2026",
    title: "PDF logbook export",
    notes: [
      "NEW: Export → PDF saves your whole logbook as a printable A4 or US Letter PDF: cover, profile page, then one page per month with previous, page and grand totals.",
      "NEW: Month pages print pilot-flying capacity (P1, P2, P1 U/S) in bold and underlined, with a legend; long months continue on the next page.",
      "IMP: The Export tab has an Excel / PDF toggle, and Excel offers All flights (default) or Date range.",
      "NEW: Route map exports as an Image (PNG), a PDF (A4, A3, US Letter) or an Interactive file that opens in any browser, with an optional Stats box.",
      "FIX: On narrow phones the right side of the app was cut off, hiding Route map, Settings and Sign out; the layout now fits down to 320 px.",
      "IMP: Every window shares one look: a double-line border with cut corners that follows your accent colour.",
    ],
  },
  {
    v: "v4.4", date: "October 2026",
    title: "Interactive route map",
    notes: [
      "NEW: Interactive route map: tap a route or airport to select it, with filters, day/night colouring, an airport route list, map layers and keyboard shortcuts.",
      "NEW: Timeline with a play button and a live, collapsible stats window; routes animate growing from departure to arrival, with a light/dark switch.",
      "IMP: Route map toolbar reworked: two labelled rows on desktop and a stacked layout on phones below 720px.",
      "NEW: Annual Overview has a Go to current year button.",
    ],
  },
  {
    v: "v4.5", date: "November 2026", current: true,
    title: "Autoland card & brightness slider",
    notes: [
      "NEW: Autoland card shows days since the last autoland, the 6-month count and the expiry (last autoland + 180 days), with date chips and arrival airport.",
      "FIX: The Settings window jumped when brightness dropped below 100%; brightness is now a smooth 1% slider that dims with an overlay.",
      "NEW: Search jump: picking a result from any tab switches to the Logbook, opens the month and pulses the row.",
      "FIX: Table density now has a visible effect: Compact / Relaxed change row padding and Narrow / Wide change column padding (Default removed).",
      "IMP: Settings gets a last-saved footer and a free text-size slider; accent presets reduced to five (ClaudeBorne, Emerald, Gold, Rose, Violet).",
      "IMP: Phone header: the toolbar shares the month/year picker row (at 639px and below).",
      "IMP: Cleaner screens: removed the row tint for remarks/autoland, helper texts and modal eyebrow labels.",
      "IMP: Smooth fade-ins for the logbook after sign-in, loading overlay, sync chips, errors and status lines.",
    ],
  },
]
