/**
 * Demo workspace with realistic transaction data.
 *
 * Requirement: Pre-populated workspace so users can explore the tool before creating their own
 * Approach: Seed a full workspace with 2 months of transactions + recurring patterns on first
 *   app load (empty DB). Uses signed amounts (positive=income, negative=expense).
 * Alternatives:
 *   - Read-only demo mode: Rejected — users should be able to edit/delete demo data freely
 *   - Load from external JSON: Rejected — adds latency, fails offline on first visit
 */

import { db } from './index'
import { debugLog } from '@/debug/debugLog'
import type { Workspace, Transaction, RecurringPattern } from '@/types/models'

const DEMO_WORKSPACE_ID = 'demo-household'

function makeId(suffix: string): string {
  return `demo-${suffix}`
}

function makeTransaction(
  id: string,
  date: string,
  amount: number,
  description: string,
  tags: string[],
  classification: Transaction['classification'],
  recurringGroupId: string | null,
): Transaction {
  const now = new Date().toISOString()
  return {
    id: makeId(id),
    workspaceId: DEMO_WORKSPACE_ID,
    date,
    amount,
    description,
    tags,
    source: 'import',
    classification,
    recurringGroupId: recurringGroupId ? makeId(recurringGroupId) : null,
    originalRow: null,
    importBatchId: null,
    createdAt: now,
    updatedAt: now,
  }
}

function makePattern(
  id: string,
  description: string,
  expectedAmount: number,
  frequency: RecurringPattern['frequency'],
  anchorDay: number,
  tags: string[],
  lastSeenDate: string,
  variability: RecurringPattern['variability'] = 'fixed',
  amountStdDev: number = 0,
): RecurringPattern {
  const now = new Date().toISOString()
  return {
    id: makeId(id),
    workspaceId: DEMO_WORKSPACE_ID,
    description,
    expectedAmount,
    amountStdDev,
    frequency,
    anchorDay,
    tags,
    variability,
    isActive: true,
    autoAccept: true,
    lastSeenDate,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Generate 2 months of realistic demo transactions.
 * Amounts are signed: positive = income, negative = expense.
 */
function generateDemoTransactions(baseDate: Date): Transaction[] {
  const txns: Transaction[] = []

  // Generate for prev month and the month before
  for (let monthOffset = 1; monthOffset <= 2; monthOffset++) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - monthOffset, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const suffix = monthOffset === 1 ? '1' : '2'

    // Income — recurring
    txns.push(makeTransaction(`salary-${suffix}`, `${y}-${m}-25`, 25000, 'Salary', ['Income', 'FNB Cheque'], 'recurring', 'pat-salary'))
    txns.push(makeTransaction(`freelance-${suffix}`, `${y}-${m}-15`, 4200 + (monthOffset === 2 ? 800 : 0), 'Freelance payment', ['Income', 'Capitec'], 'recurring', 'pat-freelance'))

    // Fixed expenses — recurring (negative amounts)
    txns.push(makeTransaction(`rent-${suffix}`, `${y}-${m}-01`, -12000, 'Rent transfer', ['Housing'], 'recurring', 'pat-rent'))
    txns.push(makeTransaction(`utilities-${suffix}`, `${y}-${m}-07`, -(1800 + monthOffset * 150), 'City of Cape Town utilities', ['Housing'], 'recurring', 'pat-utilities'))
    txns.push(makeTransaction(`internet-${suffix}`, `${y}-${m}-03`, -1000, 'Vumatel fibre', ['Housing'], 'recurring', 'pat-internet'))
    txns.push(makeTransaction(`insurance-${suffix}`, `${y}-${m}-01`, -2500, 'MiWay car insurance', ['Insurance'], 'recurring', 'pat-insurance'))
    txns.push(makeTransaction(`medical-${suffix}`, `${y}-${m}-01`, -3500, 'Discovery medical aid', ['Medical'], 'recurring', 'pat-medical'))
    txns.push(makeTransaction(`gym-${suffix}`, `${y}-${m}-01`, -699, 'Virgin Active debit order', ['Health'], 'recurring', 'pat-gym'))
    txns.push(makeTransaction(`netflix-${suffix}`, `${y}-${m}-02`, -199, 'Netflix subscription', ['Entertainment'], 'recurring', 'pat-netflix'))
    txns.push(makeTransaction(`spotify-${suffix}`, `${y}-${m}-02`, -80, 'Spotify subscription', ['Entertainment'], 'recurring', 'pat-spotify'))

    // Variable recurring — regular timing, variable amount (utility bill)
    txns.push(makeTransaction(`water-${suffix}`, `${y}-${m}-10`, -(450 + monthOffset * 120), 'City of CT water', ['Housing'], 'recurring', 'pat-water'))

    // Irregular recurring — no schedule, bought when needed (prepaid)
    txns.push(makeTransaction(`prepaid-elec-${suffix}-a`, `${y}-${m}-${String(5 + monthOffset * 3).padStart(2, '0')}`, -(350 + monthOffset * 50), 'Prepaid electricity', ['Housing'], 'recurring', 'pat-prepaid-elec'))
    txns.push(makeTransaction(`prepaid-elec-${suffix}-b`, `${y}-${m}-${String(18 - monthOffset * 2).padStart(2, '0')}`, -(280 + monthOffset * 30), 'Prepaid electricity', ['Housing'], 'recurring', 'pat-prepaid-elec'))
    txns.push(makeTransaction(`data-${suffix}`, `${y}-${m}-${String(12 + monthOffset * 5).padStart(2, '0')}`, -(150 + monthOffset * 20), 'Vodacom data bundle', ['Connectivity'], 'recurring', 'pat-data'))

    // Variable expenses — once-off (amounts vary month to month)
    txns.push(makeTransaction(`groc-${suffix}-a`, `${y}-${m}-03`, -(1250 + monthOffset * 80), 'Checkers Groceries', ['Food'], 'once-off', null))
    txns.push(makeTransaction(`groc-${suffix}-b`, `${y}-${m}-10`, -(980 + monthOffset * 60), 'Pick n Pay', ['Food'], 'once-off', null))
    txns.push(makeTransaction(`groc-${suffix}-c`, `${y}-${m}-17`, -(1450 - monthOffset * 100), 'Woolworths Food', ['Food'], 'once-off', null))
    txns.push(makeTransaction(`groc-${suffix}-d`, `${y}-${m}-24`, -(1100 + monthOffset * 50), 'Checkers Groceries', ['Food'], 'once-off', null))

    txns.push(makeTransaction(`eat-${suffix}-a`, `${y}-${m}-05`, -(350 + monthOffset * 30), 'Nandos', ['Food', 'Discretionary'], 'once-off', null))
    txns.push(makeTransaction(`eat-${suffix}-b`, `${y}-${m}-12`, -(520 - monthOffset * 40), 'Spur', ['Food', 'Discretionary'], 'once-off', null))
    txns.push(makeTransaction(`eat-${suffix}-c`, `${y}-${m}-19`, -(280 + monthOffset * 20), 'Steers', ['Food', 'Discretionary'], 'once-off', null))
    txns.push(makeTransaction(`eat-${suffix}-d`, `${y}-${m}-26`, -(680 + monthOffset * 50), 'Ocean Basket', ['Food', 'Discretionary'], 'once-off', null))

    txns.push(makeTransaction(`fuel-${suffix}-a`, `${y}-${m}-04`, -(850 + monthOffset * 30), 'Engen fuel', ['Transport'], 'once-off', null))
    txns.push(makeTransaction(`fuel-${suffix}-b`, `${y}-${m}-14`, -(920 - monthOffset * 20), 'Shell fuel', ['Transport'], 'once-off', null))
    txns.push(makeTransaction(`fuel-${suffix}-c`, `${y}-${m}-22`, -(780 + monthOffset * 40), 'BP fuel', ['Transport'], 'once-off', null))

    // Ad-hoc purchases
    txns.push(makeTransaction(`shop-${suffix}`, `${y}-${m}-08`, -(350 + monthOffset * 100), 'Takealot order', ['Shopping'], 'once-off', null))
    txns.push(makeTransaction(`uber-${suffix}`, `${y}-${m}-20`, -(180 + monthOffset * 30), 'Uber rides', ['Transport'], 'once-off', null))
  }

  return txns
}

/**
 * Generate recurring patterns from the demo data.
 */
function generateDemoPatterns(baseDate: Date): RecurringPattern[] {
  const prevMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1)
  const y = prevMonth.getFullYear()
  const m = String(prevMonth.getMonth() + 1).padStart(2, '0')

  return [
    makePattern('pat-salary', 'Salary', 25000, 'monthly', 25, ['Income', 'FNB Cheque'], `${y}-${m}-25`),
    makePattern('pat-freelance', 'Freelance payment', 4200, 'monthly', 15, ['Income', 'Capitec'], `${y}-${m}-15`),
    makePattern('pat-rent', 'Rent transfer', -12000, 'monthly', 1, ['Housing'], `${y}-${m}-01`),
    makePattern('pat-utilities', 'City of Cape Town utilities', -1950, 'monthly', 7, ['Housing'], `${y}-${m}-07`),
    makePattern('pat-internet', 'Vumatel fibre', -1000, 'monthly', 3, ['Housing'], `${y}-${m}-03`),
    makePattern('pat-insurance', 'MiWay car insurance', -2500, 'monthly', 1, ['Insurance'], `${y}-${m}-01`),
    makePattern('pat-medical', 'Discovery medical aid', -3500, 'monthly', 1, ['Medical'], `${y}-${m}-01`),
    makePattern('pat-gym', 'Virgin Active debit order', -699, 'monthly', 1, ['Health'], `${y}-${m}-01`),
    makePattern('pat-netflix', 'Netflix subscription', -199, 'monthly', 2, ['Entertainment'], `${y}-${m}-02`),
    makePattern('pat-spotify', 'Spotify subscription', -80, 'monthly', 2, ['Entertainment'], `${y}-${m}-02`),
    // Variable recurring — regular timing, variable amount
    makePattern('pat-water', 'City of CT water', -570, 'monthly', 10, ['Housing'], `${y}-${m}-10`, 'variable', 120),
    // Irregular recurring — no fixed schedule, bought when needed
    makePattern('pat-prepaid-elec', 'Prepaid electricity', -350, 'irregular', 0, ['Housing'], `${y}-${m}-16`, 'irregular'),
    makePattern('pat-data', 'Vodacom data bundle', -170, 'irregular', 0, ['Connectivity'], `${y}-${m}-17`, 'irregular'),
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
    cashOnHand: 15000,
    createdAt: nowISO,
    updatedAt: nowISO,
  }

  const transactions = generateDemoTransactions(now)
  const patterns = generateDemoPatterns(now)

  try {
    await db.transaction('rw', [db.workspaces, db.transactions, db.patterns], async () => {
      await db.workspaces.add(workspace)
      await db.transactions.bulkAdd(transactions)
      await db.patterns.bulkAdd(patterns)
    })
    debugLog('db', 'success', `Seeded demo workspace with ${transactions.length} transactions and ${patterns.length} patterns`)
    return true
  } catch (err) {
    debugLog('db', 'error', `Failed to seed demo workspace: ${err}`)
    return false
  }
}
