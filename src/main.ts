import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { debugLog } from './debug/debugLog'
import { seedDemoWorkspace } from './db/demoData'
import { pruneStaleTagCache } from './composables/useTagAutocomplete'

import './index.css'

debugLog('boot', 'info', 'Application starting')

// Seed demo workspace on first visit (empty DB) — non-blocking
seedDemoWorkspace().then((created) => {
  if (created) debugLog('boot', 'info', 'Demo workspace created')
})

// Prune stale tags on startup — non-blocking
pruneStaleTagCache().then((count) => {
  if (count > 0) debugLog('boot', 'info', `Pruned ${count} stale tag(s) from cache`)
})

const app = createApp(App)
app.use(router)
app.mount('#app')

debugLog('boot', 'success', 'Main app mounted')

// Bridge pre-mount errors captured by the inline pill script in index.html.
// These were collected before any module scripts loaded.
const preErrors = (window as any).__debugErrors as Array<{ msg: string; stack: string; time: number }> | undefined
if (preErrors && preErrors.length > 0) {
  for (const err of preErrors) {
    debugLog('boot', 'error', `[pre-mount] ${err.msg}`, err.stack ? { stack: err.stack } : undefined)
  }
}

// Clear loading timeout — Vue mounted successfully, inline pill no longer needed.
if (typeof (window as any).__debugClearLoadTimer === 'function') {
  ;(window as any).__debugClearLoadTimer()
}

// Mount debug pill in a separate Vue root so it survives main app crashes.
// Requirement: Diagnostics must remain visible even if the main app errors.
// Approach: Separate root element + app instance, no router dependency.
import DebugPill from './debug/DebugPill.vue'

const debugRoot = document.createElement('div')
debugRoot.id = 'debug-root'
document.body.appendChild(debugRoot)

const debugApp = createApp(DebugPill)
debugApp.mount(debugRoot)

debugLog('boot', 'success', 'Debug pill mounted')
