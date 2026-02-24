/**
 * In-memory debug event store with pub/sub.
 *
 * Requirement: Alpha-phase diagnostic tool for capturing runtime events
 * Approach: Capped circular buffer (200 entries) with subscriber notifications.
 *   Global error/unhandledrejection listeners installed at module load.
 *   No persistence — purely in-memory, intended to be removed post-alpha.
 * Alternatives:
 *   - Console-only logging: Rejected — non-technical users can't access devtools
 *   - Remote logging service: Rejected — local-first principle, no server dependency
 *   - Persistent storage: Rejected — debug data is ephemeral, IndexedDB overhead unnecessary
 */

export type DebugSource =
  | 'boot'
  | 'db'
  | 'pwa'
  | 'import'
  | 'engine'
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

let nextId = 1
const entries: DebugEntry[] = []
const subscribers = new Set<Subscriber>()

/**
 * Log a debug event. Entries beyond MAX_ENTRIES are discarded (oldest first).
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

  entries.push(entry)
  if (entries.length > MAX_ENTRIES) {
    entries.shift()
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
 * Get a snapshot of all current entries.
 */
export function getEntries(): readonly DebugEntry[] {
  return entries
}

/**
 * Clear all entries and reset the counter.
 */
export function clearEntries(): void {
  entries.length = 0
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

  const logs = entries.map((e) => {
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
    `--- Log (${entries.length} entries) ---`,
    ...logs,
    '',
    '=== End Report ===',
  ].join('\n')
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
