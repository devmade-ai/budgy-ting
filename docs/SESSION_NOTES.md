# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Complete visual facelift: **removed DaisyUI** and adopted the **Farlume design system**
(handoff bundle from Claude Design) as the app's own styling layer.

## Accomplished

- **Foundation (new):**
  - `src/styles/tokens/` — ported Farlume tokens: `colors.css` (palette + semantic aliases; light `:root`, dark `[data-theme="dark"]`), `typography.css`, `spacing.css`, `effects.css` (radii/shadows/glow; z-index remapped to the repo scale 50/60/70 so the debug pill stays on top), `fonts.css`, `print.css`.
  - `src/styles/components.css` — the full `.fl-*` component layer (buttons, icon buttons, inputs/selects/switch/checkbox/radio, tags + tag input, card, badge, stat/metric, table, forecast chart, dialog/overlay, toast, tooltip, segmented control, tabs, empty state, alert, spinner, skeleton, steps, progress, range, popover/menu, divider, sticky bar, link, eyebrow, prose theming). Wrapped in `@layer components`.
  - Self-hosted fonts → `src/assets/fonts/` (Newsreader, Hanken Grotesk, JetBrains Mono). Logomark → `src/assets/brand/logo-mark{,-light}.svg`.
  - `src/index.css` rewritten: dropped `@plugin "daisyui"`; imports tokens + components; `@theme inline` exposes tokens as Tailwind utilities (`bg-card`, `text-ink`, `text-accent`, `bg-pos`/`bg-neg`, `border-line`, `font-display`/`font-mono`) that flip in dark mode.
  - `daisyui` removed from package.json.
- **Theme machinery:** `src/config/themes.ts` → single `farlume` combo (light/dark, paper/ink status-bar colors); `index.html` flash script + `vite.config.ts` manifest `theme_color` (`#F4F0E8`) updated; AppLayout print handlers use `light`/`dark`.
- **Migrated all 33 DaisyUI-using files** to `.fl-*` + Farlume utilities (8 by hand incl. AppLayout, CashflowGraph, ConfirmDialog, MetricCard, EmptyState, ErrorAlert, LoadingSpinner, ClassificationBadge; the rest via 6 parallel agents). DebugPill converted to a fixed-dark, theme-independent palette.
- **Chart:** CashflowGraph wired to the Farlume chart language — ink history line, dashed amber forecast, green balance, tokenized grid/labels (via `resolveThemeColor` on `--chart-*`/`--pos`/`--text-muted`). Controls → segmented controls.
- **Brand copy:** meta + manifest description → "Forecast your cash position — local-first, on your device." Header uses the logomark + "Farlume" in Newsreader.
- **Docs:** CLAUDE.md (DaisyUI sync points → Farlume; added design-system section + no-DaisyUI rule), README tech stack, TODO (facelift follow-ups), USER_ACTIONS (icon regen).

## Current state

- **Working / verified:** `npm run build` ✓, `vue-tsc` typecheck ✓, `npm test` ✓ (178/178). Built CSS contains all Farlume utilities, `.fl-*` classes, the dark `[data-theme=dark]` scope, and the self-hosted fonts. Zero DaisyUI residue in `src/` (grep-clean).
- **Not done (no in-browser pass available here):** visual QA across screens in light/dark/mobile; app-icon regeneration from the logomark. Both tracked in TODO / USER_ACTIONS.

## Key context

- DaisyUI is gone — never reintroduce it. Use `.fl-*` classes (`src/styles/components.css`) + Farlume color utilities. Avoid `rounded-box/field/selector/btn` (don't resolve); Tailwind `rounded-md/lg` now map to Farlume radii because the token `:root` overrides Tailwind's defaults.
- Dark mode = `[data-theme="dark"]` on `<html>` (light is `:root`); `.dark` class kept in sync as a Tailwind safety net. Three sync points: themes.ts, index.html flash script, vite manifest.
- Money/figures are always mono — use `.fl-num` (or `fl-td--mono` in tables).
- Design source bundle was extracted to `/tmp/design-extract/farlume-design-system/` (ephemeral; re-fetch from the design handoff if needed).
