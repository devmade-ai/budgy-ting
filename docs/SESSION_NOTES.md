# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Forecasting system enhancement — statistical models, daily cashflow chart, actuals-gated variance, daily accuracy tracking.

## Accomplished

- **Installed ApexCharts** (`apexcharts` + `vue3-apexcharts`) — first charting library in the project
- **Built forecast engine** (`src/engine/forecast.ts`) — EMA (alpha=0.3, 3+ months), rolling average fallback, daily expansion for charts, category-level statistical forecasting
- **Built accuracy engine** (`src/engine/accuracy.ts`) — daily forecast vs actual comparison, MAPE/weighted-MAPE, per-category and per-method breakdowns. Computed on-the-fly, not persisted. Hidden from users by default.
- **Built CashflowChart component** (`src/components/CashflowChart.vue`) — ApexCharts line chart with cumulative/daily-net toggle, optional forecast overlay with dashed line
- **Wired chart into ProjectedTab** — Table/Chart toggle, loads actuals alongside expenses, computes daily chart data
- **Gated variance on actuals** — CompareTab now shows empty state until actuals are uploaded. Variance engine exposes `hasAnyActuals` and `actualsDateRange`. No assumptions about upload timing.
- **14 forecast tests + 6 accuracy tests** — all 96 tests pass, build succeeds

## Current state

All features working. Build clean. 96 tests passing. The EMA/rolling-average models are built in the engine but not yet surfaced in category forecast UI (tracked in TODO). Accuracy metrics are computed but only available programmatically (could wire into debug pill later).

## Key context

- ApexCharts adds ~518KB to the ProjectedTab chunk — code-splitting TODO added
- Forecast engine is layered: deterministic projection (existing) + statistical models (new) operate independently
- Actuals can be uploaded for any date range, any time — variance only shows for periods with data
- Daily accuracy tracking exists at engine level but is intentionally hidden from users
