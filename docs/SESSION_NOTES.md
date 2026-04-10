# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

DaisyUI v5 migration — full 6-phase migration + strengthening pass + component adoption.

## Accomplished

**Initial migration (6 phases):**
- Installed daisyui@5, configured `@plugin "daisyui"` with 4 themes (lofi, black, emerald, forest)
- Removed all custom CSS variable definitions and component classes
- Migrated all 30+ Vue files to DaisyUI semantic tokens

**Strengthening pass:**
- Fixed `<select>` elements, `--color-neutral` conflict, cross-tab sync guard, duplicated classes

**DaisyUI component adoption:**
- `steps` — NewImportWizard step indicator (replaced 25-line custom circles + lines)
- `skeleton` — SkeletonLoader (replaced animate-pulse + bg-base-300 boxes)
- `join` + `join-item` — CashflowGraph, WorkspaceForm toggle buttons
- `divider` — BurgerMenu, WorkspaceDetailView, WorkspaceListView, InstallInstructionsModal
- `progress` — WorkspaceListView pull-to-refresh, ImportStepReview ML loading bars
- `modal` + `modal-box` — 4 modal files (ConfirmDialog, TutorialModal, InstallInstructionsModal, TransactionEditModal)
- `loading loading-spinner` — TransactionEditModal (removed Loader2 import)
- HelpDrawer: Skipped — DaisyUI drawer doesn't fit modal-style overlay panels with custom animation

## Current state

All work complete and pushed. TypeScript + Vite build + 106 tests pass.

## Key context

- **4 sync points** for theme combos: `src/config/themes.ts` (source of truth) ↔ `src/index.css` @plugin themes ↔ `index.html` flash script combos object ↔ `vite.config.ts` manifest theme_color
- `src/composables/useDarkMode.ts` — dual-layer (data-theme + .dark), `syncing` guard for cross-tab
- DaisyUI registered themes: `lofi --default, black --prefersdark, emerald, forest`
- Flash prevention script also updates meta theme-color pre-paint (added in fix commit)
- Brand colors in `@theme` for CashflowGraph only (not DaisyUI-controlled)
- `--color-data-neutral` (renamed from `--color-neutral` to avoid DaisyUI conflict)
- DebugPill intentionally NOT migrated (inline styles, CSS-independent)
- glow-props pattern sync remaining: EVENT_BUS
