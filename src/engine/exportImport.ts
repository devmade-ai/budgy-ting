/**
 * Export/import engine for workspace data backup and restore.
 *
 * Requirement: JSON export that can be re-imported to restore a workspace
 * Approach: Schema-versioned JSON with all workspace data, comparison snapshot included
 * Alternatives:
 *   - Binary format: Rejected — not human-readable, harder to debug
 *   - CSV export: Rejected — loses relational structure
 */

import { db } from '@/db'
import { calculateProjection, resolveWorkspacePeriod } from './projection'
import { calculateComparison } from './variance'
import type { Workspace, Expense, Actual } from '@/types/models'

export interface ExportSchema {
  version: 2
  exportedAt: string
  /** Workspace data. Named 'workspace' in new exports, 'budget' in old exports (backward compat). */
  workspace: Workspace
  expenses: Expense[]
  actuals: Actual[]
  comparison: {
    lineItems: Array<{
      description: string
      category: string
      tags: string[]
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
 * Export a workspace with all its data to a JSON object.
 */
export async function exportWorkspace(workspaceId: string): Promise<ExportSchema | null> {
  const workspace = await db.workspaces.get(workspaceId)
  if (!workspace) return null

  const [expenses, actuals] = await Promise.all([
    db.expenses.where('workspaceId').equals(workspaceId).toArray(),
    db.actuals.where('workspaceId').equals(workspaceId).toArray(),
  ])

  // Generate comparison snapshot if data exists
  let comparison: ExportSchema['comparison'] = null

  if (expenses.length > 0) {
    const { startDate, endDate } = resolveWorkspacePeriod(workspace)
    const projection = calculateProjection(expenses, startDate, endDate)
    const comp = calculateComparison(projection, actuals, expenses)

    comparison = {
      lineItems: comp.lineItems.map((li) => ({
        description: li.description,
        category: li.category,
        tags: li.tags,
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
    version: 2,
    exportedAt: new Date().toISOString(),
    workspace,
    expenses,
    actuals,
    comparison,
  }
}

/**
 * Trigger a JSON file download in the browser.
 */
export function downloadJSON(data: ExportSchema, workspaceName: string): void {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const dateStr = new Date().toISOString().slice(0, 10)
  const safeName = workspaceName.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-').toLowerCase()
  const filename = `budgy-ting-${safeName}-${dateStr}.json`

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Validate an imported JSON file matches the export schema.
 * Backward compat: accepts both 'workspace' and 'budget' keys,
 * and handles v1 exports with category (string) instead of tags (string[]).
 */
export function validateImport(data: unknown): { valid: boolean; error?: string; data?: ExportSchema } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid file — not a JSON object' }
  }

  const obj = data as Record<string, unknown>

  if (obj['version'] !== 1 && obj['version'] !== 2) {
    return { valid: false, error: `Unsupported format version: ${obj['version']}. This app supports versions 1 and 2.` }
  }

  // Backward compat: accept both 'workspace' and 'budget' keys
  const wsData = (obj['workspace'] ?? obj['budget']) as Record<string, unknown> | undefined
  if (!wsData || typeof wsData !== 'object') {
    return { valid: false, error: 'Missing workspace data in file' }
  }

  if (!Array.isArray(obj['expenses'])) {
    return { valid: false, error: 'Missing expenses data in file' }
  }

  if (!Array.isArray(obj['actuals'])) {
    return { valid: false, error: 'Missing actuals data in file' }
  }

  if (!wsData['id'] || typeof wsData['id'] !== 'string') {
    return { valid: false, error: 'Workspace data is incomplete (missing id)' }
  }
  if (!wsData['name'] || typeof wsData['name'] !== 'string') {
    return { valid: false, error: 'Workspace data is incomplete (missing name)' }
  }
  if (!wsData['periodType'] || !['monthly', 'custom'].includes(wsData['periodType'] as string)) {
    return { valid: false, error: 'Workspace data is incomplete (missing or invalid periodType)' }
  }
  if (!wsData['startDate'] || typeof wsData['startDate'] !== 'string') {
    return { valid: false, error: 'Workspace data is incomplete (missing startDate)' }
  }
  if (!wsData['createdAt'] || typeof wsData['createdAt'] !== 'string') {
    return { valid: false, error: 'Workspace data is incomplete (missing createdAt)' }
  }

  // Validate expenses have required fields (accept both budgetId and workspaceId for backward compat)
  const expenses = obj['expenses'] as Record<string, unknown>[]
  for (let i = 0; i < Math.min(expenses.length, 5); i++) {
    const exp = expenses[i]!
    if (!exp['id'] || !(exp['workspaceId'] || exp['budgetId']) || !exp['description'] || typeof exp['amount'] !== 'number') {
      return { valid: false, error: `Expense at index ${i} is missing required fields (id, workspaceId, description, amount)` }
    }
  }

  // Normalize: ensure 'workspace' key exists and version is 2 for downstream code
  const normalized = { ...obj, workspace: wsData, version: 2 } as unknown as ExportSchema
  return { valid: true, data: normalized }
}

/**
 * Import a workspace from an export file.
 *
 * @param data - Validated export data
 * @param mode - 'replace' overwrites existing workspace with same ID, 'merge' skips if exists
 */
export async function importWorkspace(
  data: ExportSchema,
  mode: 'replace' | 'merge',
): Promise<{ imported: boolean; message: string }> {
  const existing = await db.workspaces.get(data.workspace.id)

  if (existing && mode === 'merge') {
    return { imported: false, message: `Workspace "${existing.name}" already exists. Skipped.` }
  }

  await db.transaction('rw', [db.workspaces, db.expenses, db.actuals], async () => {
    if (existing) {
      // Replace: clear existing data first
      await db.actuals.where('workspaceId').equals(data.workspace.id).delete()
      await db.expenses.where('workspaceId').equals(data.workspace.id).delete()
      await db.workspaces.delete(data.workspace.id)
    }

    // Backward compat: old exports have totalBudget instead of startingBalance,
    // and expenses may lack a type field, and may use budgetId instead of workspaceId.
    const rawWorkspace = data.workspace as unknown as Record<string, unknown>
    const workspaceToAdd = {
      ...data.workspace,
      startingBalance: data.workspace.startingBalance ?? (rawWorkspace['totalBudget'] as number | null) ?? null,
      isDemo: data.workspace.isDemo ?? false,
    }
    // Remove legacy field if present
    delete (workspaceToAdd as Record<string, unknown>)['totalBudget']
    await db.workspaces.add(workspaceToAdd)

    // Ensure all expenses have tags, type, and workspaceId
    // Backward compat: v1 exports have category (string) instead of tags (string[])
    const expensesToAdd = data.expenses.map((exp) => {
      const raw = exp as unknown as Record<string, unknown>
      const legacyCategory = raw['category'] as string | undefined
      return {
        ...exp,
        workspaceId: exp.workspaceId || (raw['budgetId'] as string),
        type: exp.type ?? 'expense' as const,
        tags: exp.tags ?? (legacyCategory ? [legacyCategory] : []),
      }
    })
    // Remove legacy category field
    for (const exp of expensesToAdd) {
      delete (exp as Record<string, unknown>)['category']
    }
    if (expensesToAdd.length > 0) {
      await db.expenses.bulkAdd(expensesToAdd)
    }

    // Backward compat: actuals may use budgetId and category instead of tags
    const actualsToAdd = data.actuals.map((act) => {
      const raw = act as unknown as Record<string, unknown>
      const legacyCategory = raw['category'] as string | undefined
      return {
        ...act,
        workspaceId: act.workspaceId || (raw['budgetId'] as string),
        tags: act.tags ?? (legacyCategory ? [legacyCategory] : []),
      }
    })
    // Remove legacy category field
    for (const act of actualsToAdd) {
      delete (act as Record<string, unknown>)['category']
    }
    if (actualsToAdd.length > 0) {
      await db.actuals.bulkAdd(actualsToAdd)
    }
  })

  return {
    imported: true,
    message: `Imported "${data.workspace.name}" with ${data.expenses.length} expenses and ${data.actuals.length} actuals.`,
  }
}
