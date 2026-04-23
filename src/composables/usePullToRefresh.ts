/**
 * Pull-to-refresh composable for mobile PWA.
 *
 * Requirement: Common mobile pattern for refreshing workspace list or transaction data
 * Approach: Track touch events on the document, trigger callback when user pulls down
 *   past a threshold at scroll position 0. Shows visual indicator during pull.
 * Alternatives:
 *   - Third-party library: Rejected — simple enough to implement, avoids dependency
 *   - Browser built-in: Not available cross-browser for PWAs
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { isDialogOpen } from '@/composables/useDialogA11y'

const THRESHOLD = 80

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const pulling = ref(false)
  const pullDistance = ref(0)
  const refreshing = ref(false)
  /** 0-1 progress toward the release threshold */
  const pullProgress = computed(() => Math.min(1, pullDistance.value / THRESHOLD))
  /** True when user has pulled past the threshold and can release */
  const canRelease = computed(() => pullDistance.value >= THRESHOLD)

  let startY = 0
  let isPulling = false

  function handleTouchStart(e: TouchEvent) {
    // Suppress pull-to-refresh while any overlay is open — otherwise a downward
    // drag inside a modal/sheet triggers a page refresh instead of scrolling
    // the sheet contents or being absorbed by the modal backdrop.
    if (isDialogOpen()) return
    if (window.scrollY === 0) {
      startY = e.touches[0]!.clientY
      isPulling = true
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isPulling) return
    const currentY = e.touches[0]!.clientY
    const diff = currentY - startY
    if (diff > 0 && window.scrollY === 0) {
      pullDistance.value = Math.min(diff * 0.5, THRESHOLD * 1.5)
      pulling.value = pullDistance.value > 10
    } else {
      isPulling = false
      pulling.value = false
      pullDistance.value = 0
    }
  }

  async function handleTouchEnd() {
    if (!isPulling) return
    isPulling = false

    if (pullDistance.value >= THRESHOLD) {
      refreshing.value = true
      try {
        await onRefresh()
      } finally {
        refreshing.value = false
      }
    }

    pulling.value = false
    pullDistance.value = 0
  }

  onMounted(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
  })

  onUnmounted(() => {
    document.removeEventListener('touchstart', handleTouchStart)
    document.removeEventListener('touchmove', handleTouchMove)
    document.removeEventListener('touchend', handleTouchEnd)
  })

  return { pulling, pullDistance, pullProgress, canRelease, refreshing }
}
