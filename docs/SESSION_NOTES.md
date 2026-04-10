# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

UX safety, debug pill responsiveness, debug log severity audit, glow-props pattern compliance.

## Accomplished

- Removed "Clear all data" nuclear button from workspace list — too dangerous on main screen
- Fixed debug pill panel not scaling to screen width — `w-[calc(100vw-2rem)] max-w-[360px]`
- Fixed same width bug in pre-framework inline pill in index.html
- Changed runway depletion debug severity from `warn` to `info` — data outcome, not app health
- Closed all remaining glow-props pattern gaps:
  - BURGER_MENU: Added `destructive` and `external` MenuItem properties
  - DEBUG_SYSTEM: Static `#debug-root`, subscriber replay, embed mode skip
  - DOWNLOAD_PDF: Already complete (print button exists)
  - EVENT_BUS: Already evaluated and skipped

## Current state

All work complete and pushed. TypeScript + Vite build + 106 tests pass. All glow-props patterns now fully passing.

## Key context

- Debug log severities reflect app health, not data outcomes — forecasts, runway, accuracy are `info`
- ML model failures are `warn` (recoverable/optional) — left as-is
- Pre-framework inline pill in index.html uses inline styles — must sync with DebugPill.vue manually
- MenuItem `destructive`/`external` properties exist but no current menu items use them yet
- `subscribe()` in debugLog.ts now replays existing entries — DebugPill simplified accordingly
- Debug pill skipped when `window.self !== window.top` (embed/iframe)
