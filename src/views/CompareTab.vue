<script setup lang="ts">
import type { Budget } from '@/types/models'

defineProps<{ budget: Budget }>()
</script>

<template>
  <div class="text-center py-12">
    <div class="i-lucide-bar-chart-3 text-4xl text-gray-300 mx-auto mb-3" />
    <p class="text-gray-500">Nothing to compare yet</p>
    <p class="text-gray-400 text-sm mt-1">
      Add expenses and import actuals to see comparisons
    </p>
  </div>
</template>
