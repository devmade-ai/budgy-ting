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

// Drain any pre-framework errors captured by the inline pill in index.html
// into the real debug log system so they appear in the Vue debug pill.
const win = window as unknown as Record<string, unknown>
const preErrors = win.__debugPreErrors as Array<{ time: string; message: string }> | undefined
if (preErrors && preErrors.length > 0) {
  for (const err of preErrors) {
    debugLog('boot', 'error', `Pre-framework: ${err.message}`)
  }
}
// Clean up the global
delete win.__debugPushError
delete win.__debugPreErrors
