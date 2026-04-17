# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Cross-project cleanup sweep: docs structure, Communication section, PWA icon cache-busting, install modal reinstall hint, EVENT_BUS decision.

## Accomplished

- Deleted `docs/HISTORY.md`; git history is the changelog
- Removed HISTORY.md subsection from CLAUDE.md Documentation rules; replaced "move to HISTORY.md" wording with "delete completed items"
- Added `## Communication` section to CLAUDE.md (verbatim from glow-props); inserted COMMUNICATION into the header reminder line
- Cleaned duplicate communication + HISTORY bullets from AI Notes and AI_MISTAKES entry
- Added `iconVersion()` + `iconCacheBustHtml()` plugin + `versioned()` helper to `vite.config.ts`
- Versioned all manifest icon srcs (`pwa-192x192`, `pwa-512x512`, `pwa-maskable-1024x1024`)
- Added `ignoreURLParametersMatching: [/^v$/]` to workbox config so precache resolves versioned URLs
- Added `src/iconCacheBust.test.ts` tripwire — 6 assertions across source + dist, verified by breaking workbox option (test fails) then restoring (test passes)
- Added reinstall-hint collapsible to `InstallInstructionsModal.vue` with iOS/Android/desktop branches
- Recorded EVENT_BUS as "Not Applicable Patterns" in CLAUDE.md (no cross-service pub/sub need in this app)
- Confirmed Save-as-PDF button already exists (`WorkspaceDetailView.vue:152`) — no code change needed

## Current state

All 112 tests pass. `vue-tsc --noEmit` clean. `vite build` succeeds and emits:
- `dist/index.html` link tags with `?v=<hash>`
- `dist/manifest.webmanifest` icon srcs with `?v=<hash>`
- `dist/sw.js` with `cleanupOutdatedCaches()` + `ignoreURLParametersMatching:[/^v$/]`

Branch: `claude/document-budgy-ting-Yn52B`.

## Key context

- Icon cache-bust uses query-string approach (`?v=<sha256-8>`), not filename hashing. Tradeoff noted in pattern doc: filename hashing is architecturally cleaner but requires custom prebuild step that vite-plugin-pwa doesn't provide.
- `iconCacheBustHtml()` throws at build time if any expected literal href isn't found in `index.html` — prevents silent drift if someone reformats a link tag.
- Reinstall collapsible uses native `<details>`/`<summary>` — zero JS, accessible by default. Collapsed by default so first-time installers see the main flow first.
- OS icon caches (Springboard, Android launcher) are user-side — no web fix exists. The collapsible IS the mitigation.
- EVENT_BUS decision is not "never" — it's "no evidence a bus would have a consumer today". Re-evaluate if two services start needing to react to each other.
