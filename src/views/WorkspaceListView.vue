<script setup lang="ts">
/**
 * Requirement: Workspace list view
 * Approach: Lists workspaces with summary data (transaction count, monthly spend).
 *   Restore-from-backup lives in the burger menu (AppLayout) and is provided via
 *   inject for the empty state discovery button.
 */

import { ref, inject, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { usePullToRefresh } from '@/composables/usePullToRefresh'
import ErrorAlert from '@/components/ErrorAlert.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { formatAmount } from '@/composables/useFormat'
import { useInstallReminder } from '@/composables/useInstallReminder'
import { estimateMonthlySpend } from '@/engine/transactionMath'
import { formatStorageSize } from '@/lib/reviewHelpers'
import { Plus, Smartphone, Wallet, ChevronRight, Database } from 'lucide-vue-next'
import type { Workspace } from '@/types/models'

const router = useRouter()
const workspaces = ref<Workspace[]>([])
const loading = ref(true)

// Restore trigger provided by AppLayout (burger menu owns the restore flow)
const triggerRestore = inject<() => void>('triggerRestore')

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
    // Re-estimate storage too — users pulling-to-refresh after a large import
    // expect the quota indicator to reflect the new on-disk size.
    loadStorageUsage()
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

const { showInstallReminder, checkInstallReminder, dismissInstallReminder } = useInstallReminder()

// Storage usage indicator — reads quota via navigator.storage.estimate().
// Hidden when the API isn't available (older Safari / some Android browsers).
// Read once on mount; no reactive refresh — users can pull-to-refresh for a
// new snapshot if they just imported a large batch.
const storageUsage = ref<{ used: number; quota: number } | null>(null)
const storagePct = computed(() => {
  if (!storageUsage.value || storageUsage.value.quota === 0) return 0
  // Clamp at 100 — spec allows `usage > quota` briefly when the browser
  // rebalances the origin's quota downward (user clears site data, other
  // origins under the same domain grow). Without the clamp, the aria-label
  // reads "Storage 105% used" until the next estimate catches up.
  return Math.min(100, (storageUsage.value.used / storageUsage.value.quota) * 100)
})
async function loadStorageUsage() {
  if (!navigator.storage?.estimate) return
  try {
    const { usage, quota } = await navigator.storage.estimate()
    if (usage !== undefined && quota !== undefined && quota > 0) {
      storageUsage.value = { used: usage, quota }
    }
  } catch {
    // Silent — non-critical diagnostic
  }
}
onMounted(() => { loadStorageUsage() })
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-y-3 mb-6">
      <h1 class="text-2xl font-bold text-base-content">Workspaces</h1>
      <button class="btn btn-primary" @click="createWorkspace">
        <Plus :size="16" class="mr-1 inline-block" />
        New Workspace
      </button>
    </div>

    <!-- Install reminder for repeat users -->
    <div
      v-if="showInstallReminder"
      class="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4 flex items-center justify-between text-sm"
    >
      <div class="flex items-center gap-2 text-primary">
        <Smartphone :size="18" />
        <span>Add Farlume to your home screen for quick access</span>
      </div>
      <button
        class="text-primary/50 hover:text-primary text-xs ml-2 whitespace-nowrap"
        @click="dismissInstallReminder"
      >
        Dismiss
      </button>
    </div>

    <ErrorAlert v-if="error" :message="error" @dismiss="error = ''" />

    <!-- Pull-to-refresh indicator with visual progress -->
    <div
      v-if="pulling || refreshing"
      class="flex flex-col items-center py-2 text-xs transition-all"
      :style="{ height: `${Math.max(pullDistance, refreshing ? 40 : 0)}px` }"
    >
      <progress
        class="progress w-8 h-1 mb-1"
        :class="canRelease ? 'progress-primary' : ''"
        :value="refreshing ? 100 : pullProgress * 100"
        max="100"
      />
      <span :class="canRelease ? 'text-primary font-medium' : 'text-base-content/60'">
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
        <button class="btn btn-primary" @click="createWorkspace">
          Create your first workspace
        </button>
        <button class="btn btn-ghost" @click="triggerRestore?.()">
          Restore from file
        </button>
      </div>
    </EmptyState>

    <!-- Workspace list -->
    <template v-else>
      <div class="space-y-3">
        <button
          v-for="ws in workspaces"
          :key="ws.id"
          class="bg-base-100 rounded-xl border border-base-300 p-4 shadow-sm w-full text-left hover:border-primary/30 transition-colors cursor-pointer"
          @click="openWorkspace(ws.id)"
        >
          <div class="flex items-center justify-between">
            <div class="min-w-0">
              <h2 class="font-semibold text-base-content truncate">{{ ws.name }}</h2>
              <p class="text-sm text-base-content/60 mt-0.5">
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
            <ChevronRight :size="16" class="text-base-content/40" />
          </div>
        </button>
      </div>
    </template>

    <!-- Storage usage indicator — rendered below any list/empty state so users
         see where their local data sits against the browser quota. Skipped
         while loading (no value during skeleton) and when navigator.storage
         isn't supported (some older Safari / Android). -->
    <div
      v-if="!loading && storageUsage"
      class="mt-8 flex items-center gap-2 text-xs text-base-content/60"
    >
      <Database :size="12" class="shrink-0" aria-hidden="true" />
      <span class="whitespace-nowrap">
        {{ formatStorageSize(storageUsage.used) }} of {{ formatStorageSize(storageUsage.quota) }} used
      </span>
      <progress
        class="progress progress-primary h-1 flex-1 max-w-[180px]"
        :value="storagePct"
        max="100"
        :aria-label="`Storage ${storagePct.toFixed(0)}% used`"
      />
    </div>
  </div>
</template>
