# ClaudeBorne Development Guide

## CRITICAL REQUIREMENTS

### Changelog — Major Changes Only
**Only add a changelog entry for major fixes or feature implementations.** Small tweaks, minor fixes, copy changes, etc. don't need one.

**If unsure whether a change counts as major, ask the user before deciding.**

**Process (when a changelog entry is warranted):**
1. Draft the entry text first and review it (it shows in Settings → Misc → Changelog)
2. Add it to the end of the `CHANGELOG` array in `src/changelog.js` and move `current: true` onto it
3. The version is read from the `current` entry, so the footer, login screen and feedback form follow automatically. Labels follow the scheme at the top of `src/changelog.js` (+0.1 per release, and the entry after x.10 becomes the next x.0)
4. Keep the `version` in `package.json`, the two root `version` fields at the top of `package-lock.json`, and the "Current version" line in `README.md` in step with it
5. Commit changelog + version changes
6. Deploy

**Changelog location:** `src/changelog.js` (shown in Settings → Misc by the shared `@brand/Changelog` component)

**Tag types:** NEW (feature), IMP (improvement), FIX (bug fix), DEP (deprecation) — written as a prefix in each note, e.g. `"FIX: ..."`

**Example:**
```js
{
  v: "v4.3", date: "October 2026", current: true,
  title: "PDF logbook export",
  notes: [
    "NEW: Feature description",
    "FIX: Bug fix description",
  ],
},
```
```

---

## Project Standards

**Tech Stack:** React 19, Vite, Firebase, ExcelJS (Excel export/import), jsPDF (PDF export)  
**Theme:** Dark Cockpit (fixed, non-customizable)  
**Font:** Courier New, 14px  
**Deployment:** Git push → Vercel auto-deploy (no local test wait)

**Key files:**
- Main UI: `src/ELogbook.jsx`
- Settings: `src/SettingsModal.jsx`
- Export/Import: `src/ExportImportModal.jsx`
- PDF export: `src/logbookPdf.js` (check with `npm run check:pdf`)
- Changelog and version: `src/changelog.js`
- Firebase: `src/firebase.js`

---

## Before Every Commit

- [ ] Features/fixes implemented
- [ ] Code tested locally (if needed)
- [ ] If change is major: changelog entry reviewed
- [ ] Version numbers updated (if releasing new version: `src/changelog.js`, `package.json`, `package-lock.json`, `README.md`)
- [ ] If change is major: changelog entry added to `src/changelog.js`
- [ ] If UI changed, review HowToGuideModal.jsx mockups for accuracy
- [ ] Commit message descriptive
- [ ] Ready to `git push origin main`

---

## Common Tasks

**Add new feature (major):**
1. Code the feature
2. Test locally
3. Draft the changelog entry and review it
4. Add it to `src/changelog.js` with `current: true` (and remove `current` from the previous entry)
5. Bump the version everywhere (v4.3 → v4.4): `package.json`, `package-lock.json`, `README.md`
6. Update the how-to guide if the UI changed
7. Commit + push

**Bug fix:**
1. Fix the bug
2. Test
3. If the fix is major, add a "FIX" entry to current version in changelog (skip for minor fixes)
4. Commit + push (no version bump needed)

---

## Questions?

Reference the memory system: the notes in the `/memory/` folder (see its `MEMORY.md` index) cover the changelog and version process, deploy checks, the dev login bypass and the PDF export.


# Karpathy Principles

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
