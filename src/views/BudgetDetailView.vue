<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db } from '@/db'
import { exportBudget, downloadJSON } from '@/engine/exportImport'
import { useToast } from '@/composables/useToast'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ErrorAlert from '@/components/ErrorAlert.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import type { Budget } from '@/types/models'

const props = defineProps<{ id: string }>()
const route = useRoute()
const router = useRouter()
const { show: showToast } = useToast()

const budget = ref<Budget | null>(null)
const loading = ref(true)
const showDeleteConfirm = ref(false)
const error = ref('')

// Overflow menu for secondary actions (Export, Edit, Delete)
const actionsMenuOpen = ref(false)
const actionsMenuRef = ref<HTMLElement | null>(null)

function toggleActionsMenu() {
  actionsMenuOpen.value = !actionsMenuOpen.value
}

function handleActionsOutsideClick(e: MouseEvent) {
  if (actionsMenuOpen.value && actionsMenuRef.value && !actionsMenuRef.value.contains(e.target as Node)) {
    actionsMenuOpen.value = false
  }
}

onMounted(async () => {
  document.addEventListener('click', handleActionsOutsideClick)
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

onUnmounted(() => {
  document.removeEventListener('click', handleActionsOutsideClick)
})

// Requirement: Tab labels must be plain language for non-technical users
// "Projected" → "Forecast", "Cashflow" → "Balance" are clearer for everyday budgeting
const tabs = [
  { name: 'budget-expenses', label: 'Expenses', icon: 'i-lucide-list' },
  { name: 'budget-projected', label: 'Forecast', icon: 'i-lucide-trending-up' },
  { name: 'budget-cashflow', label: 'Balance', icon: 'i-lucide-wallet' },
  { name: 'budget-compare', label: 'Compare', icon: 'i-lucide-bar-chart-3' },
] as const

const activeTab = computed(() => route.name as string)

function editBudget() {
  router.push({ name: 'budget-edit', params: { id: props.id } })
}

async function handleExport() {
  try {
    const data = await exportBudget(props.id)
    if (data) {
      downloadJSON(data, data.budget.name)
      showToast('Budget exported')
    }
  } catch {
    error.value = 'Couldn\'t export the budget. Please try again.'
  }
}

async function deleteBudget() {
  // Requirement: Deleting a budget removes all related data
  // Approach: Cascade delete in a single transaction — actuals, then expenses, then budget
  // Alternatives:
  //   - Soft-delete with archival: Rejected — adds complexity for an MVP with JSON export backup
  //   - Leave orphaned data: Rejected — wastes IndexedDB space, confuses future queries
  try {
    await db.transaction('rw', [db.budgets, db.expenses, db.actuals], async () => {
      await db.actuals.where('budgetId').equals(props.id).delete()
      await db.expenses.where('budgetId').equals(props.id).delete()
      await db.budgets.delete(props.id)
    })
    showToast('Budget deleted')
    router.replace({ name: 'budget-list' })
  } catch {
    error.value = 'Couldn\'t delete the budget. Please try again.'
    showDeleteConfirm.value = false
  }
}
</script>

<template>
  <ErrorAlert v-if="error" :message="error" @dismiss="error = ''" />

  <LoadingSpinner v-if="loading" />

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
        <!-- Requirement: On narrow screens, 4 inline buttons wrap messily
             Approach: Import as primary CTA + kebab overflow for secondary actions (Export/Edit/Delete)
             Alternatives:
               - All inline: Rejected — wraps on 320px screens
               - All in menu: Rejected — Import is the main action, should be prominent -->
        <div class="flex items-center gap-2">
          <button
            class="btn-primary text-sm"
            title="Import actuals"
            @click="router.push({ name: 'import-actuals', params: { id: props.id } })"
          >
            <span class="i-lucide-upload mr-1" />
            Import
          </button>
          <div ref="actionsMenuRef" class="relative">
            <button
              class="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="More actions"
              aria-label="More actions"
              aria-haspopup="true"
              :aria-expanded="actionsMenuOpen"
              @click="toggleActionsMenu"
            >
              <span class="i-lucide-more-vertical text-lg" aria-hidden="true" />
            </button>
            <div
              v-if="actionsMenuOpen"
              class="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20"
              role="menu"
            >
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                role="menuitem"
                @click="actionsMenuOpen = false; handleExport()"
              >
                <span class="i-lucide-download text-base text-gray-400" aria-hidden="true" />
                Export
              </button>
              <button
                class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                role="menuitem"
                @click="actionsMenuOpen = false; editBudget()"
              >
                <span class="i-lucide-pencil text-base text-gray-400" aria-hidden="true" />
                Edit budget
              </button>
              <div class="border-t border-gray-100 my-1" role="separator" />
              <button
                class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                role="menuitem"
                @click="actionsMenuOpen = false; showDeleteConfirm = true"
              >
                <span class="i-lucide-trash-2 text-base text-red-400" aria-hidden="true" />
                Delete budget
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab navigation — overflow-x-auto + nowrap prevents wrapping on narrow screens -->
    <nav class="flex border-b border-gray-200 mb-6 overflow-x-auto -mx-4 px-4">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.name"
        :to="{ name: tab.name, params: { id: budget.id } }"
        class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0"
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
