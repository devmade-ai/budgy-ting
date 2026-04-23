/**
 * Unit tests for useDialogA11y stack semantics.
 *
 * Covers: push/pop ordering, Escape-to-top-only behaviour, body-scroll
 * lock/release symmetry across nested dialogs. Uses happy-dom for document
 * + addEventListener.
 *
 * The composable uses Vue lifecycle hooks (onMounted/onUnmounted), so tests
 * mount minimal components via @vue/runtime-core's h/createApp. We don't pull
 * in @vue/test-utils — keeps this to the existing dep set.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createApp, defineComponent, h, ref } from 'vue'
import { useDialogA11y, isDialogOpen } from './useDialogA11y'

function mountDialog(onClose: () => void = () => {}) {
  const dialogRef = ref<HTMLElement | null>(null)
  const component = defineComponent({
    setup() {
      useDialogA11y(dialogRef, onClose)
      return { dialogRef }
    },
    render() {
      return h(
        'div',
        { ref: 'dialogRef' },
        [
          h('button', { type: 'button' }, 'first'),
          h('button', { type: 'button' }, 'middle'),
          h('button', { type: 'button' }, 'last'),
        ],
      )
    },
  })
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(component)
  app.mount(host)
  return {
    unmount: () => {
      app.unmount()
      host.remove()
    },
  }
}

function dispatchKey(key: string, options: KeyboardEventInit = {}) {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options })
  document.dispatchEvent(ev)
  return ev
}

beforeEach(() => {
  // Reset body inline styles so lock-restore assertions start from a clean slate.
  document.body.style.overflow = ''
  document.body.style.overscrollBehavior = ''
  document.documentElement.style.overflow = ''
})

describe('useDialogA11y', () => {
  describe('stack tracking', () => {
    it('reports no open dialog before any mount', () => {
      expect(isDialogOpen()).toBe(false)
    })

    it('pushes on mount and pops on unmount', () => {
      const { unmount } = mountDialog()
      expect(isDialogOpen()).toBe(true)
      unmount()
      expect(isDialogOpen()).toBe(false)
    })

    it('supports nested mounts (stack grows and shrinks LIFO)', () => {
      const outer = mountDialog()
      expect(isDialogOpen()).toBe(true)
      const inner = mountDialog()
      expect(isDialogOpen()).toBe(true)
      inner.unmount()
      expect(isDialogOpen()).toBe(true) // outer still up
      outer.unmount()
      expect(isDialogOpen()).toBe(false)
    })
  })

  describe('Escape routing', () => {
    it('only the topmost dialog receives Escape', () => {
      let outerClosed = 0
      let innerClosed = 0
      const outer = mountDialog(() => { outerClosed++ })
      const inner = mountDialog(() => { innerClosed++ })

      dispatchKey('Escape')

      expect(innerClosed).toBe(1)
      expect(outerClosed).toBe(0)

      inner.unmount()
      dispatchKey('Escape')
      expect(outerClosed).toBe(1)
      expect(innerClosed).toBe(1) // unchanged

      outer.unmount()
    })

    it('ignores non-Escape keys', () => {
      let closed = 0
      const { unmount } = mountDialog(() => { closed++ })
      dispatchKey('a')
      dispatchKey('Enter')
      expect(closed).toBe(0)
      unmount()
    })
  })

  describe('body scroll lock', () => {
    it('locks on first push, unlocks on last pop', () => {
      const outer = mountDialog()
      expect(document.body.style.overflow).toBe('hidden')
      expect(document.body.style.overscrollBehavior).toBe('contain')
      expect(document.documentElement.style.overflow).toBe('hidden')

      const inner = mountDialog()
      // Nested push should not re-apply (still locked from outer)
      expect(document.body.style.overflow).toBe('hidden')

      inner.unmount()
      // Still locked — outer is the last lock holder
      expect(document.body.style.overflow).toBe('hidden')

      outer.unmount()
      // Both popped — should restore
      expect(document.body.style.overflow).toBe('')
      expect(document.body.style.overscrollBehavior).toBe('')
      expect(document.documentElement.style.overflow).toBe('')
    })

    it('restores pre-existing inline styles, not hard-resets', () => {
      document.body.style.overflow = 'auto'
      document.body.style.overscrollBehavior = 'auto'
      document.documentElement.style.overflow = 'scroll'

      const { unmount } = mountDialog()
      expect(document.body.style.overflow).toBe('hidden')

      unmount()
      expect(document.body.style.overflow).toBe('auto')
      expect(document.body.style.overscrollBehavior).toBe('auto')
      expect(document.documentElement.style.overflow).toBe('scroll')
    })
  })
})
