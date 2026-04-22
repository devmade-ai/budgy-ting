/**
 * In-memory debug event store with pub/sub.
 *
 * Requirement: Alpha-phase diagnostic tool for capturing runtime events
 * Approach: Circular buffer (200 entries, O(1) insert) with subscriber notifications.
 *   Console.error/warn interception and global error/unhandledrejection listeners
 *   installed at module load. No persistence — purely in-memory, removed post-alpha.
 * Alternatives:
 *   - Console-only logging: Rejected — non-technical users can't access devtools
 *   - Remote logging service: Rejected — local-first principle, no server dependency
 *   - Persistent storage: Rejected — debug data is ephemeral, IndexedDB overhead unnecessary
 *   - Array.shift() eviction: Rejected — O(n) on every insert when buffer full.
 *     Circular buffer with head/count is O(1).
 * Reference: glow-props docs/implementations/DEBUG_SYSTEM.md
 */

// Typed sources with string fallback — preserves IDE autocomplete while allowing
// ad-hoc project-specific sources without modifying the type definition.
export type DebugSource =
  | 'boot'
  | 'db'
  | 'pwa'
  | 'import'
  | 'engine'
  | 'ml'
  | 'global'
  | (string & {})

export type DebugSeverity = 'info' | 'success' | 'warn' | 'error'

export interface DebugEntry {
  id: number
  timestamp: number
  source: DebugSource
  severity: DebugSeverity
  event: string
  details?: Record<string, unknown>
}

type Subscriber = (entry: DebugEntry) => void

const MAX_ENTRIES = 200

// Circular buffer: O(1) insert via head/count pointers, no Array.shift().
// head = next write position, count = number of valid entries.
const buffer: (DebugEntry | null)[] = new Array(MAX_ENTRIES).fill(null)
let head = 0
let count = 0
let nextId = 1

const subscribers = new Set<Subscriber>()

/**
 * Log a debug event. Oldest entries evicted when buffer is full (O(1)).
 */
export function debugLog(
  source: DebugSource,
  severity: DebugSeverity,
  event: string,
  details?: Record<string, unknown>,
): void {
  const entry: DebugEntry = {
    id: nextId++,
    timestamp: Date.now(),
    source,
    severity,
    event,
    details,
  }

  buffer[head] = entry
  head = (head + 1) % MAX_ENTRIES
  if (count < MAX_ENTRIES) count++

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
 * Replays all existing entries to the new subscriber immediately,
 * so subscribers don't miss events logged before they subscribed.
 */
export function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn)
  // Replay existing entries to new subscriber
  const existing = getEntries()
  for (const entry of existing) {
    try {
      fn(entry)
    } catch {
      // Subscriber errors must not break the log system
    }
  }
  return () => subscribers.delete(fn)
}

/**
 * Get a snapshot of all current entries in chronological order.
 */
export function getEntries(): DebugEntry[] {
  if (count === 0) return []
  const result: DebugEntry[] = []
  const start = count < MAX_ENTRIES ? 0 : head
  for (let i = 0; i < count; i++) {
    result.push(buffer[(start + i) % MAX_ENTRIES]!)
  }
  return result
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
 * URL query params redacted to prevent token/UTM leaking in shared reports.
 */
export function generateReport(): string {
  const all = getEntries()
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true

  const env = [
    `URL: ${window.location.origin}${window.location.pathname}${window.location.search ? '?[redacted]' : ''}`,
    `User Agent: ${navigator.userAgent}`,
    `Screen: ${screen.width}x${screen.height}`,
    `Viewport: ${window.innerWidth}x${window.innerHeight}`,
    `Online: ${navigator.onLine}`,
    `Protocol: ${window.location.protocol}`,
    `Standalone: ${standalone}`,
    `Service Worker: ${'serviceWorker' in navigator}`,
    `IndexedDB: ${'indexedDB' in window}`,
    `Timestamp: ${new Date().toISOString()}`,
  ]

  const logs = all.map((e) => {
    const t = new Date(e.timestamp)
    const ts = `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}:${t.getSeconds().toString().padStart(2, '0')}.${t.getMilliseconds().toString().padStart(3, '0')}`
    const detail = e.details ? ` | ${JSON.stringify(e.details)}` : ''
    return `[${ts}] [${e.severity.toUpperCase()}] [${e.source}] ${e.event}${detail}`
  })

  return [
    '=== Farlume Debug Report ===',
    '',
    '--- Environment ---',
    ...env,
    '',
    `--- Log (${all.length} entries) ---`,
    ...logs,
    '',
    '=== End Report ===',
  ].join('\n')
}

// ── Console interception ──
// Captures Vue warnings, library errors, and any other console output automatically.
// Must run at module load time to catch early console calls.
// HMR guard prevents duplicate patching during development.

// Module-scoped so dispose() can restore the originals.
let originalError: typeof console.error | undefined
let originalWarn: typeof console.warn | undefined

if (typeof window !== 'undefined' && !(window as any).__debugConsolePatched) {
  (window as any).__debugConsolePatched = true

  originalError = console.error
  originalWarn = console.warn

  // Re-entrancy guard: if a subscriber error triggers console.error before
  // being caught, the patched console.error would call debugLog again, which
  // notifies subscribers, which may throw again → infinite loop.
  let intercepting = false

  console.error = (...args: unknown[]) => {
    originalError!.apply(console, args)
    if (intercepting) return
    intercepting = true
    debugLog('global', 'error', args.map(String).join(' '))
    intercepting = false
  }

  console.warn = (...args: unknown[]) => {
    originalWarn!.apply(console, args)
    if (intercepting) return
    intercepting = true
    debugLog('global', 'warn', args.map(String).join(' '))
    intercepting = false
  }
}

// ── Global error listeners (installed once at module load) ──
// HMR guard prevents duplicate listeners during development.

// Named handlers so removeEventListener can reach them on HMR dispose.
function handleGlobalError(event: ErrorEvent) {
  debugLog('global', 'error', event.message || 'Unknown error', {
    filename: event.filename,
    line: event.lineno,
    col: event.colno,
  })
}

function handleUnhandledRejection(event: PromiseRejectionEvent) {
  debugLog('global', 'error', `Unhandled rejection: ${String(event.reason)}`)
}

if (typeof window !== 'undefined' && !(window as any).__debugLogListenersAttached) {
  (window as any).__debugLogListenersAttached = true
  // Signal to inline pill's error listeners (index.html) that debugLog.ts is active.
  // They check this flag and skip capture to prevent duplicate entries.
  ;(window as any).__debugLogReady = true

  window.addEventListener('error', handleGlobalError)
  window.addEventListener('unhandledrejection', handleUnhandledRejection)
}

// Requirement: HMR-safe teardown of module-level console patches and listeners
// Approach: import.meta.hot.dispose() restores originals and removes listeners.
//   Without this, every HMR cycle leaves the patched console pointing at the
//   orphaned old module's debugLog (wrong buffer, stale subscribers) while the
//   new module's HMR guard skips re-patching — silently dropping events.
// Alternatives:
//   - Re-patch on every load: Rejected — must first restore, requires the same work
//   - Ignore (prod-only concern): Rejected — debugging in dev is exactly when you
//     need reliable console capture
// Reference: glow-props docs/implementations/TIMER_LEAKS.md §5
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (typeof window === 'undefined') return
    if (originalError) console.error = originalError
    if (originalWarn) console.warn = originalWarn
    window.removeEventListener('error', handleGlobalError)
    window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    ;(window as any).__debugConsolePatched = false
    ;(window as any).__debugLogListenersAttached = false
    ;(window as any).__debugLogReady = false
  })
}
