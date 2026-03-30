# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Full dark mode implementation — glow-props sync.

## Accomplished

- Compared budgy-ting CLAUDE.md with glow-props upstream, identified 20 applicable changes
- Added all 20 items to TODO.md grouped by category
- Implemented complete dark mode system:
  - CSS variable palette (`:root` light + `.dark` dark tokens) in `index.css`
  - `@custom-variant dark` directive for Tailwind v4
  - `color-scheme: dark` on `html.dark` for native form inputs
  - `useDarkMode.ts` composable (localStorage, matchMedia, cross-tab sync, meta theme-color)
  - Flash prevention inline script in `index.html`
  - Dual `<meta name="theme-color">` tags with media queries
  - Dark/Light toggle in burger menu with Sun/Moon icons
  - `dark:` variants on 30 files (17 components + 8 views + index.css + index.html + composable)
  - ApexCharts dark theme config (axis, grid, tooltip, legend)
  - `@media print` overrides (no-print class, white bg, break-inside)
- Moved completed dark mode TODOs to HISTORY.md

## Current state

All dark mode work complete and building successfully. DebugPill intentionally NOT updated (uses hardcoded dark theme by design — alpha-only).

## Key context

- Dark tokens: `--color-surface-page: #14142a`, `--color-surface: #1c1c2e`, `--color-surface-elevated: #252540`
- Theme-color meta tags: light `#f9fafb`, dark `#14142a` (match `--color-surface-page`)
- `useDarkMode.ts` is a module-level singleton (shared state via `ref`)
- Flash prevention script in index.html duplicates localStorage/matchMedia logic from composable
- Chart re-renders on theme change via `:key` binding that includes `isDark`
- `input-field` class uses `text-base` (16px) — do NOT add `text-sm` to inputs
- Print CSS: `@media print` in index.css — `.no-print` hides elements, forces white bg
