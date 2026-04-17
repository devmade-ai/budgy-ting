# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Cross-project cleanup sweep: docs structure, Communication section, PWA icon cache-busting across all 5 cache layers including OS launcher cache via a reinstall banner, EVENT_BUS decision.

## Accomplished

- Deleted `docs/HISTORY.md`; git history is the changelog
- Added `## Communication` section to CLAUDE.md (verbatim from glow-props); inserted COMMUNICATION into the header reminder line
- Cleaned duplicate communication + HISTORY bullets from AI Notes and the AI_MISTAKES 2026-03-13 entry
- `vite.config.ts`: added `iconVersion()` + `iconCacheBustHtml()` plugin + `versioned()` helper; versioned all manifest icons and all HTML icon `<link>` tags with `?v=<sha256-8>`
- Workbox config gained `ignoreURLParametersMatching: [/^v$/]` so the versioned fetches still resolve from precache
- Removed redundant `includeAssets` from VitePWA — the `globPatterns` entry was already sweeping those files, causing duplicate precache entries for `apple-touch-icon.png` + `favicon-48x48.png` + `favicon.ico`; precache now 31 entries (down from 34)
- `version.json` now carries an `iconsHash` (sha256 of concatenated icon versions, stable across icon-unchanged deploys)
- New `src/composables/useIconRefresh.ts` watches `iconsHash` and surfaces an `info` banner when the app is in standalone display mode AND the fresh hash differs from the last-acknowledged hash. Banner has **Show how** (opens `InstallInstructionsModal` with the reinstall collapsible pre-expanded via new `expand-reinstall` prop) and **Dismiss** (acknowledges the current hash so the banner stops reappearing until icons change again)
- `InstallInstructionsModal.vue` + `AppLayout.vue` wired to support the banner flow; modal prop `expand-reinstall` defaults to false so the existing install prompt path is unchanged
- `src/iconCacheBust.test.ts` strengthened to 9 tests (4 source-level + 5 dist-level) — now iterates every `src:` in the manifest icons block and fails on any bare-string filename; catches SW precache URL duplicates; verifies `version.json` carries `iconsHash`. Tripwire was verified by introducing a bare-string src (test fails with the expected error) then restoring (test passes)
- Recorded EVENT_BUS as "Not Applicable Patterns" in CLAUDE.md (no cross-service pub/sub need in this app)
- Updated CLAUDE.md Project Status to describe new PWA-icon-cache-busting feature + tightened Save-as-PDF description to name its actual home
- Strengthened `handlePrint()` comment in `WorkspaceDetailView.vue` to explain why the per-workspace actions menu beats the burger-menu alternative for this app
- README.md tree updated with `useIconRefresh.ts`

## Current state

All 115 tests pass. `vue-tsc --noEmit` clean. `npm run build` succeeds and emits:
- `dist/index.html` link tags with `?v=<hash>` (icon extensions only — manifest href left untouched)
- `dist/manifest.webmanifest` icon srcs all with `?v=<hash>`
- `dist/sw.js` with `cleanupOutdatedCaches()` + `ignoreURLParametersMatching:[/^v$/]`; precache has 0 duplicates
- `dist/version.json` with `{ buildTime, iconsHash }`

Branch: `claude/document-budgy-ting-Yn52B`.

## Key context

- Icon cache-bust uses query-string approach (`?v=<sha256-8>`), not filename hashing. Tradeoff noted in the pattern doc: filename hashing is architecturally cleaner but requires a custom prebuild step that vite-plugin-pwa doesn't provide.
- `iconCacheBustHtml()` throws at build time if any expected literal `href="/..."` isn't found in `index.html` — prevents silent drift if someone reformats a link tag.
- Reinstall collapsible uses native `<details>`/`<summary>` — zero JS, accessible by default. When launched from the icon-refresh banner, `expand-reinstall` is passed so the user lands on the relevant content.
- OS icon caches (Springboard, Android launcher, Windows/macOS dock) are user-side — no web fix exists. The banner + collapsible ARE the mitigation and only fire for users who actually have a standalone install.
- `useIconRefresh` is guarded by `isStandalone()` and a 60-second fetch throttle. First run after a clean install records the current hash as acknowledged, so users don't get flagged for icons they've never seen another version of.
- EVENT_BUS decision is "no evidence a bus would have a consumer today". Re-evaluate if two services start needing to react to each other.
- Save-as-PDF button kept in per-workspace 3-dot actions menu. Contextual to dashboard, co-located with Export/Edit. Burger-menu placement was explicitly rejected because the burger menu is global and printing only makes sense on a workspace page.
