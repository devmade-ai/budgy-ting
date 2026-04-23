<script setup lang="ts">
/**
 * Requirement: App shell with header, burger menu, and content slot
 * Approach: Sticky header with BurgerMenu component, main content area,
 *   and overlay components (modals, drawers, toast). Menu items defined
 *   here as data — BurgerMenu handles all interaction/accessibility.
 * Alternatives:
 *   - Inline menu in layout: Rejected — extracted to BurgerMenu for
 *     separation of concerns and glow-props disclosure pattern compliance
 */

import { ref, computed, provide, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePWAUpdate } from '@/composables/usePWAUpdate'
import { useIconRefresh } from '@/composables/useIconRefresh'
import { useTutorial } from '@/composables/useTutorial'
import { useDarkMode } from '@/composables/useDarkMode'
import { useRestoreWorkspace } from '@/composables/useRestoreWorkspace'
import BurgerMenu from '@/components/BurgerMenu.vue'
import type { MenuItem } from '@/components/BurgerMenu.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import ErrorAlert from '@/components/ErrorAlert.vue'
import InstallPrompt from '@/components/InstallPrompt.vue'
import InstallInstructionsModal from '@/components/InstallInstructionsModal.vue'
import TutorialModal from '@/components/TutorialModal.vue'
import HelpDrawer from '@/components/HelpDrawer.vue'
import ToastNotification from '@/components/ToastNotification.vue'
import { CircleHelp, BookOpen, TestTubes, FileText, FileSpreadsheet, FolderOpen, RefreshCw, Sun, Moon } from 'lucide-vue-next'

// Build-time markdown imports — bundled as strings, no runtime fetch
import userGuideMd from '../../docs/USER_GUIDE.md?raw'
import testingGuideMd from '../../docs/TESTING_GUIDE.md?raw'
import importFormatMd from '../../docs/IMPORT_FORMAT.md?raw'
import sampleCsvRaw from '../../docs/sample-import.csv?raw'

// Wrap raw CSV in markdown code fence so HelpDrawer renders it as a code block
const sampleCsvMd = 'Copy this sample data to test the import wizard, or use it as a template for formatting your own data.\n\n```csv\n' + sampleCsvRaw.trim() + '\n```'

const router = useRouter()
const { hasUpdate, offlineReady, checking, updateApp, checkForUpdate } = usePWAUpdate()
const { iconNeedsRefresh, checkIconsHash, dismissIconRefresh } = useIconRefresh()
const { showTutorial, showIfFirstVisit, openTutorial, dismissTutorial } = useTutorial()
const { isDark, toggle: toggleDarkMode } = useDarkMode()

// Restore from backup — composable handles file picking, validation, import.
// onSuccess: navigate to workspace list. If already there, the router push
// is a no-op so we also reload to show the imported workspace.
const restore = useRestoreWorkspace(async () => {
  const alreadyOnList = router.currentRoute.value.name === 'workspace-list'
  if (!alreadyOnList) {
    await router.push({ name: 'workspace-list' })
  }
  // Reload to refresh the workspace list (component doesn't re-mount on same-route push)
  window.location.reload()
})
// Provide trigger for child components (e.g. WorkspaceListView empty state)
provide('triggerRestore', restore.triggerFilePicker)

const showInstructions = ref(false)
// When the install modal is opened from the icon-refresh banner we want the
// reinstall collapsible pre-expanded so the user lands on the relevant content.
const expandReinstall = ref(false)

function openInstallInstructions(options: { expandReinstall?: boolean } = {}) {
  expandReinstall.value = options.expandReinstall === true
  showInstructions.value = true
}

function handleIconRefreshShowHow() {
  // User still needs to see "your icon is stale" as acknowledged so the
  // banner stops reappearing. Opening the modal IS the acknowledgement.
  dismissIconRefresh()
  openInstallInstructions({ expandReinstall: true })
}

// Help drawer state
type DrawerContent = 'user-guide' | 'testing-guide' | 'import-format' | 'sample-csv' | null
const activeDrawer = ref<DrawerContent>(null)

// Requirement: Force light mode in print — dark backgrounds are unreadable on white paper
// Approach: Directly toggle .dark class on <html> via beforeprint/afterprint events.
//   Bypasses the reactive useDarkMode system to avoid persisting the temporary change
//   (no localStorage write, no debug log, no cross-tab sync side effects).
// Alternatives:
//   - CSS @media print overrides for all dark variants: Rejected — Tailwind generates too many
//   - Set isDark.value = false: Rejected — triggers localStorage write + debug log
function onBeforePrint() {
  const html = document.documentElement
  if (html.classList.contains('dark')) {
    html.dataset.printWasDark = 'true'
    html.dataset.printTheme = html.getAttribute('data-theme') || ''
    html.classList.remove('dark')
    // Set the light DaisyUI theme for print — must match LIGHT_THEME in themes.ts
    html.setAttribute('data-theme', 'cmyk')
  }
}
function onAfterPrint() {
  const html = document.documentElement
  if (html.dataset.printWasDark === 'true') {
    html.classList.add('dark')
    // Fallback must be a theme registered in src/index.css (cmyk, night).
    // Previous fallback was 'black' which isn't registered — if onAfterPrint
    // ever fires without a matching onBeforePrint, DaisyUI would silently
    // reset to the default theme. 'night' is the correct dark-theme fallback
    // here since we only reach this branch when printWasDark === 'true'.
    html.setAttribute('data-theme', html.dataset.printTheme || 'night')
    delete html.dataset.printWasDark
    delete html.dataset.printTheme
  }
}

// Throttled icon-hash check on tab focus — piggy-backs on visibilitychange
// so the banner surfaces when the user returns from a backgrounded tab.
function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    void checkIconsHash()
  }
}

onMounted(() => {
  showIfFirstVisit()
  window.addEventListener('beforeprint', onBeforePrint)
  window.addEventListener('afterprint', onAfterPrint)
  document.addEventListener('visibilitychange', onVisibilityChange)
  // Initial run — catches icon-only deploys that landed before mount
  void checkIconsHash()
})

onUnmounted(() => {
  window.removeEventListener('beforeprint', onBeforePrint)
  window.removeEventListener('afterprint', onAfterPrint)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

function goHome() {
  router.push({ name: 'workspace-list' })
}

function closeDrawer() {
  activeDrawer.value = null
}

// Menu items — defined as data, BurgerMenu handles rendering and interaction.
// Show/hide via visible prop, never render disabled items per glow-props spec.
const menuItems = computed<MenuItem[]>(() => [
  { label: 'How it works', icon: CircleHelp, action: () => openTutorial() },
  { label: 'User Guide', icon: BookOpen, action: () => { activeDrawer.value = 'user-guide' } },
  { label: 'Test Scenarios', icon: TestTubes, action: () => { activeDrawer.value = 'testing-guide' } },
  { label: 'Import Format', icon: FileText, action: () => { activeDrawer.value = 'import-format' }, separator: true },
  { label: 'Sample CSV', icon: FileSpreadsheet, action: () => { activeDrawer.value = 'sample-csv' } },
  { label: 'Restore from backup', icon: FolderOpen, action: () => restore.triggerFilePicker(), separator: true },
  {
    label: isDark.value ? 'Light mode' : 'Dark mode',
    icon: isDark.value ? Sun : Moon,
    iconClass: isDark.value ? 'text-warning' : 'text-base-content/40',
    action: () => toggleDarkMode(),
    separator: true,
  },
  {
    label: checking.value ? 'Checking...' : 'Check for updates',
    icon: RefreshCw,
    action: () => checkForUpdate(),
    disabled: checking.value,
  },
])
</script>

<template>
  <div class="min-h-screen bg-base-200">
    <!-- Update banner -->
    <div
      v-if="hasUpdate"
      class="bg-primary text-primary-content text-sm px-4 py-2 flex items-center justify-between no-print"
    >
      <span>A new version is available</span>
      <button
        class="font-medium underline hover:no-underline"
        @click="updateApp"
      >
        Update now
      </button>
    </div>

    <!-- Offline-ready notification (auto-dismisses after 3s) -->
    <div
      v-if="offlineReady"
      class="bg-success text-success-content text-sm px-4 py-2 text-center no-print"
    >
      App is ready for offline use
    </div>

    <!-- Icon-refresh banner — shown only when running as an installed PWA
         and the app's icon hash differs from the last one the user saw.
         OS icon caches don't respect query-string cache-busting, so the
         web side can't force a refresh. The banner is the mitigation. -->
    <div
      v-if="iconNeedsRefresh"
      class="bg-info text-info-content text-sm px-4 py-2 flex items-center justify-between gap-3 no-print"
      role="status"
    >
      <span>Your Farlume icon was updated — reinstall to see the new look.</span>
      <div class="flex items-center gap-3 shrink-0">
        <button
          type="button"
          class="font-medium underline hover:no-underline"
          @click="handleIconRefreshShowHow"
        >
          Show how
        </button>
        <button
          type="button"
          class="opacity-80 hover:opacity-100"
          aria-label="Dismiss icon refresh notice"
          @click="dismissIconRefresh"
        >
          Dismiss
        </button>
      </div>
    </div>

    <!-- Install prompt banner -->
    <div class="no-print">
      <InstallPrompt @show-instructions="openInstallInstructions()" />
    </div>

    <!-- Header -->
    <header class="bg-base-100 border-b border-base-300 sticky top-0 z-10 no-print">
      <div class="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <button
          class="text-lg font-bold text-primary hover:text-primary/80 transition-colors"
          @click="goHome"
        >
          Farlume
        </button>

        <BurgerMenu :items="menuItems" />
      </div>
    </header>

    <!-- Main content -->
    <main class="max-w-4xl mx-auto px-4 py-6">
      <slot />
    </main>

    <!-- Install instructions modal (Safari/Firefox or icon-refresh flow) -->
    <InstallInstructionsModal
      v-if="showInstructions"
      :expand-reinstall="expandReinstall"
      @close="showInstructions = false"
    />

    <!-- Tutorial modal (first visit + re-accessible from menu) -->
    <TutorialModal
      v-if="showTutorial"
      @close="dismissTutorial"
    />

    <!-- Help drawers -->
    <HelpDrawer
      v-if="activeDrawer === 'user-guide'"
      title="User Guide"
      :markdown="userGuideMd"
      @close="closeDrawer"
    />
    <HelpDrawer
      v-if="activeDrawer === 'testing-guide'"
      title="Test Scenarios"
      :markdown="testingGuideMd"
      @close="closeDrawer"
    />
    <HelpDrawer
      v-if="activeDrawer === 'import-format'"
      title="Import Format"
      :markdown="importFormatMd"
      @close="closeDrawer"
    />
    <HelpDrawer
      v-if="activeDrawer === 'sample-csv'"
      title="Sample CSV"
      :markdown="sampleCsvMd"
      @close="closeDrawer"
    />
    <!-- Restore from backup: error + replace confirm.
         Bottom offset accounts for iOS home indicator + keyboard region via
         env(safe-area-inset-bottom). Without this, the alert sat behind the
         on-screen keyboard when restore surfaced a validation error. -->
    <div
      v-if="restore.importError.value"
      class="fixed left-4 right-4 z-[70] max-w-md mx-auto"
      style="bottom: calc(1.5rem + env(safe-area-inset-bottom))"
    >
      <ErrorAlert :message="restore.importError.value" @dismiss="restore.importError.value = ''" />
    </div>
    <ConfirmDialog
      v-if="restore.showReplaceConfirm.value && restore.pendingImportData.value"
      title="Replace existing workspace?"
      :message="`A workspace named '${restore.pendingImportData.value.workspace.name}' already exists. Replacing it will overwrite all its transactions, patterns, and imported data.`"
      confirm-label="Replace"
      :danger="true"
      :busy="restore.restoring.value"
      @confirm="restore.confirmReplace"
      @cancel="restore.cancelReplace"
    />

    <!-- Toast notifications -->
    <ToastNotification />
  </div>
</template>
