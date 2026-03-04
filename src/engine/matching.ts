/**
 * CSV parsing utilities — date detection, date parsing, amount parsing, dedup.
 *
 * Requirement: Parse CSV columns into typed values during import
 * Approach: Auto-detect date format from samples, parse amounts handling currency symbols
 * Alternatives:
 *   - Library-based parsing (date-fns, etc.): Rejected — simple formats, no deps needed
 *   - User always selects format: Complementary — auto-detect first, allow override
 */

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

/**
 * Check if a transaction is a duplicate based on date + amount + description.
 *
 * Requirement: Prevent duplicate entries when re-importing
 * Approach: Exact match on date + amount + description (case-insensitive)
 * Alternatives:
 *   - Hash-based dedup: Rejected — over-engineering for MVP
 *   - Fuzzy description match: Rejected — too aggressive, might skip legitimate duplicates
 */
export function isDuplicate(
  row: { date: string; amount: number; description: string },
  existing: { date: string; amount: number; description: string }[],
): boolean {
  const descLower = row.description.toLowerCase().trim()
  return existing.some((a) =>
    a.date === row.date &&
    Math.abs(a.amount - row.amount) < 0.01 &&
    a.description.toLowerCase().trim() === descLower
  )
}
