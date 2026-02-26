<script setup lang="ts">
/**
 * Requirement: Add/edit expense form with category autocomplete
 * Approach: Reusable form with all expense fields, autocomplete dropdown for category
 */

import { ref, computed } from 'vue'
import { useCategoryAutocomplete } from '@/composables/useCategoryAutocomplete'
import { useFormValidation, required, positiveNumber, dateAfter } from '@/composables/useFormValidation'
import DateInput from '@/components/DateInput.vue'
import type { Budget, Expense, Frequency, LineType } from '@/types/models'

const props = defineProps<{
  budget: Budget
  expense?: Expense
}>()

const emit = defineEmits<{
  submit: [data: {
    description: string
    category: string
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
const startDate = ref(props.expense?.startDate ?? props.budget.startDate ?? '')
const endDate = ref(props.expense?.endDate ?? '')

const { query: categoryQuery, suggestions, isOpen, select, close } = useCategoryAutocomplete()
categoryQuery.value = props.expense?.category ?? ''

const isEditing = computed(() => !!props.expense)

const frequencies: { value: Frequency; label: string }[] = [
  { value: 'once-off', label: 'Once-off' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annually', label: 'Annually' },
]

const { errors, validate } = useFormValidation([description, categoryQuery, amount, startDate])

function handleSubmit() {
  const valid = validate([
    required('description', description, 'Description is required'),
    required('category', categoryQuery, 'Category is required'),
    positiveNumber('amount', amount),
    required('startDate', startDate, 'Start date is required'),
    dateAfter('endDate', startDate, endDate),
  ])
  if (!valid) return

  close()

  emit('submit', {
    description: description.value.trim(),
    category: categoryQuery.value.trim(),
    amount: parseFloat(amount.value),
    frequency: frequency.value,
    type: lineType.value,
    startDate: startDate.value,
    endDate: endDate.value || null,
  })
}

const BLUR_DELAY_MS = 150
const highlightIndex = ref(-1)

function handleCategoryBlur() {
  window.setTimeout(() => close(), BLUR_DELAY_MS)
}

function handleCategoryKeydown(e: KeyboardEvent) {
  if (!isOpen.value || suggestions.value.length === 0) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightIndex.value = Math.min(highlightIndex.value + 1, suggestions.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightIndex.value = Math.max(highlightIndex.value - 1, 0)
  } else if (e.key === 'Enter' && highlightIndex.value >= 0) {
    e.preventDefault()
    const selected = suggestions.value[highlightIndex.value]
    if (selected) selectCategory(selected)
  } else if (e.key === 'Escape') {
    close()
    highlightIndex.value = -1
  }
}

function selectCategory(cat: string) {
  select(cat)
  highlightIndex.value = -1
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

    <!-- Category with autocomplete -->
    <div class="relative">
      <label class="block text-sm font-medium text-gray-700 mb-1" for="expense-category">
        Category
      </label>
      <input
        id="expense-category"
        v-model="categoryQuery"
        type="text"
        class="input-field"
        placeholder="e.g. Venue, Marketing, Software"
        autocomplete="off"
        role="combobox"
        :aria-expanded="isOpen"
        aria-controls="category-listbox"
        :aria-activedescendant="highlightIndex >= 0 ? `category-option-${highlightIndex}` : undefined"
        @focus="isOpen = suggestions.length > 0"
        @blur="handleCategoryBlur"
        @keydown="handleCategoryKeydown"
      />
      <!-- Autocomplete dropdown -->
      <div
        v-if="isOpen"
        id="category-listbox"
        role="listbox"
        class="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
      >
        <button
          v-for="(cat, idx) in suggestions"
          :id="`category-option-${idx}`"
          :key="cat"
          type="button"
          role="option"
          :aria-selected="idx === highlightIndex"
          class="w-full text-left px-3 py-2 text-sm transition-colors"
          :class="idx === highlightIndex ? 'bg-brand-50 text-brand-700' : 'hover:bg-brand-50'"
          @mousedown.prevent="selectCategory(cat)"
        >
          {{ cat }}
        </button>
      </div>
      <p v-if="errors['category']" class="text-sm text-red-500 mt-1">
        {{ errors['category'] }}
      </p>
    </div>

    <!-- Amount -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1" for="expense-amount">
        Amount ({{ budget.currencyLabel }})
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
