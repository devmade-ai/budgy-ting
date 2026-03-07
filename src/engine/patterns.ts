/**
 * Recurring pattern detection engine — detects frequency, amount variation,
 * and anchor day from a set of transactions with matching descriptions.
 *
 * Requirement: When user tags a transaction as "recurring" in the import wizard,
 *   detect the frequency and scheduling parameters from historical data.
 * Approach: Group by description similarity, calculate median interval between
 *   occurrences, map to nearest standard frequency, detect preferred anchor day.
 * Alternatives:
 *   - ML clustering: Rejected — overkill for personal finance, small datasets
 *   - User manually picks frequency: Complementary — auto-detect first, allow override
 */

import { median, standardDeviation, mean } from 'simple-statistics'
import type { Transaction, Frequency, RecurringPattern } from '@/types/models'
import { formatDate } from './dateUtils'

/**
 * Coefficient of variation (stddev / mean) threshold above which a recurring item
 * is classified as "variable" rather than "fixed". 0.3 (30% variance) was chosen
 * from analysis of typical household expenses — rent/subscriptions are <10% CV,
 * while utility bills commonly range 20-40%.
 */
const VARIABLE_CV_THRESHOLD = 0.3

/** Interval-to-frequency mapping ranges (in days) */
const FREQUENCY_RANGES: Array<{ min: number; max: number; frequency: Frequency }> = [
  { min: 0, max: 2, frequency: 'daily' },
  { min: 5, max: 9, frequency: 'weekly' },
  { min: 12, max: 18, frequency: 'biweekly' },
  { min: 25, max: 36, frequency: 'monthly' },
  { min: 80, max: 100, frequency: 'quarterly' },
  { min: 340, max: 395, frequency: 'annually' },
]

export interface DetectedPattern {
  /** Description pattern (the common description among grouped transactions) */
  description: string
  /** Detected frequency */
  frequency: Frequency
  /** Median amount (signed) */
  expectedAmount: number
  /** Amount standard deviation (always positive) */
  amountStdDev: number
  /** Anchor day for scheduling */
  anchorDay: number
  /** Whether the amount varies significantly (CV > 0.3) */
  isVariable: boolean
  /** Confidence in the frequency detection (0-1) — higher means more consistent intervals */
  confidence: number
  /** Tags from the transactions (union of all unique tags) */
  tags: string[]
  /** Most recent occurrence date */
  lastSeenDate: string
  /** Transaction IDs that belong to this pattern */
  transactionIds: string[]
  /** Earliest occurrence date — used for daily rate calculation on irregular patterns */
  firstSeenDate: string
}

/**
 * Calculate the number of days between two ISO date strings.
 */
function daysBetween(a: string, b: string): number {
  const MS_PER_DAY = 86_400_000
  const da = new Date(a + 'T00:00:00')
  const db = new Date(b + 'T00:00:00')
  return Math.round(Math.abs(db.getTime() - da.getTime()) / MS_PER_DAY)
}

/**
 * Detect the frequency from a series of intervals between occurrences.
 * Returns the frequency and a confidence score (0-1).
 */
export function detectFrequency(
  intervals: number[],
): { frequency: Frequency; confidence: number } | null {
  if (intervals.length === 0) return null

  const medianInterval = median(intervals)

  // Find the matching frequency range
  for (const range of FREQUENCY_RANGES) {
    if (medianInterval >= range.min && medianInterval <= range.max) {
      // Confidence: how consistent are the intervals relative to the expected?
      // Low stddev relative to median = high confidence
      const expectedInterval = (range.min + range.max) / 2
      const deviations = intervals.map((i) => Math.abs(i - expectedInterval))
      const avgDeviation = deviations.length > 0 ? mean(deviations) : 0
      // Normalize: 0 deviation → confidence 1.0, deviation = expectedInterval → confidence 0
      const confidence = Math.max(0, 1 - avgDeviation / expectedInterval)

      return { frequency: range.frequency, confidence }
    }
  }

  // No standard frequency matched
  return null
}

/**
 * Detect the preferred anchor day from a set of dates.
 * For weekly/biweekly: returns day-of-week (0=Sunday, 6=Saturday).
 * For monthly/quarterly/annually: returns day-of-month (1-31).
 */
export function detectAnchorDay(
  dates: string[],
  frequency: Frequency,
): number {
  if (dates.length === 0) return 1

  // Daily and once-off have no meaningful anchor day
  if (frequency === 'daily' || frequency === 'once-off') return 0

  if (frequency === 'weekly' || frequency === 'biweekly') {
    // Day of week — mode
    const dows = dates.map((d) => new Date(d + 'T00:00:00').getDay())
    return mode(dows)
  }

  // Day of month — mode (handles 31st → last day of shorter months)
  const days = dates.map((d) => parseInt(d.split('-')[2]!, 10))
  return mode(days)
}

/**
 * Find the mode (most common value) of an array of numbers.
 */
function mode(values: number[]): number {
  const counts = new Map<number, number>()
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  let maxCount = 0
  let maxValue = values[0] ?? 0
  for (const [v, c] of counts) {
    if (c > maxCount) {
      maxCount = c
      maxValue = v
    }
  }
  return maxValue
}

/**
 * Detect a recurring pattern from a group of similar transactions.
 * Needs at least 2 transactions to detect a pattern.
 *
 * @param transactions - Transactions with similar descriptions, sorted by date ascending
 * @param groupDescription - The canonical description for this group
 */
export function detectPattern(
  transactions: Transaction[],
  groupDescription: string,
): DetectedPattern | null {
  if (transactions.length < 2) return null

  // Sort by date ascending
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))

  // Calculate intervals between consecutive occurrences
  const intervals = calculateIntervals(sorted.map((t) => t.date))

  // Detect frequency from intervals
  const detected = detectFrequency(intervals)
  if (!detected) return null

  // Amount analysis (use absolute values for stddev, keep sign for expected)
  const amounts = sorted.map((t) => t.amount)
  const absAmounts = amounts.map(Math.abs)
  // Use proper sorted median — amounts array from date-sorted transactions is NOT amount-sorted
  const sortedAmounts = [...amounts].sort((a, b) => a - b)
  const expectedAmount = median(sortedAmounts)
  const amountStdDev = absAmounts.length >= 2 ? standardDeviation(absAmounts) : 0
  const meanAbs = absAmounts.length > 0 ? mean(absAmounts) : 0
  const cv = meanAbs > 0 ? amountStdDev / meanAbs : 0

  // Detect anchor day
  const dates = sorted.map((t) => t.date)
  const anchorDay = detectAnchorDay(dates, detected.frequency)

  // Collect unique tags
  const tagSet = new Set<string>()
  for (const t of sorted) {
    for (const tag of t.tags) tagSet.add(tag)
  }

  return {
    description: groupDescription,
    frequency: detected.frequency,
    expectedAmount,
    amountStdDev: Math.round(amountStdDev * 100) / 100,
    anchorDay,
    isVariable: cv > VARIABLE_CV_THRESHOLD,
    confidence: Math.round(detected.confidence * 100) / 100,
    tags: [...tagSet],
    lastSeenDate: sorted[sorted.length - 1]!.date,
    firstSeenDate: sorted[0]!.date,
    transactionIds: sorted.map((t) => t.id),
  }
}

/**
 * Group transactions by normalized description for pattern detection.
 * Returns groups that have 2+ transactions (potential recurring patterns).
 */
export function groupByDescription(
  transactions: Transaction[],
): Map<string, Transaction[]> {
  const groups = new Map<string, Transaction[]>()

  for (const t of transactions) {
    const key = t.description.toLowerCase().trim()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(t)
  }

  // Only return groups with 2+ transactions (potential patterns)
  const result = new Map<string, Transaction[]>()
  for (const [key, txns] of groups) {
    if (txns.length >= 2) result.set(key, txns)
  }

  return result
}

/**
 * Detect all recurring patterns from a set of transactions.
 * Groups by description, attempts frequency detection on each group.
 */
export function detectAllPatterns(
  transactions: Transaction[],
): DetectedPattern[] {
  const groups = groupByDescription(transactions)
  const patterns: DetectedPattern[] = []

  for (const [, txns] of groups) {
    // Use the description from the first transaction as canonical
    const canonical = txns[0]!.description
    const pattern = detectPattern(txns, canonical)
    if (pattern) patterns.push(pattern)
  }

  // Sort by confidence descending
  return patterns.sort((a, b) => b.confidence - a.confidence)
}

/** Shared input type for projection functions */
type ProjectionPattern = Pick<RecurringPattern, 'frequency' | 'anchorDay' | 'expectedAmount' | 'lastSeenDate'> & {
  totalHistoricalAmount?: number
  historicalDaySpan?: number
}
type ProjectionPoint = { date: string; amount: number }

function projectDaily(amount: number, start: Date, end: Date): ProjectionPoint[] {
  const points: ProjectionPoint[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    points.push({ date: formatDate(cursor), amount })
    cursor.setDate(cursor.getDate() + 1)
  }
  return points
}

function projectWeeklyInterval(
  anchorDay: number, amount: number, intervalDays: number, start: Date, end: Date,
): ProjectionPoint[] {
  const points: ProjectionPoint[] = []
  const cursor = new Date(start)
  while (cursor.getDay() !== anchorDay) {
    cursor.setDate(cursor.getDate() + 1)
  }
  while (cursor <= end) {
    points.push({ date: formatDate(cursor), amount })
    cursor.setDate(cursor.getDate() + intervalDays)
  }
  return points
}

function projectMonthly(anchorDay: number, amount: number, start: Date, end: Date): ProjectionPoint[] {
  const points: ProjectionPoint[] = []
  let y = start.getFullYear()
  let m = start.getMonth()
  const endYear = end.getFullYear()
  const endMonth = end.getMonth()

  while (y < endYear || (y === endYear && m <= endMonth)) {
    // Handle anchor day overflow (e.g., anchor=31 but month has 30 days)
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const day = Math.min(anchorDay, daysInMonth)
    const d = new Date(y, m, day)
    if (d >= start && d <= end) {
      points.push({ date: formatDate(d), amount })
    }
    m++
    if (m > 11) { m = 0; y++ }
  }
  return points
}

/**
 * Phase quarterly projections from lastSeenDate, handling gaps > 6 months.
 * Steps forward from lastSeenDate by 3-month increments until entering the window.
 */
function projectQuarterly(
  pattern: ProjectionPattern, start: Date, end: Date,
): ProjectionPoint[] {
  const points: ProjectionPoint[] = []
  const startYear = start.getFullYear()
  const startMonth = start.getMonth()
  const endYear = end.getFullYear()
  const endMonth = end.getMonth()

  const lastSeen = new Date(pattern.lastSeenDate + 'T00:00:00')
  let nextM = lastSeen.getMonth()
  let nextY = lastSeen.getFullYear()

  // Step forward by quarters from lastSeen until we reach or pass the start
  while (new Date(nextY, nextM, 1) < new Date(startYear, startMonth, 1)) {
    nextM += 3
    if (nextM > 11) { nextM -= 12; nextY++ }
  }

  // Check if we need to step back one quarter (lastSeen's quarter may overlap start)
  const prevM = nextM - 3 < 0 ? nextM + 9 : nextM - 3
  const prevY = nextM - 3 < 0 ? nextY - 1 : nextY
  const prevDaysInMonth = new Date(prevY, prevM + 1, 0).getDate()
  const prevDay = Math.min(pattern.anchorDay, prevDaysInMonth)
  const prevD = new Date(prevY, prevM, prevDay)
  if (prevD >= start && prevD <= end) {
    points.push({ date: formatDate(prevD), amount: pattern.expectedAmount })
  }

  let y = nextY
  let m = nextM
  while (y < endYear || (y === endYear && m <= endMonth)) {
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const day = Math.min(pattern.anchorDay, daysInMonth)
    const d = new Date(y, m, day)
    if (d >= start && d <= end) {
      points.push({ date: formatDate(d), amount: pattern.expectedAmount })
    }
    m += 3
    if (m > 11) { m -= 12; y++ }
  }
  return points
}

function projectAnnually(
  pattern: ProjectionPattern, start: Date, end: Date,
): ProjectionPoint[] {
  const points: ProjectionPoint[] = []
  const lastSeen = new Date(pattern.lastSeenDate + 'T00:00:00')
  const annualMonth = lastSeen.getMonth()

  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    const daysInMonth = new Date(y, annualMonth + 1, 0).getDate()
    const day = Math.min(pattern.anchorDay, daysInMonth)
    const d = new Date(y, annualMonth, day)
    if (d >= start && d <= end) {
      points.push({ date: formatDate(d), amount: pattern.expectedAmount })
    }
  }
  return points
}

/**
 * Project irregular/on-demand expenses as a daily rate.
 * Computes average daily spend from total historical amount / observation days,
 * then spreads that rate across every forecast day.
 */
function projectIrregular(
  pattern: ProjectionPattern, start: Date, end: Date,
): ProjectionPoint[] {
  const totalSpend = pattern.totalHistoricalAmount ?? pattern.expectedAmount
  const daySpan = pattern.historicalDaySpan ?? 30
  const dailyRate = daySpan > 0 ? totalSpend / daySpan : 0

  if (Math.abs(dailyRate) <= 0.001) return []

  const points: ProjectionPoint[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    points.push({
      date: formatDate(cursor),
      amount: Math.round(dailyRate * 100) / 100,
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return points
}

/**
 * Calculate intervals (in days) between consecutive sorted ISO date strings.
 * Reused by both pattern detection and import wizard frequency detection.
 */
export function calculateIntervals(dates: string[]): number[] {
  const intervals: number[] = []
  for (let i = 1; i < dates.length; i++) {
    intervals.push(daysBetween(dates[i - 1]!, dates[i]!))
  }
  return intervals
}

/**
 * Project future occurrences of a recurring pattern within a date range.
 * Returns an array of { date, amount } for each expected occurrence.
 *
 * Requirement: Deterministic scheduling of known recurring items, plus daily-rate
 *   spreading for irregular patterns (prepaid/on-demand purchases).
 * Approach: Walk forward from anchor date by frequency intervals,
 *   handle month-end overflow (anchor day 31 → last day of short months).
 *   For irregular patterns: compute average daily spend from history and spread
 *   evenly across every day in the forecast window.
 * Alternatives:
 *   - Calculate from last seen date only: Rejected — misses if last occurrence was late
 *   - cron-like expressions: Rejected — overkill for these frequency types
 *   - Monthly lump sum for irregular: Rejected — daily rate integrates better with
 *     the forecast engine's daily aggregation
 */
export function projectPattern(
  pattern: ProjectionPattern,
  startDate: string,
  endDate: string,
): Array<{ date: string; amount: number }> {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')

  switch (pattern.frequency) {
    case 'once-off':
      return []
    case 'daily':
      return projectDaily(pattern.expectedAmount, start, end)
    case 'weekly':
      return projectWeeklyInterval(pattern.anchorDay, pattern.expectedAmount, 7, start, end)
    case 'biweekly':
      return projectWeeklyInterval(pattern.anchorDay, pattern.expectedAmount, 14, start, end)
    case 'monthly':
      return projectMonthly(pattern.anchorDay, pattern.expectedAmount, start, end)
    case 'quarterly':
      return projectQuarterly(pattern, start, end)
    case 'annually':
      return projectAnnually(pattern, start, end)
    case 'irregular':
      return projectIrregular(pattern, start, end)
  }
}

