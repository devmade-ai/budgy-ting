/**
 * PWA composable for install prompt and service worker updates.
 *
 * Requirement: Custom install banner, service worker update prompt
 * Approach: Listen for beforeinstallprompt and SW update events
 */

import { ref, onMounted } from 'vue'

const installPromptEvent = ref<Event | null>(null)
const canInstall = ref(false)
const updateAvailable = ref(false)

let registration: ServiceWorkerRegistration | null = null

export function usePWA() {
  onMounted(() => {
    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      installPromptEvent.value = e
      canInstall.value = true
    })

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      canInstall.value = false
      installPromptEvent.value = null
    })

    // Check for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        registration = reg
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                updateAvailable.value = true
              }
            })
          }
        })
      })
    }
  })

  async function install() {
    if (!installPromptEvent.value) return
    const event = installPromptEvent.value as Event & { prompt: () => Promise<void> }
    await event.prompt()
    canInstall.value = false
    installPromptEvent.value = null
  }

  function applyUpdate() {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    }
    window.location.reload()
  }

  return {
    canInstall,
    install,
    updateAvailable,
    applyUpdate,
  }
}
