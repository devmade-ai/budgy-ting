<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from 'lucide-vue-next'
import { db } from '@/db'
import { generateId } from '@/composables/useId'
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
}) {
  try {
    const now = nowISO()
    const id = generateId()

    await db.workspaces.add({
      id,
      name: data.name,
      currencyLabel: data.currencyLabel,
      periodType: data.periodType,
      startDate: data.periodType === 'monthly' ? todayISO() : data.startDate,
      endDate: data.endDate,
      isDemo: false,
      cashOnHand: null,
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
      class="text-sm text-base-content/60 hover:text-base-content mb-4 flex items-center gap-1"
      @click="handleCancel"
    >
      <ArrowLeft :size="16" />
      Back
    </button>
    <h1 class="text-2xl font-bold text-base-content mb-6">New Workspace</h1>
    <ErrorAlert v-if="error" :message="error" @dismiss="error = ''" />
    <WorkspaceForm @submit="handleSubmit" @cancel="handleCancel" />
  </div>
</template>
