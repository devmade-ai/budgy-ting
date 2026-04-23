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
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { isTransactionDirty } from '@/components/transactionDirty'
import { X, RefreshCw } from 'lucide-vue-next'
import type { TagSuggestion } from '@/ml/types'
import type { Transaction, TransactionClassification } from '@/types/models'

const props = defineProps<{
  transaction: Transaction
  suggestions: TagSuggestion[]
  suggestionsLoading: boolean
  currencyLabel: string
  /** ML error surfaced so user can retry from the modal when no suggestions appear */
  suggestionsError?: string | null
  /** All known tags from the workspace — used for autocomplete fallback when tagCache is empty */
  knownTags?: string[]
}>()

const emit = defineEmits<{
  save: [fields: Partial<Transaction>]
  delete: []
  close: []
  retrySuggestions: []
}>()

const showDeleteConfirm = ref(false)
const showDiscardConfirm = ref(false)

const dialogRef = ref<HTMLElement | null>(null)
useDialogA11y(dialogRef, () => requestClose())

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

// Warn user before silently discarding edits. Comparison lives in a pure
// helper (transactionDirty.ts) so it can be unit-tested without mounting
// the component.
const isDirty = computed(() => isTransactionDirty(props.transaction, {
  description: localDescription.value,
  date: localDate.value,
  amount: localAmount.value,
  isIncome: localIsIncome.value,
  classification: localClassification.value,
  tags: localTags.value,
}))

// Pending action for the discard confirmation — either 'close' (emit close
// and tear down the modal) or 'view' (revert to read-only mode without closing).
const discardTarget = ref<'close' | 'view'>('close')

function requestClose() {
  if (editing.value && isDirty.value) {
    discardTarget.value = 'close'
    showDiscardConfirm.value = true
    return
  }
  emit('close')
}

function requestCancelEdit() {
  if (!isDirty.value) {
    editing.value = false
    return
  }
  discardTarget.value = 'view'
  showDiscardConfirm.value = true
}

function resetLocalFields() {
  const t = props.transaction
  localDescription.value = t.description
  localDate.value = t.date
  localAmount.value = Math.abs(t.amount)
  localIsIncome.value = t.amount >= 0
  localClassification.value = t.classification
  localTags.value = [...t.tags]
  validationError.value = ''
  validationField.value = ''
}

function confirmDiscard() {
  showDiscardConfirm.value = false
  if (discardTarget.value === 'close') {
    emit('close')
  } else {
    resetLocalFields()
    editing.value = false
  }
}

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

// Validation — description required, amount must be a valid number.
// Track which field failed so aria-invalid / focus target are precise for
// screen-reader and keyboard users, not just a general banner.
const validationError = ref('')
const validationField = ref<'description' | 'amount' | 'date' | ''>('')

// Refs to the three validatable inputs — used to shift focus on failure.
const descInputRef = ref<HTMLInputElement | null>(null)
const amountInputRef = ref<HTMLInputElement | null>(null)
const dateInputRef = ref<HTMLInputElement | null>(null)

function handleSave() {
  const trimmedDesc = localDescription.value.trim()
  if (!trimmedDesc) {
    validationError.value = 'Description is required.'
    validationField.value = 'description'
    descInputRef.value?.focus()
    return
  }
  if (isNaN(localAmount.value) || localAmount.value < 0) {
    validationError.value = 'Enter a valid amount.'
    validationField.value = 'amount'
    amountInputRef.value?.focus()
    return
  }
  if (!localDate.value || !/^\d{4}-\d{2}-\d{2}$/.test(localDate.value)) {
    validationError.value = 'Enter a valid date.'
    validationField.value = 'date'
    dateInputRef.value?.focus()
    return
  }
  validationError.value = ''
  validationField.value = ''

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
    <div class="modal modal-open z-[60]">
      <!-- Backdrop -->
      <div
        class="modal-backdrop"
        aria-hidden="true"
        @click="requestClose"
      />

      <!-- Dialog — max-h + overflow-y-auto keeps long edit forms scrollable on
           small phones. Without explicit overflow, DaisyUI's modal-box clips
           content at 90vh and traps the user. -->
      <div
        ref="dialogRef"
        role="dialog"
        :aria-label="editing ? 'Edit transaction' : 'Transaction details'"
        aria-modal="true"
        class="modal-box max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-5"
      >
        <!-- Close button -->
        <!-- Mobile UX: 40x40px touch target for close button (was 18px icon with no padding) -->
        <button
          class="absolute top-2 right-2 w-10 h-10 rounded-full flex items-center justify-center text-base-content/40 hover:text-base-content/70 hover:bg-base-200 transition-colors"
          aria-label="Close"
          @click="requestClose"
        >
          <X :size="18" />
        </button>

        <!-- ── Read-only view ── -->
        <template v-if="!editing">
          <h3 class="text-lg font-semibold text-base-content mb-4">Transaction details</h3>

          <div class="space-y-3">
            <div>
              <span class="text-xs text-base-content/60 uppercase tracking-wide">Description</span>
              <p class="text-sm text-base-content mt-0.5">{{ transaction.description }}</p>
            </div>

            <div class="flex gap-6">
              <div>
                <span class="text-xs text-base-content/60 uppercase tracking-wide">Date</span>
                <p class="text-sm text-base-content mt-0.5">{{ formatDateForDisplay(transaction.date, 'numeric') }}</p>
              </div>
              <div>
                <span class="text-xs text-base-content/60 uppercase tracking-wide">Type</span>
                <p class="text-sm text-base-content mt-0.5">
                  {{ transaction.classification === 'recurring' ? 'Recurring' : 'Once-off' }}
                </p>
              </div>
            </div>

            <div>
              <span class="text-xs text-base-content/60 uppercase tracking-wide">Amount</span>
              <p
                class="text-sm font-semibold mt-0.5"
                :class="isIncome(transaction.amount) ? 'text-success' : 'text-error'"
              >
                {{ isIncome(transaction.amount) ? '+' : '-' }}{{ currencyLabel }}{{ formatAmount(Math.abs(transaction.amount)) }}
              </p>
            </div>

            <div>
              <span class="text-xs text-base-content/60 uppercase tracking-wide">Tags</span>
              <div class="flex flex-wrap items-center gap-1.5 mt-1">
                <span
                  v-for="tag in transaction.tags"
                  :key="tag"
                  class="badge badge-ghost badge-sm"
                >
                  {{ tag }}
                </span>
                <span v-if="transaction.tags.length === 0" class="text-xs text-base-content/60 italic">
                  No tags
                </span>
              </div>
            </div>
          </div>

          <!-- Action buttons — read-only mode -->
          <div class="flex gap-3 mt-5">
            <button
              class="btn btn-ghost flex-1"
              @click="emit('close')"
            >
              Close
            </button>
            <button
              class="btn btn-primary flex-1"
              @click="editing = true"
            >
              Edit
            </button>
          </div>
          <button
            class="w-full mt-2 text-xs text-base-content/40 hover:text-error transition-colors py-1"
            @click="showDeleteConfirm = true"
          >
            Delete transaction
          </button>
        </template>

        <!-- ── Edit mode ── -->
        <template v-else>
          <h3 class="text-lg font-semibold text-base-content mb-4">Edit transaction</h3>

          <div class="space-y-4">
            <!-- Description -->
            <div>
              <label :for="`${uid}-desc`" class="text-sm text-base-content/70 mb-1 block">Description</label>
              <input
                :id="`${uid}-desc`"
                ref="descInputRef"
                v-model="localDescription"
                type="text"
                :aria-invalid="validationField === 'description' || undefined"
                :aria-describedby="validationField === 'description' ? `${uid}-err` : undefined"
                class="input input-bordered w-full text-base min-h-[44px]"
              />
            </div>

            <!-- Date -->
            <div>
              <label :for="`${uid}-date`" class="text-sm text-base-content/70 mb-1 block">Date</label>
              <input
                :id="`${uid}-date`"
                ref="dateInputRef"
                v-model="localDate"
                type="date"
                :aria-invalid="validationField === 'date' || undefined"
                :aria-describedby="validationField === 'date' ? `${uid}-err` : undefined"
                class="input input-bordered w-full text-base min-h-[44px]"
              />
            </div>

            <!-- Amount + Direction -->
            <div class="flex gap-3">
              <div class="flex-1">
                <label :for="`${uid}-amount`" class="text-sm text-base-content/70 mb-1 block">Amount ({{ currencyLabel }})</label>
                <input
                  :id="`${uid}-amount`"
                  ref="amountInputRef"
                  v-model.number="localAmount"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  step="0.01"
                  :aria-invalid="validationField === 'amount' || undefined"
                  :aria-describedby="validationField === 'amount' ? `${uid}-err` : undefined"
                  class="input input-bordered w-full text-base min-h-[44px]"
                />
              </div>
              <div class="w-32">
                <label :for="`${uid}-dir`" class="text-sm text-base-content/70 mb-1 block">Direction</label>
                <select
                  :id="`${uid}-dir`"
                  v-model="localIsIncome"
                  class="select select-bordered w-full text-base min-h-[44px]"
                >
                  <option :value="false">Expense</option>
                  <option :value="true">Income</option>
                </select>
              </div>
            </div>

            <!-- Classification -->
            <div>
              <label :for="`${uid}-type`" class="text-sm text-base-content/70 mb-1 block">Type</label>
              <select
                :id="`${uid}-type`"
                v-model="localClassification"
                class="select select-bordered w-full text-base min-h-[44px]"
              >
                <option value="recurring">Recurring</option>
                <option value="once-off">Once-off</option>
              </select>
            </div>

            <!-- Tags -->
            <div>
              <label :for="`${uid}-tags`" class="text-sm text-base-content/70 mb-1 block">Tags</label>
              <div class="flex flex-wrap items-center gap-1.5 mb-2">
                <span
                  v-for="tag in localTags"
                  :key="tag"
                  class="inline-flex items-center gap-1 text-xs bg-info/10 text-info rounded pl-2 pr-0.5 py-0.5"
                >
                  {{ tag }}
                  <!-- Mobile UX: 28×28 touch target (was 20×20; 20px is below the
                       44px recommendation and inconsistent with other close buttons
                       in the app — 28 keeps chip compactness without sacrificing
                       reliable tappability). -->
                  <button
                    class="w-7 h-7 flex items-center justify-center opacity-60 hover:opacity-100 rounded-full hover:bg-info/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-info transition-colors"
                    :aria-label="`Remove ${tag}`"
                    @click="removeTag(tag)"
                  >
                    <X :size="14" aria-hidden="true" />
                  </button>
                </span>
                <span v-if="localTags.length === 0" class="text-xs text-base-content/60 italic">
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
              <div
                v-if="suggestionsLoading"
                class="flex items-center gap-1 mt-1 text-xs text-base-content/60"
                role="status"
                aria-live="polite"
                aria-busy="true"
              >
                <span class="loading loading-spinner loading-xs" aria-hidden="true" />
                Suggesting tags...
              </div>

              <!-- ML retry affordance — visible when model errored and no suggestions returned.
                   Matches the retry pattern in ImportStepReview so users see a way forward. -->
              <div
                v-else-if="suggestionsError && filteredSuggestions.length === 0"
                class="flex items-center gap-2 mt-1 text-xs text-base-content/60"
              >
                <span>Suggestions unavailable.</span>
                <button
                  class="inline-flex items-center gap-1 text-primary hover:underline"
                  type="button"
                  @click="emit('retrySuggestions')"
                >
                  <RefreshCw :size="12" aria-hidden="true" />
                  Retry
                </button>
              </div>

              <!-- Manual tag input with autocomplete -->
              <div class="relative mt-2">
                <input
                  :id="`${uid}-tags`"
                  v-model="tagInput"
                  type="text"
                  placeholder="Add a tag..."
                  class="input input-bordered w-full text-base min-h-[44px]"
                  role="combobox"
                  :aria-expanded="showAutocomplete"
                  aria-autocomplete="list"
                  :aria-controls="`${uid}-taglist`"
                  :aria-activedescendant="showAutocomplete && autocompleteResults[selectedIndex] ? `${uid}-tagopt-${selectedIndex}` : undefined"
                  @keydown="handleTagKeydown"
                  @blur="handleBlur"
                  @focus="updateAutocomplete"
                />
                <!-- Mobile UX: Render upward (bottom-full) to avoid being clipped by modal overflow -->
                <ul
                  v-if="showAutocomplete"
                  :id="`${uid}-taglist`"
                  role="listbox"
                  class="absolute z-10 left-0 right-0 bottom-full mb-0.5 bg-base-100 border border-base-300 rounded shadow-lg max-h-40 overflow-y-auto"
                >
                  <li
                    v-for="(result, i) in autocompleteResults"
                    :id="`${uid}-tagopt-${i}`"
                    :key="result"
                    role="option"
                    :aria-selected="i === selectedIndex"
                    class="text-sm px-3 py-2 hover:bg-primary/10 cursor-pointer text-base-content"
                    :class="{ 'bg-primary/10': i === selectedIndex }"
                    @mousedown.prevent="addTag(result)"
                  >
                    {{ result }}
                  </li>
                </ul>
                <p
                  v-else-if="tagInput.length > 0 && autocompleteResults.length === 0"
                  class="text-xs text-base-content/60 mt-1"
                >
                  No matching tags — press Enter to create "{{ tagInput }}"
                </p>
              </div>
            </div>
          </div>

          <!-- Validation error — role="alert" auto-announces on insert for screen readers.
               Paired with aria-describedby on the failing input above. -->
          <p
            v-if="validationError"
            :id="`${uid}-err`"
            role="alert"
            class="text-sm text-error mt-4"
          >
            {{ validationError }}
          </p>

          <!-- Action buttons — edit mode -->
          <div class="flex gap-3 mt-4">
            <button
              class="btn btn-ghost flex-1"
              @click="requestCancelEdit"
            >
              Cancel
            </button>
            <button
              class="btn btn-primary flex-1"
              @click="handleSave"
            >
              Save
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- Destructive-action confirmation.
         Previously an inline panel inside the edit modal — promoted to ConfirmDialog
         for parity with workspace delete (same alertdialog, same button weight). -->
    <ConfirmDialog
      v-if="showDeleteConfirm"
      title="Delete this transaction?"
      message="This transaction will be permanently removed. This cannot be undone."
      confirm-label="Delete transaction"
      :danger="true"
      @confirm="emit('delete')"
      @cancel="showDeleteConfirm = false"
    />

    <!-- Unsaved-changes guard — fires on close/backdrop/Escape/Cancel when
         the edit form is dirty. Without this, clicking away silently discarded
         typed values. -->
    <ConfirmDialog
      v-if="showDiscardConfirm"
      title="Discard unsaved changes?"
      message="You have unsaved changes. Close without saving?"
      confirm-label="Discard changes"
      :danger="true"
      @confirm="confirmDiscard"
      @cancel="showDiscardConfirm = false"
    />
  </Teleport>
</template>
