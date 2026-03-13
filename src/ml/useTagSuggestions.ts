/**
 * Tag suggestion composable using zero-shot classification.
 *
 * Requirement: Suggest tags for transaction descriptions using ML, off the main thread
 * Approach: Singleton composable (module-level state) that lazily creates a Web Worker
 *   running Transformers.js. Reads candidate labels from tagCache — the user's existing
 *   tag vocabulary. Falls back to default finance categories for new users.
 *   Merges tags from tagCache + patterns; uses hardcoded defaults if both are empty.
 * Alternatives:
 *   - Per-component worker: Rejected — wastes memory loading model multiple times
 *   - Main-thread inference: Rejected — blocks UI during model load (~13MB download)
 *   - Embedding similarity: Considered — zero-shot is simpler, no need to store embeddings
 */

import { ref } from 'vue'
import { db } from '@/db'
import { debugLog } from '@/debug/debugLog'
import type { WorkerResponse, WorkerRequest, TagSuggestion } from './types'
import { createTimeoutTracker } from './workerTimeout'

// ── Module-level singleton state ──

const modelLoading = ref(false)
const modelReady = ref(false)
const modelError = ref<string | null>(null)
const modelProgress = ref(0)
const inferring = ref(false)

/**
 * Default confidence threshold — suggestions below this are filtered out.
 * Lowered from 0.5 to 0.15: zero-shot on short transaction descriptions
 * (e.g. "Pick n Pay") routinely scores 0.2–0.4 for correct labels.
 * 0.5 filtered out nearly everything, leaving users with no suggestions.
 */
const confidenceThreshold = ref(0.15)

/** Model load timeout — give up if download takes too long (slow network) */
const MODEL_LOAD_TIMEOUT_MS = 30_000
/** Per-item inference timeout — single suggestions and batch base timeout */
const INFERENCE_TIMEOUT_MS = 10_000
/** Extra time per batch item beyond the base — ~300ms per description */
const BATCH_PER_ITEM_MS = 300

let worker: Worker | null = null
let requestId = 0

/** Reference count — only dispose the worker when all consumers have released */
let refCount = 0

const { trackTimeout, clearTrackedTimeout, clearAll: clearAllTimeouts } = createTimeoutTracker()

// Pending request callbacks keyed by request id.
// Separate maps for single vs batch to avoid unsafe union casts.
const pendingSingle = new Map<string, {
  resolve: (value: TagSuggestion[]) => void
  reject: (reason: Error) => void
  timeout: ReturnType<typeof setTimeout>
}>()

const pendingBatch = new Map<string, {
  resolve: (value: TagSuggestion[][]) => void
  reject: (reason: Error) => void
  timeout: ReturnType<typeof setTimeout>
}>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('./tagSuggestionWorker.ts', import.meta.url),
      { type: 'module' },
    )
    worker.onmessage = handleWorkerMessage
    worker.onerror = (err) => {
      debugLog('ml', 'error', 'Tag suggestion worker error', { error: String(err) })
      modelError.value = String(err)
      modelLoading.value = false
      // Reject all pending requests
      const workerErr = new Error('Worker error')
      for (const [, p] of pendingSingle) {
        clearTrackedTimeout(p.timeout)
        p.reject(workerErr)
      }
      pendingSingle.clear()
      for (const [, p] of pendingBatch) {
        clearTrackedTimeout(p.timeout)
        p.reject(workerErr)
      }
      pendingBatch.clear()
    }
  }
  return worker
}

function postToWorker(msg: WorkerRequest) {
  getWorker().postMessage(msg)
}

function handleWorkerMessage(event: MessageEvent<WorkerResponse>) {
  const msg = event.data

  switch (msg.type) {
    case 'model-loading':
      modelLoading.value = true
      modelError.value = null
      debugLog('ml', 'info', 'Loading tag suggestion model')
      break

    case 'model-ready':
      modelLoading.value = false
      modelReady.value = true
      modelError.value = null // Clear stale timeout error if model eventually loaded
      debugLog('ml', 'success', 'Tag suggestion model ready')
      break

    case 'model-error':
      modelLoading.value = false
      modelError.value = msg.error
      debugLog('ml', 'warn', 'Tag suggestion model failed to load', { error: msg.error })
      break

    case 'model-progress':
      modelProgress.value = msg.progress
      break

    case 'result': {
      const p = pendingSingle.get(msg.id)
      if (p) {
        clearTrackedTimeout(p.timeout)
        pendingSingle.delete(msg.id)
        p.resolve(msg.suggestions)
      }
      if (pendingSingle.size === 0 && pendingBatch.size === 0) inferring.value = false
      break
    }

    case 'batch-result': {
      const p = pendingBatch.get(msg.id)
      if (p) {
        clearTrackedTimeout(p.timeout)
        pendingBatch.delete(msg.id)
        p.resolve(msg.results)
      }
      if (pendingSingle.size === 0 && pendingBatch.size === 0) inferring.value = false
      break
    }

    case 'error': {
      // Error can come from either single or batch
      const ps = pendingSingle.get(msg.id)
      const pb = pendingBatch.get(msg.id)
      const errObj = new Error(msg.error)
      if (ps) {
        clearTrackedTimeout(ps.timeout)
        pendingSingle.delete(msg.id)
        ps.reject(errObj)
      }
      if (pb) {
        clearTrackedTimeout(pb.timeout)
        pendingBatch.delete(msg.id)
        pb.reject(errObj)
      }
      if (pendingSingle.size === 0 && pendingBatch.size === 0) inferring.value = false
      debugLog('ml', 'warn', 'Tag suggestion inference error', { error: msg.error })
      break
    }
  }
}

// Fallback labels for new users who have no tags yet (first import).
// Common personal finance categories — enough for zero-shot to score against.
const DEFAULT_LABELS = [
  'groceries', 'rent', 'utilities', 'transport', 'insurance',
  'salary', 'subscriptions', 'dining', 'entertainment', 'medical',
  'savings', 'transfer', 'fuel', 'clothing', 'education',
]

/**
 * Gather candidate labels from three sources (priority order):
 * 1. TagCache — user's existing tags (primary)
 * 2. Pattern tags — tags from RecurringPattern entries (supplementary)
 * 3. Default labels — hardcoded common categories (fallback for new users)
 */
async function getCandidateLabels(): Promise<string[]> {
  const labels = new Set<string>()

  try {
    // Source 1: User's tag cache
    const cachedTags = await db.tagCache.toArray()
    for (const t of cachedTags) labels.add(t.tag)

    // Source 2: Tags from existing patterns
    const patterns = await db.patterns.toArray()
    for (const p of patterns) {
      for (const tag of p.tags) labels.add(tag)
    }
  } catch {
    // DB read failed — fall through to defaults
  }

  // Source 3: Defaults when user has no tags yet
  if (labels.size === 0) {
    for (const label of DEFAULT_LABELS) labels.add(label)
  }

  return [...labels]
}

// ── Public API ──

/**
 * Wait for the model to finish loading. Resolves true if model is ready,
 * false if it failed or timed out. Safe to call when model is already loaded.
 */
function waitForModel(): Promise<boolean> {
  if (modelReady.value) return Promise.resolve(true)
  if (modelError.value) return Promise.resolve(false)

  return new Promise<boolean>((resolve) => {
    const check = setInterval(() => {
      if (modelReady.value) {
        clearInterval(check)
        resolve(true)
      } else if (modelError.value || (!modelLoading.value && !modelReady.value)) {
        clearInterval(check)
        resolve(false)
      }
    }, 100)

    // Safety net — don't hang forever
    trackTimeout(() => {
      clearInterval(check)
      resolve(modelReady.value)
    }, MODEL_LOAD_TIMEOUT_MS + 5_000)
  })
}

/**
 * Preload the model so it's ready when suggestions are needed.
 * Safe to call multiple times — only loads once.
 * Times out after 30s — on slow networks, silently gives up rather than hanging.
 */
function preloadModel() {
  if (modelReady.value || modelLoading.value) return
  postToWorker({ type: 'load-model' })

  trackTimeout(() => {
    if (modelLoading.value && !modelReady.value) {
      modelLoading.value = false
      modelError.value = 'Model load timed out'
      debugLog('ml', 'warn', 'Model load timed out after 30s')
    }
  }, MODEL_LOAD_TIMEOUT_MS)
}

/**
 * Suggest tags for a single description.
 * Returns suggestions above the confidence threshold, sorted by confidence desc.
 */
async function suggestTags(description: string): Promise<TagSuggestion[]> {
  const candidateLabels = await getCandidateLabels()
  if (candidateLabels.length === 0) return []
  if (!modelReady.value) return []

  const id = String(++requestId)
  inferring.value = true

  return new Promise<TagSuggestion[]>((resolve, reject) => {
    const timeout = trackTimeout(() => {
      if (pendingSingle.has(id)) {
        pendingSingle.delete(id)
        if (pendingSingle.size === 0 && pendingBatch.size === 0) inferring.value = false
        debugLog('ml', 'warn', 'Single inference timed out', { description })
        resolve([])
      }
    }, INFERENCE_TIMEOUT_MS)

    pendingSingle.set(id, {
      resolve: (v) => { clearTrackedTimeout(timeout); resolve(v) },
      reject: (e) => { clearTrackedTimeout(timeout); reject(e) },
      timeout,
    })
    postToWorker({ type: 'suggest', id, description, candidateLabels })
  }).then((suggestions) => {
    const filtered = suggestions
      .filter((s) => s.confidence >= confidenceThreshold.value)
      .slice(0, 5)

    if (suggestions.length > 0 && filtered.length === 0) {
      debugLog('ml', 'info', 'All suggestions below confidence threshold', {
        description,
        threshold: confidenceThreshold.value,
        topScore: Math.max(...suggestions.map((s) => s.confidence)),
        count: suggestions.length,
      })
    }

    return filtered
  })
}

/**
 * Suggest tags for multiple descriptions at once (import-time batch).
 * Returns one TagSuggestion[] per description, each filtered and capped.
 */
async function suggestTagsBatch(descriptions: string[]): Promise<TagSuggestion[][]> {
  const candidateLabels = await getCandidateLabels()
  if (candidateLabels.length === 0) return descriptions.map(() => [])
  if (!modelReady.value) return descriptions.map(() => [])

  const id = String(++requestId)
  inferring.value = true

  // Scale timeout with batch size — base + per-item allowance
  const batchTimeout = INFERENCE_TIMEOUT_MS + descriptions.length * BATCH_PER_ITEM_MS

  return new Promise<TagSuggestion[][]>((resolve, reject) => {
    const timeout = trackTimeout(() => {
      if (pendingBatch.has(id)) {
        pendingBatch.delete(id)
        if (pendingSingle.size === 0 && pendingBatch.size === 0) inferring.value = false
        debugLog('ml', 'warn', 'Batch inference timed out', { count: descriptions.length })
        resolve(descriptions.map(() => []))
      }
    }, batchTimeout)

    pendingBatch.set(id, {
      resolve: (v) => { clearTrackedTimeout(timeout); resolve(v) },
      reject: (e) => { clearTrackedTimeout(timeout); reject(e) },
      timeout,
    })
    postToWorker({ type: 'suggest-batch', id, descriptions, candidateLabels })
  }).then((results) =>
    results.map((suggestions) =>
      suggestions
        .filter((s) => s.confidence >= confidenceThreshold.value)
        .slice(0, 5),
    ),
  )
}

/**
 * Release one consumer reference. Only terminates the worker when the last
 * consumer releases (ref count drops to 0). This prevents the Dashboard
 * and ImportWizard from destroying each other's shared worker during
 * route transitions.
 */
function dispose() {
  refCount = Math.max(0, refCount - 1)
  if (refCount > 0) {
    debugLog('ml', 'info', `Tag suggestion consumer released (${refCount} remaining)`)
    return
  }

  clearAllTimeouts()

  // Reject any pending requests
  const disposedErr = new Error('Disposed')
  for (const [, p] of pendingSingle) p.reject(disposedErr)
  pendingSingle.clear()
  for (const [, p] of pendingBatch) p.reject(disposedErr)
  pendingBatch.clear()

  if (worker) {
    worker.terminate()
    worker = null
  }

  modelLoading.value = false
  modelReady.value = false
  modelError.value = null
  modelProgress.value = 0
  inferring.value = false

  debugLog('ml', 'info', 'Tag suggestion worker disposed')
}

export function useTagSuggestions() {
  refCount++
  return {
    modelLoading,
    modelReady,
    modelError,
    modelProgress,
    inferring,
    confidenceThreshold,
    preloadModel,
    waitForModel,
    suggestTags,
    suggestTagsBatch,
    dispose,
  }
}
