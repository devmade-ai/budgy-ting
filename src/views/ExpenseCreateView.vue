<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { useId } from '@/composables/useId'
import { nowISO } from '@/composables/useTimestamp'
import { touchTags } from '@/composables/useTagAutocomplete'
import { useToast } from '@/composables/useToast'
import ExpenseForm from '@/components/ExpenseForm.vue'
import ErrorAlert from '@/components/ErrorAlert.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import type { Workspace, Frequency, LineType } from '@/types/models'

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
  description: string
  tags: string[]
  amount: number
  frequency: Frequency
  type: LineType
  startDate: string
  endDate: string | null
}) {
  try {
    const now = nowISO()

    await db.expenses.add({
      id: useId(),
      workspaceId: props.id,
      description: data.description,
      tags: data.tags,
      amount: data.amount,
      frequency: data.frequency,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      createdAt: now,
      updatedAt: now,
    })

    await touchTags(data.tags)
    showToast('Expense added')
    router.push({ name: 'workspace-expenses', params: { id: props.id } })
  } catch {
    error.value = 'Couldn\'t add the expense. Please try again.'
  }
}

function handleCancel() {
  router.push({ name: 'workspace-expenses', params: { id: props.id } })
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

    <template v-else-if="workspace">
      <h1 class="page-title mb-6">Add Expense</h1>
      <ExpenseForm :workspace="workspace" @submit="handleSubmit" @cancel="handleCancel" />
    </template>
  </div>
</template>
