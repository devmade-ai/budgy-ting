/**
 * Simple CSV parser for import wizard.
 *
 * Requirement: Parse CSV files with common edge cases (quoted fields, commas in values)
 * Approach: Custom parser handling RFC 4180 basics — quoted fields, escaped quotes, newlines
 * Alternatives:
 *   - Papa Parse: Preferred per spec, but npm registry unavailable during scaffolding.
 *     This implementation covers the common cases. Can swap to Papa Parse when deps install.
 *   - String.split(): Rejected — breaks on quoted commas
 *
 * Handles: commas in quoted fields, double-quote escaping, CRLF/LF line endings, empty fields
 * Does NOT handle: multi-line quoted fields (rare in financial CSVs), custom delimiters
 */

export interface ParsedCSV {
  headers: string[]
  rows: Record<string, string>[]
  totalRows: number
  errors: string[]
}

export function parseCSV(content: string): ParsedCSV {
  const errors: string[] = []
  const lines = splitCSVLines(content)

  if (lines.length === 0) {
    return { headers: [], rows: [], totalRows: 0, errors: ['File is empty'] }
  }

  const headers = parseCSVRow(lines[0]!)
  if (headers.length === 0) {
    return { headers: [], rows: [], totalRows: 0, errors: ['No columns detected'] }
  }

  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (!line) continue

    const values = parseCSVRow(line)

    if (values.length !== headers.length) {
      errors.push(`Row ${i}: expected ${headers.length} columns, got ${values.length}`)
      // Pad or trim to match headers
      while (values.length < headers.length) values.push('')
    }

    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = values[j] ?? ''
    }
    rows.push(row)
  }

  return { headers, rows, totalRows: rows.length, errors }
}

function splitCSVLines(content: string): string[] {
  // Normalize line endings and split, respecting quoted fields with newlines
  const lines: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const char = content[i]!

    if (char === '"') {
      inQuotes = !inQuotes
      current += char
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && content[i + 1] === '\n') i++ // skip CRLF
      if (current.trim()) lines.push(current)
      current = ''
    } else {
      current += char
    }
  }

  if (current.trim()) lines.push(current)
  return lines
}

function parseCSVRow(row: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < row.length; i++) {
    const char = row[i]!

    if (inQuotes) {
      if (char === '"') {
        if (row[i + 1] === '"') {
          current += '"'
          i++ // skip escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        fields.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
  }

  fields.push(current.trim())
  return fields
}

/**
 * Parse a JSON file that should be an array of objects.
 */
export function parseJSONImport(content: string): ParsedCSV {
  const errors: string[] = []

  let data: unknown
  try {
    data = JSON.parse(content)
  } catch {
    return { headers: [], rows: [], totalRows: 0, errors: ['Invalid JSON file'] }
  }

  if (!Array.isArray(data)) {
    return { headers: [], rows: [], totalRows: 0, errors: ['JSON must be an array of objects'] }
  }

  if (data.length === 0) {
    return { headers: [], rows: [], totalRows: 0, errors: ['JSON array is empty'] }
  }

  // Extract headers from the first object
  const firstItem = data[0] as Record<string, unknown>
  if (typeof firstItem !== 'object' || firstItem === null) {
    return { headers: [], rows: [], totalRows: 0, errors: ['JSON items must be objects'] }
  }

  const headers = Object.keys(firstItem)

  const rows: Record<string, string>[] = []
  for (let i = 0; i < data.length; i++) {
    const item = data[i] as Record<string, unknown>
    if (typeof item !== 'object' || item === null) {
      errors.push(`Row ${i + 1}: not an object, skipped`)
      continue
    }
    const row: Record<string, string> = {}
    for (const key of headers) {
      const val = item[key]
      row[key] = val === null || val === undefined ? '' : String(val)
    }
    rows.push(row)
  }

  return { headers, rows, totalRows: rows.length, errors }
}
