<script setup lang="ts">
/**
 * Requirement: Add/edit expense form with category autocomplete
 * Approach: Reusable form with all expense fields, autocomplete dropdown for category
 */

import { ref, computed, watch } from 'vue'
import { useCategoryAutocomplete } from '@/composables/useCategoryAutocomplete'
import type { Budget, Expense, Frequency } from '@/types/models'

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
    startDate: string
    endDate: string | null
  }]
  cancel: []
}>()

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

const errors = ref<Record<string, string>>({})

watch([description, categoryQuery, amount, startDate], () => {
  errors.value = {}
})

function validate(): boolean {
  const e: Record<string, string> = {}

  if (!description.value.trim()) e['description'] = 'Description is required'
  if (!categoryQuery.value.trim()) e['category'] = 'Category is required'

  const numAmount = parseFloat(amount.value)
  if (!amount.value || isNaN(numAmount) || numAmount <= 0) {
    e['amount'] = 'Enter a positive amount'
  }

  if (!startDate.value) e['startDate'] = 'Start date is required'

  if (endDate.value && startDate.value && endDate.value < startDate.value) {
    e['endDate'] = 'End date must be after start date'
  }

  errors.value = e
  return Object.keys(e).length === 0
}

function handleSubmit() {
  if (!validate()) return

  close()

  emit('submit', {
    description: description.value.trim(),
    category: categoryQuery.value.trim(),
    amount: parseFloat(amount.value),
    frequency: frequency.value,
    startDate: startDate.value,
    endDate: endDate.value || null,
  })
}

function selectCategory(cat: string) {
  select(cat)
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="handleSubmit">
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
        @focus="isOpen = suggestions.length > 0"
        @blur="setTimeout(() => close(), 150)"
      />
      <!-- Autocomplete dropdown -->
      <div
        v-if="isOpen"
        class="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
      >
        <button
          v-for="cat in suggestions"
          :key="cat"
          type="button"
          class="w-full text-left px-3 py-2 text-sm hover:bg-brand-50 transition-colors"
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
        <input
          id="expense-start"
          v-model="startDate"
          type="date"
          class="input-field"
        />
        <p v-if="errors['startDate']" class="text-sm text-red-500 mt-1">
          {{ errors['startDate'] }}
        </p>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1" for="expense-end">
          End date
          <span class="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          id="expense-end"
          v-model="endDate"
          type="date"
          class="input-field"
          :min="startDate"
        />
        <p v-if="errors['endDate']" class="text-sm text-red-500 mt-1">
          {{ errors['endDate'] }}
        </p>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex gap-3 pt-2">
      <button type="submit" class="btn-primary flex-1">
        {{ isEditing ? 'Save changes' : 'Add expense' }}
      </button>
      <button type="button" class="btn-secondary" @click="emit('cancel')">
        Cancel
      </button>
    </div>
  </form>
</template>
