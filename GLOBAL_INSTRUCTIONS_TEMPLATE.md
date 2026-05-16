# Global Instructions Template
## Token-Efficient AI Assistant Workflow (Any Project)

---

## 🎯 Core Principle
**One-time context load, repeated use.** Memory system eliminates re-explaining. Every conversation uses saved context.

---

## Part 1: Memory System Setup

### Memory Files (Create Once, Load Always)
Each project must have these memory files in `memory/` folder:

1. **project_overview.md** — What the project is, why it exists, tech stack, key files
2. **critical_requirements.md** — Non-negotiable rules (changelog, deployment, coding standards)
3. **code_patterns.md** — Common utilities, helper functions, architectural patterns
4. **workflow.md** — Your development workflow (steps, approval gates, token priorities)
5. **user_profile.md** — Who you are, your role, communication preferences

### Memory Index
File: `memory/MEMORY.md` (one line per file)
```
- [Project Overview](project_overview.md) — What, why, tech stack
- [Critical Requirements](critical_requirements.md) — Non-negotiable rules
- [Code Patterns](code_patterns.md) — Utilities, patterns, helpers
- [Workflow](workflow.md) — Your development process
- [User Profile](user_profile.md) — Role, preferences, style
```

**Rule:** Update memory files if project state changes (new tech, new standards, new workflow).

---

## Part 2: Development Workflow

### Standard 5-Step Process
1. **You propose** — Feature request or bug report (be specific)
2. **I suggest** — Implementation approach(es), trade-offs
3. **I recommend** — Related improvements or scope expansion
4. **I ask** — "Want to see a mockup?" (optional visual review)
5. **You instruct** — "Proceed" or "Modify" → Follow critical requirements, write code

### Communication Rules
- **No fluff.** No verbose explanations unless explicitly requested
- **Code-first.** Show diffs, not descriptions
- **Ask before doing.** Wait for explicit "go" signal before implementation
- **Token priority.** Every response optimized for context reuse, not readability

---

## Part 3: Critical Requirements (Project-Specific)

Example for ClaudeBorne:
- ✅ Changelog mandatory before deploy
- ✅ Follow deployment standard (mockup → ask on version → code → user pushes)
- ✅ Dark cockpit theme (fixed)
- ✅ Always use Firebase auth pattern

*Edit this section per project.*

---

## Part 4: Code Patterns & Utilities

### What Goes Here
- Reusable helper functions with examples
- Architectural patterns used repeatedly
- Integration patterns (API calls, state management, etc.)
- Common gotchas and how to avoid them

### Example
```javascript
// Time parsing utility
parseHHMM(val) → minutes
toHHMM(mins) → "HH:MM"
isTimeInDay(hhmm) → boolean
```

*Build this incrementally as you add code.*

---

## Part 5: Workflow Details

### Your Process (Example)
1. Code locally (`npm run dev`)
2. Test in [specific setup]
3. Commit with [message format]
4. Ask me for changelog mockup
5. Decide on version bump
6. You push to [branch]

### Approval Gates
- Mockup review (optional, you decide)
- Version decision (you decide)
- Git push (you do, not me)

### Token Optimization Rules
- Load full memory at start of new chat (explicit read or auto-detect)
- No re-explaining project state
- No long-form code reviews
- Reference memory files instead of repeating

*Customize for your workflow.*

---

## Part 6: Deployment & Release

### Standard Deploy Flow
1. Code feature/fix
2. [Your specific steps: build, test, etc.]
3. Mockup changelog
4. Ask on version bump
5. Update code
6. You push

### Changelog Format
[Define format: tag types, entry structure, location in code]

*Example: TAG + description in structured JSX*

---

## How to Use This Template

### For a New Project
1. Copy this template → create `PROJECT.md` (or `CLAUDE.md`)
2. Fill in sections 1–6 with your project specifics
3. Create memory folder and files (1–5 above)
4. Point Claude to the memory index at the start of each chat
5. Claude loads context automatically

### Handing Off to Claude
**First chat:**
```
"I'm starting a fresh project. 
Load memory from memory/MEMORY.md"
(or just mention the project name if I can auto-detect)
```

**Every chat after:**
No prompt needed. Claude reads MEMORY.md automatically and loads relevant files.

---

## Token Savings Breakdown

| Step | Without This | With This |
|------|-------------|-----------|
| Explain project | 500 tokens | 0 (loaded from memory) |
| Explain workflow | 300 tokens | 0 (in memory) |
| Explain code patterns | 400 tokens | 0 (in memory) |
| Feature request → code | +2000 tokens | +800 tokens (context already loaded) |
| **Per feature (avg)** | **3200 tokens** | **~800 tokens** (75% savings) |

---

## Checklist: Before Starting New Project

- [ ] Create `memory/` folder
- [ ] Write 5 memory files (overview, requirements, patterns, workflow, profile)
- [ ] Create memory index (MEMORY.md)
- [ ] Create global instructions file (this template, filled out)
- [ ] Commit to repo
- [ ] Share MEMORY.md path with Claude on first chat

---

## Notes

- **Memory is your source of truth.** Update it when project changes.
- **Workflow is sacred.** Don't deviate from your 5-step process; it's optimized for your efficiency.
- **Code patterns grow over time.** Add utilities as you build; future features reference them.
- **Token efficiency compounds.** After 3–4 features, savings are ~70% vs. no memory.

---

**Created:** May 15, 2026  
**Version:** 1.0  
**For:** Any project (ClaudeBorne tested ✓)
