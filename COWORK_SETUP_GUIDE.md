# ClaudeBorne Cowork Setup Guide
## Efficient Development Workflow for Adding Features & UI Tweaks

---

## 1. Your Project Overview

**ClaudeBorne** is a web-based electronic logbook for pilots. It tracks flight hours, captain qualifications, and automatically calculates day/night hours.

### Technology Stack (Explained Simply)

| Technology | What It Does |
|------------|-------------|
| **React 19** | The JavaScript framework that builds your app's interface (the part users see and interact with) |
| **Vite** | A build tool that bundles your code and makes it run fast on the web |
| **Firebase** | A cloud database that stores user accounts and logbook entries |
| **XLSX** | Lets users download their logbook as an Excel file |

### Current Features
- ✅ Google login authentication
- ✅ Monthly flight logbook entries  
- ✅ Automatic day/night hour calculations
- ✅ Captain qualification tracking (P1, P2, P1 U/S)
- ✅ Settings and themes
- ✅ Excel export functionality

---

## 2. Local Development Setup

To test changes before going live, you need a local development environment. Here's what to install:

### Step 1: Install Node.js (Takes 5 minutes)
1. Visit **https://nodejs.org**
2. Download the **LTS (Long-Term Support)** version
3. Run the installer and follow the prompts
4. When finished, open Command Prompt and type: `node --version`
   - You should see a version number (e.g., v20.10.0)

### Step 2: Install VS Code (Takes 5 minutes)
1. Visit **https://code.visualstudio.com**
2. Download and install for Windows
3. Launch VS Code when done

### Step 3: Open Your Project
1. Open VS Code
2. File → Open Folder
3. Navigate to: `C:\Users\Amir Rashid\my-elogbook`
4. Click "Select Folder"

### Step 4: Install Dependencies
1. In VS Code, press **Ctrl+`** (backtick key) to open the Terminal
2. Type: `npm install`
3. Wait 1-2 minutes for it to finish (you'll see "added X packages")

### Step 5: Run Development Server
1. In the same terminal, type: `npm run dev`
2. You'll see output like:
   ```
   ➜  Local:   http://localhost:5173/
   ```
3. Open your browser and visit **http://localhost:5173**
4. Your app is now running locally! Any changes I make will appear automatically.

---

## 3. Understanding Cowork

**Cowork** is Claude's system for managing projects efficiently without wasting tokens.

### How It Helps You

| Feature | Benefit |
|---------|---------|
| **File Access** | I can read and edit your code files directly — no copy-pasting needed |
| **Memory System** | I remember context from previous conversations, so work is continuous |
| **Task Tracking** | We track progress on features across multiple conversations |
| **Direct Editing** | I modify files in your project folder; you see changes in real-time |

---

## 4. Strategies to Save Tokens

Tokens measure how much of the conversation I've "read." Here's how to use them wisely:

### ✅ Good Practice
- **Work on small, focused changes**: "Add a dark mode toggle" instead of "redesign the whole UI"
- **Give clear requirements**: Describe what, why, and any constraints
- **Test locally first**: Catch issues before asking me to fix them
- **Use memory files**: I remember decisions, so you don't repeat yourself

### ❌ Avoid This
- Long back-and-forth conversations about unclear requirements
- Making changes without understanding why
- Asking me to redesign everything in one go

---

## 5. Your Recommended Workflow

Since you prefer a **hybrid approach** (some work you do, some I do), here's what works best:

### The 5-Step Process

```
1. PLAN
   You describe: "I want to add X feature" or "I want Y to look different"
   I ask: Any clarifying questions
   
2. BUILD  
   I modify your code files in VS Code
   You watch or do other things
   
3. TEST
   You run the app locally (npm run dev)
   You click around and test the changes
   
4. APPROVE
   You say "this looks good" or "needs adjustment"
   I make any tweaks
   
5. DEPLOY
   Changes go live to https://claudeborne.my
```

### For Features You Want to Learn
If you want to understand **how** to code something:
1. I make the change
2. I explain the "why" behind each line
3. I guide you through similar changes so you can do them yourself
4. You gain skills over time (no deep programming experience needed)

---

## 6. Feature Ideas for ClaudeBorne

Based on reviewing your code, here are valuable additions:

### UI & Design Improvements (Recommended First)
- [ ] Modern color scheme and better spacing
- [ ] Mobile-friendly responsive layout
- [ ] Clearer onboarding for new users
- [ ] Keyboard shortcuts (Tab to move between cells)
- [ ] Better visual feedback (highlight changed cells)

### Data Features
- [ ] Annual statistics dashboard (total hours by type)
- [ ] Charts showing trends over time
- [ ] Ability to edit previous years' data
- [ ] Backup/restore functionality
- [ ] Print-friendly view

### User Experience
- [ ] Undo/redo for accidental changes
- [ ] Search entries by date or airport
- [ ] Filter by captain type or aircraft
- [ ] Duplicate previous month's entries
- [ ] Comments/notes on specific entries

---

## 7. How to Start

### For Next Time You Talk to Me:

Tell me:
1. **What feature or UI change** do you want to tackle first?
2. **What problem does it solve?** (e.g., "users can't find the export button")
3. **Do you want to learn to code it, or just have me do it?**
4. **Any specific requirements?** (e.g., "must be on mobile too")

I'll take it from there and guide you through the entire process!

---

## 8. Quick Reference Commands

Once your development environment is set up, here are the commands you'll use:

```bash
# Start the development server (run this to work locally)
npm run dev

# Build for production (creates optimized version for live site)
npm run build

# Check code quality
npm run lint
```

---

## 9. Project File Structure

Here's what's in your project (simplified):

```
my-elogbook/
├── src/
│   ├── App.jsx                 # Main app component
│   ├── elogbook_2026_v5_1.jsx  # The logbook interface
│   ├── SettingsModal.jsx       # Settings panel
│   ├── firebase.js             # Database configuration
│   ├── App.css                 # Styling
│   └── index.css               # Global styles
├── package.json                # List of libraries your app uses
├── vite.config.js             # Build configuration
└── node_modules/              # All the libraries (created by npm install)
```

When I make changes, I'll modify files in the `src/` folder.

---

## 10. FAQ

**Q: Will I lose my live data when testing locally?**
A: No! The live database stays separate. You'll be working with test data locally.

**Q: How long does it take to learn to code changes myself?**
A: With guidance, you can make UI changes after 2-3 sessions, and add simple features after 5-10 sessions.

**Q: What if I want to go back to an old version?**
A: Your project uses Git (version control), so we can revert changes anytime.

**Q: How much does this cost?**
A: Nothing! You already have access through your Claude subscription.

---

## Let's Get Started! 🚀

You now have everything you need. In your next message:

1. ✅ Tell me what you want to build first
2. ✅ Let me know if you've installed Node.js and VS Code
3. ✅ I'll guide you through the changes step-by-step

**You're not a programmer yet, but with this setup, you will be!**
