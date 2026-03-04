<script setup lang="ts">
/**
 * Requirement: Step 2 of redesigned import — classify each transaction group as
 *   recurring / once-off / ignore. Groups transactions by description similarity.
 * Approach: Group by exact description match (case-insensitive), let user classify each group.
 *   Auto-accept known recurring patterns.
 * Alternatives:
 *   - Fuzzy grouping: Deferred — exact match covers most bank statement patterns
 *   - Per-row classification: Rejected — too tedious with 100+ rows
 */

import { ref, computed, onMounted } from 'vue'
import { formatAmount } from '@/composables/useFormat'
import { isIncome } from '@/types/models'
import type { RecurringPattern } from '@/types/models'

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

onMounted(() => {
  // Group by description (case-insensitive)
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
    let matchedPatternId: string | null = null
    let tags: string[] = []

    for (const pattern of props.existingPatterns) {
      if (!pattern.isActive || !pattern.autoAccept) continue
      // Match by description similarity + amount proximity
      const descMatch = pattern.description.toLowerCase() === description.toLowerCase()
      const amountClose = Math.abs(avgAmount - pattern.expectedAmount) / Math.max(1, Math.abs(pattern.expectedAmount)) < 0.15
      if (descMatch || amountClose) {
        classification = 'recurring'
        matchedPatternId = pattern.id
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
    <div class="mb-4">
      <button class="text-xs text-gray-500 hover:text-gray-700 underline" @click="markRemainingOnceOff">
        Mark all remaining as once-off
      </button>
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
  </div>
</template>
