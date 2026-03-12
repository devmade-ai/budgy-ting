/**
 * Requirement: Deduplicate timeout tracking utilities shared by useTagSuggestions and useEmbeddings
 * Approach: Exported factory that creates an isolated timeout tracker per composable.
 *   Each tracker has its own Set of active timeout IDs and cleanup function.
 * Alternatives:
 *   - Shared singleton Set: Rejected — each worker composable must track independently
 *   - Inline in each file: Rejected — identical 15-line pattern duplicated twice
 */

type TimeoutId = ReturnType<typeof setTimeout>

export interface TimeoutTracker {
  /** Schedule a callback and track its timeout ID for cleanup */
  trackTimeout: (fn: () => void, ms: number) => TimeoutId
  /** Cancel a tracked timeout and remove it from the active set */
  clearTrackedTimeout: (id: TimeoutId) => void
  /** Clear all active timeouts — call during dispose */
  clearAll: () => void
}

/**
 * Create an isolated timeout tracker.
 * Each ML worker composable gets its own tracker so dispose is independent.
 */
export function createTimeoutTracker(): TimeoutTracker {
  const activeTimeouts = new Set<TimeoutId>()

  function trackTimeout(fn: () => void, ms: number): TimeoutId {
    const id = setTimeout(() => {
      activeTimeouts.delete(id)
      fn()
    }, ms)
    activeTimeouts.add(id)
    return id
  }

  function clearTrackedTimeout(id: TimeoutId): void {
    clearTimeout(id)
    activeTimeouts.delete(id)
  }

  function clearAll(): void {
    for (const id of activeTimeouts) clearTimeout(id)
    activeTimeouts.clear()
  }

  return { trackTimeout, clearTrackedTimeout, clearAll }
}
