# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Help menu with in-app docs (burger menu → User Guide / Testing Guide drawers).

## Accomplished

- **Burger menu:** Replaced `?` button in header with hamburger menu icon. Dropdown has 3 items: "How it works" (tutorial), "User Guide", "Test Scenarios"
- **HelpDrawer component:** Slide-out drawer from right side, renders markdown via `marked` library. Animated entrance/exit, backdrop click to close, keyboard accessible via existing `useDialogA11y`
- **Markdown content:** USER_GUIDE.md and TESTING_GUIDE.md imported at build time via Vite `?raw` — no runtime fetching
- **Prose styles:** Scoped CSS in HelpDrawer for readable markdown rendering (headings, lists, code blocks, checkboxes, links)
- **Dev phase note:** Added AI Notes entry in CLAUDE.md — app is pre-release, features are provisional
- **Pre-existing type fix:** Fixed TS2352 in exportImport.ts (double cast via `unknown`)
- **Docs updated:** USER_GUIDE.md help section, TESTING_GUIDE.md regression checklist + test scenarios

## Current state

All code type-checks, builds, 92 unit tests pass. DB schema v3.

Working features:
- All previous features intact
- Burger menu with help drawer for User Guide and Testing Guide

## Key context

- `AppLayout.vue` owns the menu state, drawer state, and markdown imports
- `HelpDrawer.vue` is generic — takes `title` + `markdown` props, renders via `marked.parse()`
- `marked` added as production dependency (lightweight, ~30KB)
- Markdown files are bundled at build time — changing docs requires a rebuild
