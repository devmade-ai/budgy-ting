<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { nowISO } from '@/composables/useTimestamp'
import BudgetForm from '@/components/BudgetForm.vue'
import type { Budget, PeriodType } from '@/types/models'

const props = defineProps<{ id: string }>()
const router = useRouter()

const budget = ref<Budget | null>(null)
const loading = ref(true)

onMounted(async () => {
  const found = await db.budgets.get(props.id)
  if (!found) {
    router.replace({ name: 'budget-list' })
    return
  }
  budget.value = found
  loading.value = false
})

async function handleSubmit(data: {
  name: string
  currencyLabel: string
  periodType: PeriodType
  startDate: string
  endDate: string | null
}) {
  await db.budgets.update(props.id, {
    name: data.name,
    currencyLabel: data.currencyLabel,
    periodType: data.periodType,
    startDate: data.startDate,
    endDate: data.endDate,
    updatedAt: nowISO(),
  })

  router.push({ name: 'budget-detail', params: { id: props.id } })
}

function handleCancel() {
  router.push({ name: 'budget-detail', params: { id: props.id } })
}
</script>

<template>
  <div>
    <button
      class="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
      @click="handleCancel"
    >
      <span class="i-lucide-arrow-left" />
      Back
    </button>

    <div v-if="loading" class="text-center py-12 text-gray-400">Loading...</div>

    <template v-else-if="budget">
      <h1 class="page-title mb-6">Edit Budget</h1>
      <BudgetForm :budget="budget" @submit="handleSubmit" @cancel="handleCancel" />
    </template>
  </div>
</template>
