<script setup lang="ts">
/**
 * Requirement: Redesigned import wizard — 3 steps instead of 4.
 *   Step 1: Upload & map columns (reuse existing ImportStepUpload)
 *   Step 2: Classify transactions (recurring / once-off / ignore)
 *   Step 3: Confirm & import (save to transactions + create/update patterns)
 * Approach: Parent orchestrator. Parses CSV rows into ParsedTransaction[] after step 1,
 *   groups them in step 2, then saves to DB in step 3.
 * Alternatives:
 *   - Keep old 4-step wizard: Rejected — old wizard writes to dropped tables
 *   - Modal instead of page: Rejected — too much content for a modal
 */

import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { generateId } from '@/composables/useId'
import { nowISO } from '@/composables/useTimestamp'
import { touchTags } from '@/composables/useTagAutocomplete'
import { hapticSuccess } from '@/composables/useHaptic'
import { useToast } from '@/composables/useToast'
import { parseDate, parseAmount, isDuplicate } from '@/engine/matching'
import { detectFrequency, detectAnchorDay } from '@/engine/patterns'
import ErrorAlert from '@/components/ErrorAlert.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import ImportStepUpload from './import-steps/ImportStepUpload.vue'
import ImportStepClassify from './import-steps/ImportStepClassify.vue'
import type { Workspace, Transaction, RecurringPattern, Frequency } from '@/types/models'
import type { ParsedCSV } from '@/engine/csvParser'
import type { ParsedTransaction, TransactionGroup } from './import-steps/ImportStepClassify.vue'

const props = defineProps<{ id: string }>()
const router = useRouter()
const { show: showToast } = useToast()

/** Step labels for indicator text */
const stepLabels = ['Upload', 'Classify', 'Confirm'] as const

const workspace = ref<Workspace | null>(null)
const existingPatterns = ref<RecurringPattern[]>([])
const existingTransactions = ref<Transaction[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const [ws, patterns, txns] = await Promise.all([
      db.workspaces.get(props.id),
      db.patterns.where('workspaceId').equals(props.id).toArray(),
      db.transactions.where('workspaceId').equals(props.id).toArray(),
    ])
    if (!ws) {
      router.replace({ name: 'workspace-list' })
      return
    }
    workspace.value = ws
    existingPatterns.value = patterns
    existingTransactions.value = txns
  } catch {
    error.value = 'Couldn\'t load workspace. Please go back and try again.'
  } finally {
    loading.value = false
  }
})

// ── Wizard state ──
const step = ref<1 | 2 | 3>(1)
const parsedRows = ref<ParsedTransaction[]>([])
const classifiedGroups = ref<TransactionGroup[]>([])
const saving = ref(false)
const importedCount = ref(0)

// ── Step 1 → Step 2: Parse CSV rows into ParsedTransaction[] ──
function handleUploadComplete(data: {
  parsedData: ParsedCSV
  dateColumn: string
  amountColumn: string
  descriptionColumn: string
  dateFormatIndex: number
}) {
  const rows: ParsedTransaction[] = []
  let skipped = 0

  for (const row of data.parsedData.rows) {
    const dateStr = parseDate(row[data.dateColumn] ?? '', data.dateFormatIndex)
    const amount = parseAmount(row[data.amountColumn] ?? '')
    const description = (row[data.descriptionColumn] ?? '').trim()

    if (!dateStr || amount === null || !description) {
      skipped++
      continue
    }

    // Duplicate detection against existing transactions
    // Requirement: Reuse existing isDuplicate() from matching.ts (includes .trim())
    if (isDuplicate({ date: dateStr, amount, description }, existingTransactions.value)) {
      skipped++
      continue
    }

    rows.push({
      date: dateStr,
      amount,
      description,
      originalRow: { ...row },
    })
  }

  parsedRows.value = rows

  if (rows.length === 0) {
    error.value = skipped > 0
      ? `All ${skipped} rows were duplicates or couldn't be parsed. Nothing to import.`
      : 'No valid rows found in the file.'
    return
  }

  if (skipped > 0) {
    error.value = `${skipped} row${skipped === 1 ? '' : 's'} skipped (duplicates or invalid data).`
  }

  step.value = 2
}

// ── Step 2 → Step 3: Classify groups ──
function handleClassifyComplete(groups: TransactionGroup[]) {
  classifiedGroups.value = groups
  step.value = 3
}

// ── Step 3: Save to DB ──
async function handleConfirmImport() {
  if (!workspace.value) return
  saving.value = true

  try {
    const now = nowISO()
    const batchId = generateId()
    const newTransactions: Transaction[] = []
    const patternUpdates: Array<{ pattern: RecurringPattern; isNew: boolean }> = []
    const allTags = new Set<string>()

    // Create import batch
    const allDates = classifiedGroups.value.flatMap((g) => g.rows.map((r) => r.date)).sort()
    const importBatch = {
      id: batchId,
      workspaceId: workspace.value.id,
      fileName: 'import',
      dateRange: { start: allDates[0] ?? now.slice(0, 10), end: allDates[allDates.length - 1] ?? now.slice(0, 10) },
      transactionCount: 0,
      importedAt: now,
    }

    for (const group of classifiedGroups.value) {
      // Create or update recurring pattern
      let patternId: string | null = group.matchedPatternId

      if (group.classification === 'recurring') {
        if (patternId) {
          // Update existing pattern's lastSeenDate
          const existing = existingPatterns.value.find((p) => p.id === patternId)
          if (existing) {
            const lastDate = [...group.rows].sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? existing.lastSeenDate
            patternUpdates.push({
              pattern: { ...existing, lastSeenDate: lastDate, updatedAt: now },
              isNew: false,
            })
          }
        } else {
          // Create new pattern from the group
          // Requirement: detectFrequency expects number[] of day-intervals, not string[] of dates.
          // Compute intervals between consecutive sorted dates, then detect frequency.
          const dates = group.rows.map((r) => r.date).sort()
          let frequency: Frequency = 'monthly'
          if (dates.length > 1) {
            const intervals: number[] = []
            for (let i = 1; i < dates.length; i++) {
              const dA = new Date(dates[i - 1]! + 'T00:00:00')
              const dB = new Date(dates[i]! + 'T00:00:00')
              intervals.push(Math.round(Math.abs(dB.getTime() - dA.getTime()) / 86_400_000))
            }
            const detected = detectFrequency(intervals)
            frequency = detected?.frequency ?? 'monthly'
          }
          const anchorDay = detectAnchorDay(dates, frequency)

          const newPattern: RecurringPattern = {
            id: generateId(),
            workspaceId: workspace.value!.id,
            description: group.description,
            expectedAmount: group.avgAmount,
            amountStdDev: 0,
            frequency,
            anchorDay,
            tags: group.tags,
            isActive: true,
            autoAccept: true,
            lastSeenDate: dates[dates.length - 1] ?? now.slice(0, 10),
            createdAt: now,
            updatedAt: now,
          }
          patternId = newPattern.id
          patternUpdates.push({ pattern: newPattern, isNew: true })
        }
      }

      // Create transactions
      for (const row of group.rows) {
        newTransactions.push({
          id: generateId(),
          workspaceId: workspace.value!.id,
          date: row.date,
          amount: row.amount,
          description: row.description,
          tags: group.tags,
          source: 'import',
          classification: group.classification === 'recurring' ? 'recurring' : 'once-off',
          recurringGroupId: group.classification === 'recurring' ? patternId : null,
          originalRow: row.originalRow,
          importBatchId: batchId,
          createdAt: now,
          updatedAt: now,
        })

        for (const tag of group.tags) allTags.add(tag)
      }
    }

    importBatch.transactionCount = newTransactions.length

    // Save everything in a single transaction
    await db.transaction('rw', [db.transactions, db.patterns, db.importBatches], async () => {
      await db.importBatches.add(importBatch)
      await db.transactions.bulkAdd(newTransactions)

      for (const { pattern, isNew } of patternUpdates) {
        if (isNew) {
          await db.patterns.add(pattern)
        } else {
          await db.patterns.update(pattern.id, {
            lastSeenDate: pattern.lastSeenDate,
            updatedAt: pattern.updatedAt,
          })
        }
      }
    })

    // Update tag cache
    if (allTags.size > 0) {
      await touchTags([...allTags])
    }

    importedCount.value = newTransactions.length
    saving.value = false

    // Requirement: Success feedback before navigating away
    // Approach: Toast + haptic pulse, then navigate. Brief visual confirmation.
    hapticSuccess()
    showToast(`Imported ${newTransactions.length} transaction${newTransactions.length === 1 ? '' : 's'}`)
    router.push({ name: 'workspace-detail', params: { id: props.id } })
  } catch {
    error.value = 'Couldn\'t save imported data. Please try again.'
    saving.value = false
  }
}

function goBack() {
  if (step.value > 1) {
    step.value = (step.value - 1) as 1 | 2
    error.value = ''
  } else {
    router.push({ name: 'workspace-detail', params: { id: props.id } })
  }
}
</script>

<template>
  <div>
    <button
      class="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
      @click="goBack"
    >
      <span class="i-lucide-arrow-left" />
      {{ step === 1 ? 'Back to workspace' : 'Previous step' }}
    </button>

    <ErrorAlert v-if="error" :message="error" @dismiss="error = ''" />

    <LoadingSpinner v-if="loading" />

    <template v-else-if="workspace">
      <!-- Step indicator with text labels
           Requirement: Step numbers + text labels for non-technical users
           Approach: Circle + label below each step, connected by lines -->
      <div class="flex items-start gap-2 mb-6">
        <template v-for="s in [1, 2, 3]" :key="s">
          <div class="flex flex-col items-center min-w-0">
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
              :class="s === step
                ? 'bg-brand-500 text-white'
                : s < step
                  ? 'bg-brand-100 text-brand-600'
                  : 'bg-gray-100 text-gray-400'"
            >
              {{ s < step ? '✓' : s }}
            </div>
            <span
              class="text-xs mt-1"
              :class="s === step ? 'text-brand-600 font-medium' : 'text-gray-400'"
            >
              {{ stepLabels[s - 1] }}
            </span>
          </div>
          <div
            v-if="s < 3"
            class="flex-1 h-0.5 mt-4"
            :class="s < step ? 'bg-brand-300' : 'bg-gray-200'"
          />
        </template>
      </div>
      <p class="text-xs text-gray-400 mb-4">Step {{ step }} of 3</p>

      <!-- Step 1: Upload & Map -->
      <ImportStepUpload
        v-if="step === 1"
        @complete="handleUploadComplete"
      />

      <!-- Step 2: Classify -->
      <ImportStepClassify
        v-else-if="step === 2"
        :parsed-rows="parsedRows"
        :existing-patterns="existingPatterns"
        :currency-label="workspace.currencyLabel"
        @complete="handleClassifyComplete"
        @back="step = 1"
      />

      <!-- Step 3: Confirm -->
      <div v-else-if="step === 3">
        <h2 class="text-lg font-semibold mb-4">Confirm import</h2>

        <div class="card p-4 mb-6">
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-500">Recurring groups</span>
              <span class="font-medium">{{ classifiedGroups.filter(g => g.classification === 'recurring').length }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Once-off transactions</span>
              <span class="font-medium">{{ classifiedGroups.filter(g => g.classification === 'once-off').reduce((s, g) => s + g.rows.length, 0) }}</span>
            </div>
            <div class="flex justify-between border-t border-gray-100 pt-2">
              <span class="text-gray-700 font-medium">Total transactions</span>
              <span class="font-semibold">{{ classifiedGroups.reduce((s, g) => s + g.rows.length, 0) }}</span>
            </div>
          </div>
        </div>

        <div class="flex justify-between">
          <button class="btn-secondary" @click="step = 2">Back</button>
          <button
            class="btn-primary"
            :disabled="saving"
            @click="handleConfirmImport"
          >
            {{ saving ? 'Importing...' : 'Import transactions' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
