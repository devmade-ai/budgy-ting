<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { nowISO } from '@/composables/useTimestamp'
import { useToast } from '@/composables/useToast'
import WorkspaceForm from '@/components/WorkspaceForm.vue'
import ErrorAlert from '@/components/ErrorAlert.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import type { Workspace, PeriodType } from '@/types/models'

const props = defineProps<{ id: string }>()
const router = useRouter()
const { show: showToast } = useToast()

const workspace = ref<Workspace | null>(null)
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const found = await db.workspaces.get(props.id)
    if (!found) {
      router.replace({ name: 'workspace-list' })
      return
    }
    workspace.value = found
  } catch {
    error.value = 'Couldn\'t load this workspace. Please go back and try again.'
  } finally {
    loading.value = false
  }
})

async function handleSubmit(data: {
  name: string
  currencyLabel: string
  periodType: PeriodType
  startDate: string
  endDate: string | null
}) {
  try {
    await db.workspaces.update(props.id, {
      name: data.name,
      currencyLabel: data.currencyLabel,
      periodType: data.periodType,
      startDate: data.startDate,
      endDate: data.endDate,
      updatedAt: nowISO(),
    })

    showToast('Workspace saved')
    router.push({ name: 'workspace-detail', params: { id: props.id } })
  } catch {
    error.value = 'Couldn\'t save changes. Please try again.'
  }
}

function handleCancel() {
  router.push({ name: 'workspace-detail', params: { id: props.id } })
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

    <ErrorAlert v-if="error" :message="error" @dismiss="error = ''" />

    <LoadingSpinner v-if="loading" />

    <template v-else-if="workspace">
      <h1 class="page-title mb-6">Edit Workspace</h1>
      <WorkspaceForm :workspace="workspace" @submit="handleSubmit" @cancel="handleCancel" />
    </template>
  </div>
</template>
