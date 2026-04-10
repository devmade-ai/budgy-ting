# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Fix: demo workspace not appearing on first load (race condition in boot sequence).

## Accomplished

- Fixed race condition in `main.ts` where `seedDemoWorkspace()` ran non-blocking while `app.mount()` fired synchronously — `WorkspaceListView` queried the empty DB before seeding committed
- Wrapped entire boot sequence in async IIFE, `await seedDemoWorkspace()` before `app.mount()`
- Changed DebugPill from static import to dynamic `await import()` (required inside async IIFE)

## Current state

Fix implemented. Boot sequence now guarantees demo data is in DB before any view mounts.

## Key context

- `main.ts` boot is now an async IIFE — all post-seed logic (mount, debug pill, error bridging) runs inside it
- `seedDemoWorkspace()` returns `false` immediately when workspaces exist (no latency on return visits)
- `pruneStaleTagCache()` stays non-blocking (`.then()`) since it's not needed before mount
- DebugPill is now dynamically imported — no functional change, just required for async IIFE scope
