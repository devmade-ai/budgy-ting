<script setup lang="ts">
/**
 * Requirement: Burger menu in header for accessing tutorial, user guide, and testing guide
 * Approach: Replace standalone "?" button with a menu icon that opens a dropdown.
 *   Dropdown items open the tutorial modal (existing) or a HelpDrawer with markdown content.
 *   Markdown files imported at build time via Vite ?raw to avoid runtime fetching.
 * Alternatives:
 *   - Keep "?" as tutorial only, add separate icons: Rejected — clutters header
 *   - Full sidebar navigation: Rejected — overkill for 3 menu items
 */

import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePWAUpdate } from '@/composables/usePWAUpdate'
import { useTutorial } from '@/composables/useTutorial'
import InstallPrompt from '@/components/InstallPrompt.vue'
import InstallInstructionsModal from '@/components/InstallInstructionsModal.vue'
import TutorialModal from '@/components/TutorialModal.vue'
import HelpDrawer from '@/components/HelpDrawer.vue'

// Build-time markdown imports — bundled as strings, no runtime fetch
import userGuideMd from '../../docs/USER_GUIDE.md?raw'
import testingGuideMd from '../../docs/TESTING_GUIDE.md?raw'
import importFormatMd from '../../docs/IMPORT_FORMAT.md?raw'
import sampleCsvRaw from '../../docs/sample-import.csv?raw'

// Wrap raw CSV in markdown code fence so HelpDrawer renders it as a code block
const sampleCsvMd = 'Copy this sample data to test the import wizard, or use it as a template for formatting your own data.\n\n```csv\n' + sampleCsvRaw.trim() + '\n```'

const router = useRouter()
const { hasUpdate, offlineReady, updateApp } = usePWAUpdate()
const { showTutorial, showIfFirstVisit, openTutorial, dismissTutorial } = useTutorial()

const showInstructions = ref(false)
const menuOpen = ref(false)
const menuRef = ref<HTMLElement | null>(null)

// Help drawer state
type DrawerContent = 'user-guide' | 'testing-guide' | 'import-format' | 'sample-csv' | null
const activeDrawer = ref<DrawerContent>(null)

onMounted(() => {
  showIfFirstVisit()
  document.addEventListener('click', handleOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
})

function goHome() {
  router.push({ name: 'budget-list' })
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function handleOutsideClick(e: MouseEvent) {
  if (menuOpen.value && menuRef.value && !menuRef.value.contains(e.target as Node)) {
    menuOpen.value = false
  }
}

function handleTutorial() {
  menuOpen.value = false
  openTutorial()
}

function openDrawer(content: DrawerContent) {
  menuOpen.value = false
  activeDrawer.value = content
}

function closeDrawer() {
  activeDrawer.value = null
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
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
    <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <button
          class="text-lg font-bold text-brand-600 hover:text-brand-700 transition-colors"
          @click="goHome"
        >
          budgy-ting
        </button>

        <!-- Menu button + dropdown -->
        <div ref="menuRef" class="relative">
          <button
            class="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
            title="Menu"
            aria-label="Menu"
            aria-haspopup="true"
            :aria-expanded="menuOpen"
            @click="toggleMenu"
          >
            <span class="i-lucide-menu text-lg" aria-hidden="true" />
          </button>

          <!-- Dropdown menu -->
          <div
            v-if="menuOpen"
            class="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20"
            role="menu"
          >
            <button
              class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              role="menuitem"
              @click="handleTutorial"
            >
              <span class="i-lucide-circle-help text-base text-gray-400" aria-hidden="true" />
              How it works
            </button>
            <button
              class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              role="menuitem"
              @click="openDrawer('user-guide')"
            >
              <span class="i-lucide-book-open text-base text-gray-400" aria-hidden="true" />
              User Guide
            </button>
            <button
              class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              role="menuitem"
              @click="openDrawer('testing-guide')"
            >
              <span class="i-lucide-test-tubes text-base text-gray-400" aria-hidden="true" />
              Test Scenarios
            </button>
            <div class="border-t border-gray-100 my-1" role="separator" />
            <button
              class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              role="menuitem"
              @click="openDrawer('import-format')"
            >
              <span class="i-lucide-file-text text-base text-gray-400" aria-hidden="true" />
              Import Format
            </button>
            <button
              class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              role="menuitem"
              @click="openDrawer('sample-csv')"
            >
              <span class="i-lucide-file-spreadsheet text-base text-gray-400" aria-hidden="true" />
              Sample CSV
            </button>
          </div>
        </div>
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
  </div>
</template>
