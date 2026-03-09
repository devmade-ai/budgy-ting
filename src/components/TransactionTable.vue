<script setup lang="ts">
/**
 * Requirement: Paginated, filterable transaction display with inline tag editing
 * Approach: Table on desktop, stacked cards on mobile. Client-side filtering + pagination.
 *   Click a row to expand an inline tag editor with ML suggestions.
 * Alternatives:
 *   - Table-only with horizontal scroll: Rejected — cards are much easier to scan on mobile
 *   - Virtual scrolling (vue-virtual-scroller): Deferred — paginate first, upgrade later
 *   - Server-side pagination: N/A — local-first IndexedDB app
 *   - Modal for tag editing: Rejected — inline expansion is faster for quick edits
 */

import { ref, computed, watch } from 'vue'
import { formatAmount } from '@/composables/useFormat'
import { isIncome } from '@/types/models'
import TransactionTagEditor from '@/components/TransactionTagEditor.vue'
import type { Transaction } from '@/types/models'
import type { TagSuggestion } from '@/ml/types'

const props = defineProps<{
  transactions: Transaction[]
  currencyLabel: string
  /** Per-transaction ML suggestions, keyed by transaction id */
  tagSuggestions?: Map<string, TagSuggestion[]>
  /** Whether ML model is currently inferring */
  suggestionsLoading?: boolean
}>()

const emit = defineEmits<{
  'update-transaction': [id: string, fields: Partial<Transaction>]
  /** Emitted when a row is expanded — parent can trigger ML suggestion for this transaction */
  'request-suggestions': [id: string, description: string]
}>()

const PAGE_SIZE = 25

const search = ref('')
const filterTag = ref('')
const filterClassification = ref<'' | 'recurring' | 'once-off'>('')
const currentPage = ref(1)

/** Currently expanded row for tag editing — null = all collapsed */
const expandedId = ref<string | null>(null)

// Collect all unique tags for filter dropdown
const allTags = computed(() => {
  const tags = new Set<string>()
  for (const t of props.transactions) {
    for (const tag of t.tags) tags.add(tag)
  }
  return [...tags].sort()
})

const filtered = computed(() => {
  let result = [...props.transactions]

  // Search by description
  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter((t) => t.description.toLowerCase().includes(q))
  }

  // Filter by tag
  if (filterTag.value) {
    result = result.filter((t) => t.tags.includes(filterTag.value))
  }

  // Filter by classification
  if (filterClassification.value) {
    result = result.filter((t) => t.classification === filterClassification.value)
  }

  // Sort by date descending (newest first)
  result.sort((a, b) => b.date.localeCompare(a.date))

  return result
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))

const paginatedRows = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filtered.value.slice(start, start + PAGE_SIZE)
})

// Reset page when filters change
watch([search, filterTag, filterClassification], () => {
  currentPage.value = 1
})

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' })
}

function toggleRow(txn: Transaction) {
  if (expandedId.value === txn.id) {
    expandedId.value = null
  } else {
    expandedId.value = txn.id
    emit('request-suggestions', txn.id, txn.description)
  }
}

function handleTransactionUpdate(id: string, fields: Partial<Transaction>) {
  emit('update-transaction', id, fields)
}

function getSuggestions(id: string): TagSuggestion[] {
  return props.tagSuggestions?.get(id) ?? []
}
</script>

<template>
  <div>
    <!-- Filters — touch-friendly input sizing (min-h-44px) -->
    <div v-if="transactions.length > 5" class="flex flex-wrap gap-2 mb-4">
      <input
        v-model="search"
        type="text"
        placeholder="Search transactions..."
        class="input text-sm flex-1 min-w-48 min-h-[44px]"
      />
      <select
        v-model="filterTag"
        class="input text-sm w-auto min-h-[44px]"
      >
        <option value="">All tags</option>
        <option v-for="tag in allTags" :key="tag" :value="tag">{{ tag }}</option>
      </select>
      <select
        v-model="filterClassification"
        class="input text-sm w-auto min-h-[44px]"
      >
        <option value="">All types</option>
        <option value="recurring">Recurring</option>
        <option value="once-off">Once-off</option>
      </select>
    </div>

    <!-- Mobile card layout (< sm breakpoint) -->
    <div class="sm:hidden space-y-2">
      <div
        v-for="txn in paginatedRows"
        :key="txn.id"
        class="bg-white rounded-lg border border-gray-200 overflow-hidden"
        :class="{ 'ring-2 ring-blue-200': expandedId === txn.id }"
      >
        <div
          class="p-3 cursor-pointer"
          @click="toggleRow(txn)"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-900 truncate">{{ txn.description }}</p>
              <p class="text-xs text-gray-500 mt-0.5">
                {{ formatDate(txn.date) }}
                <span
                  class="ml-1.5 inline-block text-xs px-1.5 py-0.5 rounded"
                  :class="txn.classification === 'recurring'
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-gray-50 text-gray-500'"
                >
                  {{ txn.classification === 'recurring' ? 'Recurring' : 'Once-off' }}
                </span>
              </p>
            </div>
            <span
              class="text-sm font-semibold whitespace-nowrap"
              :class="isIncome(txn.amount) ? 'text-green-600' : 'text-red-600'"
            >
              {{ isIncome(txn.amount) ? '+' : '-' }}{{ currencyLabel }}{{ formatAmount(Math.abs(txn.amount)) }}
            </span>
          </div>
          <div v-if="txn.tags.length > 0" class="mt-1.5 flex flex-wrap gap-1">
            <span
              v-for="tag in txn.tags"
              :key="tag"
              class="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5"
            >
              {{ tag }}
            </span>
          </div>
        </div>
        <!-- Inline tag editor (mobile) -->
        <TransactionTagEditor
          v-if="expandedId === txn.id"
          :transaction="txn"
          :suggestions="getSuggestions(txn.id)"
          :suggestions-loading="!!suggestionsLoading"
          :currency-label="currencyLabel"
          @update:transaction="(fields) => handleTransactionUpdate(txn.id, fields)"
          @done="expandedId = null"
        />
      </div>
      <div v-if="paginatedRows.length === 0" class="py-8 text-center text-gray-400 text-sm">
        {{ search || filterTag || filterClassification ? 'No matching transactions' : 'No transactions yet' }}
      </div>
    </div>

    <!-- Desktop table (sm+ breakpoint) -->
    <div class="hidden sm:block overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
            <th class="py-2 pr-3">Date</th>
            <th class="py-2 pr-3">Description</th>
            <th class="py-2 pr-3">Tags</th>
            <th class="py-2 pr-3">Type</th>
            <th class="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="txn in paginatedRows" :key="txn.id">
            <tr
              class="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              :class="{ 'bg-blue-50/50': expandedId === txn.id }"
              @click="toggleRow(txn)"
            >
              <td class="py-2 pr-3 whitespace-nowrap text-gray-500">
                {{ formatDate(txn.date) }}
              </td>
              <td class="py-2 pr-3 text-gray-900 max-w-xs truncate">
                {{ txn.description }}
              </td>
              <td class="py-2 pr-3">
                <span
                  v-for="tag in txn.tags"
                  :key="tag"
                  class="inline-block text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 mr-1"
                >
                  {{ tag }}
                </span>
              </td>
              <td class="py-2 pr-3">
                <span
                  class="text-xs px-1.5 py-0.5 rounded"
                  :class="txn.classification === 'recurring'
                    ? 'bg-blue-50 text-blue-600'
                    : 'bg-gray-50 text-gray-500'"
                >
                  {{ txn.classification === 'recurring' ? 'Recurring' : 'Once-off' }}
                </span>
              </td>
              <td
                class="py-2 text-right font-medium whitespace-nowrap"
                :class="isIncome(txn.amount) ? 'text-green-600' : 'text-red-600'"
              >
                {{ isIncome(txn.amount) ? '+' : '-' }}{{ currencyLabel }}{{ formatAmount(Math.abs(txn.amount)) }}
              </td>
            </tr>
            <!-- Inline tag editor row (desktop) -->
            <tr v-if="expandedId === txn.id">
              <td colspan="5" class="p-0">
                <TransactionTagEditor
                  :transaction="txn"
                  :suggestions="getSuggestions(txn.id)"
                  :suggestions-loading="!!suggestionsLoading"
                  @update:tags="(tags) => handleTagUpdate(txn.id, tags)"
                  @done="expandedId = null"
                />
              </td>
            </tr>
          </template>
          <tr v-if="paginatedRows.length === 0">
            <td colspan="5" class="py-8 text-center text-gray-400">
              {{ search || filterTag || filterClassification ? 'No matching transactions' : 'No transactions yet' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-between mt-4 text-sm text-gray-500">
      <span>{{ filtered.length }} transaction{{ filtered.length === 1 ? '' : 's' }}</span>
      <div class="flex gap-1">
        <button
          class="px-3 py-2 min-h-[44px] rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-default"
          :disabled="currentPage <= 1"
          @click="currentPage--"
        >
          Previous
        </button>
        <span class="px-3 py-2">{{ currentPage }} / {{ totalPages }}</span>
        <button
          class="px-3 py-2 min-h-[44px] rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-default"
          :disabled="currentPage >= totalPages"
          @click="currentPage++"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>
