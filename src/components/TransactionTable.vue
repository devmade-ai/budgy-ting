<script setup lang="ts">
/**
 * Requirement: Paginated, filterable transaction table for the single-screen workspace view
 * Approach: Client-side filtering + pagination. Plain table with sort by date.
 * Alternatives:
 *   - Virtual scrolling (vue-virtual-scroller): Deferred — paginate first, upgrade later
 *   - Server-side pagination: N/A — local-first IndexedDB app
 */

import { ref, computed, watch } from 'vue'
import { formatAmount } from '@/composables/useFormat'
import { isIncome } from '@/types/models'
import type { Transaction } from '@/types/models'

const props = defineProps<{
  transactions: Transaction[]
  currencyLabel: string
}>()

const PAGE_SIZE = 25

const search = ref('')
const filterTag = ref('')
const filterClassification = ref<'' | 'recurring' | 'once-off'>('')
const currentPage = ref(1)

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
</script>

<template>
  <div>
    <!-- Filters -->
    <div v-if="transactions.length > 5" class="flex flex-wrap gap-2 mb-4">
      <input
        v-model="search"
        type="text"
        placeholder="Search transactions..."
        class="input text-sm flex-1 min-w-48"
      />
      <select
        v-model="filterTag"
        class="input text-sm w-auto"
      >
        <option value="">All tags</option>
        <option v-for="tag in allTags" :key="tag" :value="tag">{{ tag }}</option>
      </select>
      <select
        v-model="filterClassification"
        class="input text-sm w-auto"
      >
        <option value="">All types</option>
        <option value="recurring">Recurring</option>
        <option value="once-off">Once-off</option>
      </select>
    </div>

    <!-- Table -->
    <div class="overflow-x-auto">
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
          <tr
            v-for="txn in paginatedRows"
            :key="txn.id"
            class="border-b border-gray-100 hover:bg-gray-50"
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
          class="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-default"
          :disabled="currentPage <= 1"
          @click="currentPage--"
        >
          Previous
        </button>
        <span class="px-3 py-1">{{ currentPage }} / {{ totalPages }}</span>
        <button
          class="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-default"
          :disabled="currentPage >= totalPages"
          @click="currentPage++"
        >
          Next
        </button>
      </div>
    </div>
  </div>
</template>
