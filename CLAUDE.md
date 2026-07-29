# ClaudeBorne Development Guide

## CRITICAL REQUIREMENTS

### Changelog — Major Changes Only
**Only add a changelog entry for major fixes or feature implementations.** Small tweaks, minor fixes, copy changes, etc. don't need one.

**If unsure whether a change counts as major, ask the user before deciding.**

**Process (when a changelog entry is warranted):**
1. Ask Claude to mockup the changelog entry first
2. Review mockup visually
3. Update `src/SettingsModal.jsx` (MiscTab → changelog section)
4. Update all version references (login screen, toolbar, settings header)
5. Commit changelog + version changes
6. Deploy

**Changelog location:** `src/SettingsModal.jsx` → MiscTab → elb-changelog-scroll

**Tag types:** NEW (feature), IMP (improvement), FIX (bug fix), DEP (deprecation)

**Example:**
```jsx
<div className="elb-changelog-entry">
  <div className="elb-changelog-ver">
    <span className="elb-changelog-tag">V5.4 <span className="elb-tag elb-tag-new">CURRENT</span></span>
    <span className="elb-changelog-date">20 MAY 2026</span>
  </div>
  <div className="elb-changelog-section">
    <div className="elb-changelog-subsection">Category Name</div>
    <ul className="elb-changelog-items">
      <li><span className="elb-tag elb-tag-new">NEW</span> Feature description</li>
      <li><span className="elb-tag elb-tag-fix">FIX</span> Bug fix description</li>
    </ul>
  </div>
</div>
```

---

## Project Standards

**Tech Stack:** React 19, Vite, Firebase, XLSX, jsPDF  
**Theme:** Dark Cockpit (fixed, non-customizable)  
**Font:** Courier New, 14px  
**Deployment:** Git push → Vercel auto-deploy (no local test wait)

**Key files:**
- Main UI: `src/ELogbook.jsx`
- Settings: `src/SettingsModal.jsx`
- Export/Import: `src/ExportImportModal.jsx`
- Firebase: `src/firebase.js`

---

## Before Every Commit

- [ ] Features/fixes implemented
- [ ] Code tested locally (if needed)
- [ ] If change is major: changelog mockup reviewed
- [ ] Version numbers updated (if releasing new version)
- [ ] If change is major: changelog entry added to SettingsModal.jsx
- [ ] If UI changed, review HowToGuideModal.jsx mockups for accuracy
- [ ] Commit message descriptive
- [ ] Ready to `git push origin main`

---

## Common Tasks

**Add new feature (major):**
1. Code the feature
2. Test locally
3. Ask Claude to mockup changelog entry
4. Update SettingsModal.jsx with new entry
5. Bump version number (V5.X → V5.Y)
6. Update version refs in all files
7. Commit + push

**Bug fix:**
1. Fix the bug
2. Test
3. If the fix is major, add a "FIX" entry to current version in changelog (skip for minor fixes)
4. Commit + push (no version bump needed)

---

## Questions?

Reference the memory system:
- `changelog_requirements.md` — Detailed changelog format & structure
- `deployment_workflow.md` — How to deploy
- `visual_design_standard.md` — UI/theme standards
- Other memory files in `/memory/` folder


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
