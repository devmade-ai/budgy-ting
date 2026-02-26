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
import type { Budget, Expense, Actual, CategoryCache } from '@/types/models'

const db = new Dexie('budgy-ting') as Dexie & {
  budgets: EntityTable<Budget, 'id'>
  expenses: EntityTable<Expense, 'id'>
  actuals: EntityTable<Actual, 'id'>
  categoryCache: EntityTable<CategoryCache, 'category'>
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

export { db }
