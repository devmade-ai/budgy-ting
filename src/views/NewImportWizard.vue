<script setup lang="ts">
/**
 * Requirement: Import wizard — 2 steps: Upload → Review & Import.
 *   Replaces previous 3-step group-based flow with per-transaction review.
 * Approach: Parent orchestrator. Parses CSV rows into ParsedTransaction[] after step 1,
 *   user reviews/enriches each transaction in step 2, then saves directly from step 2.
 * Alternatives:
 *   - 3-step group-based flow: Rejected — tags/classification applied at group level,
 *     misclassified transactions couldn't be moved between groups
 *   - Separate confirm step: Rejected — review step IS the confirm, extra step adds no value
 */

import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import { db } from '@/db'
import { useTagSuggestions } from '@/ml/useTagSuggestions'
import { useEmbeddings } from '@/ml/useEmbeddings'
import { generateId } from '@/composables/useId'
import { nowISO } from '@/composables/useTimestamp'
import { touchTags } from '@/composables/useTagAutocomplete'
import { hapticSuccess } from '@/composables/useHaptic'
import { useToast } from '@/composables/useToast'
import { parseDate, parseAmount, isDuplicate } from '@/engine/matching'
import { detectFrequency, detectAnchorDay, calculateIntervals } from '@/engine/patterns'
import { debugLog } from '@/debug/debugLog'
import ErrorAlert from '@/components/ErrorAlert.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import ImportStepUpload from './import-steps/ImportStepUpload.vue'
import ImportStepReview from './import-steps/ImportStepReview.vue'
import type { Workspace, Transaction, RecurringPattern, Frequency, RecurringVariability } from '@/types/models'
import type { ParsedCSV } from '@/engine/csvParser'
import type { ParsedTransaction, ReviewTransaction } from './import-steps/ImportStepReview.vue'

const props = defineProps<{ id: string }>()
const router = useRouter()
const { show: showToast } = useToast()
const { preloadModel, dispose } = useTagSuggestions()
const { preloadModel: preloadEmbeddings, dispose: disposeEmbeddings } = useEmbeddings()

/** Step labels for indicator text */
const stepLabels = ['Upload', 'Review'] as const

const workspace = ref<Workspace | null>(null)
const existingPatterns = ref<RecurringPattern[]>([])
const existingTransactions = ref<Transaction[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  // Reset wizard state in case component is remounted
  step.value = 1
  parsedRows.value = []
  error.value = ''

  // Start ML model downloads early — they load in Web Workers while user maps columns in Step 1
  preloadModel()
  preloadEmbeddings()

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

// Free ML worker memory when leaving the import wizard
onUnmounted(() => {
  dispose()
  disposeEmbeddings()
})

// ── Wizard state ──
const step = ref<1 | 2>(1)
const parsedRows = ref<ParsedTransaction[]>([])
const saving = ref(false)

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

  debugLog('import', rows.length > 0 ? 'info' : 'warn', 'CSV parsed', {
    totalRows: data.parsedData.totalRows,
    validRows: rows.length,
    skipped,
    parseErrors: data.parsedData.errors.length,
    dateFormat: data.dateFormatIndex,
  })

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

// ── Step 2: Review complete → Save to DB ──
// Requirement: Per-transaction save. Recurring patterns detected at save time by grouping
//   transactions marked "recurring" with same description (case-insensitive).
// Approach: Build patterns from recurring transactions, then save all in one DB transaction.
async function handleReviewComplete(reviewedTransactions: ReviewTransaction[]) {
  if (!workspace.value) return
  saving.value = true

  try {
    const now = nowISO()
    const batchId = generateId()
    const newTransactions: Transaction[] = []
    const patternUpdates: Array<{ pattern: RecurringPattern; isNew: boolean }> = []
    const allTags = new Set<string>()

    // Group recurring transactions by description to create/update patterns
    const recurringByDesc = new Map<string, ReviewTransaction[]>()
    for (const tx of reviewedTransactions) {
      if (tx.classification === 'recurring') {
        const key = tx.description.toLowerCase()
        if (!recurringByDesc.has(key)) recurringByDesc.set(key, [])
        recurringByDesc.get(key)!.push(tx)
      }
    }

    // Build pattern updates from recurring groups
    // Map: description key → patternId (for linking transactions to patterns)
    const descToPatternId = new Map<string, string>()

    for (const [descKey, txs] of recurringByDesc) {
      // Check if any transaction already matched an existing pattern
      const matchedTx = txs.find((tx) => tx.matchedPatternId)
      const patternId = matchedTx?.matchedPatternId ?? null

      if (patternId) {
        // Update existing pattern's lastSeenDate
        const existing = existingPatterns.value.find((p) => p.id === patternId)
        if (existing) {
          const lastDate = txs
            .map((tx) => tx.date)
            .sort((a, b) => b.localeCompare(a))[0] ?? existing.lastSeenDate
          patternUpdates.push({
            pattern: { ...existing, lastSeenDate: lastDate, updatedAt: now },
            isNew: false,
          })
          descToPatternId.set(descKey, patternId)
        }
      } else {
        // Create new pattern from these recurring transactions
        const dates = txs.map((tx) => tx.date).sort()
        // Use variability from first transaction (all same description should have same setting)
        const variability: RecurringVariability = txs[0]?.variability ?? 'fixed'
        let frequency: Frequency = variability === 'irregular' ? 'irregular' : 'monthly'
        let anchorDay = 0

        if (variability !== 'irregular' && dates.length > 1) {
          const intervals = calculateIntervals(dates)
          const detected = detectFrequency(intervals)
          frequency = detected?.frequency ?? 'monthly'
          anchorDay = detectAnchorDay(dates, frequency)
        } else if (variability !== 'irregular') {
          anchorDay = detectAnchorDay(dates, frequency)
        }

        // Collect tags from all transactions in this recurring group
        const patternTags = new Set<string>()
        for (const tx of txs) {
          for (const tag of tx.tags) patternTags.add(tag)
        }

        const amounts = txs.map((tx) => tx.amount)
        const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length

        const newPattern: RecurringPattern = {
          id: generateId(),
          workspaceId: workspace.value!.id,
          description: txs[0]!.description,
          expectedAmount: avgAmount,
          amountStdDev: 0,
          frequency,
          anchorDay,
          variability,
          tags: [...patternTags],
          isActive: true,
          autoAccept: true,
          lastSeenDate: dates[dates.length - 1] ?? now.slice(0, 10),
          createdAt: now,
          updatedAt: now,
        }
        descToPatternId.set(descKey, newPattern.id)
        patternUpdates.push({ pattern: newPattern, isNew: true })
      }
    }

    // Create import batch
    const allDates = reviewedTransactions.map((tx) => tx.date).sort()
    const importBatch = {
      id: batchId,
      workspaceId: workspace.value.id,
      fileName: 'import',
      dateRange: {
        start: allDates[0] ?? now.slice(0, 10),
        end: allDates[allDates.length - 1] ?? now.slice(0, 10),
      },
      transactionCount: 0,
      importedAt: now,
    }

    // Create transaction records — tags come from each transaction, not a group
    for (const tx of reviewedTransactions) {
      const descKey = tx.description.toLowerCase()
      const patternId = tx.classification === 'recurring'
        ? (descToPatternId.get(descKey) ?? null)
        : null

      newTransactions.push({
        id: generateId(),
        workspaceId: workspace.value!.id,
        date: tx.date,
        amount: tx.amount,
        description: tx.description,
        tags: tx.tags,
        source: 'import',
        classification: tx.classification,
        recurringGroupId: patternId,
        originalRow: tx.originalRow,
        importBatchId: batchId,
        createdAt: now,
        updatedAt: now,
      })

      for (const tag of tx.tags) allTags.add(tag)
    }

    importBatch.transactionCount = newTransactions.length

    // Save everything in a single IndexedDB transaction
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

    saving.value = false

    debugLog('import', 'success', 'Import saved', {
      transactions: newTransactions.length,
      newPatterns: patternUpdates.filter((p) => p.isNew).length,
      updatedPatterns: patternUpdates.filter((p) => !p.isNew).length,
      tags: allTags.size,
      batchId,
    })

    hapticSuccess()
    showToast(`Imported ${newTransactions.length} transaction${newTransactions.length === 1 ? '' : 's'}`)
    router.push({ name: 'workspace-detail', params: { id: props.id } })
  } catch (e) {
    debugLog('import', 'error', 'Import save failed', { error: String(e) })
    error.value = 'Couldn\'t save imported data. Please try again.'
    saving.value = false
  }
}

function goBack() {
  if (step.value > 1) {
    step.value = 1
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
      <ArrowLeft :size="16" />
      {{ step === 1 ? 'Back to workspace' : 'Previous step' }}
    </button>

    <ErrorAlert v-if="error" :message="error" @dismiss="error = ''" />

    <LoadingSpinner v-if="loading" />

    <template v-else-if="workspace">
      <!-- Step indicator — 2 steps: Upload → Review
           Requirement: Step numbers + text labels for non-technical users
           Approach: Circle + label below each step, connected by line -->
      <div class="flex items-start gap-2 mb-6">
        <template v-for="s in [1, 2]" :key="s">
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
            v-if="s < 2"
            class="flex-1 h-0.5 mt-4"
            :class="s < step ? 'bg-brand-300' : 'bg-gray-200'"
          />
        </template>
      </div>
      <p class="text-xs text-gray-400 mb-4">
        Step {{ step }} of 2
        <span v-if="step === 2 && parsedRows.length > 10">
          &middot; {{ parsedRows.length }} transactions to review
        </span>
      </p>

      <!-- Step 1: Upload & Map -->
      <ImportStepUpload
        v-if="step === 1"
        @complete="handleUploadComplete"
      />

      <!-- Step 2: Review & Import -->
      <ImportStepReview
        v-else-if="step === 2"
        :parsed-rows="parsedRows"
        :existing-patterns="existingPatterns"
        :currency-label="workspace.currencyLabel"
        @complete="handleReviewComplete"
        @back="step = 1"
      />
    </template>
  </div>
</template>
