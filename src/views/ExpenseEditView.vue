<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { nowISO } from '@/composables/useTimestamp'
import { touchCategory } from '@/composables/useCategoryAutocomplete'
import ExpenseForm from '@/components/ExpenseForm.vue'
import ErrorAlert from '@/components/ErrorAlert.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import type { Budget, Expense, Frequency } from '@/types/models'

const props = defineProps<{ id: string; expenseId: string }>()
const router = useRouter()

const budget = ref<Budget | null>(null)
const expense = ref<Expense | null>(null)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const [foundBudget, foundExpense] = await Promise.all([
      db.budgets.get(props.id),
      db.expenses.get(props.expenseId),
    ])

    if (!foundBudget || !foundExpense) {
      router.replace({ name: 'budget-list' })
      return
    }

    budget.value = foundBudget
    expense.value = foundExpense
  } catch {
    error.value = 'Couldn\'t load this expense. Please go back and try again.'
  } finally {
    loading.value = false
  }
})

async function handleSubmit(data: {
  description: string
  category: string
  amount: number
  frequency: Frequency
  startDate: string
  endDate: string | null
}) {
  try {
    await db.expenses.update(props.expenseId, {
      description: data.description,
      category: data.category,
      amount: data.amount,
      frequency: data.frequency,
      startDate: data.startDate,
      endDate: data.endDate,
      updatedAt: nowISO(),
    })

    await touchCategory(data.category)
    router.push({ name: 'budget-expenses', params: { id: props.id } })
  } catch {
    error.value = 'Couldn\'t save changes. Please try again.'
  }
}

function handleCancel() {
  router.push({ name: 'budget-expenses', params: { id: props.id } })
}
</script>

<template>
  <div>
    <button
      class="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
      @click="handleCancel"
    >
      <span class="i-lucide-arrow-left" />
      Back to expenses
    </button>

    <ErrorAlert v-if="error" :message="error" @dismiss="error = ''" />

    <LoadingSpinner v-if="loading" />

    <template v-else-if="budget && expense">
      <h1 class="page-title mb-6">Edit Expense</h1>
      <ExpenseForm
        :budget="budget"
        :expense="expense"
        @submit="handleSubmit"
        @cancel="handleCancel"
      />
    </template>
  </div>
</template>
