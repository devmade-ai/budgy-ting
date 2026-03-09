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
    <span class="i-lucide-sparkles text-amber-400 text-xs flex-shrink-0" aria-hidden="true" />
    <button
      v-for="s in props.suggestions"
      :key="s.tag"
      class="inline-flex items-center gap-0.5 text-xs border border-dashed border-gray-300 text-gray-600 rounded px-1.5 py-0.5 hover:border-blue-400 hover:text-blue-600 transition-colors"
      :title="`Add tag: ${s.tag}`"
      @click="emit('accept', s.tag)"
    >
      {{ s.tag }}
      <span
        class="i-lucide-x text-[10px] opacity-50 hover:opacity-100 ml-0.5"
        role="button"
        :title="`Dismiss ${s.tag}`"
        @click.stop="emit('dismiss', s.tag)"
      />
    </button>
    <button
      v-if="props.suggestions.length >= 2"
      class="text-xs text-blue-500 hover:text-blue-700 underline ml-1"
      @click="emit('acceptAll')"
    >
      Add all
    </button>
  </div>
</template>
