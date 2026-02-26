<script setup lang="ts">
/**
 * Requirement: Step 4 of import wizard — success confirmation
 * Approach: Extracted from ImportWizardView to reduce component size
 */

import type { MatchResult } from '@/engine/matching'

const props = defineProps<{
  matchResults: MatchResult[]
}>()

const emit = defineEmits<{
  finish: []
}>()

function countByConfidence(conf: string) {
  return props.matchResults.filter((r) => r.approved && r.confidence === conf).length
}
</script>

<template>
  <div class="text-center py-12">
    <div class="i-lucide-check-circle text-5xl text-green-500 mx-auto mb-4" />
    <h1 class="page-title mb-2">Import Complete</h1>
    <p class="text-gray-500 mb-6">
      Successfully imported {{ matchResults.filter((r) => r.approved).length }} transactions
    </p>

    <div class="card max-w-xs mx-auto mb-6 text-left">
      <div class="space-y-1 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-500">Auto-matched</span>
          <span class="font-medium">{{ countByConfidence('high') }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">Manually approved</span>
          <span class="font-medium">{{ countByConfidence('medium') + countByConfidence('low') + countByConfidence('manual') }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">Unbudgeted</span>
          <span class="font-medium">{{ countByConfidence('unmatched') }}</span>
        </div>
      </div>
    </div>

    <button class="btn-primary" @click="emit('finish')">
      View comparison
    </button>
  </div>
</template>
