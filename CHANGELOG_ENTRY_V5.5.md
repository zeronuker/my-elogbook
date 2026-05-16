# Changelog Entry for V5.5

Insert this into `src/SettingsModal.jsx` in the `elb-changelog-scroll` section (BEFORE the V5.4 entry):

```jsx
<div className="elb-changelog-entry">
  <div className="elb-changelog-ver">
    <span className="elb-changelog-tag">V5.5 <span className="elb-tag elb-tag-new">CURRENT</span></span>
    <span className="elb-changelog-date">15 MAY 2026</span>
  </div>
  <div className="elb-changelog-section">
    <div className="elb-changelog-subsection">Onboarding & Auth</div>
    <ul className="elb-changelog-items">
      <li><span className="elb-tag elb-tag-fix">FIX</span> Navigation after signup — "Open Logbook" button now works without refresh</li>
      <li><span className="elb-tag elb-tag-fix">FIX</span> Google login navigation — auto-loads logbook without refresh</li>
      <li><span className="elb-tag elb-tag-fix">FIX</span> Profile data persistence — signup details now appear in Settings</li>
      <li><span className="elb-tag elb-tag-fix">FIX</span> Error messages — now clear when switching between login/signup screens</li>
      <li><span className="elb-tag elb-tag-new">NEW</span> License number field in signup (Step 2)</li>
      <li><span className="elb-tag elb-tag-imp">IMP</span> Increased text sizes for better visibility on all devices</li>
      <li><span className="elb-tag elb-tag-imp">IMP</span> Updated compliance badge: MCAR 2016 Part 69 & Part 74</li>
    </ul>
  </div>
</div>
```

---

## Summary of Changes

**7 Bugs Fixed:**
1. ✓ Open Logbook button now navigates immediately after signup
2. ✓ Google login auto-navigates to logbook
3. ✓ Signup data (fullName, licenceType, licenceNumber, organization) persists in Settings
4. ✓ Error messages clear when navigating between screens
5. ✓ License number field added to signup Step 2
6. ✓ Font sizes increased across all onboarding screens
7. ✓ Badge text updated to "MCAR 2016 Part 69 & Part 74"

**Files Modified:**
- `src/App.jsx` (auth state listener, profile data mapping, error callback)
- `src/OnboardingFlow.jsx` (fonts, badge text, license field, error clearing)

---

## Version Decision

**Recommend: Bump to V5.5** (currently V5.4)

These are significant UX/functionality fixes affecting critical flows (auth, onboarding, profile). A minor version bump is appropriate.

**Version references to update if bumping:**
- `src/SettingsModal.jsx` line 51 (changelog section header)
- `src/SettingsModal.jsx` line 127 (modal header)
- `src/elogbook_2026_v5_1.jsx` (if it references version)
- `src/OnboardingFlow.jsx` line 739 (landing page "eLOGBOOK V5.4..." → "V5.5...")

---

**Ready to proceed?** Confirm:
1. Does the changelog entry look good?
2. Should we bump to V5.5 or stay at V5.4?
