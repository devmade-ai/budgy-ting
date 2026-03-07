/**
 * Shared transaction math helpers used across MetricsGrid and WorkspaceListView.
 * Extracts common income/expense aggregation to avoid duplication.
 */

import type { Transaction } from '@/types/models'

/** Sum of all positive (income) transaction amounts */
export function totalIncome(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)
}

/** Sum of absolute values of all negative (expense) transaction amounts */
export function totalExpenses(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)
}

/**
 * Estimate monthly spend from expense transactions over their date range.
 * Returns 0 if no expenses exist.
 */
export function estimateMonthlySpend(transactions: Transaction[]): number {
  const expenses = transactions.filter((t) => t.amount < 0)
  if (expenses.length === 0) return 0

  const dates = expenses.map((t) => t.date).sort()
  const firstDate = new Date(dates[0]!)
  const lastDate = new Date(dates[dates.length - 1]!)
  const daySpan = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / 86_400_000)
  const total = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0)

  return daySpan > 0 ? (total / daySpan) * 30 : total
}
