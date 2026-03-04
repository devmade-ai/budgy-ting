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
import type { Workspace, Expense, Actual } from '@/types/models'

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

function makeActual(
  id: string,
  expenseId: string | null,
  date: string,
  amount: number,
  tags: string[],
  description: string,
): Actual {
  const now = new Date().toISOString()
  return {
    id: makeId(`act-${id}`),
    workspaceId: DEMO_WORKSPACE_ID,
    expenseId: expenseId ? makeId(expenseId) : null,
    date,
    amount,
    tags,
    description,
    originalRow: {},
    matchConfidence: 'high' as const,
    approved: true,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Generate realistic demo actuals for the previous month.
 * Amounts vary slightly from budgeted amounts to show realistic variance.
 */
function generateDemoActuals(baseDate: Date): Actual[] {
  // Generate actuals for the previous month
  const prevMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1)
  const y = prevMonth.getFullYear()
  const m = String(prevMonth.getMonth() + 1).padStart(2, '0')

  return [
    // Income — received on typical pay dates
    makeActual('salary-1', 'salary', `${y}-${m}-25`, 25000, ['Income', 'FNB Cheque'], 'Salary'),
    makeActual('freelance-1', 'freelance', `${y}-${m}-15`, 4200, ['Income', 'Capitec'], 'Freelance payment'),

    // Fixed expenses — close to budgeted
    makeActual('rent-1', 'rent', `${y}-${m}-01`, 12000, ['Housing'], 'Rent transfer'),
    makeActual('utilities-1', 'utilities', `${y}-${m}-07`, 2150, ['Housing'], 'City of Cape Town utilities'),
    makeActual('internet-1', 'internet', `${y}-${m}-03`, 1000, ['Housing'], 'Vumatel fibre'),
    makeActual('insurance-1', 'insurance', `${y}-${m}-01`, 2500, ['Insurance'], 'MiWay car insurance'),
    makeActual('medical-1', 'medical', `${y}-${m}-01`, 3500, ['Medical'], 'Discovery medical aid'),

    // Variable expenses — spread across the month with realistic variation
    makeActual('groc-1', 'groceries', `${y}-${m}-03`, 1250, ['Food'], 'Checkers Groceries'),
    makeActual('groc-2', 'groceries', `${y}-${m}-10`, 980, ['Food'], 'Pick n Pay'),
    makeActual('groc-3', 'groceries', `${y}-${m}-17`, 1450, ['Food'], 'Woolworths Food'),
    makeActual('groc-4', 'groceries', `${y}-${m}-24`, 1100, ['Food'], 'Checkers Groceries'),

    makeActual('eat-1', 'eating-out', `${y}-${m}-05`, 350, ['Food', 'Discretionary'], 'Nandos'),
    makeActual('eat-2', 'eating-out', `${y}-${m}-12`, 520, ['Food', 'Discretionary'], 'Spur'),
    makeActual('eat-3', 'eating-out', `${y}-${m}-19`, 280, ['Food', 'Discretionary'], 'Steers'),
    makeActual('eat-4', 'eating-out', `${y}-${m}-26`, 680, ['Food', 'Discretionary'], 'Ocean Basket'),

    makeActual('fuel-1', 'transport', `${y}-${m}-04`, 850, ['Transport'], 'Engen fuel'),
    makeActual('fuel-2', 'transport', `${y}-${m}-14`, 920, ['Transport'], 'Shell fuel'),
    makeActual('fuel-3', 'transport', `${y}-${m}-22`, 780, ['Transport'], 'BP fuel'),

    makeActual('gym-1', 'gym', `${y}-${m}-01`, 699, ['Health'], 'Virgin Active debit order'),
    makeActual('netflix-1', 'netflix', `${y}-${m}-02`, 199, ['Entertainment'], 'Netflix subscription'),
    makeActual('spotify-1', 'spotify', `${y}-${m}-02`, 80, ['Entertainment'], 'Spotify subscription'),

    // Unbudgeted actuals — things that happen in real life but aren't in the budget
    makeActual('unbudget-1', null, `${y}-${m}-08`, 350, ['Shopping'], 'Takealot order'),
    makeActual('unbudget-2', null, `${y}-${m}-20`, 180, ['Transport'], 'Uber rides'),
  ]
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

  const actuals = generateDemoActuals(now)

  try {
    await db.transaction('rw', [db.workspaces, db.expenses, db.actuals], async () => {
      await db.workspaces.add(workspace)
      await db.expenses.bulkAdd(expenses)
      await db.actuals.bulkAdd(actuals)
    })
    debugLog('db', 'success', `Seeded demo workspace with ${expenses.length} items and ${actuals.length} actuals`)
    return true
  } catch (err) {
    debugLog('db', 'error', `Failed to seed demo workspace: ${err}`)
    return false
  }
}
