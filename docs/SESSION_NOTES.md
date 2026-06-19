# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Bug fix: the **workspace detail screen wouldn't scroll at all** on mobile. Content
overflowed the viewport (chart cut off, debug pill below the fold) but the page was
frozen.

## Accomplished

- **Root cause:** `useDialogA11y` (`src/composables/useDialogA11y.ts`) locks
  `body`/`html` scroll (`overflow: hidden`) in its `onMounted` hook, on the assumption
  that a dialog is only mounted while open. True for every `v-if`-mounted modal — but
  **`BottomSheet` stays permanently mounted** in `WorkspaceDetailView` (so its slide
  `<Transition>` can animate open/close) and gates visibility via the `open` prop. So
  the *closed* bottom sheet registered as an open dialog and locked page scroll the
  moment the detail view rendered, never releasing. The workspace **list** view scrolls
  fine because it has no bottom sheet.
- **Fix (root-cause, not a patch):** `useDialogA11y` now takes an optional third arg
  `isOpen?: MaybeRefOrGetter<boolean>`. When supplied, engagement (stack push +
  scroll-lock + focus-trap, and their teardown) is driven reactively by the open state
  via a `watch(..., { immediate: true })` instead of by mount/unmount. When omitted,
  the original mount/unmount lifecycle is preserved verbatim, so the five `v-if`-mounted
  consumers (ConfirmDialog, TransactionEditModal, HelpDrawer, TutorialModal,
  InstallInstructionsModal) are untouched. Engagement is guarded by an `engaged` flag so
  the watcher and the `onUnmounted` safety net can't double-fire.
- **`BottomSheet.vue`:** captured `const props = defineProps(...)` (was unassigned) and
  passes `() => props.open` to `useDialogA11y`. This is the only always-mounted consumer.
- **Tests:** added a `reactive open state (always-mounted dialog)` block to
  `useDialogA11y.test.ts` — verifies no lock/registration while mounted-but-closed,
  engage-on-open / release-on-close, lock release on unmount-while-open, and that a closed
  reactive dialog doesn't shadow a real sibling dialog on the stack.

## Current state

- **Verified:** `vitest run` ✓ (177 passed / 5 skipped, 12 files), `vue-tsc -b --noEmit` ✓
  (exit 0). No console statements, no dead code.
- The detail screen now scrolls normally; the bottom-sheet actions menu still locks scroll
  while open and releases on close, and its slide animation is intact.

## Key context

- **The pitfall:** `useDialogA11y` engages a global side effect (scroll lock) on mount.
  That's safe only for components mounted exclusively while active. Any always-mounted /
  prop-gated dialog MUST pass `isOpen`. Logged in `docs/AI_MISTAKES.md` (2026-06-19).
- `BottomSheet` is currently the only always-mounted `useDialogA11y` consumer. If a future
  always-mounted dialog is added, it needs the same `isOpen` wiring.
