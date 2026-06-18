<script setup lang="ts">
/**
 * Requirement: Smoother loading states with skeleton placeholders instead of spinners
 * Approach: Farlume .fl-skeleton shimmer block — each block has a built-in shimmer animation.
 *   Configurable variant mimics the shape of the final content.
 * Alternatives:
 *   - Spinner only: Rejected — content-shaped skeletons feel faster (perceived performance)
 *   - Custom animate-pulse: Replaced by the .fl-skeleton class
 */

defineProps<{
  /** Which layout to skeleton: 'dashboard' | 'list' | 'card' */
  variant?: 'dashboard' | 'list' | 'card'
}>()
</script>

<template>
  <div role="status" aria-label="Loading...">
    <!-- Dashboard skeleton: metrics grid + chart placeholder + table rows -->
    <template v-if="variant === 'dashboard'">
      <!-- Metrics grid -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <div v-for="i in 4" :key="i" class="bg-card rounded-lg border border-line-2 p-4">
          <div class="fl-skeleton h-3 w-20 mb-2" />
          <div class="fl-skeleton h-6 w-24" />
        </div>
      </div>
      <!-- Chart placeholder -->
      <div class="bg-card rounded-lg border border-line-2 p-4 mb-6">
        <div class="fl-skeleton h-48 sm:h-64 w-full" />
      </div>
      <!-- Table rows -->
      <div class="space-y-2">
        <div v-for="i in 5" :key="i" class="flex items-center gap-3 py-3">
          <div class="fl-skeleton h-4 w-20" />
          <div class="fl-skeleton h-4 flex-1" />
          <div class="fl-skeleton h-4 w-16" />
        </div>
      </div>
    </template>

    <!-- List skeleton: workspace cards -->
    <template v-else-if="variant === 'list'">
      <div class="space-y-3">
        <div v-for="i in 3" :key="i" class="bg-card rounded-lg border border-line-2 p-4">
          <div class="fl-skeleton h-5 w-40 mb-2" />
          <div class="fl-skeleton h-3 w-64" />
        </div>
      </div>
    </template>

    <!-- Generic card skeleton -->
    <template v-else>
      <div class="bg-card rounded-lg border border-line-2 p-4">
        <div class="fl-skeleton h-4 w-32 mb-3" />
        <div class="fl-skeleton h-3 w-full mb-2" />
        <div class="fl-skeleton h-3 w-3/4" />
      </div>
    </template>
  </div>
</template>
