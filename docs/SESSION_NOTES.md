# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Complete visual facelift: **removed DaisyUI** and adopted the **Farlume design system**
(handoff bundle from Claude Design) as the app's own styling layer. Then **extended the
demo seed** so every analytical feature is exercisable, audited the forecasting/runway
math for correctness, and **reframed the main chart to "cash balance over time."**

## Accomplished

- **Demo seed rewrite (`src/db/demoData.ts`):** deterministic ~12-month generator —
  731 transactions / 20 patterns covering all 7 cadences + 3 variabilities, day-of-week
  structure (weekday coffee, weekend dining), a mid-history salary raise (trend), and
  once-off shocks (laptop/flights/dental). Patterns are computed FROM the generated
  transactions so stats never drift. **Audited correctness** (Playwright + IndexedDB):
  every pattern's expectedAmount == data mean, last-seen matches, median intervals match
  the declared cadence. **Balance tuned** to a realistic moderate overspend — income
  ≈R35.4k/mo, expenses ≈R43.7k/mo, net ≈−R8.3k/mo (forecast deficit ≈−R3.3k/mo) — so the
  cash runway depletes honestly: expected "cash lasts until" ≈6 months out, worst-case
  ≈2 months. Demo seeds `forecast-months=12` for the workspace so the full year + the
  runway date show by default (the 3-month default is too short to surface it). Backtest:
  333 out-of-sample predictions, accuracy ~74%, full interval calibration. Empty-DB only.
- **Foundation (new):**
  - `src/styles/tokens/` — ported Farlume tokens: `colors.css` (palette + semantic aliases; light `:root`, dark `[data-theme="dark"]`), `typography.css`, `spacing.css`, `effects.css` (radii/shadows/glow; z-index remapped to the repo scale 50/60/70 so the debug pill stays on top), `fonts.css`, `print.css`.
  - `src/styles/components.css` — the full `.fl-*` component layer (buttons, icon buttons, inputs/selects/switch/checkbox/radio, tags + tag input, card, badge, stat/metric, table, forecast chart, dialog/overlay, toast, tooltip, segmented control, tabs, empty state, alert, spinner, skeleton, steps, progress, range, popover/menu, divider, sticky bar, link, eyebrow, prose theming). Wrapped in `@layer components`.
  - Self-hosted fonts → `src/assets/fonts/` (Newsreader, Hanken Grotesk, JetBrains Mono). Logomark → `src/assets/brand/logo-mark{,-light}.svg`.
  - `src/index.css` rewritten: dropped `@plugin "daisyui"`; imports tokens + components; `@theme inline` exposes tokens as Tailwind utilities (`bg-card`, `text-ink`, `text-accent`, `bg-pos`/`bg-neg`, `border-line`, `font-display`/`font-mono`) that flip in dark mode.
  - `daisyui` removed from package.json.
- **Theme machinery:** `src/config/themes.ts` → single `farlume` combo (light/dark, paper/ink status-bar colors); `index.html` flash script + `vite.config.ts` manifest `theme_color` (`#F4F0E8`) updated; AppLayout print handlers use `light`/`dark`.
- **Migrated all 33 DaisyUI-using files** to `.fl-*` + Farlume utilities (8 by hand incl. AppLayout, CashflowGraph, ConfirmDialog, MetricCard, EmptyState, ErrorAlert, LoadingSpinner, ClassificationBadge; the rest via 6 parallel agents). DebugPill converted to a fixed-dark, theme-independent palette.
- **Chart (`src/components/CashflowGraph.vue`):** two reframes.
  1. Wired to the Farlume chart language — tokenized colors/grid/labels via `resolveThemeColor` on `--chart-*`/`--text-muted`; controls → segmented controls.
  2. **Default mode is now "Balance" = cash balance over time** (was "Cumulative" net-from-zero). One continuous absolute-cash line: history is reconstructed backward from today's cash-on-hand (`historyOffset = cashOnHand − lastActualCumulative`), the forecast projects forward from the same boundary, and the line crosses a red "Out of cash" zero reference exactly at the runway depletion date (red "Runs out" vertical marker). The forecast's optimistic/pessimistic spread is a translucent amber **rangeArea** band (cumulative `band.upper`/`band.lower`, same edges runway.ts uses). A "Daily net" mode keeps the per-day in/out lines. `cashOnHand` is a new prop from WorkspaceDashboard (`cashOnHandForRunway`); when it's null/≤0, Balance falls back to a "Net position" line from zero with no zero/runway markers. `dataLabels` forced off (rangeArea defaults them on). History = ink solid, forecast = dashed amber, range = amber fill.
- **Brand copy:** meta + manifest description → "Forecast your cash position — local-first, on your device." Header uses the logomark + "Farlume" in Newsreader.
- **Docs:** CLAUDE.md (DaisyUI sync points → Farlume; added design-system section + no-DaisyUI rule), README tech stack, TODO (facelift follow-ups), USER_ACTIONS (icon regen).

## Current state

- **Working / verified:** `npm run build` ✓, `vue-tsc` typecheck ✓, `npm test` ✓ (178/178). Built CSS contains all Farlume utilities, `.fl-*` classes, the dark `[data-theme=dark]` scope, and the self-hosted fonts. Zero DaisyUI residue in `src/` (grep-clean).
- **App icons:** regenerated from the Farlume logomark via `npm run generate-icons` (favicon/apple-touch/pwa-any/maskable + `icon.svg`); cache-bust hash flow picks up the new bytes.
- **Visual QA done:** Playwright sweep (pre-installed Chromium at `/opt/pw-browsers`, driven via `executablePath`) across list / dashboard / import / tutorial / help / edit-modal / create / burger-menu in light + dark, desktop + mobile — no styling regressions. The Farlume chart language (ink history / dashed amber forecast / amber range band), mono numerals, serif headings, and dark mode all render correctly. The reframed Balance chart was screenshot-verified in both themes: history declines from ~R110k to today's R20k, forecast continues the sawtooth through the zero line at the "Runs out" marker (matches the "Runs out 2026-12-20" header figure), band widens over the horizon. `dataLabels` off, daily-net mode clean.
- **Forecast/runway math audited** (read every formula in `forecast.ts` / `runway.ts` / `accuracy.ts` / `conformal.ts` / `validation.ts`): all textbook-correct. Two defensible simplifications, both documented in-code: constant-width bands (mean-reverting residual + deterministic recurring → no √h growth), and runway optimistic/pessimistic applying the daily band every day (a sustained-scenario, wider than a √h cumulative — the cautious-edge choice for cashflow).

## Key context

- DaisyUI is gone — never reintroduce it. Use `.fl-*` classes (`src/styles/components.css`) + Farlume color utilities. Avoid `rounded-box/field/selector/btn` (don't resolve); Tailwind `rounded-md/lg` now map to Farlume radii because the token `:root` overrides Tailwind's defaults.
- Dark mode = `[data-theme="dark"]` on `<html>` (light is `:root`); `.dark` class kept in sync as a Tailwind safety net. Three sync points: themes.ts, index.html flash script, vite manifest.
- Money/figures are always mono — use `.fl-num` (or `fl-td--mono` in tables).
- Design source bundle was extracted to `/tmp/design-extract/farlume-design-system/` (ephemeral; re-fetch from the design handoff if needed).
