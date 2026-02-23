<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db } from '@/db'
import { exportBudget, downloadJSON } from '@/engine/exportImport'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import type { Budget } from '@/types/models'

const props = defineProps<{ id: string }>()
const route = useRoute()
const router = useRouter()

const budget = ref<Budget | null>(null)
const loading = ref(true)
const showDeleteConfirm = ref(false)

onMounted(async () => {
  const found = await db.budgets.get(props.id)
  if (!found) {
    router.replace({ name: 'budget-list' })
    return
  }
  budget.value = found
  loading.value = false
})

const tabs = [
  { name: 'budget-expenses', label: 'Expenses', icon: 'i-lucide-list' },
  { name: 'budget-projected', label: 'Projected', icon: 'i-lucide-trending-up' },
  { name: 'budget-compare', label: 'Compare', icon: 'i-lucide-bar-chart-3' },
] as const

const activeTab = computed(() => route.name as string)

function editBudget() {
  router.push({ name: 'budget-edit', params: { id: props.id } })
}

async function handleExport() {
  const data = await exportBudget(props.id)
  if (data) downloadJSON(data, data.budget.name)
}

async function deleteBudget() {
  // Cascade delete: remove expenses and actuals linked to this budget
  await db.transaction('rw', [db.budgets, db.expenses, db.actuals], async () => {
    await db.actuals.where('budgetId').equals(props.id).delete()
    await db.expenses.where('budgetId').equals(props.id).delete()
    await db.budgets.delete(props.id)
  })
  router.replace({ name: 'budget-list' })
}
</script>

<template>
  <div v-if="loading" class="text-center py-12 text-gray-400">
    Loading...
  </div>

  <div v-else-if="budget">
    <!-- Budget header -->
    <div class="mb-6">
      <button
        class="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
        @click="router.push({ name: 'budget-list' })"
      >
        <span class="i-lucide-arrow-left" />
        Budgets
      </button>
      <div class="flex items-center justify-between">
        <div>
          <h1 class="page-title">{{ budget.name }}</h1>
          <p class="text-sm text-gray-500 mt-0.5">
            {{ budget.periodType === 'monthly' ? 'Monthly' : 'Custom period' }}
            <span v-if="budget.currencyLabel"> &middot; {{ budget.currencyLabel }}</span>
          </p>
        </div>
        <div class="flex gap-2">
          <button
            class="btn-primary text-sm"
            title="Import actuals"
            @click="router.push({ name: 'import-actuals', params: { id: props.id } })"
          >
            <span class="i-lucide-upload mr-1" />
            Import
          </button>
          <button
            class="btn-secondary text-sm"
            title="Export budget"
            @click="handleExport"
          >
            <span class="i-lucide-download mr-1" />
            Export
          </button>
          <button
            class="btn-secondary text-sm"
            title="Edit budget"
            @click="editBudget"
          >
            <span class="i-lucide-pencil mr-1" />
            Edit
          </button>
          <button
            class="btn-danger text-sm"
            title="Delete budget"
            @click="showDeleteConfirm = true"
          >
            <span class="i-lucide-trash-2 mr-1" />
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Tab navigation -->
    <nav class="flex border-b border-gray-200 mb-6">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.name"
        :to="{ name: tab.name, params: { id: budget.id } }"
        class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
        :class="
          activeTab === tab.name
            ? 'border-brand-500 text-brand-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        "
      >
        <span :class="tab.icon" class="mr-1.5" />
        {{ tab.label }}
      </RouterLink>
    </nav>

    <!-- Tab content -->
    <RouterView :budget="budget" />

    <!-- Delete confirmation -->
    <ConfirmDialog
      v-if="showDeleteConfirm"
      title="Delete budget?"
      :message="`This will permanently delete '${budget.name}' and all its expenses and imported data. This cannot be undone.`"
      confirm-label="Delete budget"
      :danger="true"
      @confirm="deleteBudget"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>
