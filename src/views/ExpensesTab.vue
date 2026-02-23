<script setup lang="ts">
import type { Budget } from '@/types/models'

defineProps<{ budget: Budget }>()
</script>

<template>
  <div class="text-center py-12">
    <div class="i-lucide-list text-4xl text-gray-300 mx-auto mb-3" />
    <p class="text-gray-500">No expenses yet</p>
    <p class="text-gray-400 text-sm mt-1">
      Add expense lines to start planning your budget
    </p>
  </div>
</template>
