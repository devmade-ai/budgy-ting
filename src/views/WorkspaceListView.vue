<script setup lang="ts">
/**
 * Requirement: Workspace list with restore-from-backup and clear-all-data flows
 * Approach: FileReader + JSON validation for import, with replace-or-skip
 *   confirmation when a matching workspace already exists
 * Alternatives:
 *   - Drag-and-drop import: Rejected — file-input is simpler on mobile
 */

import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { validateImport, importWorkspace } from '@/engine/exportImport'
import { useToast } from '@/composables/useToast'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ErrorAlert from '@/components/ErrorAlert.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import { formatAmount } from '@/composables/useFormat'
import type { Workspace, Expense } from '@/types/models'
import type { ExportSchema } from '@/engine/exportImport'

const router = useRouter()
const { show: showToast } = useToast()
const workspaces = ref<Workspace[]>([])
const loading = ref(true)

// Summary data per workspace (expense count + monthly total)
const workspaceSummaries = ref<Record<string, { count: number; monthlyTotal: number }>>({})

function monthlyEquivalent(exp: Expense): number {
  if (exp.frequency === 'monthly') return exp.amount
  if (exp.frequency === 'once-off') return exp.amount
  if (exp.frequency === 'daily') return exp.amount * 30
  if (exp.frequency === 'weekly') return exp.amount * 4.33
  if (exp.frequency === 'quarterly') return exp.amount / 3
  if (exp.frequency === 'annually') return exp.amount / 12
  return 0
}

async function loadSummaries(wsList: Workspace[]) {
  const summaries: Record<string, { count: number; monthlyTotal: number }> = {}
  for (const ws of wsList) {
    try {
      const expenses = await db.expenses.where('workspaceId').equals(ws.id).toArray()
      const monthlyTotal = expenses
        .filter((e) => e.type !== 'income')
        .reduce((sum, e) => sum + monthlyEquivalent(e), 0)
      summaries[ws.id] = { count: expenses.length, monthlyTotal }
    } catch {
      summaries[ws.id] = { count: 0, monthlyTotal: 0 }
    }
  }
  workspaceSummaries.value = summaries
}

// Restore state
const importError = ref('')
const showReplaceConfirm = ref(false)
const pendingImportData = ref<ExportSchema | null>(null)

// General error state for DB failures
const error = ref('')

onMounted(async () => {
  try {
    workspaces.value = await db.workspaces.orderBy('createdAt').reverse().toArray()
    loadSummaries(workspaces.value)
  } catch {
    error.value = 'Couldn\'t load your workspaces. Please refresh the page and try again.'
  } finally {
    loading.value = false
  }
})

async function refreshList() {
  try {
    workspaces.value = await db.workspaces.orderBy('createdAt').reverse().toArray()
    loadSummaries(workspaces.value)
  } catch {
    error.value = 'Couldn\'t refresh the list. Please refresh the page and try again.'
  }
}

function openWorkspace(id: string) {
  router.push({ name: 'workspace-detail', params: { id } })
}

function createWorkspace() {
  router.push({ name: 'workspace-create' })
}

function handleRestoreFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

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

    // Check if workspace already exists
    try {
      const existing = await db.workspaces.get(result.data.workspace.id)
      if (existing) {
        pendingImportData.value = result.data
        showReplaceConfirm.value = true
      } else {
        const importResult = await importWorkspace(result.data, 'merge')
        showToast(importResult.message)
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
    const result = await importWorkspace(pendingImportData.value, 'replace')
    showToast(result.message)
    pendingImportData.value = null
    showReplaceConfirm.value = false
    await refreshList()
  } catch {
    importError.value = 'Couldn\'t replace the workspace. Please try again.'
    showReplaceConfirm.value = false
  }
}

async function handleClearAll() {
  try {
    await db.transaction('rw', [db.workspaces, db.expenses, db.actuals, db.categoryCache], async () => {
      await db.actuals.clear()
      await db.expenses.clear()
      await db.workspaces.clear()
      await db.categoryCache.clear()
    })
    await refreshList()
    showToast('All data cleared')
  } catch {
    error.value = 'Couldn\'t clear data. Please try again.'
  }
}

const showClearConfirm = ref(false)
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-y-3 mb-6">
      <h1 class="page-title">Workspaces</h1>
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
        <button class="btn-primary" @click="createWorkspace">
          <span class="i-lucide-plus mr-1" />
          New Workspace
        </button>
      </div>
    </div>

    <ErrorAlert v-if="error" :message="error" @dismiss="error = ''" />
    <ErrorAlert v-if="importError" :message="importError" @dismiss="importError = ''" />

    <LoadingSpinner v-if="loading" />

    <EmptyState
      v-else-if="workspaces.length === 0"
      icon="i-lucide-wallet"
      title="No workspaces yet"
      description="Create your first workspace or restore from a backup"
    >
      <div class="flex gap-3 justify-center">
        <button class="btn-primary" @click="createWorkspace">
          Create your first workspace
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

    <!-- Workspace list -->
    <template v-else>
      <div class="space-y-3">
        <button
          v-for="ws in workspaces"
          :key="ws.id"
          class="card w-full text-left hover:border-brand-300 transition-colors cursor-pointer"
          @click="openWorkspace(ws.id)"
        >
          <div class="flex items-center justify-between">
            <div class="min-w-0">
              <h2 class="font-semibold text-gray-900 truncate">{{ ws.name }}</h2>
              <p class="text-sm text-gray-500 mt-0.5">
                {{ ws.periodType === 'monthly' ? 'Monthly' : 'Custom period' }}
                <span v-if="ws.currencyLabel" class="ml-1">
                  &middot; {{ ws.currencyLabel }}
                </span>
                <template v-if="workspaceSummaries[ws.id]">
                  &middot; {{ workspaceSummaries[ws.id]!.count }} item{{ workspaceSummaries[ws.id]!.count === 1 ? '' : 's' }}
                  <template v-if="workspaceSummaries[ws.id]!.monthlyTotal > 0">
                    &middot; {{ ws.currencyLabel }}{{ formatAmount(workspaceSummaries[ws.id]!.monthlyTotal) }}/mo
                  </template>
                </template>
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
      title="Replace existing workspace?"
      :message="`A workspace named '${pendingImportData.workspace.name}' already exists. Replacing it will overwrite all its expenses and imported data.`"
      confirm-label="Replace"
      :danger="true"
      @confirm="confirmReplace"
      @cancel="showReplaceConfirm = false; pendingImportData = null"
    />

    <!-- Clear all confirm dialog -->
    <ConfirmDialog
      v-if="showClearConfirm"
      title="Clear all data?"
      message="This will permanently delete all workspaces, expenses, and imported data. This cannot be undone. Make sure you've exported anything you want to keep."
      confirm-label="Clear everything"
      :danger="true"
      @confirm="handleClearAll(); showClearConfirm = false"
      @cancel="showClearConfirm = false"
    />
  </div>
</template>
