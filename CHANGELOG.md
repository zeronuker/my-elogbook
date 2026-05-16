# ClaudeBorne Changelog

## Features

### Authentication & Onboarding
- Wire Firebase auth functions: signup, login, Google OAuth, onboarding complete flow
- Extract ScreenSignUp1 and ScreenSignUp2 as memoized components to fix input focus loss
- Auto-complete onboarding for existing verified users (emailVerified=true)
- Add logout confirmation screen - 3 sec message then auto-navigate to landing

### Flight Tracking
- Add dynamic day/night calculation (CAD-6) - sunrise/sunset per departure airport, unknown ICAO badge
- Add autoland recency tracking - checkbox in remarks modal, recency display in limits tab with 3-in-6-months requirement
- Add grand total hours section in flight summary tab with clickable date picker
- Add carry forward hours table in profile settings
- Tab key navigation between cells

### Settings & Customization
- Settings modal with font type and size scaling
- Profile header with standard formula toggle
- All description and hint text scales with font size slider
- All settings modal text scales with font type and size
- Load Google Fonts via `<link>` tag for proper font rendering
- Simplify appearance system: remove customization, keep Dark Cockpit theme only

### Remarks & Notes
- REMARKS popup: per-row ADD/VIEW button, modal editor, revert auto column widths
- Remarks column added to flight table

### UI Structure & Foundation
- Sectors with DEP/ARR only, STD/STA columns
- Delete row removes row and data entirely
- Green plus icon, aligned delete button, save inside table
- Auto column widths with captain column fixed at 60px with wrap
- Move add sector icon to monthly totals row
- Auto day/night calculation from STD/STA and capacity
- Google login and Firebase cloud save

## Fixes

### Layout & Spacing (Recent)
- Center number input fields (pre-flight and post-flight buffers)
- Center airline/operator field container with left-aligned text inside
- Fix field spacing: increase gap between side-by-side fields to 32px, adjust row spacing to 24px
- Fix Settings page visual layout: center airline field, add gaps between form fields, align changelog left
- Fix: merge duplicate .elb-form-group CSS rule to preserve flex display

### Day/Night Calculation
- Fix fractional minutes in dynamic day/night - round nightMins to integer
- Fix dynamic day/night timezone bug - use UTC midnight reference for SunCalc

### Authentication
- Fix Google auth UI freeze - manually update state after signin instead of waiting for listener
- Fix input focus loss on signup: always render password requirements with CSS display instead of conditional rendering
- Fix sendEmailVerification import and usage
- Add error logging for email verification

### Data & State
- Fix duplicate row entries by regenerating IDs on save
- Remove SIGN OUT text button - keep icon only in toolbar

### UI Polish
- UX polish: shrink REMARKS col, bright red delete icon, ghost header cells
- Minor adjustments: ANNUAL TOTAL wrap, LOGBOOK no-scroll fixed layout, LIMITS cards full-width
- HOC badge wraps text only
- Fix delete alignment, save now inside table
- Fix column widths to fit screen
- Fix header text align left
- Fix JSX closing tag error

### Other
- Move Firebase config to env variables

## UI Polish & Refinements

- Visual improvements v5.2: font +2pt, REMARKS col, tab renames, header weights, summary col widths
- Profile tab cleanup + appearance font sizing fixes
- Rename departure/arrival headers to STD/STA
- Add/update headers across table
- Character-based column widths
- Current month default, toolbar icons, delete row, STD/STA UTC labels

## Early Work & Foundation

- Initial commit and v5 scaffolding
- Add v5 file
- Correct headers
- Add dropdown for capacity column
- Add departure/arrival subcategories under sectors
- Align header text to left
- Fix capacity dropdown
- Sectors with DEP/ARR only, STD/STA columns

---

**Last Updated:** 2026-05-13
