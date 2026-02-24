/**
 * Service worker update management.
 *
 * Requirement: Users control when updates apply; periodic background checks
 * Approach: Wrap vite-plugin-pwa's useRegisterSW with registerType 'prompt'.
 *   Checks for new SW versions every 60 minutes. Exposes hasUpdate + updateApp
 *   to the UI. Offline-ready notification auto-dismisses after 3 seconds.
 * Alternatives:
 *   - Auto-update (registerType 'autoUpdate'): Rejected — users should control
 *     when the app reloads, especially mid-workflow
 *   - Manual SW registration: Rejected — vite-plugin-pwa handles caching strategy
 */

import { ref, watch } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { debugLog } from '@/debug/debugLog'

const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 60 minutes
const OFFLINE_DISMISS_MS = 3000

const offlineReady = ref(false)

const {
  needRefresh: hasUpdate,
  updateServiceWorker,
} = useRegisterSW({
  immediate: true,
  onRegisteredSW(swUrl, registration) {
    debugLog('pwa', 'info', 'Service worker registered', { swUrl })

    // Periodic update checks
    if (registration) {
      setInterval(() => {
        debugLog('pwa', 'info', 'Periodic SW update check')
        registration.update()
      }, CHECK_INTERVAL_MS)
    }
  },
  onRegisterError(error) {
    debugLog('pwa', 'error', 'Service worker registration failed', { error: String(error) })
  },
  onOfflineReady() {
    debugLog('pwa', 'success', 'App ready for offline use')
    offlineReady.value = true
    setTimeout(() => {
      offlineReady.value = false
    }, OFFLINE_DISMISS_MS)
  },
})

// Log when update becomes available
watch(hasUpdate, (ready) => {
  if (ready) {
    debugLog('pwa', 'info', 'New service worker available — update ready')
  }
})

function updateApp() {
  debugLog('pwa', 'info', 'User triggered SW update')
  updateServiceWorker(true)
}

export function usePWAUpdate() {
  return {
    hasUpdate,
    offlineReady,
    updateApp,
  }
}
