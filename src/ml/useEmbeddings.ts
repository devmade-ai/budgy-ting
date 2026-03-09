/**
 * Embedding composable using all-MiniLM-L6-v2 sentence-transformer.
 *
 * Requirement: Compute sentence embeddings for fuzzy grouping, pattern matching,
 *   duplicate detection, and semantic search on transaction descriptions.
 * Approach: Singleton composable (module-level state) with a dedicated Web Worker.
 *   Same ref-counting pattern as useTagSuggestions — shared across routes,
 *   only disposes when last consumer unmounts.
 * Alternatives:
 *   - Share worker with tag suggestions: Rejected — different model, different pipeline
 *   - Per-component worker: Rejected — wastes memory loading model multiple times
 *   - Main-thread inference: Rejected — blocks UI during model load (~22MB download)
 */

import { ref } from 'vue'
import { debugLog } from '@/debug/debugLog'
import type {
  EmbeddingWorkerRequest,
  EmbeddingWorkerResponse,
  DescriptionCluster,
} from './types'

// ── Module-level singleton state ──

const modelLoading = ref(false)
const modelReady = ref(false)
const modelError = ref<string | null>(null)
const modelProgress = ref(0)
const computing = ref(false)

const MODEL_LOAD_TIMEOUT_MS = 60_000 // Embedding model is ~22MB, allow more time
const EMBED_TIMEOUT_MS = 15_000
const EMBED_PER_ITEM_MS = 200 // ~200ms per description for embedding
const CLUSTER_TIMEOUT_MS = 15_000
const CLUSTER_PER_ITEM_MS = 250

let worker: Worker | null = null
let requestId = 0
let refCount = 0

const activeTimeouts = new Set<ReturnType<typeof setTimeout>>()

function trackTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
  const id = setTimeout(() => {
    activeTimeouts.delete(id)
    fn()
  }, ms)
  activeTimeouts.add(id)
  return id
}

function clearTrackedTimeout(id: ReturnType<typeof setTimeout>) {
  clearTimeout(id)
  activeTimeouts.delete(id)
}

// Separate pending maps for typed responses
const pendingEmbed = new Map<string, {
  resolve: (value: Float32Array[]) => void
  reject: (reason: Error) => void
  timeout: ReturnType<typeof setTimeout>
}>()

const pendingCluster = new Map<string, {
  resolve: (value: DescriptionCluster[]) => void
  reject: (reason: Error) => void
  timeout: ReturnType<typeof setTimeout>
}>()

function hasPending(): boolean {
  return pendingEmbed.size > 0 || pendingCluster.size > 0
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('./embeddingWorker.ts', import.meta.url),
      { type: 'module' },
    )
    worker.onmessage = handleWorkerMessage
    worker.onerror = (err) => {
      debugLog('ml', 'error', 'Embedding worker error', { error: String(err) })
      modelError.value = String(err)
      modelLoading.value = false
      const workerErr = new Error('Worker error')
      for (const [, p] of pendingEmbed) {
        clearTrackedTimeout(p.timeout)
        p.reject(workerErr)
      }
      pendingEmbed.clear()
      for (const [, p] of pendingCluster) {
        clearTrackedTimeout(p.timeout)
        p.reject(workerErr)
      }
      pendingCluster.clear()
    }
  }
  return worker
}

function postToWorker(msg: EmbeddingWorkerRequest) {
  getWorker().postMessage(msg)
}

function handleWorkerMessage(event: MessageEvent<EmbeddingWorkerResponse>) {
  const msg = event.data

  switch (msg.type) {
    case 'model-loading':
      modelLoading.value = true
      modelError.value = null
      debugLog('ml', 'info', 'Loading embedding model')
      break

    case 'model-ready':
      modelLoading.value = false
      modelReady.value = true
      modelError.value = null
      debugLog('ml', 'success', 'Embedding model ready')
      break

    case 'model-error':
      modelLoading.value = false
      modelError.value = msg.error
      debugLog('ml', 'warn', 'Embedding model failed to load', { error: msg.error })
      break

    case 'model-progress':
      modelProgress.value = msg.progress
      break

    case 'embed-result': {
      const p = pendingEmbed.get(msg.id)
      if (p) {
        clearTrackedTimeout(p.timeout)
        pendingEmbed.delete(msg.id)
        p.resolve(msg.embeddings)
      }
      if (!hasPending()) computing.value = false
      break
    }

    case 'cluster-result': {
      const p = pendingCluster.get(msg.id)
      if (p) {
        clearTrackedTimeout(p.timeout)
        pendingCluster.delete(msg.id)
        p.resolve(msg.clusters)
      }
      if (!hasPending()) computing.value = false
      break
    }

    case 'error': {
      const pe = pendingEmbed.get(msg.id)
      const pc = pendingCluster.get(msg.id)
      const errObj = new Error(msg.error)
      if (pe) {
        clearTrackedTimeout(pe.timeout)
        pendingEmbed.delete(msg.id)
        pe.reject(errObj)
      }
      if (pc) {
        clearTrackedTimeout(pc.timeout)
        pendingCluster.delete(msg.id)
        pc.reject(errObj)
      }
      if (!hasPending()) computing.value = false
      debugLog('ml', 'warn', 'Embedding inference error', { error: msg.error })
      break
    }
  }
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

    // Safety net — don't hang forever (tied to MODEL_LOAD_TIMEOUT_MS + buffer)
    trackTimeout(() => {
      clearInterval(check)
      resolve(modelReady.value)
    }, MODEL_LOAD_TIMEOUT_MS + 5_000)
  })
}

function preloadModel() {
  if (modelReady.value || modelLoading.value) return
  postToWorker({ type: 'load-model' })

  trackTimeout(() => {
    if (modelLoading.value && !modelReady.value) {
      modelLoading.value = false
      modelError.value = 'Embedding model load timed out'
      debugLog('ml', 'warn', 'Embedding model load timed out after 60s')
    }
  }, MODEL_LOAD_TIMEOUT_MS)
}

/**
 * Compute embeddings for a batch of texts.
 * Returns one Float32Array (384-dim) per text.
 */
async function embedTexts(texts: string[]): Promise<Float32Array[]> {
  if (!modelReady.value) return []
  if (texts.length === 0) return []

  const id = String(++requestId)
  computing.value = true
  const timeoutMs = EMBED_TIMEOUT_MS + texts.length * EMBED_PER_ITEM_MS

  return new Promise<Float32Array[]>((resolve, reject) => {
    const timeout = trackTimeout(() => {
      if (pendingEmbed.has(id)) {
        pendingEmbed.delete(id)
        if (!hasPending()) computing.value = false
        debugLog('ml', 'warn', 'Embed timed out', { count: texts.length })
        resolve([])
      }
    }, timeoutMs)

    pendingEmbed.set(id, {
      resolve: (v) => { clearTrackedTimeout(timeout); resolve(v) },
      reject: (e) => { clearTrackedTimeout(timeout); reject(e) },
      timeout,
    })
    postToWorker({ type: 'embed', id, texts })
  })
}

/**
 * Cluster texts by semantic similarity. Returns groups of similar descriptions.
 * @param texts — descriptions to cluster
 * @param threshold — cosine similarity threshold (0-1). Default 0.75.
 *   Higher = stricter (fewer, tighter clusters). Lower = looser (more merging).
 *   0.75 works well for bank transaction descriptions like "WOOLWORTHS SANDTON"
 *   vs "WOOLWORTHS CBD 0232".
 */
async function clusterTexts(
  texts: string[],
  threshold = 0.75,
): Promise<DescriptionCluster[]> {
  if (!modelReady.value) return texts.map((t, i) => ({
    representative: t,
    members: [t],
    memberIndices: [i],
  }))
  if (texts.length === 0) return []

  const id = String(++requestId)
  computing.value = true
  const timeoutMs = CLUSTER_TIMEOUT_MS + texts.length * CLUSTER_PER_ITEM_MS

  return new Promise<DescriptionCluster[]>((resolve, reject) => {
    const timeout = trackTimeout(() => {
      if (pendingCluster.has(id)) {
        pendingCluster.delete(id)
        if (!hasPending()) computing.value = false
        debugLog('ml', 'warn', 'Cluster timed out', { count: texts.length })
        // Fallback: each text is its own cluster
        resolve(texts.map((t, i) => ({
          representative: t,
          members: [t],
          memberIndices: [i],
        })))
      }
    }, timeoutMs)

    pendingCluster.set(id, {
      resolve: (v) => { clearTrackedTimeout(timeout); resolve(v) },
      reject: (e) => { clearTrackedTimeout(timeout); reject(e) },
      timeout,
    })
    postToWorker({ type: 'cluster', id, texts, threshold })
  })
}

function dispose() {
  refCount = Math.max(0, refCount - 1)
  if (refCount > 0) {
    debugLog('ml', 'info', `Embedding consumer released (${refCount} remaining)`)
    return
  }

  for (const id of activeTimeouts) clearTimeout(id)
  activeTimeouts.clear()

  const disposedErr = new Error('Disposed')
  for (const [, p] of pendingEmbed) p.reject(disposedErr)
  pendingEmbed.clear()
  for (const [, p] of pendingCluster) p.reject(disposedErr)
  pendingCluster.clear()

  if (worker) {
    worker.terminate()
    worker = null
  }

  modelLoading.value = false
  modelReady.value = false
  modelError.value = null
  modelProgress.value = 0
  computing.value = false

  debugLog('ml', 'info', 'Embedding worker disposed')
}

export function useEmbeddings() {
  refCount++
  return {
    modelLoading,
    modelReady,
    modelError,
    modelProgress,
    computing,
    preloadModel,
    waitForModel,
    embedTexts,
    clusterTexts,
    dispose,
  }
}
