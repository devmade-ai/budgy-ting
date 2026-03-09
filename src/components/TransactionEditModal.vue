<script setup lang="ts">
/**
 * Requirement: Modal for editing all transaction fields from the dashboard
 * Approach: Teleport modal following existing patterns (TutorialModal, InstallInstructionsModal).
 *   Editable: description, date, amount, direction, classification, tags.
 *   Tags section includes ML suggestions and autocomplete from tagCache.
 *   Saves on "Save" click, not on every keystroke.
 * Alternatives:
 *   - Inline row editor: Rejected — cramped in table rows, pushes content around
 *   - Separate edit route: Rejected — breaks single-screen dashboard flow
 */

import { ref, computed, watch, onUnmounted } from 'vue'
import { db } from '@/db'
import { useDialogA11y } from '@/composables/useDialogA11y'
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
  save: [fields: Partial<Transaction>]
  close: []
}>()

const dialogRef = ref<HTMLElement | null>(null)
useDialogA11y(dialogRef, () => emit('close'))

// Local copies — only saved on explicit "Save" click
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

// Timer cleanup for blur handler
const blurTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
onUnmounted(() => {
  if (blurTimeout.value) clearTimeout(blurTimeout.value)
})

// Dismissed ML suggestions
const dismissed = ref(new Set<string>())

const filteredSuggestions = computed(() =>
  props.suggestions.filter(
    (s) => !localTags.value.includes(s.tag) && !dismissed.value.has(s.tag),
  ),
)

// Validation — description required, amount must be a valid number
const validationError = ref('')

function handleSave() {
  const trimmedDesc = localDescription.value.trim()
  if (!trimmedDesc) {
    validationError.value = 'Description is required.'
    return
  }
  if (isNaN(localAmount.value) || localAmount.value < 0) {
    validationError.value = 'Enter a valid amount.'
    return
  }
  validationError.value = ''

  const signedAmount = localIsIncome.value ? Math.abs(localAmount.value) : -Math.abs(localAmount.value)
  emit('save', {
    description: trimmedDesc,
    date: localDate.value,
    amount: signedAmount,
    classification: localClassification.value,
    tags: [...localTags.value],
  })
}

function handleBlur() {
  if (blurTimeout.value) clearTimeout(blurTimeout.value)
  blurTimeout.value = setTimeout(() => showAutocomplete.value = false, 150)
}

// ── Tag management ──

function addTag(tag: string) {
  const trimmed = tag.trim()
  if (!trimmed || localTags.value.includes(trimmed)) return
  localTags.value.push(trimmed)
  tagInput.value = ''
  showAutocomplete.value = false
}

function removeTag(tag: string) {
  localTags.value = localTags.value.filter((t) => t !== tag)
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
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/40"
        aria-hidden="true"
        @click="emit('close')"
      />

      <!-- Dialog -->
      <div
        ref="dialogRef"
        role="dialog"
        aria-label="Edit transaction"
        aria-modal="true"
        class="relative bg-white rounded-xl shadow-xl max-w-md w-full p-5 max-h-[90vh] overflow-y-auto"
      >
        <!-- Close button -->
        <button
          class="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
          @click="emit('close')"
        >
          <span class="i-lucide-x text-lg" />
        </button>

        <h3 class="text-base font-semibold text-gray-900 mb-4">Edit transaction</h3>

        <div class="space-y-4">
          <!-- Description -->
          <div>
            <label class="text-sm text-gray-600 mb-1 block">Description</label>
            <input
              v-model="localDescription"
              type="text"
              class="input text-sm w-full min-h-[44px]"
            />
          </div>

          <!-- Date -->
          <div>
            <label class="text-sm text-gray-600 mb-1 block">Date</label>
            <input
              v-model="localDate"
              type="date"
              class="input text-sm w-full min-h-[44px]"
            />
          </div>

          <!-- Amount + Direction -->
          <div class="flex gap-3">
            <div class="flex-1">
              <label class="text-sm text-gray-600 mb-1 block">Amount ({{ currencyLabel }})</label>
              <input
                v-model.number="localAmount"
                type="number"
                min="0"
                step="0.01"
                class="input text-sm w-full min-h-[44px]"
              />
            </div>
            <div class="w-32">
              <label class="text-sm text-gray-600 mb-1 block">Direction</label>
              <select
                v-model="localIsIncome"
                class="input text-sm w-full min-h-[44px]"
              >
                <option :value="false">Expense</option>
                <option :value="true">Income</option>
              </select>
            </div>
          </div>

          <!-- Classification -->
          <div>
            <label class="text-sm text-gray-600 mb-1 block">Type</label>
            <select
              v-model="localClassification"
              class="input text-sm w-full min-h-[44px]"
            >
              <option value="recurring">Recurring</option>
              <option value="once-off">Once-off</option>
            </select>
          </div>

          <!-- Tags -->
          <div>
            <label class="text-sm text-gray-600 mb-1 block">Tags</label>
            <div class="flex flex-wrap items-center gap-1.5 mb-2">
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
                class="input text-sm w-full min-h-[44px]"
                @keydown="handleTagKeydown"
                @blur="handleBlur"
                @focus="updateAutocomplete"
              />
              <div
                v-if="showAutocomplete"
                class="absolute z-10 left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded shadow-lg max-h-40 overflow-y-auto"
              >
                <button
                  v-for="(result, i) in autocompleteResults"
                  :key="result"
                  class="block w-full text-left text-sm px-3 py-2 hover:bg-blue-50"
                  :class="{ 'bg-blue-50': i === selectedIndex }"
                  @mousedown.prevent="addTag(result)"
                >
                  {{ result }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Validation error -->
        <p v-if="validationError" class="text-sm text-red-600 mt-4">{{ validationError }}</p>

        <!-- Action buttons -->
        <div class="flex gap-3 mt-4">
          <button
            class="btn-secondary flex-1"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            class="btn-primary flex-1"
            @click="handleSave"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
