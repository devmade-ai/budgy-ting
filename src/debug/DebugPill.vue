<script setup lang="ts">
/**
 * Floating debug diagnostic panel — alpha-phase only, intended to be removed.
 *
 * Requirement: Non-technical users can't open devtools. This surfaces runtime
 *   diagnostics in a floating pill that survives app crashes (mounted in a
 *   separate Vue root).
 * Approach: Collapsed pill shows entry count + error/warning badges. Expanded
 *   state has Log, Environment, and PWA tabs with Copy/Clear actions.
 *   All styling uses inline styles (no Tailwind) so the pill renders even
 *   if CSS fails to load.
 * Alternatives:
 *   - Console-only: Rejected — inaccessible to target users
 *   - External error service (Sentry): Rejected — local-first principle
 *   - Tailwind classes: Previous approach — pill wouldn't render if CSS fails
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
const activeTab = ref<'log' | 'env' | 'pwa'>('log')
const entries = ref<DebugEntry[]>([])
const logContainer = ref<HTMLElement | null>(null)
const copyFeedback = ref(false)

// PWA diagnostics data — refreshed when PWA tab is active
const pwaDiagnostics = ref<Array<{ label: string; value: string; ok: boolean }>>([])

// Subscribe to new entries
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

// Refresh PWA diagnostics when tab is activated
watch(activeTab, (tab) => {
  if (tab === 'pwa') refreshPwaDiagnostics()
})

// ── Counts ──

const entryCount = computed(() => entries.value.length)
const errorCount = computed(() => entries.value.filter((e) => e.severity === 'error').length)
const warnCount = computed(() => entries.value.filter((e) => e.severity === 'warn').length)

// ── Styling helpers (inline style objects — no Tailwind dependency) ──

const sourceColors: Record<DebugSource, string> = {
  boot: '#9333ea',
  db: '#2563eb',
  pwa: '#0d9488',
  import: '#d97706',
  engine: '#4f46e5',
  ml: '#ea580c',
  global: '#6b7280',
}

const severityColors: Record<DebugSeverity, string> = {
  info: '#6b7280',
  success: '#16a34a',
  warn: '#ca8a04',
  error: '#dc2626',
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

// ── PWA Diagnostics ──
// Requirement: Active health checks for PWA readiness
// Approach: Check HTTPS, SW state, manifest, standalone mode, install prompt.
//   Refreshed each time the PWA tab is opened (not polling).

async function refreshPwaDiagnostics() {
  const checks: Array<{ label: string; value: string; ok: boolean }> = []

  // HTTPS check
  const isSecure = location.protocol === 'https:' || location.hostname === 'localhost'
  checks.push({ label: 'HTTPS', value: isSecure ? 'Yes' : 'No (required for SW)', ok: isSecure })

  // Service Worker support
  const swSupported = 'serviceWorker' in navigator
  checks.push({ label: 'SW Support', value: swSupported ? 'Yes' : 'No', ok: swSupported })

  // Service Worker state
  if (swSupported) {
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        const sw = reg.active || reg.waiting || reg.installing
        const state = sw?.state ?? 'none'
        checks.push({ label: 'SW State', value: state, ok: state === 'activated' })

        if (reg.waiting) {
          checks.push({ label: 'SW Waiting', value: 'Yes (update pending)', ok: false })
        }
      } else {
        checks.push({ label: 'SW State', value: 'Not registered', ok: false })
      }
    } catch {
      checks.push({ label: 'SW State', value: 'Error checking', ok: false })
    }
  }

  // Manifest check (look for <link rel="manifest">)
  const manifestLink = document.querySelector('link[rel="manifest"]')
  checks.push({ label: 'Manifest', value: manifestLink ? 'Present' : 'Missing', ok: !!manifestLink })

  // Standalone mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  checks.push({ label: 'Standalone', value: isStandalone ? 'Yes' : 'No (browser)', ok: isStandalone })

  // Install prompt captured
  const hasPrompt = !!(window as unknown as Record<string, unknown>).__pwaInstallPromptEvent
  checks.push({ label: 'Install Prompt', value: hasPrompt ? 'Captured' : 'Not available', ok: hasPrompt })

  // Online status
  checks.push({ label: 'Online', value: navigator.onLine ? 'Yes' : 'Offline', ok: navigator.onLine })

  pwaDiagnostics.value = checks
}

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
  <!-- z-index 80 per Z-Index Scale in CLAUDE.md — highest layer, debug must be visible above all UI.
       All styling is inline (no Tailwind) so the pill renders even if CSS fails to load. -->
  <div style="position:fixed;bottom:16px;right:16px;z-index:80;font-family:ui-monospace,SFMono-Regular,monospace">
    <!-- Collapsed pill -->
    <button
      v-if="!expanded"
      style="background:#111827;color:#fff;font-size:12px;padding:6px 12px;border-radius:9999px;border:none;cursor:pointer;display:flex;align-items:center;gap:6px;box-shadow:0 4px 6px rgba(0,0,0,0.3)"
      @click="toggle"
    >
      <span>dbg</span>
      <span style="color:#9ca3af">{{ entryCount }}</span>
      <span v-if="errorCount > 0" style="background:#ef4444;color:#fff;font-size:10px;padding:0 6px;border-radius:9999px">
        {{ errorCount }}
      </span>
      <span v-if="warnCount > 0" style="background:#eab308;color:#fff;font-size:10px;padding:0 6px;border-radius:9999px">
        {{ warnCount }}
      </span>
    </button>

    <!-- Expanded panel -->
    <div
      v-else
      style="background:#111827;color:#fff;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.4);width:360px;max-height:70vh;display:flex;flex-direction:column;overflow:hidden"
    >
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #374151">
        <div style="display:flex;gap:4px">
          <button
            v-for="tab in (['log', 'env', 'pwa'] as const)"
            :key="tab"
            style="font-size:12px;padding:4px 8px;border-radius:4px;border:none;cursor:pointer;transition:background 0.15s"
            :style="{
              background: activeTab === tab ? '#374151' : 'transparent',
              color: activeTab === tab ? '#fff' : '#9ca3af',
            }"
            @click="activeTab = tab"
          >
            {{ tab === 'log' ? 'Log' : tab === 'env' ? 'Environment' : 'PWA' }}
          </button>
        </div>
        <div style="display:flex;gap:4px">
          <button
            style="font-size:12px;padding:4px 8px;border-radius:4px;border:none;cursor:pointer;color:#9ca3af;background:transparent"
            @click="copyReport"
          >
            {{ copyFeedback ? 'Copied!' : 'Copy' }}
          </button>
          <button
            style="font-size:12px;padding:4px 8px;border-radius:4px;border:none;cursor:pointer;color:#9ca3af;background:transparent"
            @click="handleClear"
          >
            Clear
          </button>
          <button
            style="font-size:12px;padding:4px 8px;border-radius:4px;border:none;cursor:pointer;color:#9ca3af;background:transparent"
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
        style="flex:1;overflow-y:auto;padding:8px;font-size:11px;line-height:1.6;min-height:200px;max-height:50vh"
      >
        <div v-if="entries.length === 0" style="color:#6b7280;text-align:center;padding:32px 0">
          No entries yet
        </div>
        <div
          v-for="entry in entries"
          :key="entry.id"
          style="padding:2px 4px;display:flex;gap:6px;align-items:flex-start;border-radius:4px"
        >
          <span style="color:#6b7280;flex-shrink:0">{{ formatTime(entry.timestamp) }}</span>
          <span :style="{ color: sourceColors[entry.source], flexShrink: 0 }">[{{ entry.source }}]</span>
          <span :style="{ color: severityColors[entry.severity], wordBreak: 'break-all' }">
            {{ entry.event }}
            <span v-if="entry.details" style="color:#6b7280">
              {{ JSON.stringify(entry.details) }}
            </span>
          </span>
        </div>
      </div>

      <!-- Environment tab -->
      <div
        v-else-if="activeTab === 'env'"
        style="flex:1;overflow-y:auto;padding:12px;font-size:12px;min-height:200px;max-height:50vh"
      >
        <div
          v-for="item in envData"
          :key="item.label"
          style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1f2937"
        >
          <span style="color:#9ca3af">{{ item.label }}</span>
          <span style="color:#e5e7eb;text-align:right;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-left:8px">{{ item.value }}</span>
        </div>
      </div>

      <!-- PWA tab -->
      <div
        v-else
        style="flex:1;overflow-y:auto;padding:12px;font-size:12px;min-height:200px;max-height:50vh"
      >
        <div v-if="pwaDiagnostics.length === 0" style="color:#6b7280;text-align:center;padding:32px 0">
          Loading diagnostics...
        </div>
        <div
          v-for="check in pwaDiagnostics"
          :key="check.label"
          style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #1f2937"
        >
          <span style="color:#9ca3af">{{ check.label }}</span>
          <span :style="{ color: check.ok ? '#22c55e' : '#f87171' }">{{ check.value }}</span>
        </div>
        <button
          style="margin-top:12px;width:100%;padding:6px;font-size:11px;border-radius:4px;border:1px solid #374151;background:transparent;color:#9ca3af;cursor:pointer"
          @click="refreshPwaDiagnostics"
        >
          Refresh
        </button>
      </div>
    </div>
  </div>
</template>
