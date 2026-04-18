# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Two cross-fleet alignment passes on the same branch:

1. Closed the ICON_CACHE_BUST pattern by adding the one source-level tripwire test that wasn't already in `src/iconCacheBust.test.ts`.
2. Replaced the legacy single-word `## Triggers` section in CLAUDE.md with the redesigned 48-trigger / 8-group / 6-meta-sweep / 7-reflective-pass version from glow-props CLAUDE.md.

## Accomplished

- Added the missing `index.html contains the exact literal hrefs the plugin replaces` source-level test to `src/iconCacheBust.test.ts`. Brings test count to 10 (5 source + 5 dist), full parity with the glow-props pattern doc plus three project-specific extras (manifest-srcs-bypass-versioned, sw-precache-no-duplicates, version.json-iconsHash). All 10 tests pass.
- Verified pattern doc's Verification Checklist items 1-3 directly: dist manifest icons, dist HTML link tags, and dist sw.js workbox config all carry `?v=<8 hex>` / `/^v$/`.
- Replaced `## Triggers` section in CLAUDE.md verbatim from glow-props (lines 290-441 of glow-props CLAUDE.md). New section: 48 triggers in 8 groups (`correctness` / `trust` / `speed` / `frontend` / `quality` / `ops` / `design` / `fleet`), 6 meta sweeps (`hot` / `quick` / `ship` / `session` / `tidy` / `all`), 7 reflective passes (`risk` / `surface` / `wrap` / `skipped` / `assumed` / `approach` / `cold`), scope modifiers (`branch` / `staged` / `file <path>`).
- Added AI Notes line documenting trigger-name vs repo-path collisions: `docs` (folder), `tests` (npm script), `config`/`types`/`db` (`src/` subfolders), `patterns` (Dexie table), `state`. Precedence rule: standalone message = trigger; in-sentence/path = literal noun; ambiguous = ask.
- Confirm checks pass: exactly one `## Triggers` heading, all 8 group tables present, no leftover `rev`/`aud`/`start`/`go` references.

## Current state

ICON_CACHE_BUST: complete (core plumbing + OS-cache reinstall banner + 10/10 tripwire tests passing). Triggers section: aligned with glow-props verbatim. CLAUDE.md grew from 11 sections to 11 (no count change — section was replaced in place).

Branch: `claude/complete-icon-cache-bust-X0wpf` (now carries both icon-cache-bust completion AND the triggers replacement).

## Key context

- Two unrelated tasks landed on this branch — branch name is from the first task; the triggers replacement was added in a second commit. The branch name is misleading but the task instructions explicitly named this branch.
- Trigger collisions to watch: when reading `## Triggers` against this repo, `docs`/`tests`/`config`/`db`/`types`/`patterns`/`state` all match repo paths or scripts. If a future trigger run is ambiguous, ask.
- The `index.html` literal-href test list must mirror `REPLACEMENTS` in `vite.config.ts` `iconCacheBustHtml()`. If new icon `<link>` tags are added to `index.html`, both lists need updating.
- Test runner is `vitest` (not `node:test`) — `vitest`'s `expect`/`describe`/`it` map cleanly onto the pattern doc's `node:test` structure.
- `npm install` is required before running tests in a fresh checkout — `node_modules/.bin/vitest` and `node_modules/.bin/vite` aren't shipped in the repo.
