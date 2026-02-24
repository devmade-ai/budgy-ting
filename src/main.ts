import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { debugLog } from './debug/debugLog'

import '@unocss/reset/tailwind.css'
import 'virtual:uno.css'

debugLog('boot', 'info', 'Application starting')

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
