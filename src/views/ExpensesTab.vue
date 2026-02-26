<script setup lang="ts">
/**
 * Requirement: Expense list grouped by category with edit/delete per item
 * Approach: Load expenses for budget, group by category, display with actions
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ErrorAlert from '@/components/ErrorAlert.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import { formatAmount } from '@/composables/useFormat'
import { useToast } from '@/composables/useToast'
import type { Budget, Expense } from '@/types/models'

const props = defineProps<{ budget: Budget }>()
const router = useRouter()
const { show: showToast } = useToast()

const expenses = ref<Expense[]>([])
const loading = ref(true)
const deleteTarget = ref<Expense | null>(null)
const error = ref('')
const searchQuery = ref('')

onMounted(async () => {
  try {
    expenses.value = await db.expenses
      .where('budgetId')
      .equals(props.budget.id)
      .toArray()
  } catch {
    error.value = 'Couldn\'t load expenses. Please refresh and try again.'
  } finally {
    loading.value = false
  }
})

const filteredExpenses = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return expenses.value
  return expenses.value.filter((exp) =>
    exp.description.toLowerCase().includes(q) ||
    exp.category.toLowerCase().includes(q)
  )
})

const groupedExpenses = computed(() => {
  const groups: Record<string, Expense[]> = {}
  for (const exp of filteredExpenses.value) {
    if (!groups[exp.category]) groups[exp.category] = []
    groups[exp.category]!.push(exp)
  }
  // Sort categories alphabetically
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
})

function monthlyEquivalent(exp: Expense): number {
  if (exp.frequency === 'monthly') return exp.amount
  if (exp.frequency === 'once-off') return exp.amount
  if (exp.frequency === 'daily') return exp.amount * 30
  if (exp.frequency === 'weekly') return exp.amount * 4.33
  if (exp.frequency === 'quarterly') return exp.amount / 3
  if (exp.frequency === 'annually') return exp.amount / 12
  return 0
}

const totalMonthlyExpenses = computed(() => {
  return expenses.value
    .filter((e) => e.type !== 'income')
    .reduce((sum, exp) => sum + monthlyEquivalent(exp), 0)
})

const totalMonthlyIncome = computed(() => {
  return expenses.value
    .filter((e) => e.type === 'income')
    .reduce((sum, exp) => sum + monthlyEquivalent(exp), 0)
})

function frequencyLabel(f: string): string {
  const labels: Record<string, string> = {
    'once-off': 'Once-off',
    'daily': '/day',
    'weekly': '/week',
    'monthly': '/month',
    'quarterly': '/quarter',
    'annually': '/year',
  }
  return labels[f] ?? f
}

function addExpense() {
  router.push({ name: 'expense-create', params: { id: props.budget.id } })
}

function editExpense(exp: Expense) {
  router.push({
    name: 'expense-edit',
    params: { id: props.budget.id, expenseId: exp.id },
  })
}

async function confirmDelete() {
  if (!deleteTarget.value) return

  try {
    // Remove linked actuals when deleting an expense
    await db.transaction('rw', [db.expenses, db.actuals], async () => {
      await db.actuals.where('expenseId').equals(deleteTarget.value!.id).modify({ expenseId: null })
      await db.expenses.delete(deleteTarget.value!.id)
    })

    expenses.value = expenses.value.filter((e) => e.id !== deleteTarget.value!.id)
    showToast('Expense deleted')
    deleteTarget.value = null
  } catch {
    error.value = 'Couldn\'t delete the expense. Please try again.'
    deleteTarget.value = null
  }
}
</script>

<template>
  <div>
    <!-- Header with add button -->
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-gray-500">
        <template v-if="expenses.length > 0">
          {{ expenses.length }} item{{ expenses.length === 1 ? '' : 's' }}
          <template v-if="totalMonthlyIncome > 0">
            &middot; <span class="text-green-600">+{{ props.budget.currencyLabel }}{{ formatAmount(totalMonthlyIncome) }}</span>
          </template>
          &middot; <span class="text-red-600">-{{ props.budget.currencyLabel }}{{ formatAmount(totalMonthlyExpenses) }}</span>/month
        </template>
      </p>
      <button class="btn-primary text-sm" @click="addExpense">
        <span class="i-lucide-plus mr-1" />
        Add Item
      </button>
    </div>

    <!-- Search filter — shown when there are enough items to warrant filtering -->
    <div v-if="expenses.length >= 5" class="mb-4">
      <div class="relative">
        <span class="i-lucide-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          v-model="searchQuery"
          type="text"
          class="input-field pl-9"
          placeholder="Filter by name or category..."
        />
      </div>
    </div>

    <ErrorAlert v-if="error" :message="error" @dismiss="error = ''" />

    <LoadingSpinner v-if="loading" />

    <EmptyState
      v-else-if="expenses.length === 0"
      icon="i-lucide-list"
      title="No items yet"
      description="Add income and expense lines to start planning your cashflow"
    >
      <button class="btn-primary" @click="addExpense">Add your first item</button>
    </EmptyState>

    <!-- No search results -->
    <EmptyState
      v-else-if="filteredExpenses.length === 0 && searchQuery"
      icon="i-lucide-search-x"
      title="No matches"
      :description="`Nothing matches '${searchQuery}'`"
    />

    <!-- Grouped expense list -->
    <div v-else class="space-y-6">
      <div v-for="[category, items] in groupedExpenses" :key="category">
        <h3 class="section-title mb-2">{{ category }}</h3>
        <div class="space-y-2">
          <div
            v-for="exp in items"
            :key="exp.id"
            class="card flex items-center justify-between"
          >
            <div class="min-w-0 flex-1">
              <p class="font-medium text-gray-900 truncate">
                {{ exp.description }}
                <span v-if="exp.type === 'income'" class="text-xs text-green-600 font-normal ml-1">income</span>
              </p>
              <p class="text-sm" :class="exp.type === 'income' ? 'text-green-600' : 'text-gray-500'">
                {{ exp.type === 'income' ? '+' : '' }}{{ props.budget.currencyLabel }}{{ formatAmount(exp.amount) }}
                <span class="text-gray-400">{{ frequencyLabel(exp.frequency) }}</span>
              </p>
            </div>
            <div class="flex gap-1 ml-3 shrink-0">
              <button
                class="p-2.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
                :title="`Edit ${exp.description}`"
                :aria-label="`Edit ${exp.description}`"
                @click="editExpense(exp)"
              >
                <span class="i-lucide-pencil text-sm" aria-hidden="true" />
              </button>
              <button
                class="p-2.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                :title="`Delete ${exp.description}`"
                :aria-label="`Delete ${exp.description}`"
                @click="deleteTarget = exp"
              >
                <span class="i-lucide-trash-2 text-sm" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete confirmation -->
    <ConfirmDialog
      v-if="deleteTarget"
      title="Delete expense?"
      :message="`Remove '${deleteTarget.description}' (${props.budget.currencyLabel}${formatAmount(deleteTarget.amount)} ${frequencyLabel(deleteTarget.frequency)})? Any matched import data will be unlinked.`"
      confirm-label="Delete expense"
      :danger="true"
      @confirm="confirmDelete"
      @cancel="deleteTarget = null"
    />
  </div>
</template>
