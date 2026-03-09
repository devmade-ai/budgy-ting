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
import type { WorkerResponse, TagSuggestion } from './types'
import type { WorkerRequest } from './types'

// ── Module-level singleton state ──

const modelLoading = ref(false)
const modelReady = ref(false)
const modelError = ref<string | null>(null)
const inferring = ref(false)

/** Default confidence threshold — suggestions below this are filtered out */
const confidenceThreshold = ref(0.5)

/** Model load timeout — give up if download takes too long (slow network) */
const MODEL_LOAD_TIMEOUT_MS = 30_000
/** Per-batch inference timeout — resolve with empty results rather than hanging */
const INFERENCE_TIMEOUT_MS = 10_000

let worker: Worker | null = null
let requestId = 0
const timeouts: ReturnType<typeof setTimeout>[] = []

// Pending request callbacks keyed by request id
const pending = new Map<string, {
  resolve: (value: TagSuggestion[] | TagSuggestion[][]) => void
  reject: (reason: Error) => void
  batch: boolean
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
      for (const [id, p] of pending) {
        p.reject(new Error('Worker error'))
        pending.delete(id)
      }
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
      debugLog('ml', 'success', 'Tag suggestion model ready')
      break

    case 'model-error':
      modelLoading.value = false
      modelError.value = msg.error
      debugLog('ml', 'warn', 'Tag suggestion model failed to load', { error: msg.error })
      break

    case 'model-progress':
      // Could expose this as a ref if progress UI is needed
      break

    case 'result': {
      const p = pending.get(msg.id)
      if (p) {
        pending.delete(msg.id)
        p.resolve(msg.suggestions)
      }
      if (pending.size === 0) inferring.value = false
      break
    }

    case 'batch-result': {
      const p = pending.get(msg.id)
      if (p) {
        pending.delete(msg.id)
        p.resolve(msg.results)
      }
      if (pending.size === 0) inferring.value = false
      break
    }

    case 'error': {
      const p = pending.get(msg.id)
      if (p) {
        pending.delete(msg.id)
        p.reject(new Error(msg.error))
      }
      if (pending.size === 0) inferring.value = false
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
 * Preload the model so it's ready when suggestions are needed.
 * Safe to call multiple times — only loads once.
 * Times out after 30s — on slow networks, silently gives up rather than hanging.
 */
function preloadModel() {
  if (modelReady.value || modelLoading.value) return
  postToWorker({ type: 'load-model' })

  const timeout = setTimeout(() => {
    if (modelLoading.value && !modelReady.value) {
      modelLoading.value = false
      modelError.value = 'Model load timed out'
      debugLog('ml', 'warn', 'Model load timed out after 30s')
    }
  }, MODEL_LOAD_TIMEOUT_MS)
  timeouts.push(timeout)
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
    const timeout = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        if (pending.size === 0) inferring.value = false
        debugLog('ml', 'warn', 'Single inference timed out', { description })
        resolve([])
      }
    }, INFERENCE_TIMEOUT_MS)
    timeouts.push(timeout)

    pending.set(id, {
      resolve: (v) => { clearTimeout(timeout); (resolve as (v: TagSuggestion[] | TagSuggestion[][]) => void)(v) },
      reject: (e) => { clearTimeout(timeout); reject(e) },
      batch: false,
    })
    postToWorker({ type: 'suggest', id, description, candidateLabels })
  }).then((suggestions) =>
    (suggestions as TagSuggestion[])
      .filter((s) => s.confidence >= confidenceThreshold.value)
      .slice(0, 5),
  )
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

  return new Promise<TagSuggestion[][]>((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        if (pending.size === 0) inferring.value = false
        debugLog('ml', 'warn', 'Batch inference timed out', { count: descriptions.length })
        resolve(descriptions.map(() => []))
      }
    }, INFERENCE_TIMEOUT_MS)
    timeouts.push(timeout)

    pending.set(id, {
      resolve: (v) => { clearTimeout(timeout); (resolve as (v: TagSuggestion[] | TagSuggestion[][]) => void)(v) },
      reject: (e) => { clearTimeout(timeout); reject(e) },
      batch: true,
    })
    postToWorker({ type: 'suggest-batch', id, descriptions, candidateLabels })
  }).then((results) =>
    (results as TagSuggestion[][]).map((suggestions) =>
      suggestions
        .filter((s) => s.confidence >= confidenceThreshold.value)
        .slice(0, 5),
    ),
  )
}

/**
 * Terminate the worker and free memory.
 * Call when the import wizard unmounts — the model is not needed outside imports.
 */
function dispose() {
  timeouts.forEach(clearTimeout)
  timeouts.length = 0

  // Reject any pending requests
  for (const [, p] of pending) {
    p.reject(new Error('Disposed'))
  }
  pending.clear()

  if (worker) {
    worker.terminate()
    worker = null
  }

  modelLoading.value = false
  modelReady.value = false
  modelError.value = null
  inferring.value = false

  debugLog('ml', 'info', 'Tag suggestion worker disposed')
}

export function useTagSuggestions() {
  return {
    modelLoading,
    modelReady,
    modelError,
    inferring,
    confidenceThreshold,
    preloadModel,
    suggestTags,
    suggestTagsBatch,
    dispose,
  }
}
