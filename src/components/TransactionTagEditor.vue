<script setup lang="ts">
/**
 * Requirement: Inline transaction editor for the dashboard table
 * Approach: Renders below an expanded row — editable fields for description, date,
 *   amount, classification, and tags. Tags section includes ML suggestions and
 *   autocomplete from tagCache.
 * Alternatives:
 *   - Modal dialog: Rejected — too heavy for quick inline edits
 *   - Separate edit page/route: Rejected — breaks single-screen dashboard flow
 */

import { ref, computed, watch } from 'vue'
import { db } from '@/db'
import TagSuggestions from '@/components/TagSuggestions.vue'
import type { TagSuggestion } from '@/ml/types'
import type { Transaction, TransactionClassification } from '@/types/models'

const props = defineProps<{
  transaction: Transaction
  suggestions: TagSuggestion[]
  suggestionsLoading: boolean
  currencyLabel: string
}>()

const emit = defineEmits<{
  'update:transaction': [fields: Partial<Transaction>]
  done: []
}>()

// Local copies for immediate UI feedback
const localDescription = ref(props.transaction.description)
const localDate = ref(props.transaction.date)
const localAmount = ref(Math.abs(props.transaction.amount))
const localIsIncome = ref(props.transaction.amount >= 0)
const localClassification = ref<TransactionClassification>(props.transaction.classification)
const localTags = ref<string[]>([...props.transaction.tags])

// Tag input state
const tagInput = ref('')
const autocompleteResults = ref<string[]>([])
const showAutocomplete = ref(false)
const selectedIndex = ref(-1)

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
  () => props.transaction,
  (txn) => {
    localDescription.value = txn.description
    localDate.value = txn.date
    localAmount.value = Math.abs(txn.amount)
    localIsIncome.value = txn.amount >= 0
    localClassification.value = txn.classification
    localTags.value = [...txn.tags]
  },
)

// Emit changes on each field update (debounced at parent level)
function emitUpdate() {
  const signedAmount = localIsIncome.value ? Math.abs(localAmount.value) : -Math.abs(localAmount.value)
  emit('update:transaction', {
    description: localDescription.value.trim(),
    date: localDate.value,
    amount: signedAmount,
    classification: localClassification.value,
    tags: [...localTags.value],
  })
}

// ── Tag management ──

function addTag(tag: string) {
  const trimmed = tag.trim()
  if (!trimmed || localTags.value.includes(trimmed)) return
  localTags.value.push(trimmed)
  tagInput.value = ''
  showAutocomplete.value = false
  emitUpdate()
}

function removeTag(tag: string) {
  localTags.value = localTags.value.filter((t) => t !== tag)
  emitUpdate()
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
  emitUpdate()
}

function handleTagKeydown(e: KeyboardEvent) {
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
    class="bg-gray-50 border-t border-gray-200 px-3 py-3 space-y-3"
    @click.stop
  >
    <!-- Row 1: Description + Date -->
    <div class="flex flex-wrap gap-2">
      <div class="flex-1 min-w-48">
        <label class="text-xs text-gray-500 mb-0.5 block">Description</label>
        <input
          v-model="localDescription"
          type="text"
          class="input text-xs w-full min-h-[36px]"
          @change="emitUpdate()"
        />
      </div>
      <div class="w-36">
        <label class="text-xs text-gray-500 mb-0.5 block">Date</label>
        <input
          v-model="localDate"
          type="date"
          class="input text-xs w-full min-h-[36px]"
          @change="emitUpdate()"
        />
      </div>
    </div>

    <!-- Row 2: Amount + Type + Classification -->
    <div class="flex flex-wrap items-end gap-2">
      <div class="w-32">
        <label class="text-xs text-gray-500 mb-0.5 block">Amount ({{ currencyLabel }})</label>
        <input
          v-model.number="localAmount"
          type="number"
          min="0"
          step="0.01"
          class="input text-xs w-full min-h-[36px]"
          @change="emitUpdate()"
        />
      </div>
      <div class="w-28">
        <label class="text-xs text-gray-500 mb-0.5 block">Direction</label>
        <select
          v-model="localIsIncome"
          class="input text-xs w-full min-h-[36px]"
          @change="emitUpdate()"
        >
          <option :value="false">Expense</option>
          <option :value="true">Income</option>
        </select>
      </div>
      <div class="w-28">
        <label class="text-xs text-gray-500 mb-0.5 block">Type</label>
        <select
          v-model="localClassification"
          class="input text-xs w-full min-h-[36px]"
          @change="emitUpdate()"
        >
          <option value="recurring">Recurring</option>
          <option value="once-off">Once-off</option>
        </select>
      </div>
    </div>

    <!-- Row 3: Tags -->
    <div>
      <label class="text-xs text-gray-500 mb-0.5 block">Tags</label>
      <div class="flex flex-wrap items-center gap-1.5 mb-1.5">
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
      <div class="relative mt-1.5">
        <input
          v-model="tagInput"
          type="text"
          placeholder="Add a tag..."
          class="input text-xs w-full min-h-[36px]"
          @keydown="handleTagKeydown"
          @blur="() => setTimeout(() => showAutocomplete = false, 150)"
          @focus="updateAutocomplete"
        />
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
    </div>

    <!-- Done button -->
    <div class="flex justify-end">
      <button
        class="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1"
        @click="emit('done')"
      >
        Done
      </button>
    </div>
  </div>
</template>
