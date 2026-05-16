# ClaudeBorne Development Guide

## CRITICAL REQUIREMENTS

### 🔴 Changelog is MANDATORY Before Deploy
**Every deployment MUST include changelog update.** No exceptions.

**Process:**
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
- Main UI: `src/elogbook_2026_v5_1.jsx`
- Settings: `src/SettingsModal.jsx`
- Export/Import: `src/ExportImportModal.jsx`
- Firebase: `src/firebase.js`

---

## Before Every Commit

- [ ] Features/fixes implemented
- [ ] Code tested locally (if needed)
- [ ] Changelog mockup reviewed
- [ ] Version numbers updated (if releasing new version)
- [ ] Changelog entry added to SettingsModal.jsx
- [ ] Commit message descriptive
- [ ] Ready to `git push origin main`

---

## Common Tasks

**Add new feature:**
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
3. Add "FIX" entry to current version in changelog
4. Commit + push (no version bump needed)

---

## Questions?

Reference the memory system:
- `changelog_requirements.md` — Detailed changelog format & structure
- `deployment_workflow.md` — How to deploy
- `visual_design_standard.md` — UI/theme standards
- Other memory files in `/memory/` folder
