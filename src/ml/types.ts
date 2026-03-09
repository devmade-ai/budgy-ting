/**
 * Shared types for ML systems: tag suggestions (zero-shot NLI) and
 * sentence embeddings (similarity/grouping/dedup).
 *
 * Two models, two workers:
 *   1. xtremedistil zero-shot NLI → tag suggestions
 *   2. all-MiniLM-L6-v2 sentence-transformer → 384-dim embeddings for similarity
 *
 * Alternatives:
 *   - Single model for both: Rejected — NLI models can't produce meaningful embeddings,
 *     embedding models can't do zero-shot classification. Different architectures.
 *   - Server-side inference: Rejected — local-first principle, no server dependency
 */

// ════════════════════════════════════════════════════════════
// Tag Suggestion (zero-shot NLI)
// ════════════════════════════════════════════════════════════

export interface TagSuggestion {
  tag: string
  /** Confidence score 0-1 from the zero-shot classifier */
  confidence: number
}

// ── Messages TO the tag suggestion worker ──

export type WorkerRequest =
  | { type: 'load-model' }
  | { type: 'suggest'; id: string; description: string; candidateLabels: string[] }
  | { type: 'suggest-batch'; id: string; descriptions: string[]; candidateLabels: string[] }

// ── Messages FROM the tag suggestion worker ──

export type WorkerResponse =
  | { type: 'model-loading' }
  | { type: 'model-ready' }
  | { type: 'model-error'; error: string }
  | { type: 'model-progress'; progress: number }
  | { type: 'result'; id: string; suggestions: TagSuggestion[] }
  | { type: 'batch-result'; id: string; results: TagSuggestion[][] }
  | { type: 'error'; id: string; error: string }

// ════════════════════════════════════════════════════════════
// Embeddings (sentence-transformer)
// ════════════════════════════════════════════════════════════

/** 384-dimensional embedding vector from all-MiniLM-L6-v2 */
export type EmbeddingVector = Float32Array

/** Cosine similarity result between two texts */
export interface SimilarityResult {
  indexA: number
  indexB: number
  similarity: number
}

/** A cluster of similar descriptions */
export interface DescriptionCluster {
  /** Representative description (first seen in the cluster) */
  representative: string
  /** All descriptions in this cluster */
  members: string[]
  /** Indices into the original descriptions array */
  memberIndices: number[]
}

// ── Messages TO the embedding worker ──

export type EmbeddingWorkerRequest =
  | { type: 'load-model' }
  | { type: 'embed'; id: string; texts: string[] }
  | { type: 'cluster'; id: string; texts: string[]; threshold: number }

// ── Messages FROM the embedding worker ──

export type EmbeddingWorkerResponse =
  | { type: 'model-loading' }
  | { type: 'model-ready' }
  | { type: 'model-error'; error: string }
  | { type: 'model-progress'; progress: number }
  | { type: 'embed-result'; id: string; embeddings: Float32Array[] }
  | { type: 'cluster-result'; id: string; clusters: DescriptionCluster[] }
  | { type: 'error'; id: string; error: string }
