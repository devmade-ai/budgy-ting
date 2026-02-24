# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Deployment setup, deployment review, code standards audit, PWA system overhaul, debug system.

## Accomplished

- **Deployment:** GitHub Actions workflow for GitHub Pages, sharp-based icon generation from SVG
- **Deployment review fixes:** Router base path, SVG font (Georgia → serif), Node 22, sharp 0.34, maskable icon split
- **Code standards:** Extracted duplicated `formatAmount`, removed dead Python script, added decision comments
- **PWA overhaul:** Split `usePWA` into `usePWAUpdate` + `usePWAInstall`, added `InstallPrompt` banner with dismiss, `InstallInstructionsModal` with 4 browser variants, install analytics in localStorage
- **Debug system:** `debugLog.ts` (200-entry pub/sub buffer), `DebugPill.vue` (Log + Environment tabs), mounted in separate Vue root

## Current state

All code written. **Dependencies still need `npm install`** — npm registry was blocked. Run `npm install && npm run dev` to test.

Working features:
- Full budget CRUD, expense CRUD, projection engine, import wizard, comparison views
- Export/import (JSON backup/restore)
- PWA install prompt (native Chromium + manual instructions for Safari/Firefox)
- Service worker updates with 60-min periodic checks
- Debug pill (floating diagnostic panel, alpha-phase)
- GitHub Pages deployment workflow ready

## Key context

- npm registry blocked — no `node_modules`, can't run type-check or build
- `usePWAUpdate.ts` uses `virtual:pwa-register/vue` (requires vite-plugin-pwa runtime)
- `usePWAInstall.ts` has module-level event listeners (shared state across components)
- Debug pill mounts in separate Vue root in `main.ts` (survives main app crashes)
- `formatAmount` is now in `composables/useFormat.ts` (shared by 4 views)
- Icons generated from `public/icon.svg` via `scripts/generate-icons.mjs` (uses `serif` font, not Georgia)
- `env.d.ts` has `vite-plugin-pwa/client` type reference for `virtual:pwa-register/vue`
- All engines are pure TypeScript in `src/engine/` — testable independently
- Path alias `@/` → `src/` in both vite.config.ts and tsconfig.app.json
- UnoCSS icons: `@iconify-json/lucide` for i-lucide-* classes
- Brand colour: emerald/green (#10b981)
