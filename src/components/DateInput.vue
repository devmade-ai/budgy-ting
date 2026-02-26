<script setup lang="ts">
/**
 * Requirement: Date inputs should look obviously tappable on mobile (iOS Safari)
 * Approach: Wrapper with trailing calendar icon to hint that the field opens a date picker.
 *   Native type="date" picker is preserved — icon is decorative.
 * Alternatives:
 *   - Custom date picker library: Rejected — native picker is better on mobile
 *   - CSS-only icon: Rejected — harder to position consistently cross-browser
 */

const model = defineModel<string>({ required: true })

defineProps<{
  id?: string
  min?: string
}>()
</script>

<template>
  <div class="relative">
    <input
      :id="id"
      v-model="model"
      type="date"
      class="input-field pr-9"
      :min="min"
    />
    <span
      class="i-lucide-calendar absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      aria-hidden="true"
    />
  </div>
</template>
