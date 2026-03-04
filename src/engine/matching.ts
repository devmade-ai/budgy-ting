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
 *
 * Requirement: Disambiguate DD/MM/YYYY vs MM/DD/YYYY (identical regex)
 * Approach: When both formats match structurally, inspect the first two segments
 *   of all samples. If any first-segment > 12, it must be DD/MM. If any
 *   second-segment > 12, it must be MM/DD. If ambiguous (all values 1-12),
 *   default to DD/MM (more common internationally).
 * Alternatives:
 *   - Always require user selection: Rejected — auto-detect should handle most cases
 *   - Locale-based default: Rejected — browser locale unreliable for bank statement origin
 */
export function detectDateFormat(samples: string[]): typeof DATE_FORMATS[number] | null {
  for (const fmt of DATE_FORMATS) {
    const matches = samples.filter((s) => fmt.pattern.test(s.trim())).length
    if (matches < samples.length * 0.8) continue

    // DD/MM/YYYY and MM/DD/YYYY share the same regex — disambiguate
    if (fmt.label === 'DD/MM/YYYY' || fmt.label === 'MM/DD/YYYY') {
      return disambiguateSlashFormat(samples)
    }

    return fmt
  }
  return null
}

/**
 * Disambiguate DD/MM/YYYY vs MM/DD/YYYY by inspecting field values.
 * If first segment ever > 12, it's day-first (DD/MM). If second segment
 * ever > 12, it's month-first (MM/DD). If all values fit either, default
 * to DD/MM (international convention).
 */
function disambiguateSlashFormat(samples: string[]): typeof DATE_FORMATS[number] {
  let firstOver12 = false
  let secondOver12 = false

  for (const s of samples) {
    const parts = s.trim().split('/')
    const a = parseInt(parts[0]!, 10)
    const b = parseInt(parts[1]!, 10)
    if (a > 12) firstOver12 = true
    if (b > 12) secondOver12 = true
  }

  // First segment has values > 12 → must be DD (DD/MM/YYYY)
  if (firstOver12 && !secondOver12) return DATE_FORMATS[1]! // DD/MM/YYYY
  // Second segment has values > 12 → must be MM (MM/DD/YYYY)
  if (secondOver12 && !firstOver12) return DATE_FORMATS[2]! // MM/DD/YYYY
  // Both or neither > 12 — default to DD/MM (more common internationally)
  return DATE_FORMATS[1]! // DD/MM/YYYY
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
  // Requirement: Support international currencies beyond ZAR/USD/EUR/GBP
  // Approach: Strip all common currency symbols and letter-based codes (CHF, etc.)
  let cleaned = value.trim().replace(/[R$€£¥₹₩₪₱₫₴₸₺₼₽฿,\s]/g, '').replace(/^[A-Z]{2,3}\s*/i, '')

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
 * Approach: Match on date + amount (within tolerance) + description (case-insensitive).
 *   Amount tolerance: absolute 1 cent OR 0.5% of value, whichever is larger.
 *   This handles rounding differences across bank export formats.
 * Alternatives:
 *   - Hash-based dedup: Rejected — over-engineering for MVP
 *   - Fuzzy description match: Rejected — too aggressive, might skip legitimate duplicates
 *   - Exact-cent only: Rejected — real bank exports have tiny rounding differences
 */
export function isDuplicate(
  row: { date: string; amount: number; description: string },
  existing: { date: string; amount: number; description: string }[],
): boolean {
  const descLower = row.description.toLowerCase().trim()
  return existing.some((a) => {
    if (a.date !== row.date) return false
    if (a.description.toLowerCase().trim() !== descLower) return false
    const diff = Math.abs(a.amount - row.amount)
    const tolerance = Math.max(0.01, Math.abs(row.amount) * 0.005)
    return diff <= tolerance
  })
}
