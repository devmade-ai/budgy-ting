<script setup lang="ts">
/**
 * Requirement: Multi-step import wizard — file upload, column mapping, matching, confirmation
 * Approach: Single-page wizard with step state management
 * Alternatives:
 *   - Separate route per step: Rejected — loses state between steps
 *   - Modal wizard: Rejected — too constrained for table-heavy review step
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { useId } from '@/composables/useId'
import { nowISO } from '@/composables/useTimestamp'
import { parseCSV, parseJSONImport } from '@/engine/csvParser'
import {
  matchImportedRows,
  DATE_FORMATS,
  detectDateFormat,
  parseDate,
  parseAmount,
} from '@/engine/matching'
import { formatAmount } from '@/composables/useFormat'
import type { Budget, Expense } from '@/types/models'
import type { ParsedCSV } from '@/engine/csvParser'
import type { ImportedRow, MatchResult } from '@/engine/matching'

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

// Step 1: File upload
const parsedData = ref<ParsedCSV | null>(null)
const fileError = ref('')

// Step 2: Column mapping
const dateColumn = ref('')
const amountColumn = ref('')
const categoryColumn = ref('')
const descriptionColumn = ref('')
const dateFormatIndex = ref(0)
const mappingErrors = ref<string[]>([])

// Step 3: Matching
const matchResults = ref<MatchResult[]>([])
const skippedRows = ref(0)

// Step 3: Pagination
const MATCHES_PER_PAGE = 50
const matchPage = ref(0)

// Step 4: Confirmation
const saving = ref(false)

// ── Step 1: File Upload ──

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  fileError.value = ''

  // 10MB cap per product definition security considerations
  if (file.size > 10 * 1024 * 1024) {
    fileError.value = 'File is too large (max 10 MB)'
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result as string
    if (!content) {
      fileError.value = 'Could not read file'
      return
    }

    const isJSON = file.name.endsWith('.json')
    parsedData.value = isJSON ? parseJSONImport(content) : parseCSV(content)

    if (parsedData.value.rows.length === 0) {
      fileError.value = parsedData.value.errors[0] || 'No data found in file'
      parsedData.value = null
      return
    }

    // Auto-detect columns
    autoDetectColumns()
  }
  reader.onerror = () => {
    fileError.value = 'Failed to read file'
  }
  reader.readAsText(file)
}

function autoDetectColumns() {
  if (!parsedData.value) return
  const headers = parsedData.value.headers.map((h) => h.toLowerCase())

  // Try to detect date column
  const dateHints = ['date', 'transaction date', 'trans date', 'posting date']
  const dateIdx = headers.findIndex((h) => dateHints.some((hint) => h.includes(hint)))
  if (dateIdx >= 0) dateColumn.value = parsedData.value.headers[dateIdx]!

  // Try to detect amount column
  const amountHints = ['amount', 'debit', 'value', 'total']
  const amountIdx = headers.findIndex((h) => amountHints.some((hint) => h.includes(hint)))
  if (amountIdx >= 0) amountColumn.value = parsedData.value.headers[amountIdx]!

  // Try to detect category column
  const catHints = ['category', 'type', 'group']
  const catIdx = headers.findIndex((h) => catHints.some((hint) => h.includes(hint)))
  if (catIdx >= 0) categoryColumn.value = parsedData.value.headers[catIdx]!

  // Try to detect description column
  const descHints = ['description', 'desc', 'memo', 'reference', 'narrative', 'details']
  const descIdx = headers.findIndex((h) => descHints.some((hint) => h.includes(hint)))
  if (descIdx >= 0) descriptionColumn.value = parsedData.value.headers[descIdx]!

  // Auto-detect date format from first few samples
  if (dateColumn.value) {
    const samples = parsedData.value.rows
      .slice(0, 10)
      .map((r) => r[dateColumn.value] ?? '')
      .filter(Boolean)
    const detected = detectDateFormat(samples)
    if (detected) {
      dateFormatIndex.value = DATE_FORMATS.indexOf(detected)
    }
  }
}

function goToStep2() {
  if (parsedData.value) step.value = 2
}

// ── Step 2: Column Mapping ──

const previewRows = computed(() => {
  if (!parsedData.value) return []
  return parsedData.value.rows.slice(0, 5)
})

function validateMapping(): boolean {
  const errs: string[] = []

  if (!dateColumn.value) errs.push('Date column is required')
  if (!amountColumn.value) errs.push('Amount column is required')
  if (!categoryColumn.value && !descriptionColumn.value) {
    errs.push('At least one of Category or Description is required')
  }

  // Validate a few rows
  if (parsedData.value && dateColumn.value && amountColumn.value) {
    let dateErrors = 0
    let amountErrors = 0
    for (const row of parsedData.value.rows.slice(0, 20)) {
      const dateVal = row[dateColumn.value] ?? ''
      if (dateVal && parseDate(dateVal, dateFormatIndex.value) === null) dateErrors++

      const amountVal = row[amountColumn.value] ?? ''
      if (amountVal && parseAmount(amountVal) === null) amountErrors++
    }

    if (dateErrors > 5) errs.push(`Many dates couldn't be parsed — check the date format`)
    if (amountErrors > 5) errs.push(`Many amounts couldn't be parsed — check the amount column`)
  }

  mappingErrors.value = errs
  return errs.length === 0
}

function goToStep3() {
  if (!validateMapping()) return
  runMatching()
  step.value = 3
}

// ── Step 3: Matching ──

function runMatching() {
  if (!parsedData.value) return

  const importedRows: ImportedRow[] = []
  let skipped = 0

  for (const row of parsedData.value.rows) {
    const dateStr = row[dateColumn.value] ?? ''
    const amountStr = row[amountColumn.value] ?? ''

    const parsedDateVal = parseDate(dateStr, dateFormatIndex.value)
    const parsedAmountVal = parseAmount(amountStr)

    if (!parsedDateVal || parsedAmountVal === null) {
      skipped++
      continue
    }

    importedRows.push({
      date: parsedDateVal,
      amount: Math.abs(parsedAmountVal),
      category: categoryColumn.value ? (row[categoryColumn.value] ?? '') : '',
      description: descriptionColumn.value ? (row[descriptionColumn.value] ?? '') : '',
      originalRow: row,
    })
  }

  skippedRows.value = skipped
  matchPage.value = 0
  matchResults.value = matchImportedRows(importedRows, expenses.value)
}

function toggleApproval(index: number) {
  const result = matchResults.value[index]
  if (!result) return
  result.approved = !result.approved
}

function reassignExpense(index: number, expenseId: string | null) {
  const result = matchResults.value[index]
  if (!result) return

  if (expenseId) {
    result.matchedExpense = expenses.value.find((e) => e.id === expenseId) ?? null
    result.confidence = 'manual'
    result.approved = true
  } else {
    result.matchedExpense = null
    result.confidence = 'unmatched'
    result.approved = true // Mark as unbudgeted but approved
  }
}

function approveAll(confidence: string) {
  for (const result of matchResults.value) {
    if (result.confidence === confidence) {
      result.approved = true
    }
  }
}

const paginatedResults = computed(() => {
  const start = matchPage.value * MATCHES_PER_PAGE
  return matchResults.value.slice(start, start + MATCHES_PER_PAGE)
})

const totalPages = computed(() => Math.ceil(matchResults.value.length / MATCHES_PER_PAGE))

const matchSummary = computed(() => {
  const total = matchResults.value.length
  const high = matchResults.value.filter((r) => r.confidence === 'high').length
  const medium = matchResults.value.filter((r) => r.confidence === 'medium').length
  const low = matchResults.value.filter((r) => r.confidence === 'low').length
  const manual = matchResults.value.filter((r) => r.confidence === 'manual').length
  const unmatched = matchResults.value.filter((r) => r.confidence === 'unmatched').length
  const approved = matchResults.value.filter((r) => r.approved).length
  return { total, high, medium, low, manual, unmatched, approved }
})

// ── Step 4: Confirmation ──

async function confirmImport() {
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

function confidenceColor(c: string): string {
  const colors: Record<string, string> = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-orange-100 text-orange-700',
    manual: 'bg-blue-100 text-blue-700',
    unmatched: 'bg-gray-100 text-gray-600',
  }
  return colors[c] ?? 'bg-gray-100 text-gray-600'
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

    <div v-if="error" class="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center justify-between" role="alert">
      <span>{{ error }}</span>
      <button class="text-red-400 hover:text-red-600" @click="error = ''">
        <span class="i-lucide-x" />
      </button>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-400">Loading...</div>

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
      <div v-if="step === 1">
        <h1 class="page-title mb-2">Import Actuals</h1>
        <p class="text-gray-500 text-sm mb-6">
          Upload a CSV or JSON file with your actual spending data
        </p>

        <label
          class="card flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-300 hover:border-brand-400 transition-colors cursor-pointer"
        >
          <div class="i-lucide-upload text-3xl text-gray-400 mb-3" />
          <p class="text-gray-600 font-medium">Choose a file</p>
          <p class="text-gray-400 text-sm mt-1">CSV or JSON, max 10 MB</p>
          <input
            type="file"
            accept=".csv,.json"
            class="hidden"
            @change="handleFileSelect"
          />
        </label>

        <p v-if="fileError" class="text-sm text-red-500 mt-3">{{ fileError }}</p>

        <!-- Preview -->
        <template v-if="parsedData">
          <div class="mt-6">
            <p class="text-sm text-gray-600 mb-2">
              {{ parsedData.totalRows }} rows detected with {{ parsedData.headers.length }} columns
            </p>
            <div class="overflow-x-auto">
              <table class="w-full text-xs border border-gray-200 rounded-lg">
                <thead>
                  <tr class="bg-gray-50">
                    <th
                      v-for="h in parsedData.headers"
                      :key="h"
                      class="text-left px-2 py-1.5 font-medium text-gray-600"
                    >
                      {{ h }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, i) in parsedData.rows.slice(0, 5)"
                    :key="i"
                    class="border-t border-gray-100"
                  >
                    <td
                      v-for="h in parsedData.headers"
                      :key="h"
                      class="px-2 py-1.5 text-gray-700 truncate max-w-[150px]"
                    >
                      {{ row[h] }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-if="parsedData.errors.length > 0" class="text-xs text-amber-600 mt-2">
              {{ parsedData.errors.length }} warning(s): {{ parsedData.errors[0] }}
            </p>
          </div>

          <button class="btn-primary mt-4" @click="goToStep2">
            Continue to mapping
          </button>
        </template>
      </div>

      <!-- Step 2: Column Mapping -->
      <div v-else-if="step === 2 && parsedData">
        <h1 class="page-title mb-2">Map Columns</h1>
        <p class="text-gray-500 text-sm mb-6">
          Tell us which columns contain the date, amount, and category/description
        </p>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Date column <span class="text-red-500">*</span>
            </label>
            <select v-model="dateColumn" class="input-field">
              <option value="">Select column...</option>
              <option v-for="h in parsedData.headers" :key="h" :value="h">{{ h }}</option>
            </select>
          </div>

          <div v-if="dateColumn">
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Date format
            </label>
            <select v-model.number="dateFormatIndex" class="input-field">
              <option v-for="(fmt, i) in DATE_FORMATS" :key="i" :value="i">
                {{ fmt.label }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Amount column <span class="text-red-500">*</span>
            </label>
            <select v-model="amountColumn" class="input-field">
              <option value="">Select column...</option>
              <option v-for="h in parsedData.headers" :key="h" :value="h">{{ h }}</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Category column
            </label>
            <select v-model="categoryColumn" class="input-field">
              <option value="">None</option>
              <option v-for="h in parsedData.headers" :key="h" :value="h">{{ h }}</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Description column
            </label>
            <select v-model="descriptionColumn" class="input-field">
              <option value="">None</option>
              <option v-for="h in parsedData.headers" :key="h" :value="h">{{ h }}</option>
            </select>
          </div>
        </div>

        <!-- Mapping errors -->
        <div v-if="mappingErrors.length > 0" class="mt-4 p-3 bg-red-50 rounded-lg">
          <p
            v-for="(err, i) in mappingErrors"
            :key="i"
            class="text-sm text-red-600"
          >
            {{ err }}
          </p>
        </div>

        <!-- Preview mapped data -->
        <div v-if="previewRows.length > 0 && dateColumn && amountColumn" class="mt-6">
          <p class="text-sm font-medium text-gray-700 mb-2">Preview (first 5 rows mapped)</p>
          <div class="overflow-x-auto">
            <table class="w-full text-xs border border-gray-200 rounded-lg">
              <thead>
                <tr class="bg-gray-50">
                  <th class="text-left px-2 py-1.5 font-medium text-gray-600">Date</th>
                  <th class="text-right px-2 py-1.5 font-medium text-gray-600">Amount</th>
                  <th v-if="categoryColumn" class="text-left px-2 py-1.5 font-medium text-gray-600">Category</th>
                  <th v-if="descriptionColumn" class="text-left px-2 py-1.5 font-medium text-gray-600">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, i) in previewRows"
                  :key="i"
                  class="border-t border-gray-100"
                >
                  <td class="px-2 py-1.5 text-gray-700">{{ row[dateColumn] }}</td>
                  <td class="px-2 py-1.5 text-gray-700 text-right">{{ row[amountColumn] }}</td>
                  <td v-if="categoryColumn" class="px-2 py-1.5 text-gray-700">{{ row[categoryColumn] }}</td>
                  <td v-if="descriptionColumn" class="px-2 py-1.5 text-gray-700 truncate max-w-[200px]">{{ row[descriptionColumn] }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="flex gap-3 mt-6">
          <button class="btn-primary" @click="goToStep3">
            Run matching
          </button>
          <button class="btn-secondary" @click="step = 1">
            Back
          </button>
        </div>
      </div>

      <!-- Step 3: Auto-Matching Review -->
      <div v-else-if="step === 3">
        <h1 class="page-title mb-2">Review Matches</h1>
        <p class="text-gray-500 text-sm mb-4">
          We matched your imported data against budget expenses. Review and approve the results.
        </p>

        <!-- Skipped row warning -->
        <div v-if="skippedRows > 0" class="mb-4 p-3 bg-amber-50 text-amber-700 text-sm rounded-lg" role="alert">
          {{ skippedRows }} row{{ skippedRows === 1 ? ' was' : 's were' }} skipped because the date or amount couldn't be read.
          Check the date format and amount column on the previous step.
        </div>

        <!-- Summary badges -->
        <div class="flex flex-wrap gap-2 mb-4">
          <span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
            {{ matchSummary.high }} auto-matched
          </span>
          <span v-if="matchSummary.medium > 0" class="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">
            {{ matchSummary.medium }} likely matches
          </span>
          <span v-if="matchSummary.low > 0" class="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-700">
            {{ matchSummary.low }} possible matches
          </span>
          <span v-if="matchSummary.unmatched > 0" class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
            {{ matchSummary.unmatched }} unmatched
          </span>
        </div>

        <!-- Bulk actions -->
        <div class="flex gap-2 mb-4">
          <button
            v-if="matchSummary.medium > 0"
            class="btn-secondary text-xs"
            @click="approveAll('medium')"
          >
            Approve all likely
          </button>
          <button
            v-if="matchSummary.low > 0"
            class="btn-secondary text-xs"
            @click="approveAll('low')"
          >
            Approve all possible
          </button>
        </div>

        <!-- Match results (paginated) -->
        <div class="space-y-2">
          <div
            v-for="(result, i) in paginatedResults"
            :key="matchPage * MATCHES_PER_PAGE + i"
            class="card p-3"
            :class="result.approved ? 'border-green-200' : ''"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span
                    class="px-1.5 py-0.5 text-xs rounded-full font-medium"
                    :class="confidenceColor(result.confidence)"
                  >
                    {{ result.confidence }}
                  </span>
                  <span class="text-xs text-gray-400">{{ result.importedRow.date }}</span>
                </div>
                <p class="text-sm text-gray-900">
                  {{ budget!.currencyLabel }}{{ formatAmount(result.importedRow.amount) }}
                  <span v-if="result.importedRow.description" class="text-gray-500">
                    — {{ result.importedRow.description }}
                  </span>
                  <span v-if="result.importedRow.category" class="text-gray-400 text-xs ml-1">
                    ({{ result.importedRow.category }})
                  </span>
                </p>
                <p v-if="result.matchedExpense" class="text-xs text-brand-600 mt-1">
                  Matched: {{ result.matchedExpense.description }} ({{ result.matchedExpense.category }})
                </p>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <select
                  class="text-xs border border-gray-200 rounded px-1 py-0.5"
                  aria-label="Assign to expense"
                  :value="result.matchedExpense?.id ?? ''"
                  @change="reassignExpense(matchPage * MATCHES_PER_PAGE + i, ($event.target as HTMLSelectElement).value || null)"
                >
                  <option value="">Unbudgeted</option>
                  <option
                    v-for="exp in expenses"
                    :key="exp.id"
                    :value="exp.id"
                  >
                    {{ exp.description }} ({{ exp.category }})
                  </option>
                </select>

                <button
                  class="btn text-xs px-2 py-1"
                  :class="result.approved
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'"
                  @click="toggleApproval(matchPage * MATCHES_PER_PAGE + i)"
                >
                  {{ result.approved ? 'Approved' : 'Approve' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination controls -->
        <div v-if="totalPages > 1" class="flex items-center justify-between mt-4">
          <button
            class="btn-secondary text-xs"
            :disabled="matchPage === 0"
            @click="matchPage--"
          >
            Previous
          </button>
          <span class="text-xs text-gray-500">
            Page {{ matchPage + 1 }} of {{ totalPages }}
          </span>
          <button
            class="btn-secondary text-xs"
            :disabled="matchPage >= totalPages - 1"
            @click="matchPage++"
          >
            Next
          </button>
        </div>

        <div class="flex gap-3 mt-6">
          <button
            class="btn-primary"
            :disabled="saving || matchSummary.approved === 0"
            @click="confirmImport"
          >
            {{ saving ? 'Saving...' : `Import ${matchSummary.approved} rows` }}
          </button>
          <button class="btn-secondary" @click="step = 2">
            Back
          </button>
        </div>
      </div>

      <!-- Step 4: Confirmation -->
      <div v-else-if="step === 4">
        <div class="text-center py-12">
          <div class="i-lucide-check-circle text-5xl text-green-500 mx-auto mb-4" />
          <h1 class="page-title mb-2">Import Complete</h1>
          <p class="text-gray-500 mb-6">
            Successfully imported {{ matchSummary.approved }} transactions
          </p>

          <div class="card max-w-xs mx-auto mb-6 text-left">
            <div class="space-y-1 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">Auto-matched</span>
                <span class="font-medium">{{ matchSummary.high }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Manually approved</span>
                <span class="font-medium">{{ matchSummary.medium + matchSummary.low + matchSummary.manual }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Unbudgeted</span>
                <span class="font-medium">{{ matchSummary.unmatched }}</span>
              </div>
            </div>
          </div>

          <button class="btn-primary" @click="finish">
            View comparison
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
