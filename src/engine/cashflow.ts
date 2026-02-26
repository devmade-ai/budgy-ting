/**
 * Cashflow calculation engine — pure TypeScript, no UI dependency.
 *
 * Requirement: For budgets with a starting balance, calculate month-by-month running
 *   balance from income and expenses, identify when balance crosses zero, and provide
 *   a cashflow forecast.
 * Approach: Take starting balance + projection (with income/expense split) + actuals,
 *   produce a running balance timeline with net cashflow per month.
 *   Actuals are split into income vs expense based on their linked expense's type.
 * Alternatives:
 *   - Merge into envelope.ts: Rejected — envelope tracks expense-only burn against a
 *     fixed budget; cashflow tracks income vs expenses over time. Different mental models.
 *   - Compute in component: Rejected — engine should be testable independently
 *   - Treat all actuals as expenses: Rejected — wrong for cashflow; a salary deposit
 *     would inflate expenses instead of counting as income
 */

import type { ProjectionResult } from './projection'
import type { Actual, Expense } from '@/types/models'

export interface CashflowMonth {
  /** ISO month string: YYYY-MM */
  month: string
  /** Human-readable label: "Jan 26" */
  monthLabel: string
  /** Projected income for this month */
  projectedIncome: number
  /** Projected expenses for this month */
  projectedExpenses: number
  /** Projected net (income - expenses) */
  projectedNet: number
  /** Actual income for this month. Null if no income actuals. */
  actualIncome: number | null
  /** Actual expenses for this month. Null if no expense actuals. */
  actualExpenses: number | null
  /** Effective net used for balance calculation (actual-adjusted where available) */
  effectiveNet: number
  /** Running balance at end of this month */
  balance: number
}

export interface CashflowResult {
  /** Starting balance (beginning of period) */
  startingBalance: number
  /** Total projected income across all months */
  totalIncome: number
  /** Total projected expenses across all months */
  totalExpenses: number
  /** Total projected net (income - expenses) */
  totalNet: number
  /** Projected ending balance (startingBalance + totalNet) */
  endingBalance: number
  /** Month-by-month cashflow breakdown with running balance */
  months: CashflowMonth[]
  /** ISO date when balance is projected to cross zero (null if never) */
  zeroCrossingDate: string | null
  /** Month label when balance crosses zero (null if never) */
  zeroCrossingMonth: string | null
  /** Whether balance is projected to go negative */
  willGoNegative: boolean
  /** Lowest projected balance across all months */
  lowestBalance: number
  /** Month label of lowest balance */
  lowestBalanceMonth: string
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Build a lookup from expense ID → expense type.
 * Unlinked actuals (expenseId === null) default to 'expense' (conservative).
 */
function buildExpenseTypeLookup(expenses: Expense[]): Map<string, 'income' | 'expense'> {
  const map = new Map<string, 'income' | 'expense'>()
  for (const exp of expenses) {
    map.set(exp.id, exp.type ?? 'expense')
  }
  return map
}

/**
 * Calculate cashflow projection given a starting balance, projection, and actuals.
 *
 * @param startingBalance - Current account balance to forecast from
 * @param projection - Projection result with income/expense split
 * @param actuals - Imported actual transactions
 * @param expenses - Expense lines (needed to look up type for each actual)
 */
export function calculateCashflow(
  startingBalance: number,
  projection: ProjectionResult,
  actuals: Actual[],
  expenses: Expense[],
): CashflowResult {
  const typeLookup = buildExpenseTypeLookup(expenses)

  // Split actuals into income vs expense by month, using linked expense type
  const actualIncomeByMonth = new Map<string, number>()
  const actualExpenseByMonth = new Map<string, number>()

  for (const actual of actuals) {
    const month = actual.date.slice(0, 7)
    const type = actual.expenseId ? (typeLookup.get(actual.expenseId) ?? 'expense') : 'expense'

    if (type === 'income') {
      actualIncomeByMonth.set(month, (actualIncomeByMonth.get(month) ?? 0) + actual.amount)
    } else {
      actualExpenseByMonth.set(month, (actualExpenseByMonth.get(month) ?? 0) + actual.amount)
    }
  }

  let runningBalance = startingBalance
  let zeroCrossingDate: string | null = null
  let zeroCrossingMonth: string | null = null
  let lowestBalance = startingBalance
  let lowestBalanceMonth = ''

  const months: CashflowMonth[] = projection.months.map((slot) => {
    const projectedIncome = projection.monthlyIncome.get(slot.month) ?? 0
    const projectedExpenses = projection.monthlyTotals.get(slot.month) ?? 0
    const projectedNet = projectedIncome - projectedExpenses

    const hasActualIncome = actualIncomeByMonth.has(slot.month)
    const hasActualExpenses = actualExpenseByMonth.has(slot.month)
    const actualIncome = hasActualIncome ? actualIncomeByMonth.get(slot.month)! : null
    const actualExpenses = hasActualExpenses ? actualExpenseByMonth.get(slot.month)! : null

    // Use actuals where available, projected where not — independently for income and expenses
    const effectiveIncome = actualIncome !== null ? actualIncome : projectedIncome
    const effectiveExpense = actualExpenses !== null ? actualExpenses : projectedExpenses
    const effectiveNet = effectiveIncome - effectiveExpense

    runningBalance += effectiveNet

    const m = slot.monthNum
    const y = String(slot.year).slice(2)
    const monthLabel = `${monthNames[m - 1] ?? 'Unknown'} ${y}`

    // Track zero crossing
    if (runningBalance < 0 && !zeroCrossingDate) {
      zeroCrossingDate = slot.firstDay
      zeroCrossingMonth = monthLabel
    }

    // Track lowest balance
    if (runningBalance < lowestBalance) {
      lowestBalance = runningBalance
      lowestBalanceMonth = monthLabel
    }

    return {
      month: slot.month,
      monthLabel,
      projectedIncome,
      projectedExpenses,
      projectedNet,
      actualIncome,
      actualExpenses,
      effectiveNet,
      balance: runningBalance,
    }
  })

  const totalIncome = projection.totalIncome
  const totalExpenses = projection.grandTotal
  const totalNet = totalIncome - totalExpenses
  const endingBalance = startingBalance + months.reduce((sum, m) => sum + m.effectiveNet, 0)

  // Default lowestBalanceMonth if no months processed
  if (!lowestBalanceMonth && months.length > 0) {
    lowestBalanceMonth = months[0]!.monthLabel
  }

  return {
    startingBalance,
    totalIncome,
    totalExpenses,
    totalNet,
    endingBalance,
    months,
    zeroCrossingDate,
    zeroCrossingMonth,
    willGoNegative: lowestBalance < 0,
    lowestBalance,
    lowestBalanceMonth,
  }
}
