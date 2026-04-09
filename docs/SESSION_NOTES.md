# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

glow-props pattern sync — CLAUDE.md reference migration, APP_ICONS, BURGER_MENU, DEBUG_SYSTEM.

## Accomplished

**CLAUDE.md reference migration:**
- Renamed "Suggested Implementations" → "Implementation Patterns (Source of Truth)"
- All fetch URLs → `glow-props/contents/docs/implementations/{PATTERN_NAME}.md`
- Added listing endpoint and GitHub Pages URL
- Fixed Z-Index Scale reference → `docs/implementations/BURGER_MENU.md`
- Fixed 10 stale `glow-props CLAUDE.md` code comment references across 6 source files
- Fixed 1 stale "Suggested Implementations" reference in AI_MISTAKES.md

**APP_ICONS (glow-props sync):**
- Sharp density 150 → 400 DPI
- `shape-rendering="geometricPrecision"` on source icon.svg
- Dedicated 1024x1024 maskable icon (no rounded corners, B glyph at 80% safe zone)
- 48x48 PNG favicon with `<link rel="icon">` + `includeAssets`
- Manifest: 192/512 purpose "any", 1024 purpose "maskable"

**BURGER_MENU (glow-props sync):**
- ArrowDown/ArrowUp (wrapping) + Home/End key navigation with idx=-1 guard
- Z-index enforced: modals/drawers z-50 → z-[60] across 6 components
- Error routing: `handleItem` catches errors → `debugLog()` (debug pill)
- Removed redundant `handleOutsideClick` document listener (backdrop handles it)
- Timer cleanup: setTimeout tracked + cleared on unmount
- `visibleItems` → `computed` (was function call in template)

**DEBUG_SYSTEM (glow-props sync):**
- Circular buffer: Array.shift() O(n) → head/count pointer O(1)
- Console interception: console.error/warn patched at module load with re-entrancy guard
- PWA Diagnostics tab: 7 health checks (protocol, network, SW, standalone, install prompt, SW state, manifest)
- Inline styles: all Tailwind replaced in DebugPill.vue (CSS-independent)
- Pre-framework inline pill: vanilla JS in index.html with error buffer, __debugPushError(), 20s load timeout
- Error dedup: inline listeners yield to debugLog.ts via __debugLogReady flag
- Diagnostic indices: hardcoded → label-based findIndex lookup
- Inline pill: alert() → toggleable DOM error panel
- URL query param redaction in reports, ClipboardItem Blob fallback
- DebugSource accepts ad-hoc strings via `(string & {})`
- main.ts bridges pre-mount errors and clears load timer

## Current state

All work complete and pushed to `claude/fix-docs-fetch-urls-B2Gel`. Build verified. TypeScript clean. This session addressed CLAUDE.md, APP_ICONS, BURGER_MENU, and DEBUG_SYSTEM items from glow-props pattern gaps.

## Key context

- glow-props `docs/TODO.md` has a "Per-Repo Pattern Implementation Gaps" section with a budgy-ting subsection — this session addressed 4 of 8 categories
- Remaining categories not yet addressed: DOWNLOAD_PDF, PWA_SYSTEM, THEME_DARK_MODE, EVENT_BUS
- The implementation pattern docs (`docs/implementations/*.md`) are reference material, not the todo list
- User's plan: fetch source → break into phases → analyze one at a time → create todos with success measures → execute one at a time with verification
- Critical constraints: stop between steps, no unapproved work, no assumptions, ask before deciding
