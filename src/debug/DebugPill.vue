<script setup lang="ts">
/**
 * Floating debug diagnostic panel — alpha-phase only, intended to be removed.
 *
 * Requirement: Non-technical users can't open devtools. This surfaces runtime
 *   diagnostics in a floating pill that survives app crashes (mounted in a
 *   separate Vue root).
 * Approach: Collapsed pill shows entry count + error/warning badges. Expanded
 *   state has Log, Environment, and PWA Diagnostics tabs with Copy/Clear actions.
 *   Uses inline styles instead of Tailwind — survives stylesheet load failures
 *   since the pill runs in an isolated root where app CSS may not be loaded.
 * Alternatives:
 *   - Console-only: Rejected — inaccessible to target users
 *   - External error service (Sentry): Rejected — local-first principle
 *   - Tailwind classes: Rejected — pill must render if CSS fails to load
 * Reference: glow-props docs/implementations/DEBUG_SYSTEM.md
 */

import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
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

// ── Color mappings (inline style values) ──

const sourceColors: Record<string, string> = {
  boot: '#9333ea',
  db: '#2563eb',
  pwa: '#0d9488',
  import: '#d97706',
  engine: '#4f46e5',
  ml: '#ea580c',
  global: '#6b7280',
}

const severityColors: Record<string, string> = {
  info: '#6b7280',
  success: '#16a34a',
  warn: '#ca8a04',
  error: '#dc2626',
}

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

const statusIndicators: Record<string, { symbol: string; color: string }> = {
  pass: { symbol: 'OK', color: '#16a34a' },
  fail: { symbol: 'FAIL', color: '#dc2626' },
  warn: { symbol: 'WARN', color: '#ca8a04' },
  running: { symbol: '...', color: '#6b7280' },
}

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
  const hasPrompt = !!(window as any).__pwaInstallPromptEvent
  results.push({ label: 'Install Prompt', status: hasPrompt ? 'pass' : 'warn', detail: hasPrompt ? 'Captured' : 'Not received' })

  // Show sync results + placeholders for async
  results.push({ label: 'SW State', status: 'running', detail: 'Checking...' })
  results.push({ label: 'Manifest', status: 'running', detail: 'Checking...' })
  diagnostics.value = [...results]

  // Helper: update result by label (avoids fragile hardcoded indices)
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

  // Method 1: ClipboardItem Blob — works in contexts where writeText is blocked
  try {
    const blob = new Blob([report], { type: 'text/plain' })
    await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })])
  } catch {
    // Method 2: writeText
    try {
      await navigator.clipboard.writeText(report)
    } catch {
      // Method 3: Textarea fallback for mobile PWA webviews
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

// ── Inline style helpers ──
// All styles are inline — no Tailwind dependency. The pill renders in an isolated
// Vue root where app CSS may not be loaded (e.g. stylesheet load failure).

function tabBtnStyle(tab: string): Record<string, string> {
  const active = activeTab.value === tab
  return {
    fontSize: '12px',
    padding: '4px 8px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.15s',
    background: active ? '#374151' : 'transparent',
    color: active ? '#fff' : '#9ca3af',
  }
}
</script>

<template>
  <!-- z-80 per Z-Index Scale in CLAUDE.md — highest layer, debug must be visible above all UI -->
  <div :style="{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 80, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }">
    <!-- Collapsed pill -->
    <button
      v-if="!expanded"
      :style="{
        background: '#111827',
        color: '#fff',
        fontSize: '12px',
        padding: '6px 12px',
        borderRadius: '9999px',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,.3), 0 4px 6px -4px rgba(0,0,0,.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }"
      @click="toggle"
    >
      <span>dbg</span>
      <span :style="{ color: '#9ca3af' }">{{ entryCount }}</span>
      <span
        v-if="errorCount > 0"
        :style="{
          background: '#ef4444',
          color: '#fff',
          fontSize: '10px',
          padding: '0 6px',
          borderRadius: '9999px',
          lineHeight: '16px',
        }"
      >
        {{ errorCount }}
      </span>
      <span
        v-if="warnCount > 0"
        :style="{
          background: '#eab308',
          color: '#fff',
          fontSize: '10px',
          padding: '0 6px',
          borderRadius: '9999px',
          lineHeight: '16px',
        }"
      >
        {{ warnCount }}
      </span>
    </button>

    <!-- Expanded panel -->
    <div
      v-else
      :style="{
        background: '#111827',
        color: '#fff',
        borderRadius: '12px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,.5)',
        width: '360px',
        maxHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }"
    >
      <!-- Header -->
      <div :style="{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #374151' }">
        <div :style="{ display: 'flex', gap: '4px' }">
          <button :style="tabBtnStyle('log')" @click="activeTab = 'log'">Log</button>
          <button :style="tabBtnStyle('env')" @click="activeTab = 'env'">Env</button>
          <button :style="tabBtnStyle('pwa')" @click="activeTab = 'pwa'">PWA</button>
        </div>
        <div :style="{ display: 'flex', gap: '4px' }">
          <button
            :style="{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: 'transparent', color: '#9ca3af' }"
            @click="copyReport"
          >
            {{ copyFeedback ? 'Copied!' : 'Copy' }}
          </button>
          <button
            :style="{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: 'transparent', color: '#9ca3af' }"
            @click="handleClear"
          >
            Clear
          </button>
          <button
            :style="{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: 'transparent', color: '#9ca3af' }"
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
        :style="{ flex: '1', overflowY: 'auto', padding: '8px', fontSize: '11px', lineHeight: '1.6', minHeight: '200px', maxHeight: '50vh' }"
      >
        <div v-if="entries.length === 0" :style="{ color: '#6b7280', textAlign: 'center', padding: '32px 0' }">
          No entries yet
        </div>
        <div
          v-for="entry in entries"
          :key="entry.id"
          :style="{ padding: '2px 4px', display: 'flex', gap: '6px', alignItems: 'flex-start', borderRadius: '4px' }"
        >
          <span :style="{ color: '#6b7280', flexShrink: '0' }">{{ formatTime(entry.timestamp) }}</span>
          <span :style="{ color: sourceColors[entry.source] ?? '#6b7280', flexShrink: '0' }">[{{ entry.source }}]</span>
          <span :style="{ color: severityColors[entry.severity] ?? '#6b7280', wordBreak: 'break-all' }">
            {{ entry.event }}
            <span v-if="entry.details" :style="{ color: '#6b7280' }">
              {{ JSON.stringify(entry.details) }}
            </span>
          </span>
        </div>
      </div>

      <!-- Environment tab -->
      <div
        v-else-if="activeTab === 'env'"
        :style="{ flex: '1', overflowY: 'auto', padding: '12px', fontSize: '12px', minHeight: '200px', maxHeight: '50vh' }"
      >
        <div
          v-for="item in envData"
          :key="item.label"
          :style="{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #1f2937' }"
        >
          <span :style="{ color: '#9ca3af' }">{{ item.label }}</span>
          <span :style="{ color: '#e5e7eb', textAlign: 'right', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: '8px' }">{{ item.value }}</span>
        </div>
      </div>

      <!-- PWA Diagnostics tab -->
      <div
        v-else
        :style="{ flex: '1', overflowY: 'auto', padding: '12px', fontSize: '12px', minHeight: '200px', maxHeight: '50vh' }"
      >
        <div v-if="diagnostics.length === 0" :style="{ color: '#6b7280', textAlign: 'center', padding: '32px 0' }">
          Loading diagnostics...
        </div>
        <div
          v-for="diag in diagnostics"
          :key="diag.label"
          :style="{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1f2937' }"
        >
          <span :style="{ color: '#9ca3af' }">{{ diag.label }}</span>
          <div :style="{ display: 'flex', alignItems: 'center', gap: '8px' }">
            <span :style="{ color: '#e5e7eb', fontSize: '11px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }">{{ diag.detail }}</span>
            <span :style="{ color: statusIndicators[diag.status]?.color ?? '#6b7280', fontWeight: 'bold', fontSize: '10px', minWidth: '32px', textAlign: 'right' }">
              {{ statusIndicators[diag.status]?.symbol ?? '?' }}
            </span>
          </div>
        </div>
        <button
          v-if="diagnostics.length > 0"
          :style="{ marginTop: '12px', fontSize: '11px', padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: '#374151', color: '#9ca3af', width: '100%' }"
          @click="runDiagnostics"
        >
          Re-run diagnostics
        </button>
      </div>
    </div>
  </div>
</template>
