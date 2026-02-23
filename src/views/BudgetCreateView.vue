<script setup lang="ts">
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { useId } from '@/composables/useId'
import { nowISO, todayISO } from '@/composables/useTimestamp'
import BudgetForm from '@/components/BudgetForm.vue'
import type { PeriodType } from '@/types/models'

const router = useRouter()

async function handleSubmit(data: {
  name: string
  currencyLabel: string
  periodType: PeriodType
  startDate: string
  endDate: string | null
}) {
  const now = nowISO()
  const id = useId()

  await db.budgets.add({
    id,
    name: data.name,
    currencyLabel: data.currencyLabel,
    periodType: data.periodType,
    startDate: data.periodType === 'monthly' ? todayISO() : data.startDate,
    endDate: data.endDate,
    createdAt: now,
    updatedAt: now,
  })

  router.push({ name: 'budget-detail', params: { id } })
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
    <BudgetForm @submit="handleSubmit" @cancel="handleCancel" />
  </div>
</template>
