# Plan: Inline Tag Editing + Tag Preloading

## Overview

Two changes:
1. **Inline tag editing on transactions** — click a transaction row to expand an inline tag editor with ML suggestions
2. **Seed tagCache from demo data** — so ML suggestions work from the very first session

## Changes

### 1. Seed tagCache in demoData.ts

Add a `touchTags()` call at the end of `seedDemoWorkspace()` to populate tagCache with all tags used in demo transactions and patterns. This means the ML model has real candidate labels from the very first session.

**File:** `src/db/demoData.ts`
- After the DB transaction that creates workspace/transactions/patterns, collect all unique tags from transactions + patterns
- Call `touchTags([...allTags])` to populate tagCache

### 2. Create TransactionTagEditor.vue (new component)

**File:** `src/components/TransactionTagEditor.vue`

Small inline editor rendered below an expanded transaction row:
- Props: `transaction: Transaction`, `suggestions: TagSuggestion[]`, `suggestionsLoading: boolean`
- Emits: `update:tags(tags: string[])`, `done()`
- Shows:
  - Current tags as removable chips (click x to remove)
  - ML suggestion chips via existing `TagSuggestions.vue`
  - Small text input for manually typing tags (Enter/comma to add)
  - Autocomplete dropdown from tagCache via existing `useTagAutocomplete`

### 3. Make TransactionTable rows expandable for tag editing

**File:** `src/components/TransactionTable.vue`

- Add `expandedId: Ref<string | null>` — only one row expanded at a time
- Add click handler on rows (mobile cards + desktop rows) to toggle expand
- When expanded, render `TransactionTagEditor` below the row
- New emit: `update-tags: [id: string, tags: string[]]`
- Pass through ML suggestions from parent

### 4. Wire up in WorkspaceDashboard.vue

**File:** `src/views/WorkspaceDashboard.vue`

- Import `useTagSuggestions`, call `preloadModel()` in onMounted, `dispose()` in onUnmounted
- Listen for `@update-tags` from TransactionTable
- On tag update: `db.transactions.update(id, { tags, updatedAt })` + update local ref + `touchTags()`
- Pass ML state (suggestTags function, modelReady, inferring) to TransactionTable

## File Summary

| File | Action |
|------|--------|
| `src/db/demoData.ts` | Add touchTags call to seed tagCache |
| `src/components/TransactionTagEditor.vue` | New — inline tag editor with suggestions + manual input |
| `src/components/TransactionTable.vue` | Add row click → expand editor, emit tag updates |
| `src/views/WorkspaceDashboard.vue` | Handle tag updates, ML lifecycle |
