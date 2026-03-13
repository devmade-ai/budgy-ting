<script setup lang="ts">
/**
 * Requirement: Step 2 of import — per-transaction review and enrichment.
 *   Replaces group-based ImportStepClassify with individual transaction controls.
 * Approach: Paginated list where each transaction has inline classification toggle,
 *   tag input with autocomplete, ML tag suggestions, and ignore checkbox.
 *   Embeddings used for fuzzy pattern matching (not grouping).
 * Alternatives:
 *   - Group-based classification: Rejected — user can't fix misclassified transactions
 *     within a group; complexity of moving between groups too high
 *   - No ML enrichment: Rejected — tag suggestions and pattern matching add real value
 *     when applied per-transaction
 */

import { ref, computed, reactive, onMounted, onUnmounted, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { formatAmount } from '@/composables/useFormat'
import { usePagination } from '@/composables/usePagination'
import { useTagInput } from '@/composables/useTagInput'
import { isIncome } from '@/types/models'
import type { RecurringPattern, RecurringVariability } from '@/types/models'
import { useTagSuggestions } from '@/ml/useTagSuggestions'
import { useEmbeddings } from '@/ml/useEmbeddings'
import TagSuggestions from '@/components/TagSuggestions.vue'
import type { TagSuggestion } from '@/ml/types'

export interface ParsedTransaction {
  date: string
  amount: number
  description: string
  originalRow: Record<string, string>
}

/** Per-transaction working state during review */
export interface ReviewTransaction extends ParsedTransaction {
  classification: 'recurring' | 'once-off'
  tags: string[]
  ignored: boolean
  variability: RecurringVariability
  /** Auto-matched existing pattern (if any) */
  matchedPatternId: string | null
  /** Hint: embeddings found this similar to an existing pattern (fuzzy match) */
  fuzzyMatchHint: string | null
}

const props = defineProps<{
  parsedRows: ParsedTransaction[]
  existingPatterns: RecurringPattern[]
  currencyLabel: string
}>()

const emit = defineEmits<{
  complete: [transactions: ReviewTransaction[]]
  back: []
}>()

const search = ref('')

const transactions = ref<ReviewTransaction[]>([])

// ── ML: tag suggestions ──
const {
  modelLoading: tagModelLoading,
  modelProgress: tagModelProgress,
  modelError: tagModelError,
  waitForModel: waitForTagModel,
  retryModel: retryTagModel,
  suggestTagsBatch,
  dispose: disposeTagSuggestions,
} = useTagSuggestions()
const txSuggestions = reactive(new Map<number, TagSuggestion[]>())

// ── ML: embeddings for fuzzy pattern matching ──
const {
  modelLoading: embeddingLoading,
  modelProgress: embeddingProgress,
  modelError: embeddingError,
  embedTexts,
  waitForModel: waitForEmbeddings,
  retryModel: retryEmbeddingModel,
  dispose: disposeEmbeddings,
} = useEmbeddings()

/** True while ML models load and initial enrichment runs */
const preparing = ref(true)

onUnmounted(() => {
  disposeTagSuggestions()
  disposeEmbeddings()
})

// ── Cosine similarity for fuzzy matching ──
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    normA += a[i]! * a[i]!
    normB += b[i]! * b[i]!
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  // Guard: zero-norm vectors (e.g. model bug) → return 0 instead of NaN
  return denom === 0 ? 0 : dot / denom
}

onMounted(async () => {
  // Build initial review transactions — exact pattern matching first
  transactions.value = props.parsedRows.map((row) => {
    let classification: 'recurring' | 'once-off' = 'once-off'
    let variability: RecurringVariability = 'fixed'
    let matchedPatternId: string | null = null
    let tags: string[] = []

    // Exact description match against existing patterns
    for (const pattern of props.existingPatterns) {
      if (!pattern.isActive || !pattern.autoAccept) continue
      if (!pattern.description?.trim()) continue
      if (pattern.description.toLowerCase() === row.description.toLowerCase()) {
        classification = 'recurring'
        matchedPatternId = pattern.id
        variability = pattern.variability ?? 'fixed'
        tags = [...pattern.tags]
        break
      }
    }

    return {
      ...row,
      classification,
      tags,
      ignored: false,
      variability,
      matchedPatternId,
      fuzzyMatchHint: null,
    }
  })

  // Heuristic: descriptions appearing 2+ times likely recurring
  const descCounts = new Map<string, number>()
  for (const tx of transactions.value) {
    const key = tx.description.toLowerCase()
    descCounts.set(key, (descCounts.get(key) ?? 0) + 1)
  }
  for (const tx of transactions.value) {
    if (!tx.matchedPatternId && (descCounts.get(tx.description.toLowerCase()) ?? 0) > 1) {
      tx.classification = 'recurring'
    }
  }

  // Wait for ML models (they started downloading during Step 1)
  const [embeddingOk, tagOk] = await Promise.all([
    waitForEmbeddings(),
    waitForTagModel(),
  ])

  // Fuzzy pattern matching via embeddings
  if (embeddingOk && props.existingPatterns.length > 0) {
    try {
      const unmatchedIndices = transactions.value
        .map((tx, i) => ({ tx, i }))
        .filter(({ tx }) => !tx.matchedPatternId)

      if (unmatchedIndices.length > 0) {
        const patternDescs = props.existingPatterns
          .filter((p) => p.isActive && p.description?.trim())
          .map((p) => p.description)

        if (patternDescs.length > 0) {
          const unmatchedDescs = unmatchedIndices.map(({ tx }) => tx.description)
          const [txEmbeddings, patternEmbeddings] = await Promise.all([
            embedTexts(unmatchedDescs),
            embedTexts(patternDescs),
          ])

          const FUZZY_THRESHOLD = 0.75
          for (let ui = 0; ui < unmatchedIndices.length; ui++) {
            const txEmb = txEmbeddings[ui]
            if (!txEmb) continue
            let bestScore = 0
            let bestPatternIdx = -1

            for (let pi = 0; pi < patternEmbeddings.length; pi++) {
              const pEmb = patternEmbeddings[pi]
              if (!pEmb) continue
              const score = cosineSimilarity(txEmb, pEmb)
              if (score > bestScore) {
                bestScore = score
                bestPatternIdx = pi
              }
            }

            if (bestScore >= FUZZY_THRESHOLD && bestPatternIdx >= 0) {
              const { i } = unmatchedIndices[ui]!
              const tx = transactions.value[i]!
              const matchedPattern = props.existingPatterns.find(
                (p) => p.isActive && p.description === patternDescs[bestPatternIdx]
              )
              if (matchedPattern) {
                tx.fuzzyMatchHint = matchedPattern.description
                // Auto-fill from pattern as suggestion (user can override)
                tx.classification = 'recurring'
                tx.matchedPatternId = matchedPattern.id
                tx.variability = matchedPattern.variability ?? 'fixed'
                if (tx.tags.length === 0) {
                  tx.tags = [...matchedPattern.tags]
                }
              }
            }
          }
        }
      }
    } catch {
      // Fuzzy matching is non-critical — proceed without it
    }
  }

  preparing.value = false

  // Request ML tag suggestions for unmatched transactions
  if (tagOk) {
    requestSuggestions()
  }
})

// ── Tag suggestions (batch) ──
async function requestSuggestions() {
  const unmatched = transactions.value
    .map((tx, i) => ({ tx, i }))
    .filter(({ tx }) => !tx.matchedPatternId && tx.tags.length === 0 && !tx.ignored)

  if (unmatched.length === 0) return

  // Deduplicate descriptions — same description gets same suggestions
  const uniqueDescs = [...new Set(unmatched.map(({ tx }) => tx.description))]

  try {
    const results = await suggestTagsBatch(uniqueDescs)
    const descToSuggestions = new Map<string, TagSuggestion[]>()
    for (let i = 0; i < uniqueDescs.length; i++) {
      if (results[i] && results[i]!.length > 0) {
        descToSuggestions.set(uniqueDescs[i]!, results[i]!)
      }
    }

    for (const { tx, i } of unmatched) {
      const suggestions = descToSuggestions.get(tx.description)
      if (suggestions) {
        txSuggestions.set(i, [...suggestions])
      }
    }
  } catch {
    // Non-critical — suggestions are a nice-to-have
  }
}

function acceptSuggestion(index: number, tag: string) {
  const tx = transactions.value[index]!
  if (!tx.tags.includes(tag)) {
    tx.tags.push(tag)
  }
  const remaining = txSuggestions.get(index)?.filter((s) => s.tag !== tag)
  if (remaining && remaining.length > 0) {
    txSuggestions.set(index, remaining)
  } else {
    txSuggestions.delete(index)
  }
}

function dismissSuggestion(index: number, tag: string) {
  const remaining = txSuggestions.get(index)?.filter((s) => s.tag !== tag)
  if (remaining && remaining.length > 0) {
    txSuggestions.set(index, remaining)
  } else {
    txSuggestions.delete(index)
  }
}

function acceptAllSuggestions(index: number) {
  const tx = transactions.value[index]!
  const suggestions = txSuggestions.get(index) ?? []
  for (const s of suggestions) {
    if (!tx.tags.includes(s.tag)) {
      tx.tags.push(s.tag)
    }
  }
  txSuggestions.delete(index)
}

// ── Manual tag input ──
const tagInputIndex = ref(-1)

/** All known tags from patterns + already-tagged transactions */
const allKnownTags = computed(() => {
  const tags = new Set<string>()
  for (const p of props.existingPatterns) {
    for (const t of p.tags) tags.add(t)
  }
  for (const tx of transactions.value) {
    for (const t of tx.tags) tags.add(t)
  }
  return [...tags].sort()
})

// Proxy ref: composable operates on whichever transaction's tags are active
const activeTagsProxy = computed({
  get: () => {
    const tx = transactions.value[tagInputIndex.value]
    return tx?.tags ?? []
  },
  set: (val: string[]) => {
    const tx = transactions.value[tagInputIndex.value]
    if (tx) tx.tags = val
  },
})

const {
  tagInput: tagInputValue,
  autocompleteResults: tagAutocompleteResults,
  showAutocomplete: tagAutocompleteVisible,
  selectedIndex: tagSelectedIndex,
  addTag: addTagToActive,
  handleKeydown: handleTagInputKeydown,
  handleBlur: handleTagBlur,
  updateAutocomplete: updateTagAutocomplete,
} = useTagInput({
  tags: activeTagsProxy,
  knownTags: allKnownTags,
})

function toggleTagInput(index: number) {
  if (tagInputIndex.value === index) {
    tagInputIndex.value = -1
    tagInputValue.value = ''
    tagAutocompleteVisible.value = false
  } else {
    tagInputIndex.value = index
    tagInputValue.value = ''
    tagAutocompleteVisible.value = false
  }
}

function addTag(index: number, tag: string) {
  // Ensure we're targeting the right transaction
  tagInputIndex.value = index
  addTagToActive(tag)
}

function removeTag(index: number, tag: string) {
  const tx = transactions.value[index]
  if (!tx) return
  tx.tags = tx.tags.filter((t) => t !== tag)
}

function handleTagKeydown(e: KeyboardEvent, index: number) {
  tagInputIndex.value = index
  handleTagInputKeydown(e)
}

// ── Classification and ignore controls ──
function setClassification(index: number, cls: 'recurring' | 'once-off') {
  transactions.value[index]!.classification = cls
}

function setVariability(index: number, v: RecurringVariability) {
  transactions.value[index]!.variability = v
}

function toggleIgnore(index: number) {
  const tx = transactions.value[index]!
  tx.ignored = !tx.ignored
  // Close tag input if ignoring
  if (tx.ignored && tagInputIndex.value === index) {
    tagInputIndex.value = -1
  }
}

// ── Filtered + paginated view ──
const filteredTransactions = computed(() => {
  if (!search.value.trim()) {
    return transactions.value.map((tx, i) => ({ tx, originalIndex: i }))
  }
  const q = search.value.trim().toLowerCase()
  return transactions.value
    .map((tx, i) => ({ tx, originalIndex: i }))
    .filter(({ tx }) => tx.description.toLowerCase().includes(q))
})

const { currentPage, totalPages, paginatedItems: paginatedTransactions, resetPage } = usePagination(filteredTransactions)

watch(search, () => { resetPage() })

// ── Summary ──
const summary = computed(() => {
  const active = transactions.value.filter((tx) => !tx.ignored)
  const ignored = transactions.value.filter((tx) => tx.ignored)
  const recurring = active.filter((tx) => tx.classification === 'recurring')
  const onceOff = active.filter((tx) => tx.classification === 'once-off')
  const autoMatched = active.filter((tx) => tx.matchedPatternId)
  return {
    total: transactions.value.length,
    active: active.length,
    ignored: ignored.length,
    recurring: recurring.length,
    onceOff: onceOff.length,
    autoMatched: autoMatched.length,
  }
})

// ── Bulk actions ──
function markAllOnceOff() {
  for (const tx of transactions.value) {
    if (!tx.matchedPatternId && !tx.ignored) {
      tx.classification = 'once-off'
    }
  }
}

function handleImport() {
  const active = transactions.value.filter((tx) => !tx.ignored)
  emit('complete', active)
}
</script>

<template>
  <div>
    <h2 class="text-lg font-semibold mb-1">Review transactions</h2>

    <!-- Loading state while ML models load -->
    <template v-if="preparing">
      <p class="text-sm text-gray-500 mb-4">
        Preparing tag suggestions and pattern matching...
      </p>
      <div class="max-w-sm mx-auto mt-8 mb-8 space-y-4">
        <!-- Embedding model (fuzzy pattern matching) -->
        <div>
          <div class="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Pattern matching</span>
            <span v-if="embeddingError" class="text-amber-500">Unavailable</span>
            <span v-else-if="!embeddingLoading && !embeddingError">Ready</span>
            <span v-else-if="embeddingProgress > 0">{{ Math.round(embeddingProgress) }}%</span>
          </div>
          <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-300"
              :class="embeddingError ? 'bg-amber-400' : 'bg-brand-500'"
              :style="{ width: embeddingError ? '100%' : embeddingLoading ? `${Math.max(5, embeddingProgress)}%` : '100%' }"
            />
          </div>
        </div>

        <!-- Tag suggestion model -->
        <div>
          <div class="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Tag suggestions</span>
            <span v-if="tagModelError" class="text-amber-500">Unavailable</span>
            <span v-else-if="!tagModelLoading && !tagModelError">Ready</span>
            <span v-else-if="tagModelProgress > 0">{{ Math.round(tagModelProgress) }}%</span>
          </div>
          <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-300"
              :class="tagModelError ? 'bg-amber-400' : 'bg-brand-500'"
              :style="{ width: tagModelError ? '100%' : tagModelLoading ? `${Math.max(5, tagModelProgress)}%` : '100%' }"
            />
          </div>
        </div>

        <p class="text-xs text-gray-400 text-center">
          <template v-if="embeddingLoading || tagModelLoading">
            Downloading models for first use — this only happens once
          </template>
          <template v-else-if="embeddingError || tagModelError">
            <span v-if="embeddingError && tagModelError">Models unavailable — continuing with basic matching</span>
            <span v-else-if="embeddingError">Pattern matching unavailable</span>
            <span v-else>Tag suggestions unavailable</span>
            <button
              class="block mx-auto mt-2 text-brand-600 hover:text-brand-700 underline"
              @click="embeddingError ? retryEmbeddingModel() : retryTagModel()"
            >
              Retry download
            </button>
          </template>
          <template v-else>
            Analysing transactions...
          </template>
        </p>
      </div>
    </template>

    <!-- Main review UI -->
    <template v-else>
      <p class="text-sm text-gray-500 mb-4">
        Review each transaction. Set as recurring or once-off, add tags, or ignore.
        {{ summary.autoMatched > 0 ? `${summary.autoMatched} auto-matched from your patterns.` : '' }}
      </p>

      <!-- Summary bar -->
      <div class="flex flex-wrap gap-3 mb-4 text-sm">
        <span class="text-blue-600">{{ summary.recurring }} recurring</span>
        <span class="text-gray-600">{{ summary.onceOff }} once-off</span>
        <span class="text-gray-400">{{ summary.ignored }} ignored</span>
        <span class="ml-auto text-gray-500">{{ summary.active }} of {{ summary.total }} will be imported</span>
      </div>

      <!-- Search + bulk actions -->
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <input
          v-model="search"
          type="text"
          placeholder="Search descriptions..."
          class="input-field py-1.5 px-3 w-48 min-h-[44px]"
        />
        <button
          class="text-xs text-gray-500 hover:text-gray-700 underline"
          @click="markAllOnceOff"
        >
          Mark all unmatched as once-off
        </button>
        <span v-if="tagModelLoading" class="text-xs text-gray-400 italic">
          Loading tag suggestions...
        </span>
      </div>

      <!-- Transaction list -->
      <div class="space-y-2 mb-4">
        <div
          v-for="{ tx, originalIndex } in paginatedTransactions"
          :key="originalIndex"
          class="border rounded-lg p-3"
          :class="{
            'border-blue-200 bg-blue-50/30': !tx.ignored && tx.classification === 'recurring',
            'border-gray-200': !tx.ignored && tx.classification === 'once-off',
            'border-gray-100 bg-gray-50 opacity-60': tx.ignored,
          }"
        >
          <div class="flex flex-wrap items-start gap-2">
            <!-- Transaction info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <p class="font-medium text-gray-900 truncate text-sm">{{ tx.description }}</p>
                <span
                  v-if="tx.matchedPatternId && !tx.fuzzyMatchHint"
                  class="text-[10px] text-blue-500 whitespace-nowrap"
                >
                  auto-matched
                </span>
                <span
                  v-else-if="tx.fuzzyMatchHint"
                  class="text-[10px] text-amber-500 whitespace-nowrap"
                  :title="`Similar to pattern: ${tx.fuzzyMatchHint}`"
                >
                  similar to "{{ tx.fuzzyMatchHint }}"
                </span>
              </div>
              <p class="text-xs text-gray-500 mt-0.5">
                {{ tx.date }}
                &middot;
                <span :class="isIncome(tx.amount) ? 'text-green-600' : 'text-red-600'">
                  {{ isIncome(tx.amount) ? '+' : '-' }}{{ currencyLabel }}{{ formatAmount(Math.abs(tx.amount)) }}
                </span>
              </p>

              <!-- Tags -->
              <div v-if="tx.tags.length > 0" class="flex flex-wrap gap-1 mt-1">
                <span
                  v-for="tag in tx.tags"
                  :key="tag"
                  class="tag-pill inline-flex items-center gap-0.5"
                >
                  {{ tag }}
                  <button
                    class="opacity-50 hover:opacity-100 ml-0.5"
                    :aria-label="`Remove ${tag}`"
                    @click="removeTag(originalIndex, tag)"
                  >
                    <X :size="10" />
                  </button>
                </span>
              </div>

              <!-- ML tag suggestions -->
              <TagSuggestions
                v-if="txSuggestions.has(originalIndex)"
                :suggestions="txSuggestions.get(originalIndex)!"
                @accept="acceptSuggestion(originalIndex, $event)"
                @dismiss="dismissSuggestion(originalIndex, $event)"
                @accept-all="acceptAllSuggestions(originalIndex)"
              />

              <!-- Manual tag input -->
              <div v-if="!tx.ignored" class="mt-1.5">
                <button
                  v-if="tagInputIndex !== originalIndex"
                  class="text-xs text-gray-400 hover:text-blue-500 transition-colors"
                  @click="toggleTagInput(originalIndex)"
                >
                  + Tag
                </button>
                <div v-else class="relative">
                  <input
                    v-model="tagInputValue"
                    type="text"
                    placeholder="Type a tag..."
                    class="input-field text-xs w-full py-1.5 px-2"
                    role="combobox"
                    :aria-expanded="tagAutocompleteVisible"
                    aria-autocomplete="list"
                    @keydown="handleTagKeydown($event, originalIndex)"
                    @blur="handleTagBlur"
                    @focus="updateTagAutocomplete"
                  />
                  <ul
                    v-if="tagAutocompleteVisible"
                    role="listbox"
                    class="absolute z-10 left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded shadow-lg max-h-32 overflow-y-auto"
                  >
                    <li
                      v-for="(result, ri) in tagAutocompleteResults"
                      :key="result"
                      role="option"
                      :aria-selected="ri === tagSelectedIndex"
                      class="text-xs px-2.5 py-1.5 hover:bg-blue-50 cursor-pointer"
                      :class="{ 'bg-blue-50': ri === tagSelectedIndex }"
                      @mousedown.prevent="addTag(originalIndex, result)"
                    >
                      {{ result }}
                    </li>
                  </ul>
                </div>
              </div>

              <!-- Variability selector (recurring only) -->
              <div
                v-if="!tx.ignored && tx.classification === 'recurring'"
                class="mt-2 pt-2 border-t border-blue-100"
              >
                <p class="text-xs text-gray-500 mb-1.5">How does the amount work?</p>
                <div class="flex gap-1">
                  <button
                    class="text-xs px-2 py-1 rounded border transition-colors"
                    :class="tx.variability === 'fixed'
                      ? 'bg-blue-100 text-blue-700 border-blue-300'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-blue-200'"
                    @click="setVariability(originalIndex, 'fixed')"
                    :title="isIncome(tx.amount)
                      ? 'Same amount every time (e.g. salary, fixed retainer)'
                      : 'Same amount every time (e.g. rent, subscriptions)'"
                  >
                    Fixed amount
                  </button>
                  <button
                    class="text-xs px-2 py-1 rounded border transition-colors"
                    :class="tx.variability === 'variable'
                      ? 'bg-blue-100 text-blue-700 border-blue-300'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-blue-200'"
                    @click="setVariability(originalIndex, 'variable')"
                    :title="isIncome(tx.amount)
                      ? 'Comes at regular times but the amount changes (e.g. commission)'
                      : 'Comes at regular times but the amount changes (e.g. electricity)'"
                  >
                    Varies each time
                  </button>
                  <button
                    class="text-xs px-2 py-1 rounded border transition-colors"
                    :class="tx.variability === 'irregular'
                      ? 'bg-blue-100 text-blue-700 border-blue-300'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-blue-200'"
                    @click="setVariability(originalIndex, 'irregular')"
                    :title="isIncome(tx.amount)
                      ? 'No fixed schedule (e.g. freelance gigs)'
                      : 'No fixed schedule, bought when needed (e.g. prepaid data)'"
                  >
                    No set schedule
                  </button>
                </div>
              </div>
            </div>

            <!-- Controls: classification + ignore -->
            <div class="flex flex-col gap-1 items-end flex-shrink-0">
              <div class="flex gap-1">
                <button
                  class="text-xs px-2.5 py-1.5 rounded border transition-colors"
                  :class="!tx.ignored && tx.classification === 'recurring'
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'"
                  :disabled="tx.ignored"
                  @click="setClassification(originalIndex, 'recurring')"
                >
                  Recurring
                </button>
                <button
                  class="text-xs px-2.5 py-1.5 rounded border transition-colors"
                  :class="!tx.ignored && tx.classification === 'once-off'
                    ? 'bg-gray-700 text-white border-gray-700'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'"
                  :disabled="tx.ignored"
                  @click="setClassification(originalIndex, 'once-off')"
                >
                  Once-off
                </button>
              </div>
              <button
                class="text-xs px-2 py-1 transition-colors"
                :class="tx.ignored
                  ? 'text-red-500 hover:text-red-700 font-medium'
                  : 'text-gray-400 hover:text-gray-600'"
                @click="toggleIgnore(originalIndex)"
              >
                {{ tx.ignored ? 'Ignored — undo' : 'Ignore' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 mb-4">
        <button
          class="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
          :disabled="currentPage === 1"
          @click="currentPage--"
        >
          Previous
        </button>
        <span class="text-xs text-gray-500">
          Page {{ currentPage }} of {{ totalPages }}
        </span>
        <button
          class="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30"
          :disabled="currentPage === totalPages"
          @click="currentPage++"
        >
          Next
        </button>
      </div>

      <!-- Actions -->
      <div class="flex justify-between">
        <button class="btn-secondary" @click="emit('back')">Back</button>
        <button
          class="btn-primary"
          :disabled="summary.active === 0"
          @click="handleImport"
        >
          Import {{ summary.active }} transaction{{ summary.active === 1 ? '' : 's' }}
        </button>
      </div>
    </template>
  </div>
</template>
