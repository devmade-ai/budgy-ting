/**
 * In-memory debug event store with pub/sub.
 *
 * Requirement: Alpha-phase diagnostic tool for capturing runtime events
 * Approach: Fixed-size circular buffer (200 entries) with head/tail pointers for
 *   O(1) insertion and eviction. Subscriber notifications on each write.
 *   Global error/unhandledrejection listeners installed at module load.
 *   No persistence — purely in-memory, intended to be removed post-alpha.
 * Alternatives:
 *   - Console-only logging: Rejected — non-technical users can't access devtools
 *   - Remote logging service: Rejected — local-first principle, no server dependency
 *   - Persistent storage: Rejected — debug data is ephemeral, IndexedDB overhead unnecessary
 *   - Array + shift(): Previous approach — O(n) eviction on every write when full
 */

export type DebugSource =
  | 'boot'
  | 'db'
  | 'pwa'
  | 'import'
  | 'engine'
  | 'ml'
  | 'global'

export type DebugSeverity = 'info' | 'success' | 'warn' | 'error'

export interface DebugEntry {
  id: number
  timestamp: string
  source: DebugSource
  severity: DebugSeverity
  event: string
  details?: Record<string, unknown>
}

type Subscriber = (entry: DebugEntry) => void

const MAX_ENTRIES = 200

// Circular buffer: fixed-size array with head (oldest) and count.
// head advances when buffer is full and a new entry overwrites the oldest.
// O(1) insertion vs O(n) array.shift().
let nextId = 1
const buffer: (DebugEntry | null)[] = new Array(MAX_ENTRIES).fill(null)
let head = 0
let count = 0
const subscribers = new Set<Subscriber>()

/**
 * Log a debug event. When buffer is full, oldest entry is overwritten (O(1)).
 */
export function debugLog(
  source: DebugSource,
  severity: DebugSeverity,
  event: string,
  details?: Record<string, unknown>,
): void {
  const entry: DebugEntry = {
    id: nextId++,
    timestamp: new Date().toISOString(),
    source,
    severity,
    event,
    details,
  }

  const writeIndex = (head + count) % MAX_ENTRIES
  buffer[writeIndex] = entry

  if (count < MAX_ENTRIES) {
    count++
  } else {
    // Buffer full — advance head to discard oldest
    head = (head + 1) % MAX_ENTRIES
  }

  for (const sub of subscribers) {
    try {
      sub(entry)
    } catch {
      // Subscriber errors must not break the log system
    }
  }
}

/**
 * Subscribe to new debug entries. Returns an unsubscribe function.
 */
export function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

/**
 * Get a snapshot of all current entries in chronological order.
 */
export function getEntries(): readonly DebugEntry[] {
  const result: DebugEntry[] = []
  for (let i = 0; i < count; i++) {
    const entry = buffer[(head + i) % MAX_ENTRIES]
    if (entry) result.push(entry)
  }
  return result
}

/**
 * Current number of entries in the buffer.
 */
export function getEntryCount(): number {
  return count
}

/**
 * Clear all entries and reset the counter.
 */
export function clearEntries(): void {
  buffer.fill(null)
  head = 0
  count = 0
  nextId = 1
}

/**
 * Generate a full debug report string for clipboard export.
 */
export function generateReport(): string {
  const env = [
    `URL: ${window.location.href}`,
    `User Agent: ${navigator.userAgent}`,
    `Screen: ${screen.width}x${screen.height}`,
    `Viewport: ${window.innerWidth}x${window.innerHeight}`,
    `Online: ${navigator.onLine}`,
    `Protocol: ${window.location.protocol}`,
    `Standalone: ${window.matchMedia('(display-mode: standalone)').matches}`,
    `Service Worker: ${'serviceWorker' in navigator}`,
    `IndexedDB: ${'indexedDB' in window}`,
    `Timestamp: ${new Date().toISOString()}`,
  ]

  const allEntries = getEntries()
  const logs = allEntries.map((e) => {
    const time = e.timestamp.slice(11, 23) // HH:MM:SS.mmm
    const detail = e.details ? ` | ${JSON.stringify(e.details)}` : ''
    return `[${time}] [${e.source}] [${e.severity}] ${e.event}${detail}`
  })

  return [
    '=== budgy-ting Debug Report ===',
    '',
    '--- Environment ---',
    ...env,
    '',
    `--- Log (${allEntries.length} entries) ---`,
    ...logs,
    '',
    '=== End Report ===',
  ].join('\n')
}

// ── Console interception (installed once at module load) ──
// Requirement: Capture console.error and console.warn into the debug buffer
//   so they appear in the debug pill without needing devtools.
// Approach: Patch console methods at module load, preserving originals for
//   pass-through. Only intercept error and warn — info/log are too noisy.
// Alternatives:
//   - Only capture window.error/unhandledrejection: Rejected — misses explicit
//     console.error() calls from libraries and app code
//   - Intercept console.log too: Rejected — too noisy, floods the buffer

let _interceptingConsole = false

if (typeof window !== 'undefined') {
  const originalError = console.error
  const originalWarn = console.warn

  console.error = (...args: unknown[]) => {
    originalError.apply(console, args)
    // Guard: prevent infinite recursion if debugLog itself triggers console.error
    if (_interceptingConsole) return
    _interceptingConsole = true
    try {
      debugLog('global', 'error', 'console.error', {
        message: args.map(a => typeof a === 'string' ? a : String(a)).join(' '),
      })
    } finally {
      _interceptingConsole = false
    }
  }

  console.warn = (...args: unknown[]) => {
    originalWarn.apply(console, args)
    if (_interceptingConsole) return
    _interceptingConsole = true
    try {
      debugLog('global', 'warn', 'console.warn', {
        message: args.map(a => typeof a === 'string' ? a : String(a)).join(' '),
      })
    } finally {
      _interceptingConsole = false
    }
  }
}

// ── Global error listeners (installed once at module load) ──

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    debugLog('global', 'error', 'Uncaught error', {
      message: event.message,
      filename: event.filename,
      line: event.lineno,
      col: event.colno,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    debugLog('global', 'error', 'Unhandled promise rejection', {
      reason: String(event.reason),
    })
  })
}
