<script setup lang="ts">
/**
 * Requirement: Consistent, engaging empty state display across all views
 * Approach: Larger icon in a soft circular background + clear title + description + action slot.
 *   More visually engaging than a tiny gray icon, without needing custom illustrations.
 * Alternatives:
 *   - Custom SVG illustrations: Deferred — nice-to-have but requires design work
 *   - Tiny gray icon: Rejected — too stark, doesn't invite action
 */
import type { Component } from 'vue'

defineProps<{
  icon: Component
  title: string
  description?: string
}>()
</script>

<template>
  <div class="fl-empty">
    <span class="fl-empty__icon">
      <component :is="icon" :size="28" />
    </span>
    <h3 class="fl-empty__title">{{ title }}</h3>
    <p v-if="description" class="fl-empty__desc">
      {{ description }}
    </p>
    <div class="fl-empty__actions">
      <slot />
    </div>
  </div>
</template>
