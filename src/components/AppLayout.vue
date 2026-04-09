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

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePWAUpdate } from '@/composables/usePWAUpdate'
import { useTutorial } from '@/composables/useTutorial'
import { useDarkMode } from '@/composables/useDarkMode'
import BurgerMenu from '@/components/BurgerMenu.vue'
import type { MenuItem } from '@/components/BurgerMenu.vue'
import InstallPrompt from '@/components/InstallPrompt.vue'
import InstallInstructionsModal from '@/components/InstallInstructionsModal.vue'
import TutorialModal from '@/components/TutorialModal.vue'
import HelpDrawer from '@/components/HelpDrawer.vue'
import ToastNotification from '@/components/ToastNotification.vue'
import { CircleHelp, BookOpen, TestTubes, FileText, FileSpreadsheet, RefreshCw, Sun, Moon } from 'lucide-vue-next'

// Build-time markdown imports — bundled as strings, no runtime fetch
import userGuideMd from '../../docs/USER_GUIDE.md?raw'
import testingGuideMd from '../../docs/TESTING_GUIDE.md?raw'
import importFormatMd from '../../docs/IMPORT_FORMAT.md?raw'
import sampleCsvRaw from '../../docs/sample-import.csv?raw'

// Wrap raw CSV in markdown code fence so HelpDrawer renders it as a code block
const sampleCsvMd = 'Copy this sample data to test the import wizard, or use it as a template for formatting your own data.\n\n```csv\n' + sampleCsvRaw.trim() + '\n```'

const router = useRouter()
const { hasUpdate, offlineReady, checking, updateApp, checkForUpdate } = usePWAUpdate()
const { showTutorial, showIfFirstVisit, openTutorial, dismissTutorial } = useTutorial()
const { isDark, toggle: toggleDarkMode } = useDarkMode()

const showInstructions = ref(false)

// Help drawer state
type DrawerContent = 'user-guide' | 'testing-guide' | 'import-format' | 'sample-csv' | null
const activeDrawer = ref<DrawerContent>(null)

onMounted(() => {
  showIfFirstVisit()
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
  {
    label: isDark.value ? 'Light mode' : 'Dark mode',
    icon: isDark.value ? Sun : Moon,
    iconClass: isDark.value ? 'text-amber-400' : 'text-gray-400 dark:text-zinc-500',
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
  <div class="min-h-screen bg-gray-50 dark:bg-[var(--color-surface-page)]">
    <!-- Update banner -->
    <div
      v-if="hasUpdate"
      class="bg-brand-600 text-white text-sm px-4 py-2 flex items-center justify-between"
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
      class="bg-green-600 text-white text-sm px-4 py-2 text-center"
    >
      App is ready for offline use
    </div>

    <!-- Install prompt banner -->
    <InstallPrompt @show-instructions="showInstructions = true" />

    <!-- Header -->
    <header class="bg-white dark:bg-[var(--color-surface)] border-b border-gray-200 dark:border-zinc-700 sticky top-0 z-10 no-print">
      <div class="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <button
          class="text-lg font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
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

    <!-- Install instructions modal (Safari/Firefox) -->
    <InstallInstructionsModal
      v-if="showInstructions"
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
    <!-- Toast notifications -->
    <ToastNotification />
  </div>
</template>
