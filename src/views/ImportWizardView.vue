<script setup lang="ts">
/**
 * Requirement: Multi-step import wizard — file upload, column mapping, matching, confirmation
 * Approach: Parent orchestrator delegating each step to a dedicated sub-component
 * Alternatives:
 *   - Single monolithic component: Rejected — exceeded 600-line threshold at 747 lines
 *   - Separate route per step: Rejected — loses state between steps
 */

import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { useId } from '@/composables/useId'
import { nowISO } from '@/composables/useTimestamp'
import ErrorAlert from '@/components/ErrorAlert.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import ImportStepUpload from './import-steps/ImportStepUpload.vue'
import ImportStepMapping from './import-steps/ImportStepMapping.vue'
import ImportStepReview from './import-steps/ImportStepReview.vue'
import ImportStepComplete from './import-steps/ImportStepComplete.vue'
import type { Budget, Expense, Frequency, LineType } from '@/types/models'
import type { ParsedCSV } from '@/engine/csvParser'
import type { MatchResult } from '@/engine/matching'

const props = defineProps<{ id: string }>()
const router = useRouter()

const budget = ref<Budget | null>(null)
const expenses = ref<Expense[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const [foundBudget, foundExpenses] = await Promise.all([
      db.budgets.get(props.id),
      db.expenses.where('budgetId').equals(props.id).toArray(),
    ])
    if (!foundBudget) {
      router.replace({ name: 'budget-list' })
      return
    }
    budget.value = foundBudget
    expenses.value = foundExpenses
  } catch {
    error.value = 'Couldn\'t load budget data. Please go back and try again.'
  } finally {
    loading.value = false
  }
})

// ── Wizard state ──

const step = ref<1 | 2 | 3 | 4>(1)

// Data passed between steps
const parsedData = ref<ParsedCSV | null>(null)
const dateColumn = ref('')
const amountColumn = ref('')
const categoryColumn = ref('')
const descriptionColumn = ref('')
const dateFormatIndex = ref(0)
const matchResults = ref<MatchResult[]>([])
const skippedRows = ref(0)
const saving = ref(false)

// ── Step transitions ──

function handleUploadComplete(data: {
  parsedData: ParsedCSV
  dateColumn: string
  amountColumn: string
  categoryColumn: string
  descriptionColumn: string
  dateFormatIndex: number
}) {
  parsedData.value = data.parsedData
  dateColumn.value = data.dateColumn
  amountColumn.value = data.amountColumn
  categoryColumn.value = data.categoryColumn
  descriptionColumn.value = data.descriptionColumn
  dateFormatIndex.value = data.dateFormatIndex
  step.value = 2
}

function handleMappingComplete(data: { matchResults: MatchResult[]; skippedRows: number }) {
  matchResults.value = data.matchResults
  skippedRows.value = data.skippedRows
  step.value = 3
}

async function handleConfirmImport() {
  if (!budget.value) return
  saving.value = true

  try {
    const now = nowISO()
    const approvedResults = matchResults.value.filter((r) => r.approved)

    await db.actuals.bulkAdd(
      approvedResults.map((r) => ({
        id: useId(),
        budgetId: budget.value!.id,
        expenseId: r.matchedExpense?.id ?? null,
        date: r.importedRow.date,
        amount: r.importedRow.amount,
        category: r.importedRow.category,
        description: r.importedRow.description,
        originalRow: r.importedRow.originalRow,
        matchConfidence: r.confidence,
        approved: true,
        createdAt: now,
        updatedAt: now,
      }))
    )

    step.value = 4
  } catch {
    error.value = 'Couldn\'t save imported data. Please try again.'
  } finally {
    saving.value = false
  }
}

/**
 * Requirement: Create a new income/expense line from the import review screen
 * Approach: Save to DB, push to local expenses array, update match result to point to new expense
 * Alternatives:
 *   - Navigate to expense create page: Rejected — loses wizard state
 */
async function handleCreateExpense(data: {
  matchIndex: number
  description: string
  category: string
  amount: number
  frequency: Frequency
  type: LineType
}) {
  if (!budget.value) return

  const now = nowISO()
  const newExpense: Expense = {
    id: useId(),
    budgetId: budget.value.id,
    description: data.description,
    category: data.category,
    amount: data.amount,
    frequency: data.frequency,
    type: data.type,
    startDate: budget.value.startDate,
    endDate: null,
    createdAt: now,
    updatedAt: now,
  }

  try {
    await db.expenses.add(newExpense)
    expenses.value.push(newExpense)

    // Assign the imported row to the newly created expense
    const result = matchResults.value[data.matchIndex]
    if (result) {
      result.matchedExpense = newExpense
      result.confidence = 'manual'
      result.approved = true
    }
  } catch {
    error.value = 'Couldn\'t create the new line. Please try again.'
  }
}

function goBack() {
  if (step.value > 1) {
    step.value = (step.value - 1) as 1 | 2 | 3
  } else {
    router.push({ name: 'budget-expenses', params: { id: props.id } })
  }
}

function finish() {
  router.push({ name: 'budget-compare', params: { id: props.id } })
}
</script>

<template>
  <div>
    <button
      class="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
      @click="goBack"
    >
      <span class="i-lucide-arrow-left" />
      {{ step === 1 ? 'Back to budget' : 'Previous step' }}
    </button>

    <ErrorAlert v-if="error" :message="error" @dismiss="error = ''" />

    <LoadingSpinner v-if="loading" />

    <template v-else-if="budget">
      <!-- Step indicator -->
      <div class="flex items-center gap-2 mb-6">
        <template v-for="s in [1, 2, 3, 4]" :key="s">
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
          <div
            v-if="s < 4"
            class="flex-1 h-0.5"
            :class="s < step ? 'bg-brand-300' : 'bg-gray-200'"
          />
        </template>
      </div>

      <!-- Step 1: File Upload -->
      <ImportStepUpload
        v-if="step === 1"
        @complete="handleUploadComplete"
      />

      <!-- Step 2: Column Mapping -->
      <ImportStepMapping
        v-else-if="step === 2 && parsedData"
        :parsed-data="parsedData"
        :initial-date-column="dateColumn"
        :initial-amount-column="amountColumn"
        :initial-category-column="categoryColumn"
        :initial-description-column="descriptionColumn"
        :initial-date-format-index="dateFormatIndex"
        :expenses="expenses"
        @complete="handleMappingComplete"
        @back="step = 1"
      />

      <!-- Step 3: Matching Review -->
      <ImportStepReview
        v-else-if="step === 3"
        :match-results="matchResults"
        :expenses="expenses"
        :budget="budget"
        :skipped-rows="skippedRows"
        :saving="saving"
        @confirm="handleConfirmImport"
        @create-expense="handleCreateExpense"
        @back="step = 2"
      />

      <!-- Step 4: Confirmation -->
      <ImportStepComplete
        v-else-if="step === 4"
        :match-results="matchResults"
        @finish="finish"
      />
    </template>
  </div>
</template>
