# ClaudeBorne Changelog — Master Reference
**Current Version:** V5.3  
**Last Updated:** 13 MAY 2026  
**Status:** V5.3 deployed

---

## Implementation Details

Changelog feature is in `src/SettingsModal.jsx` → Miscellaneous tab.

**Container:** 200px scrollable  
**Theme:** Dark Cockpit (#0a0d12, #4fc3f7 accents)  
**Font:** Courier New, 14px  

**Tag Types:**
- `elb-tag-new` (green) = NEW
- `elb-tag-imp` (amber) = IMP  
- `elb-tag-fix` (blue) = FIX

---

## Current Versions in Changelog

### V5.3 (13 MAY 2026) — CURRENT
- Data Management (Import/Export)
  - Export logbook data to Excel or PDF (date range)
  - Import Excel/PDF files with validation & merge
  - Duplicate flight detection — skip existing entries
  - Globe icon with bidirectional arrows (import/export)
- Account Management
  - Delete account & all data — permanent deletion via Cloud function
  - Account deletion confirmation dialog with clear warnings
  - Auto-redirect to login/signup after deletion

### V5.2 (13 MAY 2026)
- Settings & Customization (font scaling, appearance system)
- Layout & Spacing (field centering, gap adjustments)
- UI Polish (visual refinements)

### V5.1 (07 MAY 2026)
- Flight Tracking (day/night, recency)
- Authentication (Google auth, signup)
- Other fixes

### V5.0 (05 MAY 2026)
- Authentication & Onboarding
- UI Structure & Data

### V1 (01 MAY 2026)
- Early Work & Foundation
- UI Structure & Foundation

---

## Deployment Workflow

When you deploy a new feature/fix:

1. **Code + test locally** (`npm run dev`)
2. **Approve deployment** with me
3. **I add changelog entry** to SettingsModal.jsx with:
   - New version number (V5.3, V5.4, etc.)
   - Date
   - Category (Feature/Fix/UI Polish)
   - Tagged items
4. **Update version refs** across app
5. **Commit + push** (`git push origin main`)
6. **Record here** with deployment date & summary

---

## Entry Template

```jsx
<div className="elb-changelog-entry">
  <div className="elb-changelog-ver">
    <span className="elb-changelog-tag">V5.3 <span className="elb-tag elb-tag-new">CURRENT</span></span>
    <span className="elb-changelog-date">DD MMM YYYY</span>
  </div>
  <div className="elb-changelog-section">
    <div className="elb-changelog-subsection">Feature Category</div>
    <ul className="elb-changelog-items">
      <li><span className="elb-tag elb-tag-new">NEW</span> Description</li>
      <li><span className="elb-tag elb-tag-fix">FIX</span> Description</li>
    </ul>
  </div>
</div>
```

---

## Deployment Log

### V5.3 (13 MAY 2026) ✅ DEPLOYED
- **Features:** Account Management + Import/Export
- **Status:** Live
- **Changes:** 
  - Account deletion (Cloud function, confirmation dialog, auto-redirect)
  - Export logbook to XLSX
  - Import logbook from XLSX
