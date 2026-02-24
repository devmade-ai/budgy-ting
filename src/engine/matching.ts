/**
 * Three-pass matching engine for auto-matching imported actuals to budget expense lines.
 *
 * Requirement: Match imported rows to expense lines with confidence levels
 * Approach: 3-pass algorithm — exact, fuzzy text + exact amount, amount-only
 * Alternatives:
 *   - Single-pass with weighted scoring: Rejected — harder for users to understand confidence
 *   - Machine learning: Rejected — overkill for MVP, small datasets
 *
 * Note: Fuzzy matching uses a simple substring/Levenshtein approach since Fuse.js
 * can't be installed (npm blocked). Will swap to Fuse.js when deps are available.
 */

import type { Expense, MatchConfidence } from '@/types/models'

export interface ImportedRow {
  date: string
  amount: number
  category: string
  description: string
  originalRow: Record<string, string>
}

export interface MatchResult {
  importedRow: ImportedRow
  matchedExpense: Expense | null
  confidence: MatchConfidence
  approved: boolean
}

/**
 * Run the three-pass matching algorithm.
 */
export function matchImportedRows(
  rows: ImportedRow[],
  expenses: Expense[],
): MatchResult[] {
  const results: MatchResult[] = []
  const usedExpenses = new Set<string>()

  // Track which rows have been matched
  const unmatchedRows = [...rows]
  const matchedIndices = new Set<number>()

  // Pass 1: High confidence — exact category match + exact amount
  for (let i = 0; i < unmatchedRows.length; i++) {
    if (matchedIndices.has(i)) continue
    const row = unmatchedRows[i]!

    const match = expenses.find((exp) =>
      !usedExpenses.has(`${exp.id}-${row.date}`) &&
      exp.category.toLowerCase() === row.category.toLowerCase() &&
      Math.abs(exp.amount - row.amount) < 0.01
    )

    if (match) {
      results.push({
        importedRow: row,
        matchedExpense: match,
        confidence: 'high',
        approved: true, // Auto-approved
      })
      matchedIndices.add(i)
      usedExpenses.add(`${match.id}-${row.date}`)
    }
  }

  // Pass 2: Medium confidence — fuzzy text match + exact amount
  for (let i = 0; i < unmatchedRows.length; i++) {
    if (matchedIndices.has(i)) continue
    const row = unmatchedRows[i]!

    const match = expenses.find((exp) => {
      if (usedExpenses.has(`${exp.id}-${row.date}`)) return false
      if (Math.abs(exp.amount - row.amount) >= 0.01) return false

      // Require best-of-both: use Math.max so BOTH category and description
      // must be reasonable, not just one. Math.min was a bug — it let garbage
      // descriptions through as long as category was a perfect match.
      const score = Math.max(
        fuzzyScore(row.category, exp.category),
        fuzzyScore(row.description, exp.description),
      )
      return score <= 0.4
    })

    if (match) {
      results.push({
        importedRow: row,
        matchedExpense: match,
        confidence: 'medium',
        approved: false, // Needs review
      })
      matchedIndices.add(i)
      usedExpenses.add(`${match.id}-${row.date}`)
    }
  }

  // Pass 3: Low confidence — amount-only match within same month
  for (let i = 0; i < unmatchedRows.length; i++) {
    if (matchedIndices.has(i)) continue
    const row = unmatchedRows[i]!
    const rowMonth = row.date.slice(0, 7)

    const match = expenses.find((exp) => {
      if (usedExpenses.has(`${exp.id}-${row.date}`)) return false
      if (Math.abs(exp.amount - row.amount) >= 0.01) return false

      // Check expense is active in the same month
      const expStartMonth = exp.startDate.slice(0, 7)
      const expEndMonth = exp.endDate ? exp.endDate.slice(0, 7) : '9999-12'
      return rowMonth >= expStartMonth && rowMonth <= expEndMonth
    })

    if (match) {
      results.push({
        importedRow: row,
        matchedExpense: match,
        confidence: 'low',
        approved: false,
      })
      matchedIndices.add(i)
      usedExpenses.add(`${match.id}-${row.date}`)
    }
  }

  // Remaining: Unmatched
  for (let i = 0; i < unmatchedRows.length; i++) {
    if (matchedIndices.has(i)) continue
    results.push({
      importedRow: unmatchedRows[i]!,
      matchedExpense: null,
      confidence: 'unmatched',
      approved: false,
    })
  }

  return results
}

/**
 * Fuzzy scoring using Levenshtein distance (0 = perfect match, 1 = no match).
 * Will be replaced by Fuse.js when available.
 *
 * Requirement: Score how similar two strings are for matching imported rows
 * Approach: Levenshtein distance normalized by max string length
 * Alternatives:
 *   - Character presence check: Rejected — order-blind, "abc" vs "cba" scored as perfect
 *   - Jaccard index on character sets: Rejected — loses positional information
 */
function fuzzyScore(a: string, b: string): number {
  if (!a && !b) return 0
  if (!a || !b) return 1

  const al = a.toLowerCase().trim()
  const bl = b.toLowerCase().trim()

  if (al === bl) return 0
  if (al.includes(bl) || bl.includes(al)) return 0.1

  const m = al.length
  const n = bl.length
  const maxLen = Math.max(m, n)
  if (maxLen === 0) return 0

  // Levenshtein with single-row DP for memory efficiency
  let prev: number[] = Array.from({ length: n + 1 }, (_, j) => j)
  let curr: number[] = new Array(n + 1)

  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = al[i - 1] === bl[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j]! + 1,      // deletion
        curr[j - 1]! + 1,  // insertion
        prev[j - 1]! + cost // substitution
      )
    }
    ;[prev, curr] = [curr, prev]
  }

  return prev[n]! / maxLen
}

/**
 * Common date format patterns for auto-detection.
 */
export const DATE_FORMATS = [
  { label: 'YYYY-MM-DD', pattern: /^\d{4}-\d{2}-\d{2}$/, parse: (s: string) => s },
  { label: 'DD/MM/YYYY', pattern: /^\d{2}\/\d{2}\/\d{4}$/, parse: (s: string) => {
    const [d, m, y] = s.split('/')
    return `${y}-${m}-${d}`
  }},
  { label: 'MM/DD/YYYY', pattern: /^\d{2}\/\d{2}\/\d{4}$/, parse: (s: string) => {
    const [m, d, y] = s.split('/')
    return `${y}-${m}-${d}`
  }},
  { label: 'DD-MM-YYYY', pattern: /^\d{2}-\d{2}-\d{4}$/, parse: (s: string) => {
    const [d, m, y] = s.split('-')
    return `${y}-${m}-${d}`
  }},
  { label: 'YYYY/MM/DD', pattern: /^\d{4}\/\d{2}\/\d{2}$/, parse: (s: string) => {
    return s.replace(/\//g, '-')
  }},
] as const

/**
 * Auto-detect date format from sample values.
 */
export function detectDateFormat(samples: string[]): typeof DATE_FORMATS[number] | null {
  for (const fmt of DATE_FORMATS) {
    const matches = samples.filter((s) => fmt.pattern.test(s.trim())).length
    if (matches >= samples.length * 0.8) return fmt
  }
  return null
}

/**
 * Parse a date string using detected or selected format.
 */
export function parseDate(value: string, formatIndex: number): string | null {
  const fmt = DATE_FORMATS[formatIndex]
  if (!fmt) return null

  const trimmed = value.trim()
  if (!fmt.pattern.test(trimmed)) return null

  const iso = fmt.parse(trimmed)
  // Validate it's a real date
  const date = new Date(iso)
  if (isNaN(date.getTime())) return null

  return iso
}

/**
 * Parse a numeric amount string, handling common formats.
 */
export function parseAmount(value: string): number | null {
  if (!value) return null

  // Remove currency symbols and whitespace
  let cleaned = value.trim().replace(/[R$€£¥₹,\s]/g, '')

  // Handle negative amounts in parentheses: (100) → -100
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    cleaned = '-' + cleaned.slice(1, -1)
  }

  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}
