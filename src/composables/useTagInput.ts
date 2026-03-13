/**
 * Reusable tag input composable with autocomplete from tagCache + known tags.
 *
 * Requirement: Tag input with keyboard navigation and autocomplete appears in
 *   TransactionEditModal and ImportStepReview with identical logic.
 * Approach: Extract shared state and handlers into composable.
 *   Caller provides the tags ref and a source of known tags.
 * Alternatives:
 *   - Duplicate in each component: Rejected — ~70 lines of identical logic
 *   - Shared component instead of composable: Rejected — template markup differs
 *     between modal (always visible input) and review (toggle-to-show input)
 */

import { ref, watch, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import { db } from '@/db'
import { debugLog } from '@/debug/debugLog'

interface UseTagInputOptions {
  /** The tags array to add/remove from */
  tags: Ref<string[]>
  /** Additional known tags to merge with tagCache for autocomplete */
  knownTags?: Ref<string[]> | (() => string[])
}

export function useTagInput(options: UseTagInputOptions) {
  const tagInput = ref('')
  const autocompleteResults = ref<string[]>([])
  const showAutocomplete = ref(false)
  const selectedIndex = ref(-1)

  let blurTimer: ReturnType<typeof setTimeout> | undefined
  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  onUnmounted(() => {
    clearTimeout(blurTimer)
    clearTimeout(debounceTimer)
  })

  function getKnownTags(): string[] {
    if (!options.knownTags) return []
    if (typeof options.knownTags === 'function') return options.knownTags()
    return options.knownTags.value
  }

  function addTag(tag: string) {
    const trimmed = tag.trim()
    if (!trimmed || options.tags.value.includes(trimmed)) return
    options.tags.value.push(trimmed)
    tagInput.value = ''
    showAutocomplete.value = false
  }

  function removeTag(tag: string) {
    options.tags.value = options.tags.value.filter((t) => t !== tag)
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const selected = autocompleteResults.value[selectedIndex.value]
      if (selectedIndex.value >= 0 && selected) {
        addTag(selected)
      } else if (tagInput.value.trim()) {
        addTag(tagInput.value)
      }
      selectedIndex.value = -1
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (selectedIndex.value < autocompleteResults.value.length - 1) {
        selectedIndex.value++
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (selectedIndex.value > 0) {
        selectedIndex.value--
      }
    } else if (e.key === 'Escape') {
      showAutocomplete.value = false
      selectedIndex.value = -1
    }
  }

  function handleBlur() {
    clearTimeout(blurTimer)
    blurTimer = setTimeout(() => { showAutocomplete.value = false }, 150)
  }

  // Requirement: Autocomplete should always show results when the user has tags
  // Approach: Merge tagCache + knownTags so autocomplete works even when tagCache is empty
  async function updateAutocomplete() {
    const q = tagInput.value.trim().toLowerCase()
    if (!q) {
      autocompleteResults.value = []
      showAutocomplete.value = false
      return
    }

    try {
      const tagSet = new Set<string>()
      const allCached = await db.tagCache.toArray()
      for (const t of allCached) tagSet.add(t.tag)
      for (const t of getKnownTags()) tagSet.add(t)

      const matches = [...tagSet].filter((tag) => !options.tags.value.includes(tag))
      const prefix = matches.filter((t) => t.toLowerCase().startsWith(q))
      const substring = matches.filter(
        (t) => !t.toLowerCase().startsWith(q) && t.toLowerCase().includes(q),
      )

      autocompleteResults.value = [...prefix, ...substring].slice(0, 8)
      showAutocomplete.value = autocompleteResults.value.length > 0
      selectedIndex.value = -1
    } catch (e) {
      debugLog('global', 'warn', 'Tag autocomplete query failed', { error: String(e) })
      autocompleteResults.value = []
      showAutocomplete.value = false
    }
  }

  watch(tagInput, () => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(updateAutocomplete, 100)
  })

  return {
    tagInput,
    autocompleteResults,
    showAutocomplete,
    selectedIndex,
    addTag,
    removeTag,
    handleKeydown,
    handleBlur,
    updateAutocomplete,
  }
}
