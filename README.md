# ClaudeBorne eLogbook

A free, web-based pilot logbook for commercial airline pilots. Log flights, auto-calculate day/night hours, track regulatory limits and recency, and sync your logbook across devices — no subscription, no credit card.

**Current version:** v3.9  
**Live app:** [https://www.claudeborne.my/]

---

## What It Does

ClaudeBorne eLogbook replaces a paper logbook with a browser-based app that automatically computes flight times, classifies day/night hours using real sun position data, and keeps a running tally of your FTL limits and recency requirements. It works offline, installs as a PWA, and syncs to the cloud on demand.

---

## Core Features

### Flight Logging
- Monthly logbook view with rows for each flight sector
- Fields: date, aircraft type & markings, captain, departure/arrival ICAO, STD/STA, pilot capacity (P1 / P1 U/S / P2), sectors, pilot flying, remarks, autoland flag
- Inline cell editing — click any cell to edit
- Expandable remarks modal for long entries
- Auto-populates default aircraft type, markings, captain from your profile

### Automatic Time Calculation
Flight times are computed automatically from STD and STA — you never enter day/night hours manually. Three calculation methods are available:

#### 1. Fixed UTC Bands
Night = **11:30–23:30 UTC**. Day = everything outside that window. Simple, fast, no airport data required. Correctly handles cross-midnight flights.

#### 2. Dynamic (Departure Airport)
Night is defined as **sunset + 20 min → sunrise − 20 min** at the departure airport, per the CAD-6 aviation night standard. Uses SunCalc with actual airport coordinates. Falls back to Fixed bands if the airport code is not in the database.

#### 3. Route-Integrated (Sun Along Route)
The most accurate method. Night is counted **minute by minute** along the aircraft's interpolated great-circle route between departure and arrival airports. At each 1-minute sample the app computes the sun's altitude at the aircraft's current position; a minute is classified as night when the sun is below civil twilight (−6°, the ICAO/EASA definition). Correctly handles:
- Eastbound flights flying into a sunrise (not marked 100% night)
- Long-haul sectors crossing multiple time zones
- Flights where conditions differ significantly at departure vs. arrival

Falls back to Dynamic (departure) if arrival is unknown, or to Fixed bands if both are unknown.

**Pilot capacity routing:**
- P1 → Day P1 + Night P1
- P2 → Day P2 + Night P2
- P1 U/S → Day P1 U/S + Night P1 U/S

### Three Main Tabs

| Tab | What It Shows |
|-----|--------------|
| **Logbook** | Monthly flight entry with per-column totals and carry-forward |
| **Flight Summary** | Annual hour totals broken down by month and category |
| **Limits & Recency** | FTL compliance, recency, autoland recency, type-specific trackers |

#### Limits & Recency
Automatically computed from your logbook data — no manual input required:
- Rolling 28-day / 90-day / 365-day flight duty and flight time limits
- Recent experience requirements (day/night takeoffs and landings)
- Autoland recency counter
- Per-type trackers with regulatory reference popups (CAD 1901 / MCAR 2016 Part 69 & 74)
- Status banners show green/amber/red compliance state
- Configurable pre-flight and post-flight duty buffers (default: +75 min / +15 min)

### Carry Forward
Enter your historical hours by aircraft type before your first entry in the app. These are included in Flight Summary totals and Limits & Recency calculations from day one.

---

## Sync & Offline

- **Local-first:** every edit saves to device storage instantly — no network required
- **Manual sync:** push your logbook to Firebase Firestore or pull from the cloud with one button
- **Conflict detection:** if another device has newer cloud data, a modal lets you choose Keep Local or Keep Cloud
- **Offline indicator:** toolbar shows OFFLINE chip; sync is disabled when no connection
- **PWA:** install on iOS/Android home screen and use fully offline after first load
- **Auto-update:** app checks for new versions every 30 minutes and on foreground resume; prompts to update when one is found

---

## Export & Import

- **Export to Excel** — select a date range and download a formatted `.xlsx` file
- **Export All** — exports every flight in your logbook in one click, no date range needed
- **Import from Excel** — bulk-load historical data from a formatted spreadsheet
- Exported files include separate Summary and Flights tabs with computed day/night/total columns

---

## Appearance & Customization

| Setting | Options |
|---------|---------|
| Accent color | 10 presets: ClaudeBorne gradient, Mint, Blue, Violet, Amber, Emerald, Rose, Cyan, Gold, Coral |
| Font family | JetBrains Mono, IBM Plex Mono, Roboto Mono, Space Mono, Courier New |
| Font size | 11–20 px (live preview) |
| Table density | Default / Compact / Comfortable |
| Column density | Default / Narrow / Wide |
| Brightness | Slider control |
| Column visibility | Toggle any column on/off — including all six day/night columns and Total |

Hiding columns shows a gear-icon badge with the count of hidden columns. A toast strip appears above the table as a reminder.

---

## Profile Settings

- Full name, date of birth, staff ID
- Licence number and type (ATPL, CPL, etc.)
- Airline, home base
- Default aircraft type, markings, captain
- Default pilot rank (P1 / P1 U/S / P2)

Flight Examiner and Instructor roles auto-log the pilot as captain (P1) on every flight.

---

## Authentication

- Email/password sign-up with password strength validation
- Google sign-in via Google Identity Services (works on PWA/iPad/Android)
- Email verification required before accessing the logbook
- Password reset via email link
- Pilot profile onboarding on first login
- Account deletion with right-to-erasure: submitted feedback is anonymized when your account is deleted

---

## In-App Help

- **How-To Guide** — 8 sections: getting started, installing the app, logging flights, day/night calculation, carry forward, syncing, exporting, and settings
- **Changelog** — full version history viewable in Settings → Misc
- **Send Feedback** — in-app bug reports and feature requests, stored in Firestore

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite |
| Auth & Database | Firebase Authentication + Firestore |
| Offline/PWA | vite-plugin-pwa |
| Excel Export/Import | XLSX |
| PDF Export | jsPDF + jsPDF AutoTable |
| Sun Position | SunCalc |
| Deployment | Vercel (auto-deploy on push to `main`) |

---

## Data Storage

All logbook data is stored in Firestore under `users/{uid}/logbook/data`:
- All flight log entries and settings
- `updatedAt` timestamp used for sync conflict detection
- Locally mirrored to `localStorage` for offline access

---

## Development

```bash
npm install
npm run dev
```

Push to `main` → Vercel auto-deploys. No manual build step needed.

---

## Version History

See the full changelog in-app: **Settings → Misc tab**.
