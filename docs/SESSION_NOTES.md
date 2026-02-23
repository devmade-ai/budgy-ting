# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Full MVP implementation — all 7 phases of the budgy-ting PWA.

## Accomplished

- **Phase 0:** Project scaffolding (Vite, Vue 3, TypeScript, UnoCSS, Dexie, PWA, routing)
- **Phase 1:** Budget CRUD (create/edit/delete forms, cascade delete, list with empty state)
- **Phase 2:** Expense CRUD (grouped list, category autocomplete composable, frequency selector)
- **Phase 3:** Projection engine (all 6 frequency types, partial months, monthly breakdown table)
- **Phase 4:** Import wizard (CSV/JSON parsing, column auto-detect, 3-pass matching, review/approve)
- **Phase 5:** Comparison views (variance engine, line item/category/monthly views, CSS bar charts)
- **Phase 6:** Export/import (JSON export with comparison snapshot, restore from backup, clear all)
- **Phase 7:** PWA polish (install prompt, service worker update banner)

## Current state

All code for MVP is written. **Dependencies need to be installed** — npm registry was blocked in the build environment. Run `npm install` then `npm run dev` to test.

Key items still needing attention:
- PWA icons don't exist yet (need to create and place in /public)
- Charts use CSS bars instead of ApexCharts (npm couldn't install). Can swap when deps available.
- Fuzzy matching uses simple substring/Levenshtein instead of Fuse.js. Can swap when deps available.
- No date-fns yet — using simple ISO string math for date calculations

## Key context

- npm registry blocked — all code hand-written without node_modules
- CSV parser is custom (not Papa Parse) — handles common cases but not all edge cases
- Matching engine has simple fuzzy scoring — will benefit from Fuse.js swap
- All engines are pure TypeScript in `src/engine/` — testable independently
- Path alias `@/` -> `src/` in both vite.config.ts and tsconfig.app.json
- UnoCSS icons: `@iconify-json/lucide` for i-lucide-* classes
- Brand colour: emerald/green (#10b981)
