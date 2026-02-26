<script setup lang="ts">
/**
 * Requirement: Visual cue that tables have horizontal scroll content off-screen
 * Approach: Wrapper div with CSS gradient fade on the right edge when content overflows.
 *   Uses a ResizeObserver + scroll listener to detect when content is scrollable and
 *   hides the hint when scrolled to the end.
 * Alternatives:
 *   - Arrow icon overlay: Rejected — gradient is subtler and more conventional
 *   - CSS-only with overflow check: Not possible — requires JS to detect overflow
 */

import { ref, onMounted, onUnmounted } from 'vue'

const wrapperRef = ref<HTMLElement | null>(null)
const showRightHint = ref(false)

function updateHint() {
  const el = wrapperRef.value
  if (!el) return
  // Show hint when there's more content to scroll to the right
  const hasOverflow = el.scrollWidth > el.clientWidth
  const notAtEnd = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
  showRightHint.value = hasOverflow && notAtEnd
}

let observer: ResizeObserver | null = null

onMounted(() => {
  const el = wrapperRef.value
  if (!el) return

  el.addEventListener('scroll', updateHint, { passive: true })
  observer = new ResizeObserver(updateHint)
  observer.observe(el)

  // Initial check
  updateHint()
})

onUnmounted(() => {
  wrapperRef.value?.removeEventListener('scroll', updateHint)
  observer?.disconnect()
})
</script>

<template>
  <div class="relative">
    <div ref="wrapperRef" class="overflow-x-auto -mx-4 px-4">
      <slot />
    </div>
    <!-- Fade gradient hint on right edge -->
    <div
      v-if="showRightHint"
      class="absolute top-0 right-0 bottom-0 w-8 pointer-events-none bg-gradient-to-l from-gray-50 to-transparent"
      aria-hidden="true"
    />
  </div>
</template>
