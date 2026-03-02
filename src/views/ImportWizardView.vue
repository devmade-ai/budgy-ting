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
import { touchTags } from '@/composables/useTagAutocomplete'
import ErrorAlert from '@/components/ErrorAlert.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import ImportStepUpload from './import-steps/ImportStepUpload.vue'
import ImportStepMapping from './import-steps/ImportStepMapping.vue'
import ImportStepReview from './import-steps/ImportStepReview.vue'
import ImportStepComplete from './import-steps/ImportStepComplete.vue'
import type { Workspace, Expense, Actual, Frequency, LineType } from '@/types/models'
import type { ParsedCSV } from '@/engine/csvParser'
import type { MatchResult } from '@/engine/matching'

const props = defineProps<{ id: string }>()
const router = useRouter()

const workspace = ref<Workspace | null>(null)
const expenses = ref<Expense[]>([])
const existingActuals = ref<Actual[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const [foundWorkspace, foundExpenses, foundActuals] = await Promise.all([
      db.workspaces.get(props.id),
      db.expenses.where('workspaceId').equals(props.id).toArray(),
      db.actuals.where('workspaceId').equals(props.id).toArray(),
    ])
    if (!foundWorkspace) {
      router.replace({ name: 'workspace-list' })
      return
    }
    workspace.value = foundWorkspace
    expenses.value = foundExpenses
    existingActuals.value = foundActuals
  } catch {
    error.value = 'Couldn\'t load workspace data. Please go back and try again.'
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
const duplicateCount = ref(0)
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

function handleMappingComplete(data: { matchResults: MatchResult[]; skippedRows: number; duplicateCount: number }) {
  matchResults.value = data.matchResults
  skippedRows.value = data.skippedRows
  duplicateCount.value = data.duplicateCount
  step.value = 3
}

async function handleConfirmImport() {
  if (!workspace.value) return
  saving.value = true

  try {
    const now = nowISO()
    const approvedResults = matchResults.value.filter((r) => r.approved)

    const newActuals = approvedResults.map((r) => ({
      id: useId(),
      workspaceId: workspace.value!.id,
      expenseId: r.matchedExpense?.id ?? null,
      date: r.importedRow.date,
      amount: r.importedRow.amount,
      tags: r.importedRow.tags,
      description: r.importedRow.description,
      originalRow: r.importedRow.originalRow,
      matchConfidence: r.confidence,
      approved: true,
      createdAt: now,
      updatedAt: now,
    }))

    await db.actuals.bulkAdd(newActuals)

    // Update tag cache with all unique tags from imported rows
    const allTags = new Set<string>()
    for (const r of approvedResults) {
      for (const tag of r.importedRow.tags) {
        allTags.add(tag)
      }
    }
    await touchTags([...allTags])

    // Save category mappings for future imports
    await saveCategoryMappings(approvedResults)

    step.value = 4
  } catch {
    error.value = 'Couldn\'t save imported data. Please try again.'
  } finally {
    saving.value = false
  }
}

/**
 * Requirement: Learn description→tags mappings from confirmed imports
 * Approach: For each approved row with tags, create/update a CategoryMapping
 */
async function saveCategoryMappings(results: MatchResult[]) {
  if (!workspace.value) return

  const now = nowISO()
  const mappings: Array<{ id: string; workspaceId: string; pattern: string; tags: string[]; type: LineType; createdAt: string }> = []

  for (const r of results) {
    const desc = r.importedRow.description.toLowerCase().trim()
    if (!desc || r.importedRow.tags.length === 0) continue

    const type: LineType = r.importedRow.originalSign === 'negative' ? 'income' : 'expense'
    mappings.push({
      id: useId(),
      workspaceId: workspace.value.id,
      pattern: desc,
      tags: r.importedRow.tags,
      type,
      createdAt: now,
    })
  }

  if (mappings.length > 0) {
    await db.categoryMappings.bulkPut(mappings)
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
  tags: string[]
  amount: number
  frequency: Frequency
  type: LineType
}) {
  if (!workspace.value) return

  const now = nowISO()
  const newExpense: Expense = {
    id: useId(),
    workspaceId: workspace.value.id,
    description: data.description,
    tags: data.tags,
    amount: data.amount,
    frequency: data.frequency,
    type: data.type,
    startDate: workspace.value.startDate,
    endDate: null,
    createdAt: now,
    updatedAt: now,
  }

  try {
    await db.expenses.add(newExpense)
    expenses.value.push(newExpense)
    await touchTags(data.tags)

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
    router.push({ name: 'workspace-expenses', params: { id: props.id } })
  }
}

function finish() {
  router.push({ name: 'workspace-compare', params: { id: props.id } })
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
        :existing-actuals="existingActuals"
        :workspace-id="workspace.id"
        @complete="handleMappingComplete"
        @back="step = 1"
      />

      <!-- Step 3: Matching Review -->
      <ImportStepReview
        v-else-if="step === 3"
        :match-results="matchResults"
        :expenses="expenses"
        :workspace="workspace"
        :skipped-rows="skippedRows"
        :duplicate-count="duplicateCount"
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
