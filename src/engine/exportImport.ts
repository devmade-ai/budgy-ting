/**
 * Export/import engine for budget data backup and restore.
 *
 * Requirement: JSON export that can be re-imported to restore a budget
 * Approach: Schema-versioned JSON with all budget data, comparison snapshot included
 * Alternatives:
 *   - Binary format: Rejected — not human-readable, harder to debug
 *   - CSV export: Rejected — loses relational structure
 */

import { db } from '@/db'
import { calculateProjection, resolveBudgetPeriod } from './projection'
import { calculateComparison } from './variance'
import type { Budget, Expense, Actual } from '@/types/models'

export interface ExportSchema {
  version: 1
  exportedAt: string
  budget: Budget
  expenses: Expense[]
  actuals: Actual[]
  comparison: {
    lineItems: Array<{
      description: string
      category: string
      budgeted: number
      actual: number
      variance: number
    }>
    categories: Array<{
      category: string
      budgeted: number
      actual: number
      variance: number
    }>
    monthly: Array<{
      month: string
      projected: number
      actual: number
      variance: number
    }>
  } | null
}

/**
 * Export a budget with all its data to a JSON object.
 */
export async function exportBudget(budgetId: string): Promise<ExportSchema | null> {
  const budget = await db.budgets.get(budgetId)
  if (!budget) return null

  const [expenses, actuals] = await Promise.all([
    db.expenses.where('budgetId').equals(budgetId).toArray(),
    db.actuals.where('budgetId').equals(budgetId).toArray(),
  ])

  // Generate comparison snapshot if data exists
  let comparison: ExportSchema['comparison'] = null

  if (expenses.length > 0) {
    const { startDate, endDate } = resolveBudgetPeriod(budget)
    const projection = calculateProjection(expenses, startDate, endDate)
    const comp = calculateComparison(projection, actuals, expenses)

    comparison = {
      lineItems: comp.lineItems.map((li) => ({
        description: li.description,
        category: li.category,
        budgeted: li.budgeted,
        actual: li.actual,
        variance: li.variance,
      })),
      categories: comp.categories.map((c) => ({
        category: c.category,
        budgeted: c.budgeted,
        actual: c.actual,
        variance: c.variance,
      })),
      monthly: comp.monthly.map((m) => ({
        month: m.month,
        projected: m.projected,
        actual: m.actual,
        variance: m.variance,
      })),
    }
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    budget,
    expenses,
    actuals,
    comparison,
  }
}

/**
 * Trigger a JSON file download in the browser.
 */
export function downloadJSON(data: ExportSchema, budgetName: string): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const dateStr = new Date().toISOString().slice(0, 10)
  const safeName = budgetName.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-').toLowerCase()
  const filename = `budgy-ting-${safeName}-${dateStr}.json`

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Validate an imported JSON file matches the export schema.
 */
export function validateImport(data: unknown): { valid: boolean; error?: string; data?: ExportSchema } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid file — not a JSON object' }
  }

  const obj = data as Record<string, unknown>

  if (obj['version'] !== 1) {
    return { valid: false, error: `Unsupported format version: ${obj['version']}. This app supports version 1.` }
  }

  if (!obj['budget'] || typeof obj['budget'] !== 'object') {
    return { valid: false, error: 'Missing budget data in file' }
  }

  if (!Array.isArray(obj['expenses'])) {
    return { valid: false, error: 'Missing expenses data in file' }
  }

  if (!Array.isArray(obj['actuals'])) {
    return { valid: false, error: 'Missing actuals data in file' }
  }

  const budget = obj['budget'] as Record<string, unknown>
  if (!budget['id'] || typeof budget['id'] !== 'string') {
    return { valid: false, error: 'Budget data is incomplete (missing id)' }
  }
  if (!budget['name'] || typeof budget['name'] !== 'string') {
    return { valid: false, error: 'Budget data is incomplete (missing name)' }
  }
  if (!budget['periodType'] || !['monthly', 'custom'].includes(budget['periodType'] as string)) {
    return { valid: false, error: 'Budget data is incomplete (missing or invalid periodType)' }
  }
  if (!budget['startDate'] || typeof budget['startDate'] !== 'string') {
    return { valid: false, error: 'Budget data is incomplete (missing startDate)' }
  }
  if (!budget['createdAt'] || typeof budget['createdAt'] !== 'string') {
    return { valid: false, error: 'Budget data is incomplete (missing createdAt)' }
  }

  // Validate expenses have required fields
  const expenses = obj['expenses'] as Record<string, unknown>[]
  for (let i = 0; i < Math.min(expenses.length, 5); i++) {
    const exp = expenses[i]!
    if (!exp['id'] || !exp['budgetId'] || !exp['description'] || typeof exp['amount'] !== 'number') {
      return { valid: false, error: `Expense at index ${i} is missing required fields (id, budgetId, description, amount)` }
    }
  }

  return { valid: true, data: data as ExportSchema }
}

/**
 * Import a budget from an export file.
 *
 * @param data - Validated export data
 * @param mode - 'replace' overwrites existing budget with same ID, 'merge' skips if exists
 */
export async function importBudget(
  data: ExportSchema,
  mode: 'replace' | 'merge',
): Promise<{ imported: boolean; message: string }> {
  const existing = await db.budgets.get(data.budget.id)

  if (existing && mode === 'merge') {
    return { imported: false, message: `Budget "${existing.name}" already exists. Skipped.` }
  }

  await db.transaction('rw', [db.budgets, db.expenses, db.actuals], async () => {
    if (existing) {
      // Replace: clear existing data first
      await db.actuals.where('budgetId').equals(data.budget.id).delete()
      await db.expenses.where('budgetId').equals(data.budget.id).delete()
      await db.budgets.delete(data.budget.id)
    }

    // Backward compat: old exports have totalBudget instead of startingBalance,
    // and expenses may lack a type field.
    const rawBudget = data.budget as Record<string, unknown>
    const budgetToAdd = {
      ...data.budget,
      startingBalance: data.budget.startingBalance ?? (rawBudget['totalBudget'] as number | null) ?? null,
    }
    // Remove legacy field if present
    delete (budgetToAdd as Record<string, unknown>)['totalBudget']
    await db.budgets.add(budgetToAdd)

    // Ensure all expenses have a type field (default to 'expense' for old exports)
    const expensesToAdd = data.expenses.map((exp) => ({
      ...exp,
      type: exp.type ?? 'expense' as const,
    }))
    if (expensesToAdd.length > 0) {
      await db.expenses.bulkAdd(expensesToAdd)
    }
    if (data.actuals.length > 0) {
      await db.actuals.bulkAdd(data.actuals)
    }
  })

  return {
    imported: true,
    message: `Imported "${data.budget.name}" with ${data.expenses.length} expenses and ${data.actuals.length} actuals.`,
  }
}
