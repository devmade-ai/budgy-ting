/**
 * Dexie.js database setup for Farlume.
 *
 * Requirement: Local-first IndexedDB storage with typed schema
 * Approach: Dexie v4 with typed tables matching the data model
 * Alternatives:
 *   - Raw IndexedDB: Rejected - painful API, no type safety
 *   - localStorage: Rejected - 5MB limit, no indexing
 *
 * Schema v6: Actuals-first pivot — unified Transaction model replaces separate
 *   expenses/actuals tables. RecurringPattern replaces expense lines as the source
 *   of future predictions. ImportBatch tracks imports for dedup.
 *   Clean slate migration: drops all old data (pre-release, zero users).
 */

import Dexie, { type EntityTable } from 'dexie'
import type {
  Workspace, Transaction, RecurringPattern, ImportBatch, TagCache, EmbeddingCache,
} from '@/types/models'
import { debugLog } from '@/debug/debugLog'

const db = new Dexie('farlume') as Dexie & {
  workspaces: EntityTable<Workspace, 'id'>
  transactions: EntityTable<Transaction, 'id'>
  patterns: EntityTable<RecurringPattern, 'id'>
  importBatches: EntityTable<ImportBatch, 'id'>
  tagCache: EntityTable<TagCache, 'tag'>
  embeddingCache: EntityTable<EmbeddingCache, 'text'>
}

// Schema v1-v5: Legacy schemas kept for Dexie's sequential upgrade path.
// v6 drops all old data so these upgrades are no-ops for new users,
// but Dexie requires the full version chain to be declared.

db.version(1).stores({
  budgets: 'id, name, createdAt',
  expenses: 'id, budgetId, category, createdAt',
  actuals: 'id, budgetId, expenseId, category, date',
  categoryCache: 'category, lastUsed',
})

db.version(2).stores({
  budgets: 'id, name, createdAt',
  expenses: 'id, budgetId, category, createdAt',
  actuals: 'id, budgetId, expenseId, category, date',
  categoryCache: 'category, lastUsed',
})

db.version(3).stores({
  budgets: 'id, name, createdAt',
  expenses: 'id, budgetId, category, type, createdAt',
  actuals: 'id, budgetId, expenseId, category, date',
  categoryCache: 'category, lastUsed',
})

db.version(4).stores({
  workspaces: 'id, name, createdAt',
  expenses: 'id, workspaceId, category, type, createdAt',
  actuals: 'id, workspaceId, expenseId, category, date',
  categoryCache: 'category, lastUsed',
  budgets: null,
})

db.version(5).stores({
  workspaces: 'id, name, createdAt',
  expenses: 'id, workspaceId, *tags, type, createdAt',
  actuals: 'id, workspaceId, expenseId, *tags, date',
  tagCache: 'tag, lastUsed',
  categoryMappings: 'id, workspaceId, pattern',
  categoryCache: null,
})

// Schema v6: Actuals-first pivot — clean slate migration
// Requirement: Pivot to unified Transaction model with RecurringPattern for predictions
// Approach: Drop all legacy tables (expenses, actuals, categoryMappings), create new
//   transactions + patterns + importBatches tables. Clean slate because app is pre-release.
// Alternatives:
//   - Migrate expenses → patterns, actuals → transactions: Rejected — user said drop it,
//     data hasn't been used yet, migration complexity not worth it
db.version(6).stores({
  workspaces: 'id, name, createdAt',
  transactions: 'id, workspaceId, date, *tags, recurringGroupId, source, classification, importBatchId',
  patterns: 'id, workspaceId, description, frequency, isActive',
  importBatches: 'id, workspaceId, importedAt',
  tagCache: 'tag, lastUsed',
  // Drop legacy tables
  expenses: null,
  actuals: null,
  categoryMappings: null,
}).upgrade((tx) => {
  debugLog('db', 'info', 'Schema upgrade v6: clean slate migration')
  return tx.table('workspaces').clear()
})

// Schema v7: Variable recurring expenses — adds variability field to patterns
// Requirement: Support variable-amount and irregular-timing recurring expenses
// Approach: Add variability field to patterns table, default existing patterns to 'fixed'.
//   Also index on variability for potential future filtering.
// Alternatives:
//   - Separate table for variable patterns: Rejected — same entity, just a type field
db.version(7).stores({
  workspaces: 'id, name, createdAt',
  transactions: 'id, workspaceId, date, *tags, recurringGroupId, source, classification, importBatchId',
  patterns: 'id, workspaceId, description, frequency, isActive, variability',
  importBatches: 'id, workspaceId, importedAt',
  tagCache: 'tag, lastUsed',
}).upgrade(async (tx) => {
  debugLog('db', 'info', 'Schema upgrade v7: backfilling pattern variability')
  const patterns = tx.table('patterns')
  await patterns.toCollection().modify((pattern: Record<string, unknown>) => {
    if (!pattern['variability']) {
      pattern['variability'] = 'fixed'
    }
  })
})

// Schema v8: Embedding cache for sentence-transformer (all-MiniLM-L6-v2)
// Requirement: Cache computed embeddings to avoid re-computing for descriptions seen before
// Approach: Simple text→embedding lookup table. Keyed on normalized text (lowercase + trimmed).
// Alternatives:
//   - Recompute every time: Rejected — embedding is ~200ms per text, caching saves repeat imports
//   - Store in memory only: Rejected — lost on page refresh, IndexedDB persists across sessions
db.version(8).stores({
  workspaces: 'id, name, createdAt',
  transactions: 'id, workspaceId, date, *tags, recurringGroupId, source, classification, importBatchId',
  patterns: 'id, workspaceId, description, frequency, isActive, variability',
  importBatches: 'id, workspaceId, importedAt',
  tagCache: 'tag, lastUsed',
  embeddingCache: 'text, computedAt',
})

db.on('ready', () => {
  debugLog('db', 'success', 'Database ready', { version: db.verno })
})

export { db }
