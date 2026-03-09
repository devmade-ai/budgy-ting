<script setup lang="ts">
/**
 * Requirement: Inline tag editor for transactions in the dashboard table
 * Approach: Renders below an expanded row — shows current tags as removable chips,
 *   ML suggestions via TagSuggestions, and a text input for manual tag entry.
 *   Autocomplete from tagCache via useTagAutocomplete pattern.
 * Alternatives:
 *   - Modal dialog: Rejected — too heavy for quick tag edits
 *   - Full transaction edit form: Rejected — only tags need editing right now
 */

import { ref, computed, watch, onMounted } from 'vue'
import { db } from '@/db'
import TagSuggestions from '@/components/TagSuggestions.vue'
import type { TagSuggestion } from '@/ml/types'
import type { Transaction } from '@/types/models'

const props = defineProps<{
  transaction: Transaction
  suggestions: TagSuggestion[]
  suggestionsLoading: boolean
}>()

const emit = defineEmits<{
  'update:tags': [tags: string[]]
  done: []
}>()

const tagInput = ref('')
const autocompleteResults = ref<string[]>([])
const showAutocomplete = ref(false)
const selectedIndex = ref(-1)

// Local copy of tags for immediate UI feedback
const localTags = ref<string[]>([...props.transaction.tags])

// Dismissed ML suggestions (don't re-show after dismiss)
const dismissed = ref(new Set<string>())

// Filter out suggestions for tags already applied or dismissed
const filteredSuggestions = computed(() =>
  props.suggestions.filter(
    (s) => !localTags.value.includes(s.tag) && !dismissed.value.has(s.tag),
  ),
)

// Sync when parent transaction changes
watch(
  () => props.transaction.tags,
  (newTags) => {
    localTags.value = [...newTags]
  },
)

function addTag(tag: string) {
  const trimmed = tag.trim()
  if (!trimmed || localTags.value.includes(trimmed)) return
  localTags.value.push(trimmed)
  emit('update:tags', [...localTags.value])
  tagInput.value = ''
  showAutocomplete.value = false
}

function removeTag(tag: string) {
  localTags.value = localTags.value.filter((t) => t !== tag)
  emit('update:tags', [...localTags.value])
}

function acceptSuggestion(tag: string) {
  addTag(tag)
}

function dismissSuggestion(tag: string) {
  dismissed.value = new Set([...dismissed.value, tag])
}

function acceptAllSuggestions() {
  for (const s of filteredSuggestions.value) {
    if (!localTags.value.includes(s.tag)) {
      localTags.value.push(s.tag)
    }
  }
  emit('update:tags', [...localTags.value])
}

function handleInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    if (selectedIndex.value >= 0 && autocompleteResults.value[selectedIndex.value]) {
      addTag(autocompleteResults.value[selectedIndex.value])
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

// Autocomplete from tagCache — prefix match then substring match
async function updateAutocomplete() {
  const q = tagInput.value.trim().toLowerCase()
  if (!q) {
    autocompleteResults.value = []
    showAutocomplete.value = false
    return
  }

  try {
    const allCached = await db.tagCache.toArray()
    const matches = allCached
      .map((t) => t.tag)
      .filter((tag) => !localTags.value.includes(tag))

    // Prefix matches first, then substring
    const prefix = matches.filter((t) => t.toLowerCase().startsWith(q))
    const substring = matches.filter(
      (t) => !t.toLowerCase().startsWith(q) && t.toLowerCase().includes(q),
    )

    autocompleteResults.value = [...prefix, ...substring].slice(0, 8)
    showAutocomplete.value = autocompleteResults.value.length > 0
    selectedIndex.value = -1
  } catch {
    autocompleteResults.value = []
    showAutocomplete.value = false
  }
}

watch(tagInput, updateAutocomplete)
</script>

<template>
  <div
    class="bg-gray-50 border-t border-gray-200 px-3 py-3"
    @click.stop
  >
    <!-- Current tags -->
    <div class="flex flex-wrap items-center gap-1.5 mb-2">
      <span class="text-xs text-gray-500 mr-1">Tags:</span>
      <span
        v-for="tag in localTags"
        :key="tag"
        class="inline-flex items-center gap-0.5 text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5"
      >
        {{ tag }}
        <button
          class="i-lucide-x text-[10px] opacity-60 hover:opacity-100 ml-0.5"
          :title="`Remove ${tag}`"
          @click="removeTag(tag)"
        />
      </span>
      <span v-if="localTags.length === 0" class="text-xs text-gray-400 italic">
        No tags
      </span>
    </div>

    <!-- ML suggestions -->
    <TagSuggestions
      v-if="filteredSuggestions.length > 0"
      :suggestions="filteredSuggestions"
      @accept="acceptSuggestion"
      @dismiss="dismissSuggestion"
      @accept-all="acceptAllSuggestions"
    />
    <div v-if="suggestionsLoading" class="flex items-center gap-1 mt-1 text-xs text-gray-400">
      <span class="i-lucide-loader-2 animate-spin text-xs" />
      Suggesting tags...
    </div>

    <!-- Manual tag input with autocomplete -->
    <div class="relative mt-2">
      <input
        v-model="tagInput"
        type="text"
        placeholder="Add a tag..."
        class="input text-xs w-full min-h-[36px]"
        @keydown="handleInputKeydown"
        @blur="() => setTimeout(() => showAutocomplete = false, 150)"
        @focus="updateAutocomplete"
      />
      <!-- Autocomplete dropdown -->
      <div
        v-if="showAutocomplete"
        class="absolute z-10 left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded shadow-lg max-h-40 overflow-y-auto"
      >
        <button
          v-for="(result, i) in autocompleteResults"
          :key="result"
          class="block w-full text-left text-xs px-3 py-1.5 hover:bg-blue-50"
          :class="{ 'bg-blue-50': i === selectedIndex }"
          @mousedown.prevent="addTag(result)"
        >
          {{ result }}
        </button>
      </div>
    </div>

    <!-- Done button -->
    <div class="mt-2 flex justify-end">
      <button
        class="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1"
        @click="emit('done')"
      >
        Done
      </button>
    </div>
  </div>
</template>
