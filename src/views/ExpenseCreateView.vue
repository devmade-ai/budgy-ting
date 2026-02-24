<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { useId } from '@/composables/useId'
import { nowISO } from '@/composables/useTimestamp'
import { touchCategory } from '@/composables/useCategoryAutocomplete'
import ExpenseForm from '@/components/ExpenseForm.vue'
import type { Budget, Frequency } from '@/types/models'

const props = defineProps<{ id: string }>()
const router = useRouter()

const budget = ref<Budget | null>(null)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const found = await db.budgets.get(props.id)
    if (!found) {
      router.replace({ name: 'budget-list' })
      return
    }
    budget.value = found
  } catch {
    error.value = 'Couldn\'t load this budget. Please go back and try again.'
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
    const now = nowISO()

    await db.expenses.add({
      id: useId(),
      budgetId: props.id,
      description: data.description,
      category: data.category,
      amount: data.amount,
      frequency: data.frequency,
      startDate: data.startDate,
      endDate: data.endDate,
      createdAt: now,
      updatedAt: now,
    })

    await touchCategory(data.category)
    router.push({ name: 'budget-expenses', params: { id: props.id } })
  } catch {
    error.value = 'Couldn\'t add the expense. Please try again.'
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

    <div v-if="error" class="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center justify-between" role="alert">
      <span>{{ error }}</span>
      <button class="text-red-400 hover:text-red-600" @click="error = ''">
        <span class="i-lucide-x" />
      </button>
    </div>

    <div v-if="loading" class="text-center py-12 text-gray-400">Loading...</div>

    <template v-else-if="budget">
      <h1 class="page-title mb-6">Add Expense</h1>
      <ExpenseForm :budget="budget" @submit="handleSubmit" @cancel="handleCancel" />
    </template>
  </div>
</template>
