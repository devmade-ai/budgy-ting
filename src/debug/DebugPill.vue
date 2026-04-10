<script setup lang="ts">
/**
 * Floating debug diagnostic panel — alpha-phase only, intended to be removed.
 *
 * Requirement: Non-technical users can't open devtools. This surfaces runtime
 *   diagnostics in a floating pill that survives app crashes (mounted in a
 *   separate Vue root).
 * Approach: Collapsed pill shows entry count + error/warning badges. Expanded
 *   state has Log, Environment, and PWA Diagnostics tabs with Copy/Clear actions.
 *   Uses DaisyUI semantic tokens via Tailwind classes. The pre-framework inline
 *   pill in index.html handles the CSS-not-loaded case — this Vue component only
 *   mounts after Vue is running (CSS is guaranteed loaded).
 * Alternatives:
 *   - Console-only: Rejected — inaccessible to target users
 *   - External error service (Sentry): Rejected — local-first principle
 * Reference: glow-props docs/implementations/DEBUG_SYSTEM.md
 */

import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { resolveThemeColor } from '@/composables/useThemeColor'
import { useDarkMode } from '@/composables/useDarkMode'
import {
  subscribe,
  getEntries,
  clearEntries,
  generateReport,
  type DebugEntry,
} from './debugLog'

const expanded = ref(false)
const activeTab = ref<'log' | 'env' | 'pwa'>('log')
const entries = ref<DebugEntry[]>([])
const logContainer = ref<HTMLElement | null>(null)
const copyFeedback = ref(false)

// isDark triggers recompute of resolved colors when theme changes
const { isDark } = useDarkMode()

let unsubscribe: (() => void) | null = null
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  entries.value = [...getEntries()]
  unsubscribe = subscribe(() => {
    entries.value = [...getEntries()]
  })
})

onUnmounted(() => {
  unsubscribe?.()
  if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer)
})

// Auto-scroll log to bottom when new entries arrive
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

// ── Color mappings — resolved from DaisyUI theme tokens ──
// Recompute when isDark changes (forces resolveThemeColor to re-read CSS vars)

const sourceColors = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  isDark.value // dependency — triggers recompute on theme change
  return {
    boot: resolveThemeColor('--color-secondary', '#9333ea'),
    db: resolveThemeColor('--color-info', '#2563eb'),
    pwa: resolveThemeColor('--color-accent', '#0d9488'),
    import: resolveThemeColor('--color-warning', '#d97706'),
    engine: resolveThemeColor('--color-primary', '#4f46e5'),
    ml: resolveThemeColor('--color-error', '#ea580c'),
    global: resolveThemeColor('--color-base-content', '#6b7280'),
  } as Record<string, string>
})

const severityColors = computed(() => {
  isDark.value
  return {
    info: resolveThemeColor('--color-base-content', '#6b7280'),
    success: resolveThemeColor('--color-success', '#16a34a'),
    warn: resolveThemeColor('--color-warning', '#ca8a04'),
    error: resolveThemeColor('--color-error', '#dc2626'),
  } as Record<string, string>
})

const statusIndicators = computed(() => {
  isDark.value
  return {
    pass: { symbol: 'OK', color: resolveThemeColor('--color-success', '#16a34a') },
    fail: { symbol: 'FAIL', color: resolveThemeColor('--color-error', '#dc2626') },
    warn: { symbol: 'WARN', color: resolveThemeColor('--color-warning', '#ca8a04') },
    running: { symbol: '...', color: resolveThemeColor('--color-base-content', '#6b7280') },
  } as Record<string, { symbol: string; color: string }>
})

function formatTime(ts: number): string {
  const t = new Date(ts)
  const h = t.getHours().toString().padStart(2, '0')
  const m = t.getMinutes().toString().padStart(2, '0')
  const s = t.getSeconds().toString().padStart(2, '0')
  const ms = t.getMilliseconds().toString().padStart(3, '0')
  return `${h}:${m}:${s}.${ms}`
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

// ── PWA Diagnostics ──

interface DiagnosticResult {
  label: string
  status: 'pass' | 'fail' | 'warn' | 'running'
  detail: string
}

const diagnostics = ref<DiagnosticResult[]>([])
let diagnosticRunId = 0

async function runDiagnostics() {
  const runId = ++diagnosticRunId
  const results: DiagnosticResult[] = []

  // Sync checks
  results.push({
    label: 'Protocol',
    status: location.protocol === 'https:' || location.hostname === 'localhost' ? 'pass' : 'fail',
    detail: location.protocol,
  })
  results.push({
    label: 'Network',
    status: navigator.onLine ? 'pass' : 'warn',
    detail: navigator.onLine ? 'Online' : 'Offline',
  })
  results.push({
    label: 'SW Support',
    status: 'serviceWorker' in navigator ? 'pass' : 'fail',
    detail: 'serviceWorker' in navigator ? 'Supported' : 'Not supported',
  })

  // Standalone mode
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true
  results.push({ label: 'Standalone', status: standalone ? 'pass' : 'warn', detail: String(standalone) })

  // Install prompt
  const hasPrompt = !!(window as any).__pwaInstallPromptEvent || !!(window as any).__pwaInstallPromptReceived
  results.push({ label: 'Install Prompt', status: hasPrompt ? 'pass' : 'warn', detail: hasPrompt ? 'Captured' : 'Not received' })

  // Show sync results + placeholders for async
  results.push({ label: 'SW State', status: 'running', detail: 'Checking...' })
  results.push({ label: 'Manifest', status: 'running', detail: 'Checking...' })
  diagnostics.value = [...results]

  function set(label: string, result: DiagnosticResult) {
    const idx = results.findIndex((r) => r.label === label)
    if (idx >= 0) results[idx] = result
  }

  // Async: SW state
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/')
      if (runId !== diagnosticRunId) return
      const state = reg?.active ? 'active' : reg?.waiting ? 'waiting' : reg?.installing ? 'installing' : 'none'
      set('SW State', { label: 'SW State', status: reg ? 'pass' : 'warn', detail: state })
    } catch (e) {
      if (runId !== diagnosticRunId) return
      set('SW State', { label: 'SW State', status: 'fail', detail: String(e) })
    }
  } else {
    set('SW State', { label: 'SW State', status: 'fail', detail: 'No SW support' })
  }
  diagnostics.value = [...results]

  // Async: Manifest validation
  const manifestLink = document.querySelector('link[rel="manifest"]')
  if (manifestLink) {
    try {
      const res = await fetch(manifestLink.getAttribute('href') || '/manifest.webmanifest')
      if (runId !== diagnosticRunId) return
      const manifest = await res.json()
      const hasIcons = manifest.icons?.length > 0
      const hasName = !!manifest.name
      set('Manifest', {
        label: 'Manifest',
        status: hasIcons && hasName ? 'pass' : 'warn',
        detail: `name=${manifest.name || 'missing'}, icons=${manifest.icons?.length || 0}`,
      })
    } catch {
      if (runId !== diagnosticRunId) return
      set('Manifest', { label: 'Manifest', status: 'fail', detail: 'Failed to fetch' })
    }
  } else {
    set('Manifest', { label: 'Manifest', status: 'warn', detail: 'No <link rel="manifest"> found' })
  }
  if (runId === diagnosticRunId) diagnostics.value = [...results]
}

// Run diagnostics when PWA tab is first activated
watch(activeTab, (tab) => {
  if (tab === 'pwa' && diagnostics.value.length === 0) {
    runDiagnostics()
  }
})

// ── Actions ──

async function copyReport() {
  const report = generateReport()

  try {
    const blob = new Blob([report], { type: 'text/plain' })
    await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })])
  } catch {
    try {
      await navigator.clipboard.writeText(report)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = report
      textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
  }

  copyFeedback.value = true
  if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer)
  copyFeedbackTimer = setTimeout(() => {
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
  <!-- z-[80] per Z-Index Scale in CLAUDE.md — highest layer, debug must be visible above all UI -->
  <div class="fixed bottom-4 right-4 z-[80] font-mono">
    <!-- Collapsed pill -->
    <button
      v-if="!expanded"
      class="bg-neutral text-neutral-content text-xs px-3 py-1.5 rounded-full border-none cursor-pointer shadow-lg flex items-center gap-1.5"
      @click="toggle"
    >
      <span>dbg</span>
      <span class="text-neutral-content/50">{{ entryCount }}</span>
      <span
        v-if="errorCount > 0"
        class="bg-error text-error-content text-[10px] px-1.5 rounded-full leading-4"
      >
        {{ errorCount }}
      </span>
      <span
        v-if="warnCount > 0"
        class="bg-warning text-warning-content text-[10px] px-1.5 rounded-full leading-4"
      >
        {{ warnCount }}
      </span>
    </button>

    <!-- Expanded panel -->
    <div
      v-else
      class="bg-neutral text-neutral-content rounded-xl shadow-2xl w-[calc(100vw-2rem)] max-w-[360px] max-h-[70vh] flex flex-col overflow-hidden"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-3 py-2 border-b border-neutral-content/10">
        <div class="flex gap-1">
          <button
            v-for="tab in (['log', 'env', 'pwa'] as const)"
            :key="tab"
            class="text-xs px-2 py-1 rounded border-none cursor-pointer transition-colors"
            :class="activeTab === tab ? 'bg-neutral-content/20 text-neutral-content' : 'bg-transparent text-neutral-content/50'"
            @click="activeTab = tab"
          >
            {{ tab === 'log' ? 'Log' : tab === 'env' ? 'Env' : 'PWA' }}
          </button>
        </div>
        <div class="flex gap-1">
          <button
            class="text-xs px-2 py-1 rounded border-none cursor-pointer bg-transparent text-neutral-content/50"
            @click="copyReport"
          >
            {{ copyFeedback ? 'Copied!' : 'Copy' }}
          </button>
          <button
            class="text-xs px-2 py-1 rounded border-none cursor-pointer bg-transparent text-neutral-content/50"
            @click="handleClear"
          >
            Clear
          </button>
          <button
            class="text-xs px-2 py-1 rounded border-none cursor-pointer bg-transparent text-neutral-content/50"
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
        class="flex-1 overflow-y-auto p-2 text-[11px] leading-relaxed min-h-[200px] max-h-[50vh]"
      >
        <div v-if="entries.length === 0" class="text-neutral-content/40 text-center py-8">
          No entries yet
        </div>
        <div
          v-for="entry in entries"
          :key="entry.id"
          class="px-1 py-0.5 flex gap-1.5 items-start rounded"
        >
          <span class="text-neutral-content/40 shrink-0">{{ formatTime(entry.timestamp) }}</span>
          <span class="shrink-0" :style="{ color: sourceColors[entry.source] ?? '' }">[{{ entry.source }}]</span>
          <span :style="{ color: severityColors[entry.severity] ?? '' }" class="break-all">
            {{ entry.event }}
            <span v-if="entry.details" class="text-neutral-content/40">
              {{ JSON.stringify(entry.details) }}
            </span>
          </span>
        </div>
      </div>

      <!-- Environment tab -->
      <div
        v-else-if="activeTab === 'env'"
        class="flex-1 overflow-y-auto p-3 text-xs min-h-[200px] max-h-[50vh]"
      >
        <div
          v-for="item in envData"
          :key="item.label"
          class="flex justify-between py-1.5 border-b border-neutral-content/10"
        >
          <span class="text-neutral-content/50 shrink-0">{{ item.label }}</span>
          <span class="text-neutral-content/80 text-right min-w-0 truncate ml-2">{{ item.value }}</span>
        </div>
      </div>

      <!-- PWA Diagnostics tab -->
      <div
        v-else
        class="flex-1 overflow-y-auto p-3 text-xs min-h-[200px] max-h-[50vh]"
      >
        <div v-if="diagnostics.length === 0" class="text-neutral-content/40 text-center py-8">
          Loading diagnostics...
        </div>
        <div
          v-for="diag in diagnostics"
          :key="diag.label"
          class="flex justify-between items-center py-1.5 border-b border-neutral-content/10"
        >
          <span class="text-neutral-content/50 shrink-0">{{ diag.label }}</span>
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-neutral-content/80 text-[11px] min-w-0 truncate">{{ diag.detail }}</span>
            <span
              class="font-bold text-[10px] min-w-[32px] text-right"
              :style="{ color: statusIndicators[diag.status]?.color ?? '' }"
            >
              {{ statusIndicators[diag.status]?.symbol ?? '?' }}
            </span>
          </div>
        </div>
        <button
          v-if="diagnostics.length > 0"
          class="mt-3 text-[11px] px-2 py-1 rounded border-none cursor-pointer bg-neutral-content/10 text-neutral-content/50 w-full"
          @click="runDiagnostics"
        >
          Re-run diagnostics
        </button>
      </div>
    </div>
  </div>
</template>
