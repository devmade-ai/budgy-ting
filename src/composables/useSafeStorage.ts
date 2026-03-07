/**
 * Requirement: Centralise localStorage access with error handling
 * Approach: Wrapper functions that catch localStorage errors (private browsing,
 *   storage full, SecurityError) and log failures to debugLog for diagnostics.
 * Alternatives:
 *   - Inline try/catch everywhere: Rejected — duplicated 6+ times across composables/views
 *   - sessionStorage fallback: Rejected — adds complexity, silent failure is acceptable
 */

import { debugLog } from '@/debug/debugLog'

/**
 * Safely read a string value from localStorage.
 * Returns null if key doesn't exist or localStorage is unavailable.
 */
export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch (e) {
    debugLog('global', 'warn', 'localStorage read failed', { key, error: String(e) })
    return null
  }
}

/**
 * Safely write a string value to localStorage.
 * Silently fails if localStorage is unavailable (logs to debugLog).
 */
export function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch (e) {
    debugLog('global', 'warn', 'localStorage write failed', { key, error: String(e) })
  }
}

/**
 * Safely remove a key from localStorage.
 */
export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (e) {
    debugLog('global', 'warn', 'localStorage remove failed', { key, error: String(e) })
  }
}
