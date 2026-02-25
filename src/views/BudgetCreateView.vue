<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { useId } from '@/composables/useId'
import { nowISO, todayISO } from '@/composables/useTimestamp'
import BudgetForm from '@/components/BudgetForm.vue'
import ErrorAlert from '@/components/ErrorAlert.vue'
import type { PeriodType } from '@/types/models'

const router = useRouter()
const error = ref('')

async function handleSubmit(data: {
  name: string
  currencyLabel: string
  periodType: PeriodType
  startDate: string
  endDate: string | null
  startingBalance: number | null
}) {
  try {
    const now = nowISO()
    const id = useId()

    await db.budgets.add({
      id,
      name: data.name,
      currencyLabel: data.currencyLabel,
      periodType: data.periodType,
      startDate: data.periodType === 'monthly' ? todayISO() : data.startDate,
      endDate: data.endDate,
      startingBalance: data.startingBalance,
      createdAt: now,
      updatedAt: now,
    })

    router.push({ name: 'budget-detail', params: { id } })
  } catch {
    error.value = 'Couldn\'t create the budget. Please check your storage and try again.'
  }
}

function handleCancel() {
  router.push({ name: 'budget-list' })
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
    <h1 class="page-title mb-6">New Budget</h1>
    <ErrorAlert v-if="error" :message="error" @dismiss="error = ''" />
    <BudgetForm @submit="handleSubmit" @cancel="handleCancel" />
  </div>
</template>
