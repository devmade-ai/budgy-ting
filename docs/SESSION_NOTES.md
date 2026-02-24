# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Tutorial modal for first-time users.

## Accomplished

- **Tutorial modal:** Created 6-step walkthrough modal (`TutorialModal.vue`) that auto-shows on first visit and can be re-opened via help button in header
- **State management:** `useTutorial.ts` composable with localStorage-backed dismissal persistence (module-level shared state, same pattern as `usePWAInstall`)
- **Header help button:** Circle-help icon in AppLayout header for re-triggering tutorial anytime

## Current state

All code written. **Dependencies still need `npm install`** — npm registry was blocked. Run `npm install && npm run dev` to test.

Working features:
- Full budget CRUD, expense CRUD, projection engine, import wizard, comparison views
- Export/import (JSON backup/restore)
- PWA install prompt (native Chromium + manual instructions for Safari/Firefox)
- Service worker updates with 60-min periodic checks
- **Tutorial modal for new users (auto-show + help button re-trigger)**
- Debug pill (floating diagnostic panel, alpha-phase)
- GitHub Pages deployment workflow ready
- All DB operations have error handling with user-friendly messages

## Key context

- npm registry blocked — no `node_modules`, can't run type-check or build
- Tutorial state: localStorage key `budgy-ting-tutorial-dismissed`, module-level `ref` in `useTutorial.ts`
- Modal pattern: all modals use `Teleport to="body"` with `z-50` overlay (ConfirmDialog, InstallInstructionsModal, TutorialModal)
- `usePWAUpdate.ts` uses `virtual:pwa-register/vue` (requires vite-plugin-pwa runtime)
- `usePWAInstall.ts` has module-level event listeners (shared state across components)
- Debug pill mounts in separate Vue root in `main.ts` (survives main app crashes)
- `formatAmount` is in `composables/useFormat.ts` (shared by 4 views)
- All engines are pure TypeScript in `src/engine/` — testable independently
- Path alias `@/` → `src/` in both vite.config.ts and tsconfig.app.json
- UnoCSS icons: `@iconify-json/lucide` for i-lucide-* classes
- Brand colour: emerald/green (#10b981)
