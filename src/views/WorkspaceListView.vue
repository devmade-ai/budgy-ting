<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { useToast } from '@/composables/useToast'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ErrorAlert from '@/components/ErrorAlert.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import EmptyState from '@/components/EmptyState.vue'
import type { Workspace } from '@/types/models'

const router = useRouter()
const { show: showToast } = useToast()
const workspaces = ref<Workspace[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    workspaces.value = await db.workspaces.orderBy('createdAt').reverse().toArray()
  } catch {
    error.value = 'Couldn\'t load your workspaces. Please refresh the page and try again.'
  } finally {
    loading.value = false
  }
})

async function refreshList() {
  try {
    workspaces.value = await db.workspaces.orderBy('createdAt').reverse().toArray()
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
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-y-3 mb-6">
      <h1 class="page-title">Workspaces</h1>
      <button class="btn-primary" @click="createWorkspace">
        <span class="i-lucide-plus mr-1" />
        New Workspace
      </button>
    </div>

    <ErrorAlert v-if="error" :message="error" @dismiss="error = ''" />

    <LoadingSpinner v-if="loading" />

    <EmptyState
      v-else-if="workspaces.length === 0"
      icon="i-lucide-wallet"
      title="No workspaces yet"
      description="Create your first workspace to start tracking your finances"
    >
      <button class="btn-primary" @click="createWorkspace">
        Create your first workspace
      </button>
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

    <!-- Clear all confirm dialog -->
    <ConfirmDialog
      v-if="showClearConfirm"
      title="Clear all data?"
      message="This will permanently delete all workspaces, transactions, and patterns. This cannot be undone."
      confirm-label="Clear everything"
      :danger="true"
      @confirm="handleClearAll(); showClearConfirm = false"
      @cancel="showClearConfirm = false"
    />
  </div>
</template>
