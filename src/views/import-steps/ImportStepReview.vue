<script setup lang="ts">
/**
 * Requirement: Step 3 of import wizard — match review with pagination
 * Approach: Extracted from ImportWizardView to reduce component size
 *
 * Requirement: Allow creating new income/expense lines during import review
 * Approach: Inline modal form pre-filled from imported row data, emits to parent for DB save
 * Alternatives:
 *   - Navigate away to expense form: Rejected — loses import wizard state
 *   - Reuse full ExpenseForm component: Rejected — too heavy for inline use, needs budget context wiring
 */

import { ref, computed } from 'vue'
import { formatAmount } from '@/composables/useFormat'
import type { Budget, Expense, Frequency, LineType } from '@/types/models'
import type { MatchResult } from '@/engine/matching'

const props = defineProps<{
  matchResults: MatchResult[]
  expenses: Expense[]
  budget: Budget
  skippedRows: number
  saving: boolean
}>()

const emit = defineEmits<{
  confirm: []
  back: []
  'create-expense': [data: {
    matchIndex: number
    description: string
    category: string
    amount: number
    frequency: Frequency
    type: LineType
  }]
}>()

const MATCHES_PER_PAGE = 50
const matchPage = ref(0)

const paginatedResults = computed(() => {
  const start = matchPage.value * MATCHES_PER_PAGE
  return props.matchResults.slice(start, start + MATCHES_PER_PAGE)
})

const totalPages = computed(() => Math.ceil(props.matchResults.length / MATCHES_PER_PAGE))

const matchSummary = computed(() => {
  const total = props.matchResults.length
  const high = props.matchResults.filter((r) => r.confidence === 'high').length
  const medium = props.matchResults.filter((r) => r.confidence === 'medium').length
  const low = props.matchResults.filter((r) => r.confidence === 'low').length
  const manual = props.matchResults.filter((r) => r.confidence === 'manual').length
  const unmatched = props.matchResults.filter((r) => r.confidence === 'unmatched').length
  const approved = props.matchResults.filter((r) => r.approved).length
  return { total, high, medium, low, manual, unmatched, approved }
})

function toggleApproval(index: number) {
  const result = props.matchResults[index]
  if (!result) return
  result.approved = !result.approved
}

function reassignExpense(index: number, expenseId: string | null) {
  const result = props.matchResults[index]
  if (!result) return

  if (expenseId) {
    result.matchedExpense = props.expenses.find((e) => e.id === expenseId) ?? null
    result.confidence = 'manual'
    result.approved = true
  } else {
    result.matchedExpense = null
    result.confidence = 'unmatched'
    result.approved = true
  }
}

function approveAll(confidence: string) {
  for (const result of props.matchResults) {
    if (result.confidence === confidence) {
      result.approved = true
    }
  }
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

// ── "Create new" inline form ──

const creatingForIndex = ref<number | null>(null)
const newType = ref<LineType>('expense')
const newDescription = ref('')
const newCategory = ref('')
const newAmount = ref('')
const newFrequency = ref<Frequency>('monthly')
const newErrors = ref<Record<string, string>>({})

const frequencies: { value: Frequency; label: string }[] = [
  { value: 'once-off', label: 'Once-off' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
]

function openCreateForm(matchIndex: number) {
  const row = props.matchResults[matchIndex]?.importedRow
  if (!row) return

  creatingForIndex.value = matchIndex
  // Pre-fill from imported row data
  newDescription.value = row.description || ''
  newCategory.value = row.category || ''
  newAmount.value = row.amount ? String(row.amount) : ''
  // Use CSV sign as hint: negative typically means income in bank statements
  newType.value = row.originalSign === 'negative' ? 'income' : 'expense'
  newFrequency.value = 'monthly'
  newErrors.value = {}
}

function cancelCreate() {
  creatingForIndex.value = null
  newErrors.value = {}
}

function submitCreate() {
  if (creatingForIndex.value === null) return

  const errors: Record<string, string> = {}
  if (!newDescription.value.trim()) errors['description'] = 'Description is required'
  if (!newCategory.value.trim()) errors['category'] = 'Category is required'
  const parsedAmount = parseFloat(newAmount.value)
  if (!newAmount.value || isNaN(parsedAmount) || parsedAmount <= 0) {
    errors['amount'] = 'Enter a positive amount'
  }
  if (Object.keys(errors).length > 0) {
    newErrors.value = errors
    return
  }

  emit('create-expense', {
    matchIndex: creatingForIndex.value,
    description: newDescription.value.trim(),
    category: newCategory.value.trim(),
    amount: parsedAmount,
    frequency: newFrequency.value,
    type: newType.value,
  })

  creatingForIndex.value = null
  newErrors.value = {}
}

function handleDropdownChange(matchIndex: number, value: string) {
  if (value === '__create__') {
    openCreateForm(matchIndex)
  } else {
    reassignExpense(matchIndex, value || null)
  }
}
</script>

<template>
  <div>
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
              {{ budget.currencyLabel }}{{ formatAmount(result.importedRow.amount) }}
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
              @change="handleDropdownChange(matchPage * MATCHES_PER_PAGE + i, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">Unbudgeted</option>
              <option value="__create__">+ Create new...</option>
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
        @click="emit('confirm')"
      >
        {{ saving ? 'Saving...' : `Import ${matchSummary.approved} rows` }}
      </button>
      <button class="btn-secondary" @click="emit('back')">
        Back
      </button>
    </div>

    <!-- Create new income/expense modal -->
    <Teleport to="body">
      <div
        v-if="creatingForIndex !== null"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        @click.self="cancelCreate"
      >
        <div class="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-5" role="dialog" aria-label="Create new income or expense">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Create new line</h2>

          <!-- Type toggle -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <div class="flex gap-2">
              <button
                type="button"
                class="btn flex-1 text-sm"
                :class="newType === 'expense'
                  ? 'bg-red-50 text-red-700 border border-red-300'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'"
                @click="newType = 'expense'"
              >
                Expense
              </button>
              <button
                type="button"
                class="btn flex-1 text-sm"
                :class="newType === 'income'
                  ? 'bg-green-50 text-green-700 border border-green-300'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'"
                @click="newType = 'income'"
              >
                Income
              </button>
            </div>
          </div>

          <!-- Description -->
          <div class="mb-3">
            <label class="block text-sm font-medium text-gray-700 mb-1" for="new-desc">Description</label>
            <input
              id="new-desc"
              v-model="newDescription"
              type="text"
              class="input-field text-sm"
              placeholder="e.g. Salary, Netflix"
            />
            <p v-if="newErrors['description']" class="text-xs text-red-500 mt-1">{{ newErrors['description'] }}</p>
          </div>

          <!-- Category -->
          <div class="mb-3">
            <label class="block text-sm font-medium text-gray-700 mb-1" for="new-cat">Category</label>
            <input
              id="new-cat"
              v-model="newCategory"
              type="text"
              class="input-field text-sm"
              placeholder="e.g. Income, Entertainment"
            />
            <p v-if="newErrors['category']" class="text-xs text-red-500 mt-1">{{ newErrors['category'] }}</p>
          </div>

          <!-- Amount -->
          <div class="mb-3">
            <label class="block text-sm font-medium text-gray-700 mb-1" for="new-amount">
              Amount ({{ budget.currencyLabel }})
            </label>
            <input
              id="new-amount"
              v-model="newAmount"
              type="number"
              step="0.01"
              min="0.01"
              class="input-field text-sm"
              placeholder="0.00"
            />
            <p v-if="newErrors['amount']" class="text-xs text-red-500 mt-1">{{ newErrors['amount'] }}</p>
          </div>

          <!-- Frequency -->
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-1">How often?</label>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                v-for="f in frequencies"
                :key="f.value"
                type="button"
                class="btn text-xs py-1.5"
                :class="newFrequency === f.value
                  ? 'bg-brand-50 text-brand-700 border border-brand-300'
                  : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'"
                @click="newFrequency = f.value"
              >
                {{ f.label }}
              </button>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-3">
            <button
              type="button"
              class="btn-primary flex-1 text-sm"
              @click="submitCreate"
            >
              Create &amp; assign
            </button>
            <button
              type="button"
              class="btn-secondary text-sm"
              @click="cancelCreate"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
