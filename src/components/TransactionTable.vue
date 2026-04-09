<script setup lang="ts">
/**
 * Requirement: Paginated, filterable transaction display with edit modal
 * Approach: Table on desktop, stacked cards on mobile. Client-side filtering + pagination.
 *   Click a row to open a modal for editing all transaction fields.
 * Alternatives:
 *   - Table-only with horizontal scroll: Rejected — cards are much easier to scan on mobile
 *   - Virtual scrolling (vue-virtual-scroller): Deferred — paginate first, upgrade later
 *   - Server-side pagination: N/A — local-first IndexedDB app
 *   - Inline row editor: Rejected — cramped, pushes content around
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { formatAmount, formatDateForDisplay } from '@/composables/useFormat'
import { usePagination } from '@/composables/usePagination'
import { isIncome } from '@/types/models'
import ClassificationBadge from '@/components/ClassificationBadge.vue'
import TransactionEditModal from '@/components/TransactionEditModal.vue'
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
  'delete-transaction': [id: string]
  /** Emitted when a row is selected — parent can trigger ML suggestion for this transaction */
  'request-suggestions': [id: string, description: string]
}>()

const search = ref('')
const filterTag = ref('')
const filterClassification = ref<'' | 'recurring' | 'once-off'>('')

/** Transaction currently being edited in the modal — null = modal closed */
const editingTransaction = ref<Transaction | null>(null)

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

  if (search.value) {
    const q = search.value.toLowerCase()
    result = result.filter((t) => t.description.toLowerCase().includes(q))
  }

  if (filterTag.value) {
    result = result.filter((t) => t.tags.includes(filterTag.value))
  }

  if (filterClassification.value) {
    result = result.filter((t) => t.classification === filterClassification.value)
  }

  result.sort((a, b) => b.date.localeCompare(a.date))

  return result
})

const { currentPage, totalPages, paginatedItems: paginatedRows, resetPage } = usePagination(filtered)

// Reset page when filters change
watch([search, filterTag, filterClassification], () => {
  resetPage()
})

// Requirement: Show all transactions in print — pagination truncates to 25 rows
// Approach: Listen for beforeprint/afterprint events to bypass pagination.
//   Browsers drain microtasks (including Vue DOM updates) before rendering print preview.
// Alternatives:
//   - Print-only template section: Rejected — duplicates entire table/card markup
//   - CSS-only: Not possible — pagination is data-driven (.slice()), not CSS-driven
const printMode = ref(false)
const displayRows = computed(() => printMode.value ? filtered.value : paginatedRows.value)

function onBeforePrint() { printMode.value = true }
function onAfterPrint() { printMode.value = false }
onMounted(() => {
  window.addEventListener('beforeprint', onBeforePrint)
  window.addEventListener('afterprint', onAfterPrint)
})
onUnmounted(() => {
  window.removeEventListener('beforeprint', onBeforePrint)
  window.removeEventListener('afterprint', onAfterPrint)
})

function openEdit(txn: Transaction) {
  editingTransaction.value = txn
  emit('request-suggestions', txn.id, txn.description)
}

function handleSave(fields: Partial<Transaction>) {
  if (editingTransaction.value) {
    emit('update-transaction', editingTransaction.value.id, fields)
  }
  editingTransaction.value = null
}

function handleDelete() {
  if (editingTransaction.value) {
    emit('delete-transaction', editingTransaction.value.id)
  }
  editingTransaction.value = null
}

function handleRowKeydown(e: KeyboardEvent, txn: Transaction) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    openEdit(txn)
  }
}

function getSuggestions(id: string): TagSuggestion[] {
  return props.tagSuggestions?.get(id) ?? []
}
</script>

<template>
  <div>
    <!-- Filters — touch-friendly input sizing (min-h-44px) -->
    <div v-if="transactions.length > 5" class="flex flex-wrap gap-2 mb-4 no-print">
      <input
        v-model="search"
        type="text"
        placeholder="Search transactions..."
        class="input-field flex-1 min-w-48 min-h-[44px]"
      />
      <select
        v-model="filterTag"
        class="input-field w-auto min-h-[44px]"
      >
        <option value="">All tags</option>
        <option v-for="tag in allTags" :key="tag" :value="tag">{{ tag }}</option>
      </select>
      <select
        v-model="filterClassification"
        class="input-field w-auto min-h-[44px]"
      >
        <option value="">All types</option>
        <option value="recurring">Recurring</option>
        <option value="once-off">Once-off</option>
      </select>
    </div>

    <!-- Mobile card layout (< sm breakpoint) — hidden in print (table is better for PDF) -->
    <div class="sm:hidden space-y-2 no-print">
      <div
        v-for="txn in displayRows"
        :key="txn.id"
        role="button"
        tabindex="0"
        class="bg-white dark:bg-[var(--color-surface-elevated)] rounded-lg border border-gray-200 dark:border-zinc-700 p-3 cursor-pointer hover:border-gray-300 dark:hover:border-zinc-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
        @click="openEdit(txn)"
        @keydown="handleRowKeydown($event, txn)"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">{{ txn.description }}</p>
            <p class="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              {{ formatDateForDisplay(txn.date) }}
              <ClassificationBadge :classification="txn.classification" class="ml-1.5 inline-block" />
            </p>
          </div>
          <span
            class="text-sm font-semibold whitespace-nowrap"
            :class="isIncome(txn.amount) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
          >
            {{ isIncome(txn.amount) ? '+' : '-' }}{{ currencyLabel }}{{ formatAmount(Math.abs(txn.amount)) }}
          </span>
        </div>
        <div v-if="txn.tags.length > 0" class="mt-1.5 flex flex-wrap gap-1">
          <span
            v-for="tag in txn.tags"
            :key="tag"
            class="tag-pill"
          >
            {{ tag }}
          </span>
        </div>
      </div>
      <div v-if="paginatedRows.length === 0" class="py-8 text-center text-gray-400 dark:text-zinc-500 text-sm">
        {{ search || filterTag || filterClassification ? 'No matching transactions' : 'No transactions yet' }}
      </div>
    </div>

    <!-- Desktop table (sm+ breakpoint) — forced visible in print via print-show -->
    <div class="hidden sm:block overflow-x-auto print-show">
      <table class="w-full text-sm">
        <thead>
          <!-- Mobile UX: text-sm for readable table headers (was text-xs) -->
          <tr class="border-b border-gray-200 dark:border-zinc-700 text-left text-sm text-gray-500 dark:text-zinc-400 uppercase tracking-wide">
            <th class="py-2 pr-3">Date</th>
            <th class="py-2 pr-3">Description</th>
            <th class="py-2 pr-3">Tags</th>
            <th class="py-2 pr-3">Type</th>
            <th class="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="txn in displayRows"
            :key="txn.id"
            tabindex="0"
            class="border-b border-gray-100 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-[var(--color-surface-hover)] cursor-pointer focus:outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20"
            @click="openEdit(txn)"
            @keydown="handleRowKeydown($event, txn)"
          >
            <td class="py-2 pr-3 whitespace-nowrap text-gray-500 dark:text-zinc-400">
              {{ formatDateForDisplay(txn.date) }}
            </td>
            <td class="py-2 pr-3 text-gray-900 dark:text-zinc-100 max-w-xs truncate">
              {{ txn.description }}
            </td>
            <td class="py-2 pr-3">
              <span
                v-for="tag in txn.tags"
                :key="tag"
                class="tag-pill inline-block mr-1"
              >
                {{ tag }}
              </span>
            </td>
            <td class="py-2 pr-3">
              <ClassificationBadge :classification="txn.classification" />
            </td>
            <td
              class="py-2 text-right font-medium whitespace-nowrap"
              :class="isIncome(txn.amount) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
            >
              {{ isIncome(txn.amount) ? '+' : '-' }}{{ currencyLabel }}{{ formatAmount(Math.abs(txn.amount)) }}
            </td>
          </tr>
          <tr v-if="paginatedRows.length === 0">
            <td colspan="5" class="py-8 text-center text-gray-400 dark:text-zinc-500">
              {{ search || filterTag || filterClassification ? 'No matching transactions' : 'No transactions yet' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-between mt-4 text-sm text-gray-500 dark:text-zinc-400 no-print">
      <span>{{ filtered.length }} transaction{{ filtered.length === 1 ? '' : 's' }}</span>
      <div class="flex gap-1">
        <button
          class="px-4 py-2.5 min-h-[44px] min-w-[44px] rounded border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-[var(--color-surface-hover)] disabled:opacity-40 disabled:cursor-default dark:text-zinc-200"
          :disabled="currentPage <= 1"
          @click="currentPage--"
        >
          Previous
        </button>
        <span class="px-3 py-2">{{ currentPage }} / {{ totalPages }}</span>
        <button
          class="px-4 py-2.5 min-h-[44px] min-w-[44px] rounded border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-[var(--color-surface-hover)] disabled:opacity-40 disabled:cursor-default dark:text-zinc-200"
          :disabled="currentPage >= totalPages"
          @click="currentPage++"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Edit modal -->
    <TransactionEditModal
      v-if="editingTransaction"
      :transaction="editingTransaction"
      :suggestions="getSuggestions(editingTransaction.id)"
      :suggestions-loading="!!suggestionsLoading"
      :currency-label="currencyLabel"
      :known-tags="allTags"
      @save="handleSave"
      @delete="handleDelete"
      @close="editingTransaction = null"
    />
  </div>
</template>
