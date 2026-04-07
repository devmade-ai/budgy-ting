# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Full DaisyUI v5 migration — replacing custom Tailwind v4 CSS variables with DaisyUI semantic theme system.

## Accomplished

- Installed DaisyUI v5.5.19, configured `@plugin "daisyui"` in index.css
- Overrode DaisyUI primary color to brand green (#10b981) via oklch
- Switched dark mode from `.dark` class to `data-theme` attribute (DaisyUI standard)
- Updated flash prevention script in index.html for `data-theme`
- Removed all custom CSS component classes (`.btn-primary`, `.btn-secondary`, `.btn-danger`, `.input-field`, `.card`, `.page-title`, `.tag-pill`) — replaced by DaisyUI equivalents
- Removed `:root` / `.dark` CSS variable blocks — DaisyUI provides `base-100/200/300`, `base-content`, `primary`, `error`, `success`, `warning`, `info`
- Migrated 30+ Vue files: replaced all hardcoded Tailwind color classes and `dark:` prefixes with DaisyUI semantic tokens
- Updated `@custom-variant dark` to target `[data-theme="dark"]` for edge cases
- Build passes clean (`vue-tsc -b && vite build`)

## Current state

All migration work complete and building. DebugPill intentionally NOT migrated (hardcoded dark theme by design — alpha-only).

## Key context

- DaisyUI uses `data-theme` attribute on `<html>`, not `.dark` class
- `useDarkMode.ts` uses `setAttribute('data-theme', ...)` instead of `classList.add/remove('dark')`
- Primary color override: `oklch(69.7% 0.153 163.5)` in `html[data-theme]` selectors (higher specificity than DaisyUI defaults)
- Brand color scale still in `@theme` for Tailwind utilities (`bg-brand-500`, etc.) — used sparingly for brand-specific styling
- DaisyUI semantic mapping: `bg-base-100` (cards), `bg-base-200` (page bg), `bg-base-300` (borders/insets), `text-base-content` (text), `text-base-content/60` (muted text)
- Button mapping: `btn btn-primary`, `btn btn-ghost` (was secondary), `btn btn-error` (was danger)
- Input mapping: `input input-bordered` for inputs, `select select-bordered` for selects
- CashflowGraph still uses hardcoded hex colors for ApexCharts (it doesn't support CSS variables)
- `input-field` class no longer exists — all inputs use DaisyUI classes directly
