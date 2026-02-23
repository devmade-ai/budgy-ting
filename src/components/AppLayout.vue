<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goHome() {
  router.push({ name: 'budget-list' })
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-4xl mx-auto px-4 h-14 flex items-center">
        <button
          class="text-lg font-bold text-brand-600 hover:text-brand-700 transition-colors"
          @click="goHome"
        >
          budgy-ting
        </button>
      </div>
    </header>

    <!-- Main content -->
    <main class="max-w-4xl mx-auto px-4 py-6">
      <slot />
    </main>
  </div>
</template>
