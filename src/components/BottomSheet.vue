<script setup lang="ts">
/**
 * Requirement: Mobile-friendly menu alternative to dropdown menus
 * Approach: Bottom sheet that slides up from the bottom, easier to reach with thumbs.
 *   Falls back to regular dropdown positioning on desktop via CSS media queries.
 * Alternatives:
 *   - Always use dropdowns: Rejected — top-right dropdowns are hard to reach on tall phones
 *   - Full-screen modal: Rejected — too heavy for a simple menu
 */

import { ref, watch } from 'vue'
import { useDialogA11y } from '@/composables/useDialogA11y'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const sheetRef = ref<HTMLElement | null>(null)
useDialogA11y(sheetRef, () => emit('close'))

function handleBackdropClick() {
  emit('close')
}

// Mobile UX: Swipe-to-close gesture on the drag handle
// Tracks touch start/move/end and closes the sheet when swiped down 80px+
const dragOffset = ref(0)
const isDragging = ref(false)
let startY = 0

function onTouchStart(e: TouchEvent) {
  startY = e.touches[0]!.clientY
  isDragging.value = true
  dragOffset.value = 0
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging.value) return
  const dy = e.touches[0]!.clientY - startY
  // Only allow downward drag (positive dy)
  dragOffset.value = Math.max(0, dy)
}

function onTouchEnd() {
  if (!isDragging.value) return
  isDragging.value = false
  if (dragOffset.value > 80) {
    emit('close')
  }
  dragOffset.value = 0
}

// Reset drag state when sheet closes
watch(() => sheetRef.value, () => {
  dragOffset.value = 0
  isDragging.value = false
})
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="fixed inset-0 z-[60]">
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/40"
          aria-hidden="true"
          @click="handleBackdropClick"
        />

        <!-- Sheet — bottom on mobile, centered card on desktop -->
        <div
          ref="sheetRef"
          role="dialog"
          aria-modal="true"
          class="absolute bottom-0 left-0 right-0 bg-white dark:bg-[var(--color-surface-elevated)] rounded-t-2xl shadow-xl dark:shadow-none
                 max-h-[70vh] overflow-y-auto pb-safe
                 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
                 sm:rounded-xl sm:max-w-sm sm:w-full"
          :style="dragOffset > 0 ? { transform: `translateY(${dragOffset}px)`, transition: isDragging ? 'none' : '' } : {}"
        >
          <!-- Drag handle (mobile only) — swipe down to close -->
          <div
            class="flex justify-center pt-3 pb-2 sm:hidden cursor-grab active:cursor-grabbing touch-none"
            @touchstart="onTouchStart"
            @touchmove="onTouchMove"
            @touchend="onTouchEnd"
          >
            <div class="w-10 h-1 bg-gray-300 dark:bg-zinc-600 rounded-full" />
          </div>

          <div class="px-4 pb-4">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Bottom sheet slide-up animation */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.2s ease;
}
.sheet-enter-active > div:last-child,
.sheet-leave-active > div:last-child {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from > div:last-child,
.sheet-leave-to > div:last-child {
  transform: translateY(100%);
}

/* Safe area padding for iOS notch */
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0.5rem);
}
</style>
