<script setup lang="ts">
/**
 * Requirement: Display ML-suggested tags as interactive chips the user can accept or dismiss
 * Approach: Dashed-border chips with sparkle icon. Tap to accept, x to dismiss.
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
    <Sparkles :size="12" class="text-amber-400 flex-shrink-0" aria-hidden="true" />
    <span
      v-for="s in props.suggestions"
      :key="s.tag"
      class="inline-flex items-center gap-0.5 text-xs border border-dashed border-gray-300 text-gray-600 rounded px-1.5 py-0.5"
    >
      <button
        class="hover:text-blue-600 transition-colors"
        :aria-label="`Add tag: ${s.tag}`"
        @click="emit('accept', s.tag)"
      >
        {{ s.tag }}
      </button>
      <!-- Mobile UX: 20x20px touch target for dismiss (was 10px icon) -->
      <button
        class="w-5 h-5 flex items-center justify-center opacity-50 hover:opacity-100 ml-0.5 rounded-full"
        :aria-label="`Dismiss ${s.tag}`"
        @click="emit('dismiss', s.tag)"
      >
        <X :size="12" />
      </button>
    </span>
    <button
      v-if="props.suggestions.length >= 2"
      class="text-xs text-blue-500 hover:text-blue-700 underline ml-1"
      @click="emit('acceptAll')"
    >
      Add all
    </button>
  </div>
</template>
