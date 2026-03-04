<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import { useToast } from '@/composables/useToast'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ErrorAlert from '@/components/ErrorAlert.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import type { Workspace } from '@/types/models'

const props = defineProps<{ id: string }>()
const router = useRouter()
const { show: showToast } = useToast()

const workspace = ref<Workspace | null>(null)
const loading = ref(true)
const showDeleteConfirm = ref(false)
const error = ref('')

// Overflow menu for secondary actions (Edit, Delete)
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
})

function editWorkspace() {
  router.push({ name: 'workspace-edit', params: { id: props.id } })
}

async function deleteWorkspace() {
  // Requirement: Deleting a workspace removes all related data
  // Approach: Cascade delete in a single transaction — transactions, patterns, importBatches, then workspace
  try {
    await db.transaction('rw', [db.workspaces, db.transactions, db.patterns, db.importBatches], async () => {
      await db.importBatches.where('workspaceId').equals(props.id).delete()
      await db.patterns.where('workspaceId').equals(props.id).delete()
      await db.transactions.where('workspaceId').equals(props.id).delete()
      await db.workspaces.delete(props.id)
    })
    showToast('Workspace deleted')
    router.replace({ name: 'workspace-list' })
  } catch {
    error.value = 'Couldn\'t delete the workspace. Please try again.'
    showDeleteConfirm.value = false
  }
}
</script>

<template>
  <ErrorAlert v-if="error" :message="error" @dismiss="error = ''" />

  <LoadingSpinner v-if="loading" />

  <div v-else-if="workspace">
    <!-- Workspace header -->
    <div class="mb-6">
      <button
        class="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
        @click="router.push({ name: 'workspace-list' })"
      >
        <span class="i-lucide-arrow-left" />
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
                @click="actionsMenuOpen = false; editWorkspace()"
              >
                <span class="i-lucide-pencil text-base text-gray-400" aria-hidden="true" />
                Edit workspace
              </button>
              <div class="border-t border-gray-100 my-1" role="separator" />
              <button
                class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                role="menuitem"
                @click="actionsMenuOpen = false; showDeleteConfirm = true"
              >
                <span class="i-lucide-trash-2 text-base text-red-400" aria-hidden="true" />
                Delete workspace
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Workspace content area — views will be added as the new UI is built -->
    <div class="text-center py-12 text-gray-400">
      <span class="i-lucide-construction text-4xl mb-3 block" />
      <p class="text-sm">Transaction views coming soon</p>
    </div>

    <!-- Delete confirmation -->
    <ConfirmDialog
      v-if="showDeleteConfirm"
      title="Delete workspace?"
      :message="`This will permanently delete '${workspace.name}' and all its transactions and patterns. This cannot be undone.`"
      confirm-label="Delete workspace"
      :danger="true"
      @confirm="deleteWorkspace"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>
