<script setup lang="ts">
/**
 * Floating debug diagnostic panel — alpha-phase only, intended to be removed.
 *
 * Requirement: Non-technical users can't open devtools. This surfaces runtime
 *   diagnostics in a floating pill that survives app crashes (mounted in a
 *   separate Vue root).
 * Approach: Collapsed pill shows entry count + error/warning badges. Expanded
 *   state has Log and Environment tabs with Copy/Clear actions.
 * Alternatives:
 *   - Console-only: Rejected — inaccessible to target users
 *   - External error service (Sentry): Rejected — local-first principle
 */

import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import {
  subscribe,
  getEntries,
  clearEntries,
  generateReport,
  type DebugEntry,
  type DebugSource,
  type DebugSeverity,
} from './debugLog'

const expanded = ref(false)
const activeTab = ref<'log' | 'env'>('log')
const entries = ref<DebugEntry[]>([])
const logContainer = ref<HTMLElement | null>(null)
const copyFeedback = ref(false)

// Subscribe to new entries
let unsubscribe: (() => void) | null = null

onMounted(() => {
  entries.value = [...getEntries()]
  unsubscribe = subscribe((entry) => {
    entries.value = [...getEntries()]
  })
})

onUnmounted(() => {
  unsubscribe?.()
})

// Auto-scroll log to bottom when new entries arrive or when log tab is shown
watch(
  () => entries.value.length,
  () => {
    if (expanded.value && activeTab.value === 'log') {
      nextTick(() => {
        if (logContainer.value) {
          logContainer.value.scrollTop = logContainer.value.scrollHeight
        }
      })
    }
  },
)

// ── Counts ──

const entryCount = computed(() => entries.value.length)
const errorCount = computed(() => entries.value.filter((e) => e.severity === 'error').length)
const warnCount = computed(() => entries.value.filter((e) => e.severity === 'warn').length)

// ── Styling helpers ──

const sourceColors: Record<DebugSource, string> = {
  boot: 'text-purple-600',
  db: 'text-blue-600',
  pwa: 'text-teal-600',
  import: 'text-amber-600',
  engine: 'text-indigo-600',
  global: 'text-gray-600',
}

const severityColors: Record<DebugSeverity, string> = {
  info: 'text-gray-500',
  success: 'text-green-600',
  warn: 'text-yellow-600',
  error: 'text-red-600',
}

function formatTime(iso: string): string {
  return iso.slice(11, 23) // HH:MM:SS.mmm
}

// ── Environment data ──

const envData = computed(() => [
  { label: 'URL', value: window.location.href },
  { label: 'User Agent', value: navigator.userAgent },
  { label: 'Screen', value: `${screen.width}x${screen.height}` },
  { label: 'Viewport', value: `${window.innerWidth}x${window.innerHeight}` },
  { label: 'Online', value: navigator.onLine ? 'Yes' : 'No' },
  { label: 'Protocol', value: window.location.protocol },
  { label: 'Standalone', value: window.matchMedia('(display-mode: standalone)').matches ? 'Yes' : 'No' },
  { label: 'Service Worker', value: 'serviceWorker' in navigator ? 'Supported' : 'Not supported' },
  { label: 'IndexedDB', value: 'indexedDB' in window ? 'Supported' : 'Not supported' },
  { label: 'Timestamp', value: new Date().toISOString() },
])

// ── Actions ──

async function copyReport() {
  const report = generateReport()

  try {
    await navigator.clipboard.writeText(report)
  } catch {
    // Fallback: textarea copy for environments without Clipboard API
    const textarea = document.createElement('textarea')
    textarea.value = report
    textarea.style.position = 'fixed'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }

  copyFeedback.value = true
  setTimeout(() => {
    copyFeedback.value = false
  }, 1500)
}

function handleClear() {
  clearEntries()
  entries.value = []
}

function toggle() {
  expanded.value = !expanded.value
  if (expanded.value && activeTab.value === 'log') {
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight
      }
    })
  }
}
</script>

<template>
  <div class="fixed bottom-4 right-4 z-[9999]">
    <!-- Collapsed pill -->
    <button
      v-if="!expanded"
      class="bg-gray-900 text-white text-xs font-mono px-3 py-1.5 rounded-full shadow-lg
             hover:bg-gray-800 transition-colors flex items-center gap-1.5"
      @click="toggle"
    >
      <span>dbg</span>
      <span class="text-gray-400">{{ entryCount }}</span>
      <span v-if="errorCount > 0" class="bg-red-500 text-white text-[10px] px-1.5 rounded-full">
        {{ errorCount }}
      </span>
      <span v-if="warnCount > 0" class="bg-yellow-500 text-white text-[10px] px-1.5 rounded-full">
        {{ warnCount }}
      </span>
    </button>

    <!-- Expanded panel -->
    <div
      v-else
      class="bg-gray-900 text-white rounded-xl shadow-2xl w-[360px] max-h-[70vh] flex flex-col overflow-hidden"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <div class="flex gap-1">
          <button
            class="text-xs px-2 py-1 rounded transition-colors"
            :class="activeTab === 'log' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'"
            @click="activeTab = 'log'"
          >
            Log
          </button>
          <button
            class="text-xs px-2 py-1 rounded transition-colors"
            :class="activeTab === 'env' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'"
            @click="activeTab = 'env'"
          >
            Environment
          </button>
        </div>
        <div class="flex gap-1">
          <button
            class="text-xs px-2 py-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            @click="copyReport"
          >
            {{ copyFeedback ? 'Copied!' : 'Copy' }}
          </button>
          <button
            class="text-xs px-2 py-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            @click="handleClear"
          >
            Clear
          </button>
          <button
            class="text-xs px-2 py-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            @click="toggle"
          >
            Close
          </button>
        </div>
      </div>

      <!-- Log tab -->
      <div
        v-if="activeTab === 'log'"
        ref="logContainer"
        class="flex-1 overflow-y-auto p-2 font-mono text-[11px] leading-relaxed min-h-[200px] max-h-[50vh]"
      >
        <div v-if="entries.length === 0" class="text-gray-500 text-center py-8">
          No entries yet
        </div>
        <div
          v-for="entry in entries"
          :key="entry.id"
          class="py-0.5 flex gap-1.5 items-start hover:bg-gray-800/50 px-1 rounded"
        >
          <span class="text-gray-500 shrink-0">{{ formatTime(entry.timestamp) }}</span>
          <span :class="sourceColors[entry.source]" class="shrink-0">[{{ entry.source }}]</span>
          <span :class="severityColors[entry.severity]" class="break-all">
            {{ entry.event }}
            <span v-if="entry.details" class="text-gray-500">
              {{ JSON.stringify(entry.details) }}
            </span>
          </span>
        </div>
      </div>

      <!-- Environment tab -->
      <div
        v-else
        class="flex-1 overflow-y-auto p-3 text-xs min-h-[200px] max-h-[50vh]"
      >
        <div
          v-for="item in envData"
          :key="item.label"
          class="flex justify-between py-1.5 border-b border-gray-800 last:border-0"
        >
          <span class="text-gray-400">{{ item.label }}</span>
          <span class="text-gray-200 text-right max-w-[220px] truncate ml-2">{{ item.value }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
