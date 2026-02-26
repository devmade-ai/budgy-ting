<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { useId } from '@/composables/useId'
import { nowISO, todayISO } from '@/composables/useTimestamp'
import { useToast } from '@/composables/useToast'
import WorkspaceForm from '@/components/WorkspaceForm.vue'
import ErrorAlert from '@/components/ErrorAlert.vue'
import type { PeriodType } from '@/types/models'

const router = useRouter()
const { show: showToast } = useToast()
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

    await db.workspaces.add({
      id,
      name: data.name,
      currencyLabel: data.currencyLabel,
      periodType: data.periodType,
      startDate: data.periodType === 'monthly' ? todayISO() : data.startDate,
      endDate: data.endDate,
      startingBalance: data.startingBalance,
      isDemo: false,
      createdAt: now,
      updatedAt: now,
    })

    showToast('Workspace created')
    router.push({ name: 'workspace-detail', params: { id } })
  } catch {
    error.value = 'Couldn\'t create the workspace. Please check your storage and try again.'
  }
}

function handleCancel() {
  router.push({ name: 'workspace-list' })
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
    <h1 class="page-title mb-6">New Workspace</h1>
    <ErrorAlert v-if="error" :message="error" @dismiss="error = ''" />
    <WorkspaceForm @submit="handleSubmit" @cancel="handleCancel" />
  </div>
</template>
