<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePWAUpdate } from '@/composables/usePWAUpdate'
import { useTutorial } from '@/composables/useTutorial'
import InstallPrompt from '@/components/InstallPrompt.vue'
import InstallInstructionsModal from '@/components/InstallInstructionsModal.vue'
import TutorialModal from '@/components/TutorialModal.vue'

const router = useRouter()
const { hasUpdate, offlineReady, updateApp } = usePWAUpdate()
const { showTutorial, showIfFirstVisit, openTutorial, dismissTutorial } = useTutorial()

const showInstructions = ref(false)

onMounted(() => {
  showIfFirstVisit()
})

function goHome() {
  router.push({ name: 'budget-list' })
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
        <button
          class="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
          title="How it works"
          aria-label="How it works"
          @click="openTutorial"
        >
          <span class="i-lucide-circle-help text-lg" aria-hidden="true" />
        </button>
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

    <!-- Tutorial modal (first visit + re-accessible from help button) -->
    <TutorialModal
      v-if="showTutorial"
      @close="dismissTutorial"
    />
  </div>
</template>
