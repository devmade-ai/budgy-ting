<script setup lang="ts">
/**
 * Requirement: Add/edit expense form with multi-tag input and autocomplete
 * Approach: Reusable form with tag chips, inline add via Enter/comma, autocomplete dropdown
 * Alternatives:
 *   - Single category input: Rejected — user needs multiple tags (category, account, etc.)
 *   - Separate category + tags fields: Rejected — single tags array is simpler
 */

import { ref, computed } from 'vue'
import { useTagAutocomplete } from '@/composables/useTagAutocomplete'
import { useFormValidation, required, positiveNumber, dateAfter } from '@/composables/useFormValidation'
import DateInput from '@/components/DateInput.vue'
import type { Workspace, Expense, Frequency, LineType } from '@/types/models'

const props = defineProps<{
  workspace: Workspace
  expense?: Expense
}>()

const emit = defineEmits<{
  submit: [data: {
    description: string
    tags: string[]
    amount: number
    frequency: Frequency
    type: LineType
    startDate: string
    endDate: string | null
  }]
  cancel: []
}>()

const lineType = ref<LineType>(props.expense?.type ?? 'expense')
const description = ref(props.expense?.description ?? '')
const amount = ref(props.expense?.amount?.toString() ?? '')
const frequency = ref<Frequency>(props.expense?.frequency ?? 'monthly')
const startDate = ref(props.expense?.startDate ?? props.workspace.startDate ?? '')
const endDate = ref(props.expense?.endDate ?? '')

// Multi-tag state
const tags = ref<string[]>(props.expense?.tags ? [...props.expense.tags] : [])
const { query: tagQuery, suggestions, isOpen, select: selectSuggestion, close } = useTagAutocomplete()

const isEditing = computed(() => !!props.expense)
const tagsValid = ref(true)

const frequencies: { value: Frequency; label: string }[] = [
  { value: 'once-off', label: 'Once-off' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
]

// Dummy ref for validation — tags are validated separately
const tagsRef = ref('')
const { errors, validate } = useFormValidation([description, tagsRef, amount, startDate])

function addTag(value: string) {
  const trimmed = value.trim()
  if (trimmed && !tags.value.includes(trimmed)) {
    tags.value.push(trimmed)
  }
  tagQuery.value = ''
  close()
}

function removeTag(index: number) {
  tags.value.splice(index, 1)
}

const highlightIndex = ref(-1)

function handleTagKeydown(e: KeyboardEvent) {
  // Handle autocomplete navigation
  if (isOpen.value && suggestions.value.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      highlightIndex.value = Math.min(highlightIndex.value + 1, suggestions.value.length - 1)
      return
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      highlightIndex.value = Math.max(highlightIndex.value - 1, 0)
      return
    } else if (e.key === 'Enter' && highlightIndex.value >= 0) {
      e.preventDefault()
      const selected = suggestions.value[highlightIndex.value]
      if (selected) {
        addTag(selected)
        highlightIndex.value = -1
      }
      return
    } else if (e.key === 'Escape') {
      close()
      highlightIndex.value = -1
      return
    }
  }

  // Add tag on Enter or comma
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    if (tagQuery.value.trim()) {
      addTag(tagQuery.value)
    }
  }

  // Remove last tag on Backspace if input is empty
  if (e.key === 'Backspace' && !tagQuery.value && tags.value.length > 0) {
    tags.value.pop()
  }
}

function handleTagBlur() {
  // Add any pending text as a tag
  if (tagQuery.value.trim()) {
    addTag(tagQuery.value)
  }
  window.setTimeout(() => close(), 150)
}

function selectTag(tag: string) {
  addTag(tag)
  highlightIndex.value = -1
}

function handleSubmit() {
  // Validate tags separately
  tagsValid.value = tags.value.length > 0

  const valid = validate([
    required('description', description, 'Description is required'),
    positiveNumber('amount', amount),
    required('startDate', startDate, 'Start date is required'),
    dateAfter('endDate', startDate, endDate),
  ])

  if (!valid || !tagsValid.value) return

  close()

  emit('submit', {
    description: description.value.trim(),
    tags: tags.value,
    amount: parseFloat(amount.value),
    frequency: frequency.value,
    type: lineType.value,
    startDate: startDate.value,
    endDate: endDate.value || null,
  })
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="handleSubmit">
    <!-- Income / Expense toggle -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Type
      </label>
      <div class="flex gap-2">
        <button
          type="button"
          class="btn flex-1 text-sm"
          :class="lineType === 'expense'
            ? 'bg-red-50 text-red-700 border border-red-300'
            : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'"
          @click="lineType = 'expense'"
        >
          <span class="i-lucide-arrow-down-circle mr-1" />
          Expense
        </button>
        <button
          type="button"
          class="btn flex-1 text-sm"
          :class="lineType === 'income'
            ? 'bg-green-50 text-green-700 border border-green-300'
            : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'"
          @click="lineType = 'income'"
        >
          <span class="i-lucide-arrow-up-circle mr-1" />
          Income
        </button>
      </div>
    </div>

    <!-- Description -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1" for="expense-desc">
        Description
      </label>
      <input
        id="expense-desc"
        v-model="description"
        type="text"
        class="input-field"
        placeholder="e.g. Venue hire, Monthly hosting"
        autofocus
      />
      <p v-if="errors['description']" class="text-sm text-red-500 mt-1">
        {{ errors['description'] }}
      </p>
    </div>

    <!-- Tags (multi-tag input with autocomplete) -->
    <div class="relative">
      <label class="block text-sm font-medium text-gray-700 mb-1" for="expense-tags">
        Tags
      </label>
      <p class="text-xs text-gray-400 mb-1">Add categories, account names, or labels. Press Enter or comma to add.</p>
      <div
        class="input-field flex flex-wrap items-center gap-1.5 min-h-[42px] cursor-text py-1.5"
        @click="($refs.tagInput as HTMLInputElement)?.focus()"
      >
        <!-- Tag chips -->
        <span
          v-for="(tag, idx) in tags"
          :key="tag"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-700"
        >
          {{ tag }}
          <button
            type="button"
            class="hover:text-brand-900 transition-colors"
            :aria-label="`Remove tag ${tag}`"
            @click.stop="removeTag(idx)"
          >
            <span class="i-lucide-x text-[10px]" />
          </button>
        </span>
        <!-- Input -->
        <input
          ref="tagInput"
          id="expense-tags"
          v-model="tagQuery"
          type="text"
          class="flex-1 min-w-[80px] outline-none border-none bg-transparent text-sm py-0.5"
          placeholder="Type and press Enter..."
          autocomplete="off"
          role="combobox"
          :aria-expanded="isOpen"
          aria-controls="tag-listbox"
          :aria-activedescendant="highlightIndex >= 0 ? `tag-option-${highlightIndex}` : undefined"
          @keydown="handleTagKeydown"
          @blur="handleTagBlur"
        />
      </div>
      <!-- Autocomplete dropdown -->
      <div
        v-if="isOpen"
        id="tag-listbox"
        role="listbox"
        class="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
      >
        <button
          v-for="(tag, idx) in suggestions"
          :id="`tag-option-${idx}`"
          :key="tag"
          type="button"
          role="option"
          :aria-selected="idx === highlightIndex"
          class="w-full text-left px-3 py-2 text-sm transition-colors"
          :class="idx === highlightIndex ? 'bg-brand-50 text-brand-700' : 'hover:bg-brand-50'"
          @mousedown.prevent="selectTag(tag)"
        >
          {{ tag }}
        </button>
      </div>
      <p v-if="!tagsValid" class="text-sm text-red-500 mt-1">
        At least one tag is required
      </p>
    </div>

    <!-- Amount -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1" for="expense-amount">
        Amount ({{ workspace.currencyLabel }})
      </label>
      <input
        id="expense-amount"
        v-model="amount"
        type="number"
        step="0.01"
        min="0.01"
        class="input-field"
        placeholder="0.00"
      />
      <p v-if="errors['amount']" class="text-sm text-red-500 mt-1">
        {{ errors['amount'] }}
      </p>
    </div>

    <!-- Frequency -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">
        How often?
      </label>
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="f in frequencies"
          :key="f.value"
          type="button"
          class="btn text-sm"
          :class="frequency === f.value
            ? 'bg-brand-50 text-brand-700 border border-brand-300'
            : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'"
          @click="frequency = f.value"
        >
          {{ f.label }}
        </button>
      </div>
    </div>

    <!-- Dates -->
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1" for="expense-start">
          Start date
        </label>
        <DateInput id="expense-start" v-model="startDate" />
        <p v-if="errors['startDate']" class="text-sm text-red-500 mt-1">
          {{ errors['startDate'] }}
        </p>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1" for="expense-end">
          End date
          <span class="text-gray-400 font-normal">(optional)</span>
        </label>
        <DateInput id="expense-end" v-model="endDate" :min="startDate" />
        <p v-if="errors['endDate']" class="text-sm text-red-500 mt-1">
          {{ errors['endDate'] }}
        </p>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex gap-3 pt-2">
      <button type="submit" class="btn-primary flex-1">
        {{ isEditing ? 'Save changes' : lineType === 'income' ? 'Add income' : 'Add expense' }}
      </button>
      <button type="button" class="btn-secondary" @click="emit('cancel')">
        Cancel
      </button>
    </div>
  </form>
</template>
