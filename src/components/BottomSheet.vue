<script setup lang="ts">
/**
 * Requirement: Mobile-friendly menu alternative to dropdown menus
 * Approach: Bottom sheet that slides up from the bottom, easier to reach with thumbs.
 *   Falls back to regular dropdown positioning on desktop via CSS media queries.
 * Alternatives:
 *   - Always use dropdowns: Rejected — top-right dropdowns are hard to reach on tall phones
 *   - Full-screen modal: Rejected — too heavy for a simple menu
 */

import { ref, onMounted, onUnmounted } from 'vue'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const sheetRef = ref<HTMLElement | null>(null)

function handleBackdropClick() {
  emit('close')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="fixed inset-0 z-50">
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
          class="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-xl
                 max-h-[70vh] overflow-y-auto pb-safe
                 sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2
                 sm:rounded-xl sm:max-w-sm sm:w-full"
        >
          <!-- Drag handle (mobile only) -->
          <div class="flex justify-center pt-3 pb-2 sm:hidden">
            <div class="w-10 h-1 bg-gray-300 rounded-full" />
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
