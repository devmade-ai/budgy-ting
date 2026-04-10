import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { debugLog } from './debug/debugLog'
import { seedDemoWorkspace } from './db/demoData'
import { pruneStaleTagCache } from './composables/useTagAutocomplete'

import './index.css'

debugLog('boot', 'info', 'Application starting')

// Requirement: Demo workspace must be available before any view queries the DB.
// Approach: Await seedDemoWorkspace() before app.mount() so WorkspaceListView's
//   onMounted query always sees demo data on first visit. Wrapped in async IIFE
//   because top-level await requires ESM module output (not guaranteed by all bundlers).
// Alternatives:
//   - Non-blocking seed with refetch in view: Rejected — adds complexity (reactive flag
//     or event bus), and the view still flashes empty state before refetch completes.
//   - Router navigation guard: Rejected — seed is a one-time DB concern, not a routing
//     concern. Guard would run on every navigation for a check that only matters once.
;(async () => {
  try {
    const created = await seedDemoWorkspace()
    if (created) debugLog('boot', 'info', 'Demo workspace created')
  } catch (err) {
    debugLog('boot', 'error', `Demo seed failed: ${err}`)
  }

  // Prune stale tags on startup — non-blocking (not needed before mount)
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
  // Approach: Static #debug-root in index.html + separate app instance, no router dependency.
  // Skipped in embed/iframe contexts — debug pill is only useful in the main window.
  const { default: DebugPill } = await import('./debug/DebugPill.vue')

  const isEmbed = window.self !== window.top
  if (!isEmbed) {
    const debugRoot = document.getElementById('debug-root')
    if (debugRoot) {
      const debugApp = createApp(DebugPill)
      debugApp.mount(debugRoot)
      debugLog('boot', 'success', 'Debug pill mounted')
    }
  }
})()
