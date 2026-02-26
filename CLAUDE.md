# READ AND FOLLOW THE FUCKING PROCESS, PRINCIPLES, CODE STANDARDS, DOCUMENTATION, AI NOTES, AND PROHIBITIONS EVERY TIME

## Cross-Project Reference

Shared CLAUDE.md patterns are maintained at:
```
https://raw.githubusercontent.com/devmade-ai/glow-props/main/CLAUDE.md
```

Check this periodically for new Suggested Implementations, AI Notes, or process updates that should be synced into this project. Adapt React examples to Vue 3 Composition API when porting.

## Process

1. **Read these preferences first**
2. **Gather context from documentation** (CLAUDE.md, relevant docs/)
3. **Then proceed with the task**

### REMINDER: READ AND FOLLOW THE FUCKING PROCESS EVERY TIME

## Principles

1. **User-first design** - Align with how real people will use the tool (top priority)
2. **Simplicity** - Simple flow, clear guidance, non-overwhelming visuals, accurate interpretation
3. **Document WHY** - Explain decisions and how they align with tool goals
4. **Testability** - Ensure correctness and alignment with usage goals can be verified
5. **Know the purpose** - Always be aware of what the tool is for
6. **Follow conventions** - Best practices and consistent patterns
7. **Repeatable process** - Follow consistent steps to ensure all the above

### REMINDER: READ AND FOLLOW THE FUCKING PRINCIPLES EVERY TIME

## Code Standards

### Code Organization

- Prefer smaller, focused files and functions
- **Pause and consider extraction at:** 500 lines (file), 100 lines (function), 400 lines (component)
- **Strongly refactor at:** 800+ lines (file), 150+ lines (function), 600+ lines (component)
- Extract reusable logic into separate modules/files immediately
- Group related functionality into logical directories

### Decision Documentation in Code

Non-trivial code changes must include comments explaining:
- **What** was the requirement or instruction
- **Why** this approach was chosen
- **What alternatives** were considered and why they were rejected

```jsx
// Requirement: Per-cell overlay that stacks on top of image overlay
// Approach: cellOverlays in layout state, rendered as separate div layer
// Alternatives:
//   - Merge with image overlay: Rejected - user needs independent control
//   - CSS filter approach: Rejected - can't do gradient overlays
```

### Cleanup

- Remove `console.log`/`console.debug` statements before marking work complete
- Delete unused imports, variables, and dead code immediately
- Remove commented-out code unless explicitly marked `// KEEP:` with reason
- Remove temporary/scratch files after implementation is complete

### Quality Checks

During every change, actively scan for:
- Error handling gaps
- Edge cases not covered
- Inconsistent naming
- Code duplication that should be extracted
- Missing input validation at boundaries
- Security concerns (XSS via dangerouslySetInnerHTML, unsanitized user input)
- Performance issues (unnecessary re-renders, missing keys, large re-computations)

Report findings even if not directly related to current task.

### User Experience (Non-Negotiable)

All end users are non-technical. This overrides cleverness.

- UI must be intuitive without instructions
- Use plain language - no jargon or developer-speak in user-facing text
- Error messages must say what went wrong AND what to do next, in simple terms
- Confirm destructive actions with clear consequences explained
- Provide feedback for all user actions (loading states, success confirmations)

### Commit Message Format

All commits must include metadata footers:

```
type(scope): subject

Body explaining why.

Tags: tag1, tag2, tag3
Complexity: 1-5
Urgency: 1-5
Impact: internal|user-facing|infrastructure|api
Risk: low|medium|high
Debt: added|paid|neutral
Epic: feature-name
Semver: patch|minor|major
```

**Tags:** Use from the project's tag list (see docs/EXTRACTION_PLAYBOOK.md)
**Complexity:** 1=trivial, 2=small, 3=medium, 4=large, 5=major rewrite
**Urgency:** 1=planned, 2=normal, 3=elevated, 4=urgent, 5=critical
**Impact:** internal, user-facing, infrastructure, or api
**Risk:** low=safe change, medium=could break things, high=touches critical paths
**Debt:** added=introduced shortcuts, paid=cleaned up debt, neutral=neither
**Epic:** groups related commits under one feature/initiative name
**Semver:** patch=bugfix, minor=new feature, major=breaking change

These footers are required on every commit. No exceptions.

### REMINDER: READ AND FOLLOW THE FUCKING CODE STANDARDS EVERY TIME

## Documentation

**AI assistants automatically maintain these documents.** Update them as you work - don't wait for the user to ask. This ensures context is always current for the next session.

### `CLAUDE.md`

**Purpose:** AI preferences, project overview, architecture, key state structures.
**When to read:** At the start of every session, before doing any work.
**When to update:** When project architecture changes, state structure changes, or preferences evolve.
**What to include:**

- Process, Principles, AI Notes: Update when learning new patterns or preferences
- Project Status: Current working features (bullet list)
- Architecture: File structure with brief descriptions
- Key State Structure: Important state shapes with comments
- Any section that becomes outdated after feature changes

**Why:** This is the primary context for AI assistants. Accurate info here prevents mistakes.

### `docs/SESSION_NOTES.md`

**Purpose:** Compact context summary for session continuity (like `/compact` output).
**When to read:** At the start of a session to quickly understand what was done previously.
**When to update:** Rewrite at session end with a fresh summary. Clear previous content.
**What to include:**

- **Worked on:** Brief description of focus area
- **Accomplished:** Bullet list of completions
- **Current state:** Where things stand (working/broken/in-progress)
- **Key context:** Important info the next session needs to know

**Why:** Enables quick resumption without re-reading entire codebase. Not a changelog - a snapshot.

### `docs/TODO.md`

**Purpose:** AI-managed backlog of ideas and potential improvements.
**When to read:** When looking for work to do, or when the user asks about pending tasks.
**When to update:** When noticing potential improvements. Move completed items to HISTORY.md.
**What to include:**

- Group by category (Features, UX, Technical, etc.)
- Use `- [ ]` for pending items only
- Brief description of what and why
- When complete, move to HISTORY.md (don't keep in TODO)

**Why:** User reviews this to prioritize work. Keeps TODO focused on pending items only.

### `docs/HISTORY.md`

**Purpose:** Changelog and record of completed work.
**When to read:** When you need historical context about why something was built a certain way.
**When to update:** When completing TODO items or making significant changes.
**What to include:**

- Completed TODO items (organized by category)
- Bug fixes and changes (organized by date)
- Brief description of what was done

**Why:** Historical context separate from active TODO. Tracks what's been accomplished.

### `docs/USER_ACTIONS.md`

**Purpose:** Manual actions requiring user intervention outside the codebase.
**When to read:** When something requires manual user intervention (deployments, API keys, external config).
**When to update:** When tasks need external action. Clear when completed.
**What to include:**

- Action title and description
- Why it's needed
- Steps to complete
- Keep empty when nothing pending (with placeholder text)

**Why:** Some tasks require credentials, dashboards, or manual config the AI can't do.

### `docs/AI_MISTAKES.md`

**Purpose:** Record significant AI mistakes and learnings to prevent repetition.
**When to read:** When starting a session, to avoid repeating past mistakes.
**When to update:** After making a mistake that wasted time or broke things.
**What to include:**

- What went wrong
- Why it happened
- How to prevent it
- Date (for context)

**Why:** AI assistants repeat mistakes across sessions. This document builds institutional memory.

### `README.md`

**Purpose:** User-facing guide for the application.
**When to read:** When you need a quick overview of what the tool does and its main features.
**When to update:** When features change that affect how users interact with the tool.
**What to include:**

- What the tool does (overview)
- Current features (keep in sync with actual functionality)
- How to use each feature (user guide)
- Getting started / installation
- Tech stack and deployment info

**Why:** Users and contributors read this first. Must accurately reflect the current state.

### `docs/USER_GUIDE.md`

**Purpose:** Comprehensive user documentation explaining how to use every feature.
**When to read:** When you need to understand what users can do with the tool, or how a feature is supposed to work from the user's perspective.
**When to update:** When adding new features, changing UI workflows, or modifying how existing features work.
**What to include:**

- Tab-by-tab walkthrough of the interface
- Explanation of every control and what it does
- Workflow tips and best practices
- Organized by user tasks, not technical implementation

**Why:** Serves as the authoritative reference for user-facing behavior. Helps ensure AI assistants understand the user experience.

### `docs/TESTING_GUIDE.md`

**Purpose:** Manual test scenarios for verifying the application works correctly.
**When to read:** Before testing changes, or when you need to verify specific functionality works.
**When to update:** When adding new features that need test coverage, or when existing tests become outdated.
**What to include:**

- Step-by-step test scenarios with exact actions
- Where to click/look for each step
- Expected results for each action
- Regression checklist for quick verification

**Why:** Ensures consistent, thorough testing. Prevents regressions by documenting what to verify after changes.

### REMINDER: READ AND FOLLOW THE FUCKING DOCUMENTATION EVERY TIME

## AI Notes

<!-- Reminders and learnings for AI assistants - add to this as needed -->

- Always read a file before attempting to edit it
- Check for existing patterns in the codebase before creating new ones
- Commit and push changes before ending a session
- Clean up completed or obsolete docs/files and remove references to them
- **ASK before assuming.** When a user reports a bug, ask clarifying questions (which mode? what did you type? what do you see?) BEFORE writing code. Don't guess the cause and build a fix on an assumption - you'll waste time fixing the wrong thing. One clarifying question saves multiple wrong commits.
- **Always read files before editing.** Use the Read tool on every file before attempting to Edit it. Editing without reading first will fail.
- **Communication style:** Direct, concise responses. No filler phrases or conversational padding. State facts and actions. Ask specific questions with concrete options when clarification is needed.
- **Development phase:** App is pre-release with zero users. Features added now are provisional and will be changed or removed later. Don't over-polish or over-engineer — keep things easy to swap out. Don't push back on feature ideas based on "users don't need this" — there are no users yet, and the goal is exploration.
- **Check build tools before building.** Run `npm install` or verify `node_modules/.bin/vite` exists before attempting `npm run build`. The `sharp` package may not be installed (used by prebuild icon generation), so use `./node_modules/.bin/vite build` directly to skip the prebuild step if sharp fails.

### REMINDER: READ AND FOLLOW THE FUCKING AI NOTES EVERY TIME

## Suggested Implementations

Reference patterns for features implemented in this project. These document the architecture and behavior — check existing code matches before modifying.

### PWA System

The PWA system has four parts:

**Service worker & updates** (`src/composables/usePWAUpdate.ts`): Wraps `vite-plugin-pwa`'s virtual import with `registerType: 'prompt'` — users control when updates apply. Checks for new service worker versions every 60 minutes via `registration.update()`. Exposes `hasUpdate` ref and `updateApp()` to the UI. The offline-ready notification auto-dismisses after 3 seconds.

**Install detection** (`src/composables/usePWAInstall.ts`): Detects browser type (Chrome/Edge/Brave/Safari/Firefox) via UA string. Captures `beforeinstallprompt` on Chromium browsers for native install. For Safari and Firefox, falls back to manual instruction flow. Tracks install analytics in localStorage (last 50 events: prompted, installed, dismissed, instructions-viewed). Respects standalone mode detection (hides prompt when already installed). Dismiss state persisted in localStorage.

**Install prompt UI** (`src/components/InstallPrompt.vue`): Renders a banner with "Install" (Chromium native) or "How to Install" (Safari/Firefox) buttons, plus a "Not now" dismiss. Hidden when already in standalone mode, dismissed, or unsupported browser.

**Manual install instructions** (`src/components/InstallInstructionsModal.vue`): Browser-specific step-by-step guides in a modal. Four variants: Safari iOS (Share → Add to Home Screen), Safari macOS (File → Add to Dock), Firefox Android (menu → Install), Firefox desktop (tells user to use Chrome/Edge instead). Plain language, aimed at non-technical users.

#### Fix: Timer Leaks on Unmount (Nested Timeouts)

Debounce patterns using `setTimeout` leak when a component unmounts mid-timeout. The nested case is worse: a timeout callback sets *another* timeout, and cleaning up only the outer one leaves the inner one orphaned.

**Fix — track all timeout IDs:**
```typescript
// In a composable or component setup
const timeouts: ReturnType<typeof setTimeout>[] = []

function scheduleWithCleanup() {
  const outer = setTimeout(() => {
    doSomething()
    const inner = setTimeout(() => save(), 500)
    timeouts.push(inner)
  }, 300)
  timeouts.push(outer)
}

onUnmounted(() => timeouts.forEach(clearTimeout))
```

**General rule:** Every `setTimeout`, `setInterval`, `addEventListener`, or `subscribe` call inside a component needs a corresponding cleanup in `onUnmounted`. If callbacks create *new* async operations, those need cleanup too.

#### Fix: PWA Install Prompt Race Condition

In SPAs, `beforeinstallprompt` can fire before the framework mounts. This event fires once — if nothing is listening, it's lost.

**Part 1: Inline script in `index.html` (before module scripts)**

```html
<script>
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    window.__pwaInstallPromptEvent = e;
  });
</script>
```

Classic (non-module) script executes synchronously during HTML parse. Stashes the event on `window` for the composable to consume.

**Part 2: Composable consumes the stashed event**

```typescript
function consumeEarlyCapturedEvent() {
  const win = window as unknown as Record<string, unknown>
  const captured = win.__pwaInstallPromptEvent
  if (captured) {
    delete win.__pwaInstallPromptEvent
    return captured
  }
  return null
}

// At module load (outside composable function):
const early = consumeEarlyCapturedEvent()
if (early) {
  deferredPrompt = early
  canNativeInstall.value = true
}

// Fallback listener for first-visit case
window.addEventListener('beforeinstallprompt', (e) => { ... })
```

**Why both parts:** On repeat visits (cached SW), the event fires before mount — the inline script catches it. On first visits (SW registers late), the event fires after mount — the listener catches it.

### Debug System

Alpha-phase diagnostic tool, intended to be removed post-alpha.

**In-memory event store** (`src/debug/debugLog.ts`): Pub/sub system with a capped circular buffer of 200 entries. Each entry has: `id`, `timestamp`, `source` (boot/db/pwa/import/engine/global), `severity` (info/success/warn/error), `event`, and optional `details`. Global `window.error` and `unhandledrejection` listeners capture crashes early.

**Floating debug pill** (`src/debug/DebugPill.vue`): Mounted in a separate Vue root (survives App crashes). Collapsed: "dbg" pill with entry count and error/warning badges. Expanded: two tabs — Log (timestamped, color-coded entries) and Environment (URL, UA, screen, online status, SW/IndexedDB support). Copy generates a full debug report to clipboard. Clear wipes all entries.

### App Icons from SVG Source

Single SVG source file (`public/icon.svg`), Sharp converts to all needed PNG sizes. One command regenerates everything.

**Generator:** `scripts/generate-icons.mjs` — reads SVG, outputs:
- `pwa-512x512.png` (512x512) — PWA manifest, maskable
- `pwa-192x192.png` (192x192) — PWA manifest, any
- `apple-touch-icon.png` (180x180) — iOS bookmark
- `favicon.ico` (32x32) — browser tab (PNG wrapped in ICO container)

**Run:** `npm run generate-icons`

**SVG design rules:**
- Canvas must be square (`viewBox="0 0 512 512"`)
- Use paths, not text — avoid font rendering inconsistencies across OS/CI
- Background fills entire canvas (no transparency)
- Important content stays within inner 80% (safe zone for maskable crop)
- Design must be legible at 32px (favicon) — avoid fine details

**PWA manifest icons** (configured in `vite.config.ts` via vite-plugin-pwa):
- 192x192 with `purpose: 'any'`
- 512x512 with `purpose: 'any'`
- 512x512 with `purpose: 'maskable'` (separate entry)

Don't combine `"any maskable"` — browsers pick the wrong one.

## Prohibitions

Never:
- Start implementation without understanding full scope
- Create files outside established project structure
- Leave TODO comments in code without tracking them in `docs/TODO.md`
- Ignore errors or warnings in build/console output
- Make "while I'm here" changes without asking first
- Use placeholder data that looks like real data
- Skip error handling "for now"
- Remove features during "cleanup" without checking if they're documented as intentional (see AI_MISTAKES.md)
- Proceed with assumptions when a single clarifying question would prevent a wrong commit

### REMINDER: READ AND FOLLOW THE FUCKING PROHIBITIONS EVERY TIME
