<script setup lang="ts">
/**
 * Requirement: Step 2 of redesigned import — classify each transaction group as
 *   recurring / once-off / ignore. Groups transactions by description similarity.
 * Approach: Group by exact description match (case-insensitive), then merge semantically
 *   similar groups via all-MiniLM-L6-v2 embeddings. Auto-accept known recurring patterns.
 * Alternatives:
 *   - Exact match only: Previous approach — misses similar descriptions like
 *     "WOOLWORTHS SANDTON" vs "WOOLWORTHS CBD 0232"
 *   - Per-row classification: Rejected — too tedious with 100+ rows
 */

import { ref, computed, onMounted, onUnmounted, reactive } from 'vue'
import { formatAmount } from '@/composables/useFormat'
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

export interface TransactionGroup {
  description: string
  rows: ParsedTransaction[]
  totalAmount: number
  avgAmount: number
  /** User classification: recurring, once-off, or ignore (not stored) */
  classification: 'recurring' | 'once-off' | 'ignore'
  /**
   * Sub-type for recurring items:
   * - 'fixed': Same amount, regular schedule (rent, subscriptions)
   * - 'variable': Different amount each time, regular schedule (electricity bill)
   * - 'irregular': Variable amount AND timing, bought when needed (prepaid, data)
   */
  variability: RecurringVariability
  /** Auto-matched pattern (if any) */
  matchedPatternId: string | null
  /** Tags from matched pattern or user input */
  tags: string[]
}

const props = defineProps<{
  parsedRows: ParsedTransaction[]
  existingPatterns: RecurringPattern[]
  currencyLabel: string
}>()

const emit = defineEmits<{
  complete: [groups: TransactionGroup[]]
  back: []
}>()

const groups = ref<TransactionGroup[]>([])

// ── ML tag suggestions ──
// Requirement: Suggest tags for unmatched groups using zero-shot classification
// Approach: Preload model on mount, batch-request suggestions for groups without tags.
//   Candidate labels are the user's existing tags from tagCache. If no tags exist
//   (first import), no suggestions are shown — graceful degradation.
const {
  modelLoading: tagModelLoading,
  modelProgress: tagModelProgress,
  modelError: tagModelError,
  waitForModel: waitForTagModel,
  suggestTagsBatch,
} = useTagSuggestions()
const groupSuggestions = reactive(new Map<string, TagSuggestion[]>())

// ── Embedding-based fuzzy grouping ──
// Requirement: Merge semantically similar descriptions (e.g. "WOOLWORTHS SANDTON"
//   and "WOOLWORTHS CBD 0232") into one group, rather than requiring exact match.
// Approach: Always wait for the embedding model to load (with progress bar), then
//   cluster group descriptions before showing them to the user.
//   First import downloads the model (~22MB); subsequent imports load from cache (~1-2s).
// Alternatives:
//   - Skip if model not ready: Rejected — user never sees fuzzy grouping on first import
//   - Silent background merge: Rejected — groups jumping after user starts classifying
const {
  modelLoading: embeddingLoading,
  modelProgress: embeddingProgress,
  modelError: embeddingError,
  clusterTexts,
  waitForModel: waitForEmbeddings,
  dispose: disposeEmbeddings,
} = useEmbeddings()

/** True while waiting for the embedding model + building groups */
const preparingGroups = ref(true)

onUnmounted(() => {
  disposeEmbeddings()
})

async function requestSuggestions() {
  const unmatched = groups.value.filter((g) => !g.matchedPatternId && g.tags.length === 0)
  if (unmatched.length === 0) return

  try {
    const descriptions = unmatched.map((g) => g.description)
    const results = await suggestTagsBatch(descriptions)
    for (let i = 0; i < unmatched.length; i++) {
      const key = unmatched[i]!.description.toLowerCase()
      if (results[i] && results[i]!.length > 0) {
        groupSuggestions.set(key, results[i]!)
      }
    }
  } catch {
    // Non-critical — suggestions are a nice-to-have
  }
}

function acceptSuggestion(group: TransactionGroup, tag: string) {
  if (!group.tags.includes(tag)) {
    group.tags.push(tag)
  }
  // Remove from suggestions
  const key = group.description.toLowerCase()
  const remaining = groupSuggestions.get(key)?.filter((s) => s.tag !== tag)
  if (remaining && remaining.length > 0) {
    groupSuggestions.set(key, remaining)
  } else {
    groupSuggestions.delete(key)
  }
}

function dismissSuggestion(group: TransactionGroup, tag: string) {
  const key = group.description.toLowerCase()
  const remaining = groupSuggestions.get(key)?.filter((s) => s.tag !== tag)
  if (remaining && remaining.length > 0) {
    groupSuggestions.set(key, remaining)
  } else {
    groupSuggestions.delete(key)
  }
}

function acceptAllSuggestions(group: TransactionGroup) {
  const key = group.description.toLowerCase()
  const suggestions = groupSuggestions.get(key) ?? []
  for (const s of suggestions) {
    if (!group.tags.includes(s.tag)) {
      group.tags.push(s.tag)
    }
  }
  groupSuggestions.delete(key)
}

/**
 * Merge semantically similar groups using embedding-based clustering.
 * Only called if the embedding model is already loaded. Mutates groups.value.
 */
async function mergeSimilarGroups() {
  if (groups.value.length <= 1) return

  const descriptions = groups.value.map((g) => g.description)
  const clusters = await clusterTexts(descriptions, 0.75)

  // Only merge if clustering actually reduced the number of groups
  if (clusters.length >= descriptions.length) return

  const mergedGroups: TransactionGroup[] = []
  for (const cluster of clusters) {
    // Validate all indices are within bounds before accessing
    const validIndices = cluster.memberIndices.filter((idx) => idx >= 0 && idx < groups.value.length)
    if (validIndices.length === 0) continue

    if (validIndices.length === 1) {
      mergedGroups.push(groups.value[validIndices[0]!]!)
    } else {
      // Merge multiple groups into one — primary group absorbs the rest
      const primary = groups.value[validIndices[0]!]!
      for (let i = 1; i < validIndices.length; i++) {
        const other = groups.value[validIndices[i]!]!
        primary.rows.push(...other.rows)
        for (const tag of other.tags) {
          if (!primary.tags.includes(tag)) primary.tags.push(tag)
        }
        // Inherit matched pattern if primary doesn't have one
        if (!primary.matchedPatternId && other.matchedPatternId) {
          primary.matchedPatternId = other.matchedPatternId
          primary.classification = other.classification
          primary.variability = other.variability
        }
      }
      // Recalculate aggregates
      primary.totalAmount = primary.rows.reduce((s, r) => s + r.amount, 0)
      primary.avgAmount = primary.totalAmount / primary.rows.length
      // Use the cluster representative as the group description
      primary.description = cluster.representative
      mergedGroups.push(primary)
    }
  }

  groups.value = mergedGroups
  // Re-sort: auto-matched first, then by occurrence count desc
  groups.value.sort((a, b) => {
    if (a.matchedPatternId && !b.matchedPatternId) return -1
    if (!a.matchedPatternId && b.matchedPatternId) return 1
    return b.rows.length - a.rows.length
  })
}

onMounted(async () => {
  // Group by description (case-insensitive) — instant, no model needed
  const groupMap = new Map<string, ParsedTransaction[]>()
  for (const row of props.parsedRows) {
    const key = row.description.toLowerCase().trim()
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(row)
  }

  groups.value = [...groupMap.entries()].map(([, rows]) => {
    const totalAmount = rows.reduce((s, r) => s + r.amount, 0)
    const avgAmount = totalAmount / rows.length
    const description = rows[0]!.description

    // Auto-classify from existing patterns
    let classification: 'recurring' | 'once-off' | 'ignore' = 'once-off'
    let variability: RecurringVariability = 'fixed'
    let matchedPatternId: string | null = null
    let tags: string[] = []

    for (const pattern of props.existingPatterns) {
      if (!pattern.isActive || !pattern.autoAccept) continue
      if (!pattern.description?.trim()) continue
      // Match by description similarity, optionally confirmed by amount proximity
      // Requirement: Auto-classify known patterns. Description match is required;
      //   amount proximity alone is not enough (e.g. "Car purchase" -12000 ≠ "Rent" -12000)
      const descMatch = pattern.description.toLowerCase() === description.toLowerCase()
      if (descMatch) {
        classification = 'recurring'
        matchedPatternId = pattern.id
        variability = pattern.variability ?? 'fixed'
        tags = [...pattern.tags]
        break
      }
    }

    // Multi-occurrence items default to recurring suggestion
    if (!matchedPatternId && rows.length > 1) {
      classification = 'recurring'
    }

    return {
      description,
      rows,
      totalAmount,
      avgAmount,
      classification,
      variability,
      matchedPatternId,
      tags,
    }
  })

  // Sort: auto-matched first, then by occurrence count desc
  groups.value.sort((a, b) => {
    if (a.matchedPatternId && !b.matchedPatternId) return -1
    if (!a.matchedPatternId && b.matchedPatternId) return 1
    return b.rows.length - a.rows.length
  })

  // Wait for both ML models to load (they download in parallel during Step 1).
  // First import: downloads ~35MB total (progress bar shown). Subsequent: loads from cache.
  const [embeddingOk, tagOk] = await Promise.all([
    waitForEmbeddings(),
    waitForTagModel(),
  ])

  if (embeddingOk) {
    await mergeSimilarGroups()
  }

  preparingGroups.value = false

  // Both models waited for — request suggestions immediately if tag model loaded
  if (tagOk) {
    requestSuggestions()
  }
})

const summary = computed(() => {
  const recurring = groups.value.filter((g) => g.classification === 'recurring')
  const onceOff = groups.value.filter((g) => g.classification === 'once-off')
  const ignored = groups.value.filter((g) => g.classification === 'ignore')
  const autoAccepted = groups.value.filter((g) => g.matchedPatternId)
  const totalRows = groups.value.reduce((s, g) => s + g.rows.length, 0)
  const importedRows = groups.value
    .filter((g) => g.classification !== 'ignore')
    .reduce((s, g) => s + g.rows.length, 0)

  return { recurring, onceOff, ignored, autoAccepted, totalRows, importedRows }
})

function setClassification(index: number, cls: 'recurring' | 'once-off' | 'ignore') {
  groups.value[index]!.classification = cls
}

function setVariability(index: number, v: RecurringVariability) {
  const group = groups.value[index]!
  group.variability = v
  // Irregular patterns use 'irregular' frequency — override any auto-detected frequency
  // Fixed and variable patterns keep their detected frequency
}

function markRemainingOnceOff() {
  for (const g of groups.value) {
    if (!g.matchedPatternId && g.classification !== 'ignore') {
      g.classification = 'once-off'
    }
  }
}

function handleContinue() {
  emit('complete', groups.value.filter((g) => g.classification !== 'ignore'))
}
</script>

<template>
  <div>
    <h2 class="text-lg font-semibold mb-1">Classify transactions</h2>

    <!-- Loading state while ML models download and groups are prepared -->
    <template v-if="preparingGroups">
      <p class="text-sm text-gray-500 mb-4">
        Preparing smart grouping and tag suggestions...
      </p>
      <div class="max-w-sm mx-auto mt-8 mb-8 space-y-4">
        <!-- Grouping model (embeddings) -->
        <div>
          <div class="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Smart grouping</span>
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
          <template v-else-if="embeddingError && tagModelError">
            Models unavailable — continuing with basic matching
          </template>
          <template v-else>
            Grouping transactions...
          </template>
        </p>
      </div>
    </template>

    <!-- Main classify UI — shown after groups are ready -->
    <template v-else>
    <p class="text-sm text-gray-500 mb-4">
      Mark each group as recurring (repeats regularly), once-off, or ignore.
      {{ summary.autoAccepted.length > 0 ? `${summary.autoAccepted.length} auto-matched from your patterns.` : '' }}
    </p>

    <!-- Summary bar -->
    <div class="flex flex-wrap gap-3 mb-4 text-sm">
      <span class="text-blue-600">{{ summary.recurring.length }} recurring</span>
      <span class="text-gray-600">{{ summary.onceOff.length }} once-off</span>
      <span class="text-gray-400">{{ summary.ignored.length }} ignored</span>
      <span class="ml-auto text-gray-500">{{ summary.importedRows }} of {{ summary.totalRows }} rows will be imported</span>
    </div>

    <!-- Bulk action -->
    <div class="mb-4 flex items-center gap-3">
      <button class="text-xs text-gray-500 hover:text-gray-700 underline" @click="markRemainingOnceOff">
        Mark all remaining as once-off
      </button>
      <span v-if="tagModelLoading" class="text-xs text-gray-400 italic">
        Suggesting tags...
      </span>
    </div>

    <!-- Group list -->
    <div class="space-y-3 mb-6">
      <div
        v-for="(group, i) in groups"
        :key="group.description"
        class="border rounded-lg p-3"
        :class="{
          'border-blue-200 bg-blue-50/30': group.classification === 'recurring',
          'border-gray-200': group.classification === 'once-off',
          'border-gray-100 bg-gray-50 opacity-60': group.classification === 'ignore',
        }"
      >
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex-1 min-w-0">
            <p class="font-medium text-gray-900 truncate">{{ group.description }}</p>
            <p class="text-xs text-gray-500 mt-0.5">
              {{ group.rows.length }} occurrence{{ group.rows.length === 1 ? '' : 's' }}
              &middot;
              <span :class="isIncome(group.avgAmount) ? 'text-green-600' : 'text-red-600'">
                {{ isIncome(group.avgAmount) ? '+' : '-' }}{{ currencyLabel }}{{ formatAmount(Math.abs(group.avgAmount)) }}
              </span>
              avg
              <span v-if="group.matchedPatternId" class="ml-1 text-blue-500">
                (auto-matched)
              </span>
            </p>
            <div v-if="group.tags.length > 0" class="flex gap-1 mt-1">
              <span
                v-for="tag in group.tags"
                :key="tag"
                class="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5"
              >
                {{ tag }}
              </span>
            </div>
            <!-- ML tag suggestions for unmatched groups -->
            <TagSuggestions
              v-if="groupSuggestions.has(group.description.toLowerCase())"
              :suggestions="groupSuggestions.get(group.description.toLowerCase())!"
              @accept="acceptSuggestion(group, $event)"
              @dismiss="dismissSuggestion(group, $event)"
              @accept-all="acceptAllSuggestions(group)"
            />
          </div>
          <div class="flex gap-1">
            <button
              class="text-xs px-2.5 py-1.5 rounded border transition-colors"
              :class="group.classification === 'recurring'
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'"
              @click="setClassification(i, 'recurring')"
            >
              Recurring
            </button>
            <button
              class="text-xs px-2.5 py-1.5 rounded border transition-colors"
              :class="group.classification === 'once-off'
                ? 'bg-gray-700 text-white border-gray-700'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'"
              @click="setClassification(i, 'once-off')"
            >
              Once-off
            </button>
            <button
              class="text-xs px-2.5 py-1.5 rounded border transition-colors"
              :class="group.classification === 'ignore'
                ? 'bg-gray-400 text-white border-gray-400'
                : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'"
              @click="setClassification(i, 'ignore')"
            >
              Ignore
            </button>
          </div>
        </div>
        <!-- Variability sub-type selector — shown when classified as recurring
             Requirement: Let user specify how predictable this recurring expense is
             Approach: Inline pill selector below the classification buttons, only
               visible when 'recurring' is selected. Plain language labels. -->
        <div
          v-if="group.classification === 'recurring'"
          class="mt-2 pt-2 border-t border-blue-100"
        >
          <p class="text-xs text-gray-500 mb-1.5">How does the amount work?</p>
          <div class="flex gap-1">
            <button
              class="text-xs px-2 py-1 rounded border transition-colors"
              :class="group.variability === 'fixed'
                ? 'bg-blue-100 text-blue-700 border-blue-300'
                : 'bg-white text-gray-500 border-gray-200 hover:border-blue-200'"
              @click="setVariability(i, 'fixed')"
              :title="isIncome(group.avgAmount)
                ? 'Same amount every time (e.g. salary, fixed retainer)'
                : 'Same amount every time (e.g. rent, subscriptions)'"
            >
              Fixed amount
            </button>
            <button
              class="text-xs px-2 py-1 rounded border transition-colors"
              :class="group.variability === 'variable'
                ? 'bg-blue-100 text-blue-700 border-blue-300'
                : 'bg-white text-gray-500 border-gray-200 hover:border-blue-200'"
              @click="setVariability(i, 'variable')"
              :title="isIncome(group.avgAmount)
                ? 'Comes at regular times but the amount changes (e.g. commission, hourly pay)'
                : 'Comes at regular times but the amount changes (e.g. electricity bill, water)'"
            >
              Varies each time
            </button>
            <button
              class="text-xs px-2 py-1 rounded border transition-colors"
              :class="group.variability === 'irregular'
                ? 'bg-blue-100 text-blue-700 border-blue-300'
                : 'bg-white text-gray-500 border-gray-200 hover:border-blue-200'"
              @click="setVariability(i, 'irregular')"
              :title="isIncome(group.avgAmount)
                ? 'No fixed schedule, comes when it comes (e.g. freelance gigs, ad-hoc sales)'
                : 'No fixed schedule, bought when needed (e.g. prepaid electricity, data)'"
            >
              No set schedule
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-between">
      <button class="btn-secondary" @click="emit('back')">Back</button>
      <button
        class="btn-primary"
        :disabled="summary.importedRows === 0"
        @click="handleContinue"
      >
        Continue ({{ summary.importedRows }} transactions)
      </button>
    </div>
    </template>
  </div>
</template>
