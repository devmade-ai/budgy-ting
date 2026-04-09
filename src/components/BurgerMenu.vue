<script setup lang="ts">
/**
 * Requirement: Global nav menu accessible from header
 * Approach: Disclosure-pattern dropdown with backdrop. Extracted from AppLayout
 *   for separation of concerns.
 * Why disclosure, not role="menu": ARIA menu pattern is for application menus
 *   (File/Edit/View). Screen readers enter forms mode, suppress normal nav
 *   keys, and expect arrow-key navigation. A burger nav is a disclosure.
 * Alternatives:
 *   - role="menu" pattern: Rejected — wrong ARIA semantics for navigation
 *   - Slide-out drawer: Rejected — needs animation lib, fights with bottom nav
 *   - Headless UI Disclosure: Viable — adds dependency for a single component
 * Reference: glow-props docs/implementations/BURGER_MENU.md
 */

import { ref, watch, onMounted, onUnmounted, nextTick, type Component } from 'vue'
import { Menu } from 'lucide-vue-next'

export interface MenuItem {
  label: string
  action: () => void
  icon?: Component
  /** Icon class override (e.g. for colored icons like Sun/Moon) */
  iconClass?: string
  visible?: boolean
  separator?: boolean
  disabled?: boolean
}

const props = defineProps<{
  items: MenuItem[]
}>()

// Unique ID for aria-controls — counter-based to avoid collisions
// if multiple BurgerMenu instances exist on the same page
let idCounter = 0
const menuId = `nav-menu-${++idCounter}`

const open = ref(false)
const triggerRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)

// hasBeenOpenRef prevents stealing focus on initial mount.
// Without it, the focus-return watch runs when open starts as false,
// moving focus to the trigger from wherever the user currently is.
let hasBeenOpen = false

const visibleItems = () => props.items.filter((item) => item.visible !== false)

function close() {
  open.value = false
}

function toggle() {
  open.value = !open.value
}

// Close menu first, then execute action after DOM settles.
// 50ms accounts for any visual transition — keeps the menu visually
// closed before the action's side effects (modals, route changes) fire.
function handleItem(item: MenuItem) {
  if (item.disabled) return
  close()
  setTimeout(() => item.action(), 50)
}

// Escape key closes menu — only registered while open
// Requirement: Keyboard accessibility for menu close
// Reference: glow-props docs/implementations/BURGER_MENU.md
function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    close()
  }
}

// Arrow key + Home/End navigation within menu items
// Requirement: Keyboard traversal with wrapping for disclosure-pattern menu
// Reference: glow-props docs/implementations/BURGER_MENU.md
function handleMenuKeyDown(e: KeyboardEvent) {
  const items = menuRef.value?.querySelectorAll('button:not([disabled])') as NodeListOf<HTMLElement> | undefined
  if (!items || items.length === 0) return
  const idx = Array.from(items).indexOf(document.activeElement as HTMLElement)

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      items[(idx + 1) % items.length].focus()
      break
    case 'ArrowUp':
      e.preventDefault()
      items[(idx - 1 + items.length) % items.length].focus()
      break
    case 'Home':
      e.preventDefault()
      items[0].focus()
      break
    case 'End':
      e.preventDefault()
      items[items.length - 1].focus()
      break
  }
}

// Outside click — close if click is outside the menu container
function handleOutsideClick(e: MouseEvent) {
  const container = triggerRef.value?.parentElement
  if (open.value && container && !container.contains(e.target as Node)) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
  document.removeEventListener('keydown', handleKeyDown)
})

// Focus management: focus first item on open, return to trigger on close.
// Escape key listener only registered while menu is open.
watch(open, (isOpen) => {
  if (isOpen) {
    hasBeenOpen = true
    document.addEventListener('keydown', handleKeyDown)
    // Focus first visible menu item after DOM updates
    nextTick(() => {
      const firstItem = menuRef.value?.querySelector('button') as HTMLElement | null
      firstItem?.focus()
    })
  } else {
    document.removeEventListener('keydown', handleKeyDown)
    // Return focus to trigger button on close — but only if menu was
    // previously opened (hasBeenOpen guard)
    if (hasBeenOpen) {
      triggerRef.value?.focus()
    }
  }
})
</script>

<template>
  <div class="relative no-print">
    <button
      ref="triggerRef"
      type="button"
      class="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors"
      aria-label="Menu"
      :aria-expanded="open"
      :aria-controls="menuId"
      @click="toggle"
    >
      <Menu :size="18" aria-hidden="true" />
    </button>

    <template v-if="open">
      <!-- Backdrop — cursor-pointer required for iOS Safari.
           iOS Safari does not fire click events on empty divs without it.
           This is an intentional iOS optimization, not a bug.
           Reference: glow-props docs/implementations/BURGER_MENU.md -->
      <div
        class="fixed inset-0 z-40 cursor-pointer"
        @click="close"
      />

      <nav
        :id="menuId"
        ref="menuRef"
        aria-label="Main navigation"
        class="absolute right-0 top-full mt-1 z-50
               w-48 max-w-[calc(100vw-1rem)] rounded-lg shadow-lg
               bg-white dark:bg-[var(--color-surface-elevated)]
               border border-gray-200 dark:border-zinc-700
               py-1 overflow-hidden overscroll-contain"
        @keydown="handleMenuKeyDown"
      >
        <ul class="list-none m-0 p-0">
          <template v-for="(item, i) in visibleItems()" :key="item.label">
            <li v-if="item.separator && i > 0" role="separator">
              <div class="border-t border-gray-100 dark:border-zinc-700 my-1" />
            </li>
            <li>
              <button
                type="button"
                class="w-full text-left px-4 py-2 min-h-[44px] text-sm truncate
                       transition-colors outline-none
                       focus-visible:ring-2 focus-visible:ring-brand-500
                       text-gray-700 dark:text-zinc-200
                       hover:bg-gray-50 dark:hover:bg-[var(--color-surface-hover)]
                       flex items-center gap-2
                       disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="item.disabled"
                @click="handleItem(item)"
              >
                <component
                  v-if="item.icon"
                  :is="item.icon"
                  :size="16"
                  :class="item.iconClass ?? 'text-gray-400 dark:text-zinc-500'"
                  aria-hidden="true"
                />
                {{ item.label }}
              </button>
            </li>
          </template>
        </ul>
      </nav>
    </template>
  </div>
</template>
