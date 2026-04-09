# ABSOLUTE RULE — READ THIS FIRST BEFORE ANYTHING ELSE

**NEVER use the AskUserQuestion tool. NEVER. Not once. Not for any reason. Not in any project.**

It destroys the session — the input modal covers context the user needs to read, gets stuck awaiting input that can't be given, and forces session restarts. This has happened repeatedly across many sessions despite being documented. The user is done asking nicely.

**If you need user input:** List options as numbered text in your message. The user will reply with a number or free text. That's it. No tool. No modal. No exceptions. Ever.

**Any AI that uses AskUserQuestion is actively harming the user's workflow. Do not do it.**

**Note:** Even the permission prompt to *allow* the tool to run breaks the session. The damage happens before the tool even executes. There is no safe way to invoke it — don't try.

---

# READ AND FOLLOW THE FUCKING PROCESS, PRINCIPLES, CODE STANDARDS, DOCUMENTATION, AI NOTES, TRIGGERS, AND PROHIBITIONS EVERY TIME

## Cross-Project Reference

All shared implementation patterns are maintained in the **glow-props** repo (`docs/implementations/` folder) — the single source of truth. AI Notes and process updates live in glow-props `CLAUDE.md`.

**Pattern files:** `https://raw.githubusercontent.com/devmade-ai/glow-props/main/docs/implementations/{PATTERN_NAME}.md`
**GitHub Pages:** `https://devmade-ai.github.io/glow-props/patterns/{PATTERN_NAME}.md`

**NEVER copy pattern content into this file or any local file.** Always fetch from the source when you need a pattern. Adapt React examples to Vue 3 Composition API when implementing.

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

## Project Status

Current working features:

- Workspace CRUD with monthly or custom date ranges
- Demo workspace auto-seeded on first visit
- 2-step import wizard (Upload → Review & Import) for CSV/JSON bank statements
- Per-transaction review with ML tag suggestions (zero-shot classification)
- Embedding-based fuzzy pattern matching (cosine similarity)
- Recurring pattern detection (daily/weekly/biweekly/monthly/quarterly/annually/irregular)
- Variable recurring expenses (fixed/variable/irregular variability)
- Holt's double exponential smoothing forecasting with day-of-week seasonality
- Cash runway calculation with confidence bands (optimistic/expected/pessimistic)
- Prediction accuracy metrics (MAE, RMSE, bias, WMAPE, hit rate)
- Single-screen dashboard (cashflow graph, metrics grid, transaction table)
- Transaction edit modal with read-only view mode
- Export/import/restore workspace data as JSON
- PWA: offline-first, installable, service worker update prompt, manual update check
- Debug pill (alpha): floating diagnostic panel with log + environment + PWA diagnostics tabs, inline styles (CSS-independent), console interception, pre-framework inline pill with 20s load timeout
- Tag autocomplete from tagCache + pattern tags + ML suggestions
- Duplicate detection on import (date + amount + description)
- Pull-to-refresh, haptic feedback, bottom sheet modal
- Dark mode: user-controlled toggle, system preference fallback, localStorage persistence, cross-tab sync, flash prevention, print overrides

**Database:** Schema v8 (8 tables: workspaces, transactions, patterns, importBatches, tagCache, embeddingCache + 2 legacy)
**Tech stack:** Vue 3 + TypeScript + Tailwind CSS v4 + Dexie.js + vite-plugin-pwa + ApexCharts + simple-statistics + Transformers.js (Web Worker)

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

**Tags:** Use descriptive tags for the change area (e.g. projection, import, pwa, db, ux, a11y, docs, test, cleanup)
**Complexity:** 1=trivial, 2=small, 3=medium, 4=large, 5=major rewrite
**Urgency:** 1=planned, 2=normal, 3=elevated, 4=urgent, 5=critical
**Impact:** internal, user-facing, infrastructure, or api
**Risk:** low=safe change, medium=could break things, high=touches critical paths
**Debt:** added=introduced shortcuts, paid=cleaned up debt, neutral=neither
**Epic:** groups related commits under one feature/initiative name
**Semver:** patch=bugfix, minor=new feature, major=breaking change

These footers are required on every commit. No exceptions.

### REMINDER: READ AND FOLLOW THE FUCKING CODE STANDARDS EVERY TIME

### Z-Index Scale

All projects follow this scale to prevent stacking conflicts between the burger menu, debug pill, modals, toasts, and install banners. Reference: glow-props `docs/implementations/BURGER_MENU.md`.

| Layer | Z-Index | Examples |
|-------|---------|----------|
| Base content | 0-10 | Page content, cards, inline dropdowns (autocomplete, tag suggestions) |
| Sticky headers | 10 | App bar (`header` in AppLayout) |
| Menu dropdowns | 20 | Action menus (WorkspaceDetailView) |
| Menu backdrop | 40 | Burger menu backdrop (BurgerMenu) |
| Menu dropdown | 50 | Burger menu card (BurgerMenu) |
| Modals / drawers | 60 | Dialogs, bottom sheets, help drawers, confirm dialogs |
| Toasts / banners | 70 | Update banner, install prompt, ToastNotification |
| Debug pill | 80 | Debug overlay (separate Vue root) |

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
- **Docs are part of the task, not a follow-up.** Before committing any fix or feature: update TODO.md (remove completed, add deferred), update HISTORY.md (record what was done). Commit code + docs together. NEVER commit code changes without updating docs in the same commit. See AI_MISTAKES.md entry from 2026-03-13.
- **Communication style:** Direct, concise responses. No filler phrases or conversational padding. State facts and actions. Ask specific questions with concrete options when clarification is needed.
- **NEVER use the AskUserQuestion tool.** It breaks the session UI — the input modal covers context, gets stuck awaiting input, and disrupts workflow. If you need user input, list options as numbered text in your response and let the user reply with a number or text. This is a hard rule with zero exceptions.
- **Development phase:** App is pre-release with zero users. Features added now are provisional and will be changed or removed later. Don't over-polish or over-engineer — keep things easy to swap out. Don't push back on feature ideas based on "users don't need this" — there are no users yet, and the goal is exploration.
- **Check build tools before building.** Run `npm install` or verify `node_modules/.bin/vite` exists before attempting `npm run build`. The `sharp` package may not be installed (used by prebuild icon generation), so use `./node_modules/.bin/vite build` directly to skip the prebuild step if sharp fails.
- **Claude Code mobile/web — accessing sibling repos:**
  - Use `GITHUB_ALL_REPO_TOKEN` with the GitHub API (`api.github.com/repos/devmade-ai/{repo}/contents/{path}`) to read files from other devmade-ai repos
  - Use `$(printenv GITHUB_ALL_REPO_TOKEN)` not `$GITHUB_ALL_REPO_TOKEN` to avoid shell expansion issues
  - Never clone sibling repos — use the API instead
- **Discontinued repos — skip entirely:** `plant-fur` and `coin-zapp` are discontinued. Do not check, audit, align, or include them in cross-project operations.
- **Implementation patterns — no local copies.** All implementation patterns live in glow-props `docs/implementations/` folder. Fetch individual patterns from `api.github.com/repos/devmade-ai/glow-props/contents/docs/implementations/{PATTERN_NAME}.md` or list available patterns via `api.github.com/repos/devmade-ai/glow-props/contents/docs/implementations`. Never paste pattern content into this project's CLAUDE.md or any local file. Never reconstruct patterns from memory. If the source is unreachable, defer the work.

### REMINDER: READ AND FOLLOW THE FUCKING AI NOTES EVERY TIME

## Implementation Patterns (Source of Truth)

**DO NOT store implementation patterns locally.** All patterns live in the glow-props repo under `docs/implementations/` and must be fetched from there every time.

### Where to find patterns

The single source of truth for all implementation patterns is the glow-props `docs/implementations/` folder. Each pattern is a separate `.md` file.

**List available patterns:**
```
api.github.com/repos/devmade-ai/glow-props/contents/docs/implementations
```

**Fetch a specific pattern:**
```
api.github.com/repos/devmade-ai/glow-props/contents/docs/implementations/{PATTERN_NAME}.md
```

**GitHub Pages (read-only):**
```
https://devmade-ai.github.io/glow-props/patterns/{PATTERN_NAME}.md
```

**How to access via API:** Use `GITHUB_ALL_REPO_TOKEN` with the GitHub API.
Or use `$(printenv GITHUB_ALL_REPO_TOKEN)` with curl (see AI Notes for proxy handling).

### Rules

1. **Always fetch from glow-props `docs/implementations/`** — never rely on cached, copied, or memorized versions of patterns
2. **List patterns first** — use the listing endpoint to discover available patterns dynamically
3. **Never paste pattern content into this file** — this section is a pointer, not a copy
4. **Adapt React examples to Vue 3 Composition API** when implementing patterns from glow-props
5. **Check for updates before implementing** — patterns evolve; the source always has the latest version
6. **If glow-props is unreachable**, note it and defer — do not reconstruct patterns from memory

## Prohibitions

Never:
- **Use the AskUserQuestion tool — EVER. For ANY reason. See the top of this file. List options as numbered text instead.**
- Start implementation without understanding full scope
- Create files outside established project structure
- Leave TODO comments in code without tracking them in `docs/TODO.md`
- Ignore errors or warnings in build/console output
- Make "while I'm here" changes without asking first
- Use placeholder data that looks like real data
- Skip error handling "for now"
- Remove features during "cleanup" without checking if they're documented as intentional (see AI_MISTAKES.md)
- Proceed with assumptions when a single clarifying question would prevent a wrong commit
- Use interactive input prompts or selection UIs — list options as numbered text instead
- Store, copy, or paste implementation patterns locally — always fetch from glow-props source

### REMINDER: READ AND FOLLOW THE FUCKING PROHIBITIONS EVERY TIME

## Triggers

Single-word commands that invoke focused analysis passes. Each trigger has a short alias. Type the word or alias to activate.

| # | Trigger | Alias | What it does |
|---|---------|-------|--------------|
| 1 | `review` | `rev` | Code review — bugs, UI, UX, simplification |
| 2 | `audit` | `aud` | Code quality — hacks, anti-patterns, latent bugs, race conditions |
| 3 | `docs` | `doc` | Documentation accuracy vs actual code |
| 4 | `mobile` | `tap` | Mobile UX — touch targets, viewport, safe areas |
| 5 | `clean` | `cln` | Hygiene — duplication, refactor candidates, dead code |
| 6 | `performance` | `perf` | Re-renders, expensive ops, bundle size, DB/API, memory |
| 7 | `security` | `sec` | Injection, auth gaps, data exposure, insecure defaults, CVEs |
| 8 | `debug` | `dbg` | Debug pill coverage — missing logs, noise |
| 9 | `improve` | `imp` | Open-ended — architecture, DX, anything else |
| 10 | `start` | `go` | Sequential sweep of all 9 above, one at a time |

### Trigger behavior

- Each trigger runs a single focused pass and reports findings.
- Findings are listed as numbered text — never interactive prompts or selection UIs.
- One trigger per response. Never combine multiple triggers in a single response.

### `start` / `go` behavior

Runs all 9 triggers in priority sequence, one at a time:

`rev` → `aud` → `doc` → `tap` → `cln` → `perf` → `sec` → `dbg` → `imp`

After each trigger completes and findings are presented, the user responds with one of:
1. `fix` — apply the suggested fixes, then move to the next trigger
2. `skip` — skip this trigger's findings and move to the next trigger
3. `stop` — end the sweep entirely

Rules:
- Always pause after each trigger — never auto-advance to the next one.
- Never run multiple triggers in one response.
- Wait for the user's explicit `fix`, `skip`, or `stop` before proceeding.

### REMINDER: READ AND FOLLOW THE FUCKING TRIGGERS EVERY TIME
