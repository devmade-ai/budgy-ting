<script setup lang="ts">
/**
 * Requirement: Display ML-suggested tags as interactive chips the user can accept or dismiss
 * Approach: Farlume accent tags (fl-tag fl-tag--accent) with a sparkle icon. Tap to accept, x to dismiss.
 *   Confidence not shown — non-technical audience. Hidden when no suggestions.
 * Alternatives:
 *   - Inline in tag input: Rejected — import flow doesn't have a tag input per group
 *   - Modal/popover: Rejected — too heavy for quick accept/dismiss interaction
 */

import type { TagSuggestion } from '@/ml/types'
import { Sparkles, X } from 'lucide-vue-next'

const props = defineProps<{
  suggestions: TagSuggestion[]
}>()

const emit = defineEmits<{
  accept: [tag: string]
  dismiss: [tag: string]
  acceptAll: []
}>()
</script>

<template>
  <div v-if="props.suggestions.length > 0" class="flex flex-wrap items-center gap-1 mt-1">
    <Sparkles :size="12" class="text-accent-active flex-shrink-0" aria-hidden="true" />
    <span
      v-for="s in props.suggestions"
      :key="s.tag"
      class="fl-tag fl-tag--accent fl-tag--sm"
    >
      <button
        class="bg-transparent border-none cursor-pointer p-0 text-inherit"
        :aria-label="`Add tag: ${s.tag}`"
        @click="emit('accept', s.tag)"
      >
        {{ s.tag }}
      </button>
      <!-- Mobile UX: 20x20px touch target for dismiss (was 10px icon) -->
      <button
        class="fl-tag__x w-5 h-5"
        :aria-label="`Dismiss ${s.tag}`"
        @click="emit('dismiss', s.tag)"
      >
        <X :size="12" />
      </button>
    </span>
    <button
      v-if="props.suggestions.length >= 2"
      class="fl-link text-xs ml-1"
      @click="emit('acceptAll')"
    >
      Add all
    </button>
  </div>
</template>
