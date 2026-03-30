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
import { usePullToRefresh } from '@/composables/usePullToRefresh'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ErrorAlert from '@/components/ErrorAlert.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { formatAmount } from '@/composables/useFormat'
import { useInstallReminder } from '@/composables/useInstallReminder'
import { estimateMonthlySpend } from '@/engine/transactionMath'
import { FolderOpen, Plus, Smartphone, Wallet, ChevronRight } from 'lucide-vue-next'
import type { Workspace } from '@/types/models'
import type { ExportSchema } from '@/engine/exportImport'

const router = useRouter()
const { show: showToast } = useToast()
const workspaces = ref<Workspace[]>([])
const loading = ref(true)

// Pull-to-refresh for mobile
const { pulling, pullDistance, pullProgress, canRelease, refreshing } = usePullToRefresh(refreshList)

// Summary data per workspace (transaction count + monthly spend estimate)
const workspaceSummaries = ref<Record<string, { count: number; monthlyTotal: number }>>({})

async function loadSummaries(wsList: Workspace[]) {
  const summaries: Record<string, { count: number; monthlyTotal: number }> = {}
  for (const ws of wsList) {
    try {
      const transactions = await db.transactions.where('workspaceId').equals(ws.id).toArray()
      summaries[ws.id] = {
        count: transactions.length,
        monthlyTotal: estimateMonthlySpend(transactions),
      }
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
  checkInstallReminder()
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
    await db.transaction('rw', [db.workspaces, db.transactions, db.patterns, db.importBatches, db.tagCache], async () => {
      await db.transactions.clear()
      await db.patterns.clear()
      await db.importBatches.clear()
      await db.workspaces.clear()
      await db.tagCache.clear()
    })
    await refreshList()
    showToast('All data cleared')
  } catch {
    error.value = 'Couldn\'t clear data. Please try again.'
  }
}

const showClearConfirm = ref(false)

const { showInstallReminder, checkInstallReminder, dismissInstallReminder } = useInstallReminder()
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-y-3 mb-6">
      <h1 class="page-title">Workspaces</h1>
      <div class="flex gap-2">
        <label class="btn-secondary text-sm cursor-pointer">
          <FolderOpen :size="16" class="mr-1 inline-block" />
          Restore
          <input
            type="file"
            accept=".json"
            class="hidden"
            @change="handleRestoreFile"
          />
        </label>
        <button class="btn-primary" @click="createWorkspace">
          <Plus :size="16" class="mr-1 inline-block" />
          New Workspace
        </button>
      </div>
    </div>

    <!-- Install reminder for repeat users -->
    <div
      v-if="showInstallReminder"
      class="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg p-3 mb-4 flex items-center justify-between text-sm"
    >
      <div class="flex items-center gap-2 text-brand-700 dark:text-brand-300">
        <Smartphone :size="18" />
        <span>Add budgy-ting to your home screen for quick access</span>
      </div>
      <button
        class="text-brand-400 dark:text-brand-500 hover:text-brand-600 text-xs ml-2 whitespace-nowrap"
        @click="dismissInstallReminder"
      >
        Dismiss
      </button>
    </div>

    <ErrorAlert v-if="error" :message="error" @dismiss="error = ''" />
    <ErrorAlert v-if="importError" :message="importError" @dismiss="importError = ''" />

    <!-- Pull-to-refresh indicator with visual progress -->
    <div
      v-if="pulling || refreshing"
      class="flex flex-col items-center py-2 text-xs transition-all"
      :style="{ height: `${Math.max(pullDistance, refreshing ? 40 : 0)}px` }"
    >
      <div class="w-8 h-1 bg-gray-200 dark:bg-zinc-700 rounded-full overflow-hidden mb-1">
        <div
          class="h-full rounded-full transition-colors"
          :class="canRelease ? 'bg-brand-500' : 'bg-gray-400'"
          :style="{ width: refreshing ? '100%' : `${pullProgress * 100}%` }"
        />
      </div>
      <span :class="canRelease ? 'text-brand-600 dark:text-brand-400 font-medium' : 'text-gray-400 dark:text-zinc-500'">
        {{ refreshing ? 'Refreshing...' : canRelease ? 'Release to refresh' : 'Pull to refresh' }}
      </span>
    </div>

    <SkeletonLoader v-if="loading" variant="list" />

    <EmptyState
      v-else-if="workspaces.length === 0"
      :icon="Wallet"
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
          class="card w-full text-left hover:border-brand-300 dark:hover:border-brand-700 transition-colors cursor-pointer"
          @click="openWorkspace(ws.id)"
        >
          <div class="flex items-center justify-between">
            <div class="min-w-0">
              <h2 class="font-semibold text-gray-900 dark:text-zinc-100 truncate">{{ ws.name }}</h2>
              <p class="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
                {{ ws.periodType === 'monthly' ? 'Monthly' : 'Custom period' }}
                <span v-if="ws.currencyLabel" class="ml-1">
                  &middot; {{ ws.currencyLabel }}
                </span>
                <template v-if="workspaceSummaries[ws.id]">
                  &middot; {{ workspaceSummaries[ws.id]!.count }} transaction{{ workspaceSummaries[ws.id]!.count === 1 ? '' : 's' }}
                  <template v-if="workspaceSummaries[ws.id]!.monthlyTotal > 0">
                    &middot; {{ ws.currencyLabel }}{{ formatAmount(workspaceSummaries[ws.id]!.monthlyTotal) }}/mo
                  </template>
                </template>
              </p>
            </div>
            <ChevronRight :size="16" class="text-gray-400 dark:text-zinc-500" />
          </div>
        </button>
      </div>

      <!-- Data management -->
      <div class="mt-8 pt-6 border-t border-gray-200 dark:border-zinc-700">
        <button
          class="text-xs text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
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
      :message="`A workspace named '${pendingImportData.workspace.name}' already exists. Replacing it will overwrite all its transactions, patterns, and imported data.`"
      confirm-label="Replace"
      :danger="true"
      @confirm="confirmReplace"
      @cancel="showReplaceConfirm = false; pendingImportData = null"
    />

    <!-- Clear all confirm dialog -->
    <ConfirmDialog
      v-if="showClearConfirm"
      title="Clear all data?"
      message="This will permanently delete all workspaces, transactions, patterns, and imported data. This cannot be undone. Make sure you've exported anything you want to keep."
      confirm-label="Clear everything"
      :danger="true"
      @confirm="handleClearAll(); showClearConfirm = false"
      @cancel="showClearConfirm = false"
    />
  </div>
</template>
