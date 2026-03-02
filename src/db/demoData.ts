/**
 * Demo workspace with realistic household cashflow data.
 *
 * Requirement: Pre-populated workspace so users can explore the tool before creating their own
 * Approach: Seed a full workspace with income + expenses on first app load (empty DB).
 *   Uses a deterministic ID so it can be identified as a demo workspace.
 * Alternatives:
 *   - Read-only demo mode: Rejected — users should be able to edit/delete demo data freely
 *   - Load from external JSON: Rejected — adds latency, fails offline on first visit
 */

import { db } from './index'
import { debugLog } from '@/debug/debugLog'
import type { Workspace, Expense } from '@/types/models'

const DEMO_WORKSPACE_ID = 'demo-household'

function makeId(suffix: string): string {
  return `demo-${suffix}`
}

function makeExpense(
  id: string,
  description: string,
  tags: string[],
  amount: number,
  frequency: Expense['frequency'],
  type: Expense['type'],
  startDate: string,
): Expense {
  const now = new Date().toISOString()
  return {
    id: makeId(id),
    workspaceId: DEMO_WORKSPACE_ID,
    description,
    tags,
    amount,
    frequency,
    type,
    startDate,
    endDate: null,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Seed the demo workspace if the DB is empty (first visit).
 * Returns true if the demo was created, false if skipped.
 */
export async function seedDemoWorkspace(): Promise<boolean> {
  const count = await db.workspaces.count()
  if (count > 0) return false

  const now = new Date()
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const nowISO = now.toISOString()

  const workspace: Workspace = {
    id: DEMO_WORKSPACE_ID,
    name: 'Demo Household',
    currencyLabel: 'R',
    periodType: 'monthly',
    startDate,
    endDate: null,
    isDemo: true,
    createdAt: nowISO,
    updatedAt: nowISO,
  }

  const expenses: Expense[] = [
    // Income
    makeExpense('salary', 'Salary', ['Income', 'FNB Cheque'], 25000, 'monthly', 'income', startDate),
    makeExpense('freelance', 'Freelance Work', ['Income', 'Capitec'], 5000, 'monthly', 'income', startDate),

    // Fixed expenses
    makeExpense('rent', 'Rent', ['Housing'], 12000, 'monthly', 'expense', startDate),
    makeExpense('utilities', 'Electricity & Water', ['Housing'], 1800, 'monthly', 'expense', startDate),
    makeExpense('internet', 'Fibre Internet', ['Housing'], 1000, 'monthly', 'expense', startDate),
    makeExpense('insurance', 'Car Insurance', ['Insurance'], 2500, 'monthly', 'expense', startDate),
    makeExpense('medical', 'Medical Aid', ['Medical'], 3500, 'monthly', 'expense', startDate),

    // Variable expenses
    makeExpense('groceries', 'Groceries', ['Food'], 4500, 'monthly', 'expense', startDate),
    makeExpense('eating-out', 'Eating Out', ['Food', 'Discretionary'], 2000, 'monthly', 'expense', startDate),
    makeExpense('transport', 'Fuel & Transport', ['Transport'], 2500, 'monthly', 'expense', startDate),
    makeExpense('gym', 'Gym Membership', ['Health'], 699, 'monthly', 'expense', startDate),
    makeExpense('netflix', 'Netflix', ['Entertainment'], 199, 'monthly', 'expense', startDate),
    makeExpense('spotify', 'Spotify', ['Entertainment'], 80, 'monthly', 'expense', startDate),

    // Less frequent expenses
    makeExpense('clothing', 'Clothing', ['Shopping', 'Discretionary'], 1500, 'quarterly', 'expense', startDate),
    makeExpense('car-service', 'Car Service', ['Transport'], 3000, 'annually', 'expense', startDate),
    makeExpense('vet', 'Vet Checkup', ['Pets'], 800, 'annually', 'expense', startDate),
  ]

  try {
    await db.transaction('rw', [db.workspaces, db.expenses], async () => {
      await db.workspaces.add(workspace)
      await db.expenses.bulkAdd(expenses)
    })
    debugLog('db', 'success', `Seeded demo workspace with ${expenses.length} items`)
    return true
  } catch (err) {
    debugLog('db', 'error', `Failed to seed demo workspace: ${err}`)
    return false
  }
}
