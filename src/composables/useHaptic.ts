/**
 * Haptic feedback composable for mobile PWA.
 *
 * Requirement: Light tactile feedback on key actions (import, create, delete confirmation)
 * Approach: navigator.vibrate() with graceful degradation — no-op on unsupported browsers.
 * Alternatives:
 *   - Always vibrate: Rejected — should be subtle, not annoying
 *   - Third-party haptics library: Rejected — overkill for simple vibrate calls
 */

/**
 * Trigger a short haptic pulse. No-op on unsupported browsers.
 * @param duration - Vibration duration in ms (default 10ms for subtle feedback)
 */
export function hapticFeedback(duration: number = 10): void {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(duration)
    }
  } catch {
    // Silently degrade — haptics are non-critical
  }
}

/** Slightly longer pulse for destructive/important confirmations */
export function hapticConfirm(): void {
  hapticFeedback(20)
}

/** Double pulse for success events */
export function hapticSuccess(): void {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([10, 50, 10])
    }
  } catch {
    // Silently degrade
  }
}
