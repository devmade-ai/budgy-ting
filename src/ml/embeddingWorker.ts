/// <reference lib="webworker" />

/**
 * Web Worker for sentence embeddings using all-MiniLM-L6-v2.
 *
 * Requirement: Compute 384-dim embeddings for transaction descriptions off the main thread.
 *   Used for fuzzy grouping, pattern matching, duplicate detection, and semantic search.
 * Approach: Dynamically import Transformers.js, load sentence-transformer model, expose
 *   embed (raw vectors) and cluster (group by cosine similarity) operations.
 * Alternatives:
 *   - Share the zero-shot worker: Rejected — different model architecture, different pipeline
 *   - Main-thread inference: Rejected — blocks UI during model load (~22MB download)
 *   - ONNX Runtime directly: Rejected — Transformers.js handles tokenization + pooling
 */

import type {
  EmbeddingWorkerRequest,
  EmbeddingWorkerResponse,
  DescriptionCluster,
} from './types'

const MODEL_ID = 'Xenova/all-MiniLM-L6-v2'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedder: any = null
let loadingPromise: Promise<void> | null = null

function post(msg: EmbeddingWorkerResponse) {
  self.postMessage(msg)
}

async function loadModel() {
  if (embedder) {
    post({ type: 'model-ready' })
    return
  }

  if (loadingPromise) return loadingPromise

  post({ type: 'model-loading' })

  loadingPromise = (async () => {
    try {
      const { pipeline } = await import('@huggingface/transformers')

      embedder = await pipeline(
        'feature-extraction',
        MODEL_ID,
        {
          dtype: 'q8',
          progress_callback: (progress: Record<string, unknown>) => {
            if (typeof progress.progress === 'number') {
              post({ type: 'model-progress', progress: progress.progress })
            }
          },
        },
      )

      post({ type: 'model-ready' })
    } catch (err) {
      embedder = null
      post({ type: 'model-error', error: String(err) })
    } finally {
      loadingPromise = null
    }
  })()
}

/**
 * Compute embeddings for a batch of texts.
 * Returns one Float32Array (384-dim) per text.
 */
async function embed(id: string, texts: string[]): Promise<void> {
  if (!embedder) {
    post({ type: 'error', id, error: 'Model not loaded' })
    return
  }

  try {
    const embeddings: Float32Array[] = []

    // Process one at a time to avoid memory spikes with large batches
    for (const text of texts) {
      const output = await embedder(text, { pooling: 'mean', normalize: true })
      // output.data is a Float32Array of shape [1, 384] — extract the single embedding
      embeddings.push(new Float32Array(output.data))
    }

    post({ type: 'embed-result', id, embeddings })
  } catch (err) {
    post({ type: 'error', id, error: String(err) })
  }
}

/** Cosine similarity between two normalized vectors (dot product when L2-normalized) */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
  }
  return dot
}

/**
 * Cluster texts by cosine similarity using single-linkage greedy clustering.
 * Each text is assigned to the first cluster whose representative has similarity >= threshold.
 * If no cluster matches, a new cluster is created.
 *
 * Requirement: Group bank transaction descriptions like "WOOLWORTHS SANDTON" and
 *   "WOOLWORTHS CBD 0232" into one cluster. Brute-force pairwise is fine for
 *   typical import sizes (< 1000 unique descriptions).
 * Approach: Greedy single-pass — O(n*k) where k is number of clusters.
 * Alternatives:
 *   - HNSW approximate NN: Deferred — overkill for < 10k descriptions
 *   - Agglomerative clustering: Rejected — slower, harder to implement incrementally
 */
async function cluster(
  id: string,
  texts: string[],
  threshold: number,
): Promise<void> {
  if (!embedder) {
    post({ type: 'error', id, error: 'Model not loaded' })
    return
  }

  try {
    // Step 1: Compute all embeddings
    const embeddings: Float32Array[] = []
    for (const text of texts) {
      const output = await embedder(text, { pooling: 'mean', normalize: true })
      embeddings.push(new Float32Array(output.data))
    }

    // Step 2: Greedy clustering
    const clusters: DescriptionCluster[] = []
    const clusterEmbeddings: Float32Array[] = [] // representative embedding per cluster

    for (let i = 0; i < texts.length; i++) {
      const embedding = embeddings[i]!
      let assigned = false

      for (let c = 0; c < clusters.length; c++) {
        if (cosineSimilarity(embedding, clusterEmbeddings[c]!) >= threshold) {
          clusters[c]!.members.push(texts[i]!)
          clusters[c]!.memberIndices.push(i)
          assigned = true
          break
        }
      }

      if (!assigned) {
        clusters.push({
          representative: texts[i]!,
          members: [texts[i]!],
          memberIndices: [i],
        })
        clusterEmbeddings.push(embedding)
      }
    }

    post({ type: 'cluster-result', id, clusters })
  } catch (err) {
    post({ type: 'error', id, error: String(err) })
  }
}

self.onmessage = (event: MessageEvent<EmbeddingWorkerRequest>) => {
  const msg = event.data

  switch (msg.type) {
    case 'load-model':
      loadModel()
      break
    case 'embed':
      embed(msg.id, msg.texts)
      break
    case 'cluster':
      cluster(msg.id, msg.texts, msg.threshold)
      break
  }
}
