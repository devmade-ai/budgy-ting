<script setup lang="ts">
/**
 * Requirement: Expense list grouped by category with edit/delete per item
 * Approach: Load expenses for budget, group by category, display with actions
 */

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import type { Budget, Expense } from '@/types/models'

const props = defineProps<{ budget: Budget }>()
const router = useRouter()

const expenses = ref<Expense[]>([])
const loading = ref(true)
const deleteTarget = ref<Expense | null>(null)

onMounted(async () => {
  expenses.value = await db.expenses
    .where('budgetId')
    .equals(props.budget.id)
    .toArray()
  loading.value = false
})

const groupedExpenses = computed(() => {
  const groups: Record<string, Expense[]> = {}
  for (const exp of expenses.value) {
    if (!groups[exp.category]) groups[exp.category] = []
    groups[exp.category]!.push(exp)
  }
  // Sort categories alphabetically
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
})

const totalMonthly = computed(() => {
  return expenses.value.reduce((sum, exp) => {
    if (exp.frequency === 'monthly') return sum + exp.amount
    if (exp.frequency === 'once-off') return sum + exp.amount
    if (exp.frequency === 'daily') return sum + exp.amount * 30
    if (exp.frequency === 'weekly') return sum + exp.amount * 4.33
    if (exp.frequency === 'quarterly') return sum + exp.amount / 3
    if (exp.frequency === 'annually') return sum + exp.amount / 12
    return sum
  }, 0)
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

function formatAmount(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

  // Remove linked actuals when deleting an expense
  await db.transaction('rw', [db.expenses, db.actuals], async () => {
    await db.actuals.where('expenseId').equals(deleteTarget.value!.id).modify({ expenseId: null })
    await db.expenses.delete(deleteTarget.value!.id)
  })

  expenses.value = expenses.value.filter((e) => e.id !== deleteTarget.value!.id)
  deleteTarget.value = null
}
</script>

<template>
  <div>
    <!-- Header with add button -->
    <div class="flex items-center justify-between mb-4">
      <p class="text-sm text-gray-500">
        <template v-if="expenses.length > 0">
          {{ expenses.length }} expense{{ expenses.length === 1 ? '' : 's' }}
          &middot; ~{{ props.budget.currencyLabel }}{{ formatAmount(totalMonthly) }}/month
        </template>
      </p>
      <button class="btn-primary text-sm" @click="addExpense">
        <span class="i-lucide-plus mr-1" />
        Add Expense
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-gray-400">Loading...</div>

    <!-- Empty state -->
    <div v-else-if="expenses.length === 0" class="text-center py-12">
      <div class="i-lucide-list text-4xl text-gray-300 mx-auto mb-3" />
      <p class="text-gray-500">No expenses yet</p>
      <p class="text-gray-400 text-sm mt-1 mb-4">
        Add expense lines to start planning your budget
      </p>
      <button class="btn-primary" @click="addExpense">Add your first expense</button>
    </div>

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
              <p class="font-medium text-gray-900 truncate">{{ exp.description }}</p>
              <p class="text-sm text-gray-500">
                {{ props.budget.currencyLabel }}{{ formatAmount(exp.amount) }}
                <span class="text-gray-400">{{ frequencyLabel(exp.frequency) }}</span>
              </p>
            </div>
            <div class="flex gap-1 ml-3 shrink-0">
              <button
                class="p-1.5 text-gray-400 hover:text-gray-600 rounded transition-colors"
                title="Edit"
                @click="editExpense(exp)"
              >
                <span class="i-lucide-pencil text-sm" />
              </button>
              <button
                class="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                title="Delete"
                @click="deleteTarget = exp"
              >
                <span class="i-lucide-trash-2 text-sm" />
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
