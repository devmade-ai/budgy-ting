<script setup lang="ts">
/**
 * Requirement: Modal for viewing and editing transaction fields from the dashboard
 * Approach: Opens in read-only mode first, user clicks "Edit" to switch to editable form.
 *   Teleport modal following existing patterns (TutorialModal, InstallInstructionsModal).
 *   Editable: description, date, amount, direction, classification, tags.
 *   Tags section includes ML suggestions and autocomplete from tagCache.
 *   Saves on "Save" click, not on every keystroke.
 * Alternatives:
 *   - Immediately editable: Rejected — users often just want to review, not edit
 *   - Inline row editor: Rejected — cramped in table rows, pushes content around
 *   - Separate edit route: Rejected — breaks single-screen dashboard flow
 */

import { ref, computed } from 'vue'
import { formatAmount, formatDateForDisplay } from '@/composables/useFormat'
import { useTagInput } from '@/composables/useTagInput'
import { isIncome } from '@/types/models'
import { useDialogA11y } from '@/composables/useDialogA11y'
import TagSuggestions from '@/components/TagSuggestions.vue'
import { X, Loader2 } from 'lucide-vue-next'
import type { TagSuggestion } from '@/ml/types'
import type { Transaction, TransactionClassification } from '@/types/models'

const props = defineProps<{
  transaction: Transaction
  suggestions: TagSuggestion[]
  suggestionsLoading: boolean
  currencyLabel: string
  /** All known tags from the workspace — used for autocomplete fallback when tagCache is empty */
  knownTags?: string[]
}>()

const emit = defineEmits<{
  save: [fields: Partial<Transaction>]
  delete: []
  close: []
}>()

const showDeleteConfirm = ref(false)

const dialogRef = ref<HTMLElement | null>(null)
useDialogA11y(dialogRef, () => emit('close'))

// Requirement: Read-only first, then editable on user action
// Approach: Boolean toggle — modal opens in view mode, "Edit" button switches to edit mode
const editing = ref(false)

// Unique id prefix for label-input associations (a11y)
const uid = `txn-edit-${Math.random().toString(36).slice(2, 8)}`

// Local copies — only saved on explicit "Save" click
const localDescription = ref(props.transaction.description)
const localDate = ref(props.transaction.date)
const localAmount = ref(Math.abs(props.transaction.amount))
const localIsIncome = ref(props.transaction.amount >= 0)
const localClassification = ref<TransactionClassification>(props.transaction.classification)
const localTags = ref<string[]>([...props.transaction.tags])

const {
  tagInput,
  autocompleteResults,
  showAutocomplete,
  selectedIndex,
  addTag,
  removeTag,
  handleKeydown: handleTagKeydown,
  handleBlur,
  updateAutocomplete,
} = useTagInput({
  tags: localTags,
  knownTags: () => props.knownTags ?? [],
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
  if (!localDate.value || !/^\d{4}-\d{2}-\d{2}$/.test(localDate.value)) {
    validationError.value = 'Enter a valid date.'
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
        :aria-label="editing ? 'Edit transaction' : 'Transaction details'"
        aria-modal="true"
        class="relative bg-white dark:bg-[var(--color-surface-elevated)] rounded-xl shadow-xl dark:shadow-none max-w-md w-full p-4 sm:p-5 max-w-[calc(100%-1rem)] sm:max-w-md max-h-[90vh] overflow-y-auto"
      >
        <!-- Close button -->
        <!-- Mobile UX: 40x40px touch target for close button (was 18px icon with no padding) -->
        <button
          class="absolute top-2 right-2 w-10 h-10 rounded-full flex items-center justify-center text-gray-400 dark:text-zinc-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
          aria-label="Close"
          @click="emit('close')"
        >
          <X :size="18" />
        </button>

        <!-- ── Read-only view ── -->
        <template v-if="!editing">
          <h3 class="text-base font-semibold text-gray-900 dark:text-zinc-100 mb-4">Transaction details</h3>

          <div class="space-y-3">
            <div>
              <span class="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Description</span>
              <p class="text-sm text-gray-900 dark:text-zinc-100 mt-0.5">{{ transaction.description }}</p>
            </div>

            <div class="flex gap-6">
              <div>
                <span class="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Date</span>
                <p class="text-sm text-gray-900 dark:text-zinc-100 mt-0.5">{{ formatDateForDisplay(transaction.date, 'numeric') }}</p>
              </div>
              <div>
                <span class="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Type</span>
                <p class="text-sm text-gray-900 dark:text-zinc-100 mt-0.5">
                  {{ transaction.classification === 'recurring' ? 'Recurring' : 'Once-off' }}
                </p>
              </div>
            </div>

            <div>
              <span class="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Amount</span>
              <p
                class="text-sm font-semibold mt-0.5"
                :class="isIncome(transaction.amount) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
              >
                {{ isIncome(transaction.amount) ? '+' : '-' }}{{ currencyLabel }}{{ formatAmount(Math.abs(transaction.amount)) }}
              </p>
            </div>

            <div>
              <span class="text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wide">Tags</span>
              <div class="flex flex-wrap items-center gap-1.5 mt-1">
                <span
                  v-for="tag in transaction.tags"
                  :key="tag"
                  class="tag-pill"
                >
                  {{ tag }}
                </span>
                <span v-if="transaction.tags.length === 0" class="text-xs text-gray-400 dark:text-zinc-500 italic">
                  No tags
                </span>
              </div>
            </div>
          </div>

          <!-- Action buttons — read-only mode -->
          <div class="flex gap-3 mt-5">
            <button
              class="btn-secondary flex-1"
              @click="emit('close')"
            >
              Close
            </button>
            <button
              class="btn-primary flex-1"
              @click="editing = true"
            >
              Edit
            </button>
          </div>
          <button
            class="w-full mt-2 text-xs text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors py-1"
            @click="showDeleteConfirm = true"
          >
            Delete transaction
          </button>
          <!-- Inline delete confirmation -->
          <div v-if="showDeleteConfirm" class="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p class="text-sm text-red-700 dark:text-red-400 mb-2">Delete this transaction? This can't be undone.</p>
            <div class="flex gap-2">
              <button class="btn-secondary text-xs flex-1" @click="showDeleteConfirm = false">Cancel</button>
              <button
                class="text-xs flex-1 px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                @click="emit('delete')"
              >
                Delete
              </button>
            </div>
          </div>
        </template>

        <!-- ── Edit mode ── -->
        <template v-else>
          <h3 class="text-base font-semibold text-gray-900 dark:text-zinc-100 mb-4">Edit transaction</h3>

          <div class="space-y-4">
            <!-- Description -->
            <div>
              <label :for="`${uid}-desc`" class="text-sm text-gray-600 dark:text-zinc-300 mb-1 block">Description</label>
              <input
                :id="`${uid}-desc`"
                v-model="localDescription"
                type="text"
                class="input-field w-full min-h-[44px]"
              />
            </div>

            <!-- Date -->
            <div>
              <label :for="`${uid}-date`" class="text-sm text-gray-600 dark:text-zinc-300 mb-1 block">Date</label>
              <input
                :id="`${uid}-date`"
                v-model="localDate"
                type="date"
                class="input-field w-full min-h-[44px]"
              />
            </div>

            <!-- Amount + Direction -->
            <div class="flex gap-3">
              <div class="flex-1">
                <label :for="`${uid}-amount`" class="text-sm text-gray-600 dark:text-zinc-300 mb-1 block">Amount ({{ currencyLabel }})</label>
                <input
                  :id="`${uid}-amount`"
                  v-model.number="localAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  class="input-field w-full min-h-[44px]"
                />
              </div>
              <div class="w-32">
                <label :for="`${uid}-dir`" class="text-sm text-gray-600 dark:text-zinc-300 mb-1 block">Direction</label>
                <select
                  :id="`${uid}-dir`"
                  v-model="localIsIncome"
                  class="input-field w-full min-h-[44px]"
                >
                  <option :value="false">Expense</option>
                  <option :value="true">Income</option>
                </select>
              </div>
            </div>

            <!-- Classification -->
            <div>
              <label :for="`${uid}-type`" class="text-sm text-gray-600 dark:text-zinc-300 mb-1 block">Type</label>
              <select
                :id="`${uid}-type`"
                v-model="localClassification"
                class="input-field w-full min-h-[44px]"
              >
                <option value="recurring">Recurring</option>
                <option value="once-off">Once-off</option>
              </select>
            </div>

            <!-- Tags -->
            <div>
              <label :for="`${uid}-tags`" class="text-sm text-gray-600 dark:text-zinc-300 mb-1 block">Tags</label>
              <div class="flex flex-wrap items-center gap-1.5 mb-2">
                <span
                  v-for="tag in localTags"
                  :key="tag"
                  class="inline-flex items-center gap-0.5 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded px-1.5 py-0.5"
                >
                  {{ tag }}
                  <!-- Mobile UX: 20x20px touch target for tag removal (was 10px icon) -->
                  <button
                    class="w-5 h-5 flex items-center justify-center opacity-60 hover:opacity-100 ml-0.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors"
                    :aria-label="`Remove ${tag}`"
                    @click="removeTag(tag)"
                  >
                    <X :size="12" />
                  </button>
                </span>
                <span v-if="localTags.length === 0" class="text-xs text-gray-400 dark:text-zinc-500 italic">
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
              <div v-if="suggestionsLoading" class="flex items-center gap-1 mt-1 text-xs text-gray-400 dark:text-zinc-500">
                <Loader2 :size="12" class="animate-spin" />
                Suggesting tags...
              </div>

              <!-- Manual tag input with autocomplete -->
              <div class="relative mt-2">
                <input
                  :id="`${uid}-tags`"
                  v-model="tagInput"
                  type="text"
                  placeholder="Add a tag..."
                  class="input-field w-full min-h-[44px]"
                  role="combobox"
                  :aria-expanded="showAutocomplete"
                  aria-autocomplete="list"
                  @keydown="handleTagKeydown"
                  @blur="handleBlur"
                  @focus="updateAutocomplete"
                />
                <!-- Mobile UX: Render upward (bottom-full) to avoid being clipped by modal overflow -->
                <ul
                  v-if="showAutocomplete"
                  role="listbox"
                  class="absolute z-10 left-0 right-0 bottom-full mb-0.5 bg-white dark:bg-[var(--color-surface-elevated)] border border-gray-200 dark:border-zinc-700 rounded shadow-lg dark:shadow-none max-h-40 overflow-y-auto"
                >
                  <li
                    v-for="(result, i) in autocompleteResults"
                    :key="result"
                    role="option"
                    :aria-selected="i === selectedIndex"
                    class="text-sm px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer dark:text-zinc-200"
                    :class="{ 'bg-blue-50 dark:bg-blue-900/30': i === selectedIndex }"
                    @mousedown.prevent="addTag(result)"
                  >
                    {{ result }}
                  </li>
                </ul>
                <p
                  v-else-if="tagInput.length > 0 && autocompleteResults.length === 0"
                  class="text-xs text-gray-400 dark:text-zinc-500 mt-1"
                >
                  No matching tags — press Enter to create "{{ tagInput }}"
                </p>
              </div>
            </div>
          </div>

          <!-- Validation error -->
          <p v-if="validationError" class="text-sm text-red-600 dark:text-red-400 mt-4">{{ validationError }}</p>

          <!-- Action buttons — edit mode -->
          <div class="flex gap-3 mt-4">
            <button
              class="btn-secondary flex-1"
              @click="editing = false"
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
        </template>
      </div>
    </div>
  </Teleport>
</template>
