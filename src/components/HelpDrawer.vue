<script setup lang="ts">
/**
 * Requirement: In-app access to USER_GUIDE.md and TESTING_GUIDE.md during development
 * Approach: Slide-out drawer rendering markdown via `marked`, content imported at build time
 *   using Vite ?raw imports. Uses existing Teleport + useDialogA11y patterns.
 * Alternatives:
 *   - Separate route/page: Rejected — drawer is less disruptive, can view alongside app
 *   - Raw <pre> text: Rejected — markdown rendering is cheap and much more readable
 *   - iframe: Rejected — unnecessary complexity for static content
 */

import { ref, computed, onMounted } from 'vue'
import { marked } from 'marked'
import { useDialogA11y } from '@/composables/useDialogA11y'

const props = defineProps<{
  title: string
  markdown: string
}>()

const emit = defineEmits<{
  close: []
}>()

const drawerRef = ref<HTMLElement | null>(null)
const visible = ref(false)

useDialogA11y(drawerRef, () => emit('close'))

// Render markdown to HTML once (content is static build-time import)
const htmlContent = computed(() => marked.parse(props.markdown) as string)

// Animate in after mount
onMounted(() => {
  requestAnimationFrame(() => {
    visible.value = true
  })
})

function handleClose() {
  visible.value = false
  // Wait for slide-out animation before unmounting
  setTimeout(() => emit('close'), 200)
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex">
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/40 transition-opacity duration-200"
        :class="visible ? 'opacity-100' : 'opacity-0'"
        aria-hidden="true"
        @click="handleClose"
      />

      <!-- Drawer panel — slides in from right -->
      <div
        ref="drawerRef"
        role="dialog"
        :aria-label="title"
        aria-modal="true"
        class="absolute top-0 right-0 h-full w-[calc(100%-2rem)] max-w-lg bg-white shadow-xl transition-transform duration-200 flex flex-col"
        :class="visible ? 'translate-x-0' : 'translate-x-full'"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <h2 class="text-lg font-semibold text-gray-900">{{ title }}</h2>
          <button
            class="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
            @click="handleClose"
          >
            <span class="i-lucide-x text-lg" aria-hidden="true" />
          </button>
        </div>

        <!-- Content -->
        <!-- eslint-disable vue/no-v-html -->
        <div
          class="flex-1 overflow-y-auto px-5 py-4 prose prose-sm max-w-none"
          v-html="htmlContent"
        />
        <!-- eslint-enable vue/no-v-html -->
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Minimal prose styles for rendered markdown — keeps it readable without a full typography plugin */
:deep(.prose) h1 { font-size: 1.5rem; font-weight: 700; margin: 1.5rem 0 0.75rem; color: #111827; }
:deep(.prose) h2 { font-size: 1.25rem; font-weight: 600; margin: 1.25rem 0 0.5rem; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.25rem; }
:deep(.prose) h3 { font-size: 1.1rem; font-weight: 600; margin: 1rem 0 0.5rem; color: #374151; }
:deep(.prose) h4 { font-size: 1rem; font-weight: 600; margin: 0.75rem 0 0.25rem; color: #374151; }
:deep(.prose) p { margin: 0.5rem 0; line-height: 1.6; color: #374151; }
:deep(.prose) ul, :deep(.prose) ol { margin: 0.5rem 0; padding-left: 1.5rem; color: #374151; }
:deep(.prose) li { margin: 0.25rem 0; line-height: 1.5; }
:deep(.prose) li > ul, :deep(.prose) li > ol { margin: 0.125rem 0; }
:deep(.prose) strong { font-weight: 600; color: #111827; }
:deep(.prose) code { background: #f3f4f6; padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-size: 0.85em; }
:deep(.prose) pre { background: #f3f4f6; padding: 0.75rem 1rem; border-radius: 0.5rem; overflow-x: auto; margin: 0.5rem 0; }
:deep(.prose) pre code { background: none; padding: 0; }
:deep(.prose) hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.5rem 0; }
:deep(.prose) a { color: #10b981; text-decoration: underline; }
:deep(.prose) input[type="checkbox"] { margin-right: 0.5rem; }
</style>
