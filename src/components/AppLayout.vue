<script setup lang="ts">
import { useRouter } from 'vue-router'
import { usePWA } from '@/composables/usePWA'

const router = useRouter()
const { canInstall, install, updateAvailable, applyUpdate } = usePWA()

function goHome() {
  router.push({ name: 'budget-list' })
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Update banner -->
    <div
      v-if="updateAvailable"
      class="bg-brand-600 text-white text-sm px-4 py-2 flex items-center justify-between"
    >
      <span>A new version is available</span>
      <button
        class="font-medium underline hover:no-underline"
        @click="applyUpdate"
      >
        Update now
      </button>
    </div>

    <!-- Header -->
    <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <button
          class="text-lg font-bold text-brand-600 hover:text-brand-700 transition-colors"
          @click="goHome"
        >
          budgy-ting
        </button>

        <!-- Install button (only shown when browser supports install) -->
        <button
          v-if="canInstall"
          class="text-xs text-brand-600 border border-brand-300 rounded-full px-3 py-1 hover:bg-brand-50 transition-colors"
          @click="install"
        >
          <span class="i-lucide-download mr-1" />
          Install app
        </button>
      </div>
    </header>

    <!-- Main content -->
    <main class="max-w-4xl mx-auto px-4 py-6">
      <slot />
    </main>
  </div>
</template>
