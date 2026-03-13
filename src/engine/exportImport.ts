/**
 * Export/import engine for workspace data backup and restore.
 *
 * Requirement: JSON export that can be re-imported to restore a workspace
 * Approach: Schema-versioned JSON with all workspace data (transactions, patterns, importBatches)
 * Alternatives:
 *   - Binary format: Rejected — not human-readable, harder to debug
 *   - CSV export: Rejected — loses relational structure
 */

import { db } from '@/db'
import type { Workspace, Transaction, RecurringPattern, ImportBatch } from '@/types/models'

export interface ExportSchema {
  version: 3
  exportedAt: string
  workspace: Workspace
  transactions: Transaction[]
  patterns: RecurringPattern[]
  importBatches: ImportBatch[]
}

/**
 * Export a workspace with all its data to a JSON object.
 */
export async function exportWorkspace(workspaceId: string): Promise<ExportSchema | null> {
  const workspace = await db.workspaces.get(workspaceId)
  if (!workspace) return null

  const [transactions, patterns, importBatches] = await Promise.all([
    db.transactions.where('workspaceId').equals(workspaceId).toArray(),
    db.patterns.where('workspaceId').equals(workspaceId).toArray(),
    db.importBatches.where('workspaceId').equals(workspaceId).toArray(),
  ])

  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    workspace,
    transactions,
    patterns,
    importBatches,
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
 */
export function validateImport(data: unknown): { valid: boolean; error?: string; data?: ExportSchema } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid file — not a JSON object' }
  }

  const obj = data as Record<string, unknown>

  if (obj['version'] !== 3) {
    return { valid: false, error: `Unsupported format version: ${obj['version']}. This app requires version 3. Old backups from before the actuals-first update are not compatible.` }
  }

  const wsData = obj['workspace'] as Record<string, unknown> | undefined
  if (!wsData || typeof wsData !== 'object') {
    return { valid: false, error: 'Missing workspace data in file' }
  }

  if (!Array.isArray(obj['transactions'])) {
    return { valid: false, error: 'Missing transactions data in file' }
  }

  // Validate patterns and importBatches are arrays when present
  if (obj['patterns'] !== undefined && !Array.isArray(obj['patterns'])) {
    return { valid: false, error: 'Invalid patterns data in file (expected array)' }
  }
  if (obj['importBatches'] !== undefined && !Array.isArray(obj['importBatches'])) {
    return { valid: false, error: 'Invalid import batches data in file (expected array)' }
  }

  if (!wsData['id'] || typeof wsData['id'] !== 'string') {
    return { valid: false, error: 'Workspace data is incomplete (missing id)' }
  }
  if (!wsData['name'] || typeof wsData['name'] !== 'string') {
    return { valid: false, error: 'Workspace data is incomplete (missing name)' }
  }

  // Requirement: Validate field types to catch corrupted/tampered import files
  // Approach: Validate ALL transactions and first pattern for required field types.
  //   Full scan catches corruption anywhere in the file (not just the first entry).
  // Alternatives:
  //   - Full Zod schema: Rejected — adds a dependency for a pre-release app
  //   - Trust the data: Rejected — corrupted files could inject invalid data into IndexedDB
  //   - Spot-check first only: Rejected — a valid first entry with corrupt later entries passes
  const txns = obj['transactions'] as Record<string, unknown>[]
  for (let ti = 0; ti < txns.length; ti++) {
    const sample = txns[ti]!
    if (typeof sample['id'] !== 'string' || typeof sample['date'] !== 'string' || typeof sample['amount'] !== 'number') {
      return { valid: false, error: `Transaction ${ti + 1} is malformed (missing id, date, or amount)` }
    }
    if (typeof sample['description'] !== 'string') {
      return { valid: false, error: `Transaction ${ti + 1} is malformed (missing description)` }
    }
    if (!Array.isArray(sample['tags'])) {
      return { valid: false, error: `Transaction ${ti + 1} is malformed (tags must be an array)` }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sample['date'] as string)) {
      return { valid: false, error: `Transaction ${ti + 1} date format is invalid (expected YYYY-MM-DD)` }
    }
  }

  // Validate patterns if present
  const pats = obj['patterns'] as Record<string, unknown>[] | undefined
  if (Array.isArray(pats) && pats.length > 0) {
    const sample = pats[0]!
    if (typeof sample['id'] !== 'string' || typeof sample['description'] !== 'string') {
      return { valid: false, error: 'Pattern data is malformed (missing id or description)' }
    }
    if (typeof sample['expectedAmount'] !== 'number') {
      return { valid: false, error: 'Pattern data is malformed (expectedAmount must be a number)' }
    }
    if (typeof sample['frequency'] !== 'string') {
      return { valid: false, error: 'Pattern data is malformed (frequency must be a string)' }
    }
  }

  // Validate workspace has required fields
  if (typeof wsData['currencyLabel'] !== 'string') {
    return { valid: false, error: 'Workspace data is incomplete (missing currencyLabel)' }
  }

  // Backfill patterns missing the variability field (pre-v7 exports)
  if (Array.isArray(pats)) {
    for (const p of pats) {
      if (!p['variability']) {
        p['variability'] = 'fixed'
      }
    }
  }

  return { valid: true, data: obj as unknown as ExportSchema }
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

  await db.transaction('rw', [db.workspaces, db.transactions, db.patterns, db.importBatches], async () => {
    if (existing) {
      await db.transactions.where('workspaceId').equals(data.workspace.id).delete()
      await db.patterns.where('workspaceId').equals(data.workspace.id).delete()
      await db.importBatches.where('workspaceId').equals(data.workspace.id).delete()
      await db.workspaces.delete(data.workspace.id)
    }

    await db.workspaces.add(data.workspace)

    if (data.transactions.length > 0) {
      await db.transactions.bulkAdd(data.transactions)
    }
    if (data.patterns?.length > 0) {
      await db.patterns.bulkAdd(data.patterns)
    }
    if (data.importBatches?.length > 0) {
      await db.importBatches.bulkAdd(data.importBatches)
    }
  })

  return {
    imported: true,
    message: `Imported "${data.workspace.name}" with ${data.transactions.length} transactions and ${data.patterns?.length ?? 0} recurring patterns.`,
  }
}
