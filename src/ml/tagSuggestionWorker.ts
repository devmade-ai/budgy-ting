/// <reference lib="webworker" />

/**
 * Web Worker for ML-based tag suggestions.
 *
 * Requirement: Run zero-shot classification off the main thread to avoid UI jank
 * Approach: Dynamically import Transformers.js only when model load is requested.
 *   Uses MoritzLaurer/xtremedistil-l6-h256-zeroshot-v1.1-all-33 (~13MB quantized).
 *   Candidate labels come from the user's existing tags — no fixed label vocabulary.
 * Alternatives:
 *   - Main-thread inference: Rejected — blocks UI during model load and inference
 *   - ONNX Runtime directly: Rejected — Transformers.js wraps it with zero-shot pipeline
 */

import type { WorkerRequest, WorkerResponse, TagSuggestion } from './types'

const MODEL_ID = 'MoritzLaurer/xtremedistil-l6-h256-zeroshot-v1.1-all-33'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let classifier: any = null

function post(msg: WorkerResponse) {
  self.postMessage(msg)
}

async function loadModel() {
  if (classifier) {
    post({ type: 'model-ready' })
    return
  }

  post({ type: 'model-loading' })

  try {
    const { pipeline } = await import('@huggingface/transformers')

    classifier = await pipeline(
      'zero-shot-classification',
      MODEL_ID,
      {
        dtype: 'q8',
        // ProgressInfo is a union type — only 'progress' events have .progress
        progress_callback: (progress: Record<string, unknown>) => {
          if (typeof progress.progress === 'number') {
            post({ type: 'model-progress', progress: progress.progress })
          }
        },
      },
    )

    post({ type: 'model-ready' })
  } catch (err) {
    classifier = null
    post({ type: 'model-error', error: String(err) })
  }
}

async function suggest(
  id: string,
  description: string,
  candidateLabels: string[],
): Promise<void> {
  if (!classifier) {
    post({ type: 'error', id, error: 'Model not loaded' })
    return
  }

  try {
    const result = await classifier(description, candidateLabels, {
      multi_label: true,
    })

    // Transformers.js returns { labels: string[], scores: number[] }
    const suggestions: TagSuggestion[] = result.labels.map(
      (label: string, i: number) => ({
        tag: label,
        confidence: result.scores[i] as number,
      }),
    )

    post({ type: 'result', id, suggestions })
  } catch (err) {
    post({ type: 'error', id, error: String(err) })
  }
}

async function suggestBatch(
  id: string,
  descriptions: string[],
  candidateLabels: string[],
): Promise<void> {
  if (!classifier) {
    post({ type: 'error', id, error: 'Model not loaded' })
    return
  }

  try {
    // Zero-shot NLI models process one premise at a time against all labels.
    // Process sequentially to avoid memory spikes.
    const results: TagSuggestion[][] = []

    for (const desc of descriptions) {
      const result = await classifier(desc, candidateLabels, {
        multi_label: true,
      })

      results.push(
        result.labels.map((label: string, i: number) => ({
          tag: label,
          confidence: result.scores[i] as number,
        })),
      )
    }

    post({ type: 'batch-result', id, results })
  } catch (err) {
    post({ type: 'error', id, error: String(err) })
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data

  switch (msg.type) {
    case 'load-model':
      loadModel()
      break
    case 'suggest':
      suggest(msg.id, msg.description, msg.candidateLabels)
      break
    case 'suggest-batch':
      suggestBatch(msg.id, msg.descriptions, msg.candidateLabels)
      break
  }
}
