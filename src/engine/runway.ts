/**
 * Cash runway calculation engine — projects how long cash will last
 * based on the combined daily forecast.
 *
 * Requirement: When user inputs cash on hand, walk forward day-by-day
 *   through the combined forecast to calculate depletion date, minimum balance,
 *   and end balance.
 * Approach: Simple daily accumulation from starting balance through forecast points.
 * Alternatives:
 *   - Monthly approximation: Rejected — daily granularity catches mid-month dips
 *   - Separate runway model: Rejected — reuse existing forecast daily points
 */

import type { DailyForecastPoint } from './forecast'

export interface RunwayResult {
  /** Days until balance hits zero (null = cash lasts beyond forecast horizon) */
  daysRemaining: number | null
  /** ISO date when balance hits zero (null = never within forecast) */
  depletionDate: string | null
  /** Balance at end of forecast period */
  endBalance: number
  /** Lowest predicted balance during forecast */
  minimumBalance: number
  /** When the lowest point occurs */
  minimumBalanceDate: string
  /** Daily balance progression (for graphing the runway) */
  dailyBalance: Array<{ date: string; balance: number }>
}

/**
 * Calculate cash runway from daily forecast points.
 *
 * @param cashOnHand - Starting cash amount (positive number)
 * @param dailyForecasts - Combined daily forecast points (amounts are signed: + income, - expense)
 */
export function calculateRunway(
  cashOnHand: number,
  dailyForecasts: DailyForecastPoint[],
): RunwayResult {
  if (dailyForecasts.length === 0) {
    return {
      daysRemaining: null,
      depletionDate: null,
      endBalance: cashOnHand,
      minimumBalance: cashOnHand,
      minimumBalanceDate: '',
      dailyBalance: [],
    }
  }

  let balance = cashOnHand
  let minBalance = cashOnHand
  let minDate = dailyForecasts[0]!.date
  const dailyBalance: Array<{ date: string; balance: number }> = []

  for (let i = 0; i < dailyForecasts.length; i++) {
    const day = dailyForecasts[i]!
    balance += day.amount

    const roundedBalance = Math.round(balance * 100) / 100
    dailyBalance.push({ date: day.date, balance: roundedBalance })

    if (balance < minBalance) {
      minBalance = balance
      minDate = day.date
    }

    if (balance <= 0) {
      return {
        daysRemaining: i + 1,
        depletionDate: day.date,
        endBalance: Math.round(balance * 100) / 100,
        minimumBalance: Math.round(minBalance * 100) / 100,
        minimumBalanceDate: minDate,
        dailyBalance,
      }
    }
  }

  return {
    daysRemaining: null, // cash lasts beyond forecast horizon
    depletionDate: null,
    endBalance: Math.round(balance * 100) / 100,
    minimumBalance: Math.round(minBalance * 100) / 100,
    minimumBalanceDate: minDate,
    dailyBalance,
  }
}

/**
 * Calculate runway with prediction bands — returns optimistic, expected, and pessimistic scenarios.
 *
 * @param cashOnHand - Starting cash amount
 * @param dailyForecasts - Forecast points with prediction bands
 */
export function calculateRunwayWithBands(
  cashOnHand: number,
  dailyForecasts: DailyForecastPoint[],
): {
  expected: RunwayResult
  optimistic: RunwayResult
  pessimistic: RunwayResult
} {
  // Expected: use point forecast
  const expected = calculateRunway(cashOnHand, dailyForecasts)

  // Optimistic: use upper band (more income / less expense)
  const optimisticPoints = dailyForecasts.map((p) => ({
    ...p,
    amount: p.band ? p.band.upper : p.amount,
  }))
  const optimistic = calculateRunway(cashOnHand, optimisticPoints)

  // Pessimistic: use lower band (less income / more expense)
  const pessimisticPoints = dailyForecasts.map((p) => ({
    ...p,
    amount: p.band ? p.band.lower : p.amount,
  }))
  const pessimistic = calculateRunway(cashOnHand, pessimisticPoints)

  return { expected, optimistic, pessimistic }
}
