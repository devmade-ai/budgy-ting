<script setup lang="ts">
/**
 * Requirement: Budget list with restore-from-backup and clear-all-data flows
 * Approach: FileReader + JSON validation for import, with replace-or-skip
 *   confirmation when a matching budget ID already exists
 * Alternatives:
 *   - Drag-and-drop import: Rejected — file-input is simpler on mobile
 */

import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { validateImport, importBudget } from '@/engine/exportImport'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ErrorAlert from '@/components/ErrorAlert.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import type { Budget } from '@/types/models'
import type { ExportSchema } from '@/engine/exportImport'

const router = useRouter()
const budgets = ref<Budget[]>([])
const loading = ref(true)

// Restore state
const importMessage = ref('')
const importError = ref('')
const showReplaceConfirm = ref(false)
const pendingImportData = ref<ExportSchema | null>(null)

// General error state for DB failures
const error = ref('')

onMounted(async () => {
  try {
    budgets.value = await db.budgets.orderBy('createdAt').reverse().toArray()
  } catch {
    error.value = 'Couldn\'t load your budgets. Please refresh the page and try again.'
  } finally {
    loading.value = false
  }
})

async function refreshList() {
  try {
    budgets.value = await db.budgets.orderBy('createdAt').reverse().toArray()
  } catch {
    error.value = 'Couldn\'t refresh the list. Please refresh the page and try again.'
  }
}

function openBudget(id: string) {
  router.push({ name: 'budget-detail', params: { id } })
}

function createBudget() {
  router.push({ name: 'budget-create' })
}

function handleRestoreFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  importMessage.value = ''
  importError.value = ''

  const reader = new FileReader()
  reader.onload = async (e) => {
    const content = e.target?.result as string
    let data: unknown
    try {
      data = JSON.parse(content)
    } catch {
      importError.value = 'Invalid file — could not parse JSON'
      return
    }

    const result = validateImport(data)
    if (!result.valid || !result.data) {
      importError.value = result.error ?? 'Invalid export file'
      return
    }

    // Check if budget already exists
    try {
      const existing = await db.budgets.get(result.data.budget.id)
      if (existing) {
        pendingImportData.value = result.data
        showReplaceConfirm.value = true
      } else {
        const importResult = await importBudget(result.data, 'merge')
        importMessage.value = importResult.message
        await refreshList()
      }
    } catch {
      importError.value = 'Couldn\'t restore the backup. Please try again.'
    }
  }
  reader.onerror = () => {
    importError.value = 'Failed to read file'
  }
  reader.readAsText(file)

  // Reset input so same file can be selected again
  input.value = ''
}

async function confirmReplace() {
  if (!pendingImportData.value) return
  try {
    const result = await importBudget(pendingImportData.value, 'replace')
    importMessage.value = result.message
    pendingImportData.value = null
    showReplaceConfirm.value = false
    await refreshList()
  } catch {
    importError.value = 'Couldn\'t replace the budget. Please try again.'
    showReplaceConfirm.value = false
  }
}

async function handleClearAll() {
  try {
    await db.transaction('rw', [db.budgets, db.expenses, db.actuals, db.categoryCache], async () => {
      await db.actuals.clear()
      await db.expenses.clear()
      await db.budgets.clear()
      await db.categoryCache.clear()
    })
    await refreshList()
    importMessage.value = 'All data cleared'
  } catch {
    error.value = 'Couldn\'t clear data. Please try again.'
  }
}

const showClearConfirm = ref(false)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="page-title">Budgets</h1>
      <div class="flex gap-2">
        <label class="btn-secondary text-sm cursor-pointer">
          <span class="i-lucide-folder-open mr-1" />
          Restore
          <input
            type="file"
            accept=".json"
            class="hidden"
            @change="handleRestoreFile"
          />
        </label>
        <button class="btn-primary" @click="createBudget">
          <span class="i-lucide-plus mr-1" />
          New Budget
        </button>
      </div>
    </div>

    <ErrorAlert v-if="error" :message="error" @dismiss="error = ''" />
    <ErrorAlert v-if="importMessage" :message="importMessage" variant="success" @dismiss="importMessage = ''" />
    <ErrorAlert v-if="importError" :message="importError" @dismiss="importError = ''" />

    <LoadingSpinner v-if="loading" />

    <EmptyState
      v-else-if="budgets.length === 0"
      icon="i-lucide-wallet"
      title="No budgets yet"
      description="Create your first budget or restore from a backup"
    >
      <div class="flex gap-3 justify-center">
        <button class="btn-primary" @click="createBudget">
          Create your first budget
        </button>
        <label class="btn-secondary cursor-pointer">
          Restore from file
          <input
            type="file"
            accept=".json"
            class="hidden"
            @change="handleRestoreFile"
          />
        </label>
      </div>
    </EmptyState>

    <!-- Budget list -->
    <template v-else>
      <div class="space-y-3">
        <button
          v-for="budget in budgets"
          :key="budget.id"
          class="card w-full text-left hover:border-brand-300 transition-colors cursor-pointer"
          @click="openBudget(budget.id)"
        >
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-semibold text-gray-900">{{ budget.name }}</h2>
              <p class="text-sm text-gray-500 mt-0.5">
                {{ budget.periodType === 'monthly' ? 'Monthly' : 'Custom period' }}
                <span v-if="budget.currencyLabel" class="ml-1">
                  &middot; {{ budget.currencyLabel }}
                </span>
              </p>
            </div>
            <span class="i-lucide-chevron-right text-gray-400" />
          </div>
        </button>
      </div>

      <!-- Data management -->
      <div class="mt-8 pt-6 border-t border-gray-200">
        <button
          class="text-xs text-gray-400 hover:text-red-500 transition-colors"
          @click="showClearConfirm = true"
        >
          Clear all data
        </button>
      </div>
    </template>

    <!-- Replace confirm dialog -->
    <ConfirmDialog
      v-if="showReplaceConfirm && pendingImportData"
      title="Replace existing budget?"
      :message="`A budget named '${pendingImportData.budget.name}' already exists. Replacing it will overwrite all its expenses and imported data.`"
      confirm-label="Replace"
      :danger="true"
      @confirm="confirmReplace"
      @cancel="showReplaceConfirm = false; pendingImportData = null"
    />

    <!-- Clear all confirm dialog -->
    <ConfirmDialog
      v-if="showClearConfirm"
      title="Clear all data?"
      message="This will permanently delete all budgets, expenses, and imported data. This cannot be undone. Make sure you've exported anything you want to keep."
      confirm-label="Clear everything"
      :danger="true"
      @confirm="handleClearAll(); showClearConfirm = false"
      @cancel="showClearConfirm = false"
    />
  </div>
</template>
