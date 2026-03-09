/**
 * Tag suggestion composable using zero-shot classification.
 *
 * Requirement: Suggest tags for transaction descriptions using ML, off the main thread
 * Approach: Singleton composable (module-level state) that lazily creates a Web Worker
 *   running Transformers.js. Reads candidate labels from tagCache — the user's existing
 *   tag vocabulary. Only activates when tags exist (cold start: first import has no
 *   suggestions, second import onward uses established tags).
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

let worker: Worker | null = null
let requestId = 0

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

/**
 * Read all tags from the user's tag cache to use as candidate labels.
 * Returns empty array if no tags exist (first-time user).
 */
async function getCandidateLabels(): Promise<string[]> {
  try {
    const tags = await db.tagCache.toArray()
    return tags.map((t) => t.tag)
  } catch {
    return []
  }
}

// ── Public API ──

/**
 * Preload the model so it's ready when suggestions are needed.
 * Safe to call multiple times — only loads once.
 */
function preloadModel() {
  if (modelReady.value || modelLoading.value) return
  postToWorker({ type: 'load-model' })
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
    pending.set(id, { resolve: resolve as (v: TagSuggestion[] | TagSuggestion[][]) => void, reject, batch: false })
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
    pending.set(id, { resolve: resolve as (v: TagSuggestion[] | TagSuggestion[][]) => void, reject, batch: true })
    postToWorker({ type: 'suggest-batch', id, descriptions, candidateLabels })
  }).then((results) =>
    (results as TagSuggestion[][]).map((suggestions) =>
      suggestions
        .filter((s) => s.confidence >= confidenceThreshold.value)
        .slice(0, 5),
    ),
  )
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
  }
}
