/**
 * Dexie.js database setup for budgy-ting.
 *
 * Requirement: Local-first IndexedDB storage with typed schema
 * Approach: Dexie v4 with typed tables matching the data model
 * Alternatives:
 *   - Raw IndexedDB: Rejected - painful API, no type safety
 *   - localStorage: Rejected - 5MB limit, no indexing
 */

import Dexie, { type EntityTable } from 'dexie'
import type { Workspace, Expense, Actual, TagCache, CategoryMapping } from '@/types/models'

const db = new Dexie('budgy-ting') as Dexie & {
  workspaces: EntityTable<Workspace, 'id'>
  expenses: EntityTable<Expense, 'id'>
  actuals: EntityTable<Actual, 'id'>
  tagCache: EntityTable<TagCache, 'tag'>
  categoryMappings: EntityTable<CategoryMapping, 'id'>
}

// Schema v1: indexes match product definition spec
// budgetId on expenses/actuals for per-budget queries
// category indexes for autocomplete and matching
// date index on actuals for monthly rollup queries
db.version(1).stores({
  budgets: 'id, name, createdAt',
  expenses: 'id, budgetId, category, createdAt',
  actuals: 'id, budgetId, expenseId, category, date',
  categoryCache: 'category, lastUsed',
})

// Schema v2: add totalBudget field (envelope mode)
// Requirement: Users can set a fixed total budget to track remaining balance
// Approach: Dexie upgrade handler — set null for existing budgets (no envelope by default)
// Alternatives:
//   - New table for envelope data: Rejected — totalBudget belongs on the budget record
//   - Breaking migration: Rejected — must preserve existing user data
db.version(2).stores({
  budgets: 'id, name, createdAt',
  expenses: 'id, budgetId, category, createdAt',
  actuals: 'id, budgetId, expenseId, category, date',
  categoryCache: 'category, lastUsed',
}).upgrade((tx) => {
  return tx.table('budgets').toCollection().modify((budget) => {
    if (budget.totalBudget === undefined) {
      budget.totalBudget = null
    }
  })
})

// Schema v3: cashflow pivot — rename totalBudget → startingBalance, add type to expenses
// Requirement: Pivot from budgeting app to cashflow app with income tracking
// Approach: Rename field on budgets, add 'type' field defaulting to 'expense' on expenses
// Alternatives:
//   - Separate income table: Rejected — income uses same frequency/amount model as expenses
//   - Keep totalBudget name: Rejected — "starting balance" reflects cashflow semantics better
db.version(3).stores({
  budgets: 'id, name, createdAt',
  expenses: 'id, budgetId, category, type, createdAt',
  actuals: 'id, budgetId, expenseId, category, date',
  categoryCache: 'category, lastUsed',
}).upgrade((tx) => {
  return Promise.all([
    tx.table('budgets').toCollection().modify((budget) => {
      budget.startingBalance = budget.totalBudget ?? null
      delete budget.totalBudget
    }),
    tx.table('expenses').toCollection().modify((expense) => {
      if (expense.type === undefined) {
        expense.type = 'expense'
      }
    }),
  ])
})

// Schema v4: Rename budgets → workspaces, budgetId → workspaceId
// Requirement: Rename "budget" to "workspace" across the app — reflects cashflow/workspace mental model
// Approach: Create new workspaces table, migrate data from budgets, rename foreign keys on expenses/actuals
// Alternatives:
//   - Keep old table names with new TypeScript types: Rejected — confusing mismatch between DB and code
//   - Breaking reset: Rejected — must preserve existing user data
db.version(4).stores({
  workspaces: 'id, name, createdAt',
  expenses: 'id, workspaceId, category, type, createdAt',
  actuals: 'id, workspaceId, expenseId, category, date',
  categoryCache: 'category, lastUsed',
  budgets: null, // Delete old budgets table
}).upgrade((tx) => {
  return Promise.all([
    // Migrate budgets → workspaces (add isDemo field)
    tx.table('budgets').toCollection().toArray().then((budgets) => {
      const workspaces = budgets.map((b) => ({
        ...b,
        isDemo: false,
      }))
      if (workspaces.length > 0) {
        return tx.table('workspaces').bulkAdd(workspaces)
      }
    }),
    // Rename budgetId → workspaceId on expenses
    tx.table('expenses').toCollection().modify((expense) => {
      expense.workspaceId = expense.budgetId
      delete expense.budgetId
    }),
    // Rename budgetId → workspaceId on actuals
    tx.table('actuals').toCollection().modify((actual) => {
      actual.workspaceId = actual.budgetId
      delete actual.budgetId
    }),
  ])
})

// Schema v5: category → tags (string[]), categoryCache → tagCache, add categoryMappings
// Requirement: Support multiple category tags per expense/actual instead of single category
// Approach: Convert category string to single-element tags array, rename cache table
// Alternatives:
//   - Keep category + add tags: Rejected — dual fields adds confusion, tags subsume category
//   - Breaking reset: Rejected — must preserve existing user data
db.version(5).stores({
  workspaces: 'id, name, createdAt',
  expenses: 'id, workspaceId, *tags, type, createdAt',
  actuals: 'id, workspaceId, expenseId, *tags, date',
  tagCache: 'tag, lastUsed',
  categoryMappings: 'id, workspaceId, pattern',
  categoryCache: null, // Delete old categoryCache table
}).upgrade((tx) => {
  return Promise.all([
    // Convert expenses: category string → tags array
    tx.table('expenses').toCollection().modify((expense: Record<string, unknown>) => {
      const cat = expense['category'] as string | undefined
      expense['tags'] = cat ? [cat] : []
      delete expense['category']
    }),
    // Convert actuals: category string → tags array
    tx.table('actuals').toCollection().modify((actual: Record<string, unknown>) => {
      const cat = actual['category'] as string | undefined
      actual['tags'] = cat ? [cat] : []
      delete actual['category']
    }),
    // Migrate categoryCache → tagCache
    tx.table('categoryCache').toCollection().toArray().then((entries: Array<Record<string, unknown>>) => {
      const tags = entries.map((c) => ({
        tag: c['category'] as string,
        lastUsed: c['lastUsed'] as string,
      }))
      if (tags.length > 0) {
        return tx.table('tagCache').bulkAdd(tags)
      }
    }),
  ])
})

export { db }
