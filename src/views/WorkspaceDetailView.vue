<script setup lang="ts">
/**
 * Requirement: Workspace detail — single-screen dashboard replacing old 3-tab layout
 * Approach: Header with actions (Import, Export, Edit, Delete) + WorkspaceDashboard child.
 *   Uses BottomSheet on mobile for the actions menu (easier thumb reach).
 *   Desktop keeps the kebab dropdown for space efficiency.
 * Alternatives:
 *   - Keep 3-tab layout: Rejected — old tabs query dropped DB tables, single screen is simpler
 *   - Merge header into dashboard: Rejected — keeps navigation concerns separate from data display
 */

import { ref, onMounted, onUnmounted } from 'vue'
import type { Component } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { exportWorkspace, downloadJSON } from '@/engine/exportImport'
import { useToast } from '@/composables/useToast'
import { hapticConfirm } from '@/composables/useHaptic'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import ErrorAlert from '@/components/ErrorAlert.vue'
import WorkspaceDashboard from '@/views/WorkspaceDashboard.vue'
import { ArrowLeft, Upload, MoreVertical, Download, Pencil, Trash2 } from 'lucide-vue-next'
import type { Workspace } from '@/types/models'

const props = defineProps<{ id: string }>()
const router = useRouter()
const { show: showToast } = useToast()

const workspace = ref<Workspace | null>(null)
const loading = ref(true)
const showDeleteConfirm = ref(false)
const error = ref('')

// Actions menu — bottom sheet on mobile, dropdown on desktop
const actionsMenuOpen = ref(false)
const actionsMenuRef = ref<HTMLElement | null>(null)

// Requirement: First-use hint for kebab menu on mobile
// Approach: One-time subtle pulse animation on the kebab button. Persisted in localStorage.
const KEBAB_HINT_KEY = 'budgy-ting:kebab-hint-seen'
const showKebabHint = ref(false)
let kebabHintTimeout: ReturnType<typeof setTimeout> | null = null

function toggleActionsMenu() {
  actionsMenuOpen.value = !actionsMenuOpen.value
  // Dismiss the hint once user taps the menu
  if (showKebabHint.value) {
    showKebabHint.value = false
    if (kebabHintTimeout) { clearTimeout(kebabHintTimeout); kebabHintTimeout = null }
    try { localStorage.setItem(KEBAB_HINT_KEY, 'true') } catch { /* ignore */ }
  }
}

function handleActionsOutsideClick(e: MouseEvent) {
  if (actionsMenuOpen.value && actionsMenuRef.value && !actionsMenuRef.value.contains(e.target as Node)) {
    actionsMenuOpen.value = false
  }
}

onMounted(async () => {
  document.addEventListener('click', handleActionsOutsideClick)

  // Show kebab hint if never seen — auto-dismiss after 6s if not tapped
  try {
    if (!localStorage.getItem(KEBAB_HINT_KEY)) {
      showKebabHint.value = true
      kebabHintTimeout = setTimeout(() => {
        showKebabHint.value = false
        try { localStorage.setItem(KEBAB_HINT_KEY, 'true') } catch { /* ignore */ }
      }, 6000)
    }
  } catch { /* ignore */ }

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

onUnmounted(() => {
  document.removeEventListener('click', handleActionsOutsideClick)
  if (kebabHintTimeout) clearTimeout(kebabHintTimeout)
})

function editWorkspace() {
  actionsMenuOpen.value = false
  router.push({ name: 'workspace-edit', params: { id: props.id } })
}

async function handleExport() {
  actionsMenuOpen.value = false
  try {
    const data = await exportWorkspace(props.id)
    if (data) {
      downloadJSON(data, data.workspace.name)
      showToast('Workspace exported')
    }
  } catch {
    error.value = 'Couldn\'t export the workspace. Please try again.'
  }
}

function confirmDelete() {
  actionsMenuOpen.value = false
  hapticConfirm()
  showDeleteConfirm.value = true
}

async function deleteWorkspace() {
  // Requirement: Deleting a workspace removes all related data
  // Approach: Cascade delete in a single transaction — transactions, patterns, importBatches, then workspace
  // Alternatives:
  //   - Soft-delete with archival: Rejected — adds complexity for an MVP with JSON export backup
  //   - Leave orphaned data: Rejected — wastes IndexedDB space, confuses future queries
  try {
    await db.transaction('rw', [db.workspaces, db.transactions, db.patterns, db.importBatches], async () => {
      await db.transactions.where('workspaceId').equals(props.id).delete()
      await db.patterns.where('workspaceId').equals(props.id).delete()
      await db.importBatches.where('workspaceId').equals(props.id).delete()
      await db.workspaces.delete(props.id)
    })
    showToast('Workspace deleted')
    router.replace({ name: 'workspace-list' })
  } catch {
    error.value = 'Couldn\'t delete the workspace. Please try again.'
    showDeleteConfirm.value = false
  }
}

/** Menu items shared between bottom sheet and dropdown */
const menuActions: Array<{ label: string; icon: Component; action: () => void }> = [
  { label: 'Export', icon: Download, action: handleExport },
  { label: 'Edit workspace', icon: Pencil, action: editWorkspace },
]
</script>

<template>
  <ErrorAlert v-if="error" :message="error" @dismiss="error = ''" />

  <SkeletonLoader v-if="loading" variant="dashboard" />

  <div v-else-if="workspace">
    <!-- Workspace header -->
    <div class="mb-6">
      <button
        class="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1 min-h-[44px]"
        @click="router.push({ name: 'workspace-list' })"
      >
        <ArrowLeft :size="16" />
        Workspaces
      </button>
      <div class="flex items-center justify-between">
        <div>
          <h1 class="page-title">{{ workspace.name }}</h1>
          <p class="text-sm text-gray-500 mt-0.5">
            {{ workspace.periodType === 'monthly' ? 'Monthly' : 'Custom period' }}
            <span v-if="workspace.currencyLabel"> &middot; {{ workspace.currencyLabel }}</span>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="btn-primary text-sm min-h-[44px]"
            title="Import actuals"
            @click="router.push({ name: 'import-actuals', params: { id: props.id } })"
          >
            <Upload :size="16" class="mr-1 inline-block" />
            Import
          </button>
          <div ref="actionsMenuRef" class="relative">
            <button
              class="w-11 h-11 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              :class="{ 'animate-pulse ring-2 ring-brand-300': showKebabHint }"
              title="More actions"
              aria-label="More actions"
              aria-haspopup="true"
              :aria-expanded="actionsMenuOpen"
              @click="toggleActionsMenu"
            >
              <MoreVertical :size="18" aria-hidden="true" />
            </button>

            <!-- Desktop dropdown (hidden on mobile) -->
            <div
              v-if="actionsMenuOpen"
              class="hidden sm:block absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20"
              role="menu"
            >
              <button
                v-for="item in menuActions"
                :key="item.label"
                class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                role="menuitem"
                @click="item.action()"
              >
                <component :is="item.icon" :size="16" class="text-gray-400" aria-hidden="true" />
                {{ item.label }}
              </button>
              <div class="border-t border-gray-100 my-1" role="separator" />
              <button
                class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                role="menuitem"
                @click="confirmDelete"
              >
                <Trash2 :size="16" class="text-red-400" aria-hidden="true" />
                Delete workspace
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile bottom sheet (visible only on mobile) -->
    <BottomSheet
      :open="actionsMenuOpen"
      class="sm:hidden"
      @close="actionsMenuOpen = false"
    >
      <div class="space-y-1">
        <button
          v-for="item in menuActions"
          :key="item.label"
          class="w-full text-left px-3 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-3"
          @click="item.action()"
        >
          <component :is="item.icon" :size="18" class="text-gray-400" aria-hidden="true" />
          {{ item.label }}
        </button>
        <div class="border-t border-gray-100 my-1" />
        <button
          class="w-full text-left px-3 py-3 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-3"
          @click="confirmDelete"
        >
          <Trash2 :size="18" class="text-red-400" aria-hidden="true" />
          Delete workspace
        </button>
      </div>
    </BottomSheet>

    <!-- Single-screen dashboard — replaces old 3-tab layout -->
    <WorkspaceDashboard :workspace="workspace" />

    <!-- Delete confirmation -->
    <ConfirmDialog
      v-if="showDeleteConfirm"
      title="Delete workspace?"
      :message="`This will permanently delete '${workspace.name}' and all its transactions, patterns, and imported data. This cannot be undone.`"
      confirm-label="Delete workspace"
      :danger="true"
      @confirm="deleteWorkspace"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>
