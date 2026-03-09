/**
 * Shared types for ML-based tag suggestion system.
 *
 * Requirement: Auto-suggest tags for imported transactions using zero-shot classification
 * Approach: Web Worker runs Transformers.js with a pre-trained NLI model. The composable
 *   passes the user's existing tags as candidate labels — no custom training needed.
 * Alternatives:
 *   - Fine-tuned MobileBERT: Rejected — requires training pipeline, 100MB model, fixed label set
 *   - Server-side inference: Rejected — local-first principle, no server dependency
 */

export interface TagSuggestion {
  tag: string
  /** Confidence score 0-1 from the zero-shot classifier */
  confidence: number
}

// ── Messages TO the worker ──

export type WorkerRequest =
  | { type: 'load-model' }
  | { type: 'suggest'; id: string; description: string; candidateLabels: string[] }
  | { type: 'suggest-batch'; id: string; descriptions: string[]; candidateLabels: string[] }

// ── Messages FROM the worker ──

export type WorkerResponse =
  | { type: 'model-loading' }
  | { type: 'model-ready' }
  | { type: 'model-error'; error: string }
  | { type: 'model-progress'; progress: number }
  | { type: 'result'; id: string; suggestions: TagSuggestion[] }
  | { type: 'batch-result'; id: string; results: TagSuggestion[][] }
  | { type: 'error'; id: string; error: string }
