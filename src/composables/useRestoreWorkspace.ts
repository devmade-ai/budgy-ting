/**
 * Workspace restore-from-backup composable.
 *
 * Requirement: Restore a workspace from exported JSON, accessible from burger menu
 *   and workspace list empty state
 * Approach: Composable encapsulates file picking, validation, import, and replace
 *   confirmation. Programmatic file input (no hidden DOM element needed).
 *   Caller provides onSuccess callback for post-import actions (e.g. list refresh).
 * Alternatives:
 *   - Inline in each component: Rejected — duplicated validation/import logic
 *   - Event bus: Rejected — provide/inject is simpler for parent→child
 */

import { ref } from 'vue'
import { db } from '@/db'
import { validateImport, importWorkspace } from '@/engine/exportImport'
import { useToast } from '@/composables/useToast'
import type { ExportSchema } from '@/engine/exportImport'

export function useRestoreWorkspace(onSuccess?: () => void) {
  const { show: showToast } = useToast()
  const importError = ref('')
  const showReplaceConfirm = ref(false)
  const pendingImportData = ref<ExportSchema | null>(null)
  // Requirement: Non-trivial IDB replace transactions need visible progress —
  // users shouldn't wonder if the app froze.
  const restoring = ref(false)

  function triggerFilePicker() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => handleFile(e as Event)
    input.click()
  }

  function handleFile(event: Event) {
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

      try {
        const existing = await db.workspaces.get(result.data.workspace.id)
        if (existing) {
          pendingImportData.value = result.data
          showReplaceConfirm.value = true
        } else {
          const importResult = await importWorkspace(result.data, 'merge')
          showToast(importResult.message)
          onSuccess?.()
        }
      } catch {
        importError.value = 'Couldn\'t restore the backup. Please try again.'
      }
    }
    reader.onerror = () => {
      importError.value = 'Failed to read file'
    }
    reader.readAsText(file)
  }

  async function confirmReplace() {
    if (!pendingImportData.value || restoring.value) return
    restoring.value = true
    try {
      const result = await importWorkspace(pendingImportData.value, 'replace')
      showToast(result.message)
      pendingImportData.value = null
      showReplaceConfirm.value = false
      onSuccess?.()
    } catch {
      importError.value = 'Couldn\'t replace the workspace. Please try again.'
      showReplaceConfirm.value = false
      // Clear pendingImportData too — otherwise a subsequent file pick shows
      // the confirm dialog with the previous file's workspace name until the
      // new file's validation overwrites it.
      pendingImportData.value = null
    } finally {
      restoring.value = false
    }
  }

  function cancelReplace() {
    if (restoring.value) return
    showReplaceConfirm.value = false
    pendingImportData.value = null
  }

  return {
    triggerFilePicker,
    importError,
    showReplaceConfirm,
    pendingImportData,
    restoring,
    confirmReplace,
    cancelReplace,
  }
}
