<script setup lang="ts">
/**
 * Requirement: Create/edit budget form with name, currency, period type, dates, optional starting balance
 * Approach: Single form component reused for create and edit via optional budget prop
 * Alternatives:
 *   - Separate create/edit components: Rejected — too much duplication
 *   - Modal form: Rejected — full page form is simpler on mobile
 */

import { ref, computed } from 'vue'
import type { Budget, PeriodType } from '@/types/models'
import { todayISO } from '@/composables/useTimestamp'
import { useFormValidation, required, positiveNumber, dateAfter } from '@/composables/useFormValidation'
import DateInput from '@/components/DateInput.vue'

const props = defineProps<{
  budget?: Budget
}>()

const emit = defineEmits<{
  submit: [data: {
    name: string
    currencyLabel: string
    periodType: PeriodType
    startDate: string
    endDate: string | null
    startingBalance: number | null
  }]
  cancel: []
}>()

const name = ref(props.budget?.name ?? '')
const currencyLabel = ref(props.budget?.currencyLabel ?? 'R')
const periodType = ref<PeriodType>(props.budget?.periodType ?? 'monthly')
const startDate = ref(props.budget?.startDate ?? todayISO())
const endDate = ref(props.budget?.endDate ?? '')
const hasStartingBalance = ref(props.budget?.startingBalance != null)
const startingBalanceStr = ref(props.budget?.startingBalance?.toString() ?? '')

const isEditing = computed(() => !!props.budget)

const { errors, validate } = useFormValidation([name, startDate, endDate, startingBalanceStr])

function runValidation(): boolean {
  return validate([
    required('name', name, 'Budget name is required'),
    // Custom period requires a start date
    {
      field: 'dates',
      check: () => periodType.value !== 'custom' || !!startDate.value,
      message: 'Start date is required',
    },
    dateAfter('dates', startDate, endDate),
    // Starting balance must be positive when enabled
    {
      field: 'balance',
      check: () => !hasStartingBalance.value || (!!startingBalanceStr.value && !isNaN(parseFloat(startingBalanceStr.value)) && parseFloat(startingBalanceStr.value) > 0),
      message: 'Enter a positive amount',
    },
  ])
}

function handleSubmit() {
  if (!runValidation()) return

  emit('submit', {
    name: name.value.trim(),
    currencyLabel: currencyLabel.value.trim() || 'R',
    periodType: periodType.value,
    startDate: startDate.value,
    endDate: periodType.value === 'custom' && endDate.value ? endDate.value : null,
    startingBalance: hasStartingBalance.value ? parseFloat(startingBalanceStr.value) : null,
  })
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="handleSubmit">
    <!-- Budget name -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1" for="budget-name">
        Budget name
      </label>
      <input
        id="budget-name"
        v-model="name"
        type="text"
        class="input-field"
        placeholder="e.g. Wedding Budget, Q1 Marketing"
        autofocus
      />
      <p v-if="errors['name']" class="text-sm text-red-500 mt-1">{{ errors['name'] }}</p>
    </div>

    <!-- Currency label -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1" for="currency-label">
        Currency symbol
      </label>
      <input
        id="currency-label"
        v-model="currencyLabel"
        type="text"
        class="input-field w-20"
        placeholder="R"
        maxlength="5"
      />
      <p class="text-sm text-gray-400 mt-1">Display only — shown next to amounts</p>
    </div>

    <!-- Starting balance (cashflow tracking) -->
    <div>
      <div class="flex items-center gap-2 mb-2">
        <input
          id="has-starting-balance"
          v-model="hasStartingBalance"
          type="checkbox"
          class="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
        />
        <label class="text-sm font-medium text-gray-700" for="has-starting-balance">
          I know my current balance
        </label>
      </div>
      <div v-if="hasStartingBalance" class="ml-6">
        <label class="block text-sm text-gray-600 mb-1" for="starting-balance">
          Starting balance
        </label>
        <input
          id="starting-balance"
          v-model="startingBalanceStr"
          type="number"
          step="0.01"
          min="0.01"
          class="input-field"
          placeholder="0.00"
        />
        <p class="text-sm text-gray-400 mt-1">
          Your current account balance — we'll forecast from here
        </p>
        <p v-if="errors['balance']" class="text-sm text-red-500 mt-1">{{ errors['balance'] }}</p>
      </div>
    </div>

    <!-- Period type -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Budget period
      </label>
      <div class="flex gap-2">
        <button
          type="button"
          class="btn flex-1"
          :class="periodType === 'monthly'
            ? 'bg-brand-50 text-brand-700 border border-brand-300'
            : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'"
          @click="periodType = 'monthly'"
        >
          Monthly
        </button>
        <button
          type="button"
          class="btn flex-1"
          :class="periodType === 'custom'
            ? 'bg-brand-50 text-brand-700 border border-brand-300'
            : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'"
          @click="periodType = 'custom'"
        >
          Custom dates
        </button>
      </div>
    </div>

    <!-- Custom date range -->
    <div v-if="periodType === 'custom'" class="space-y-3">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1" for="start-date">
          Start date
        </label>
        <DateInput id="start-date" v-model="startDate" />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1" for="end-date">
          End date
        </label>
        <DateInput id="end-date" v-model="endDate" :min="startDate" />
      </div>
      <p v-if="errors['dates']" class="text-sm text-red-500">{{ errors['dates'] }}</p>
    </div>

    <!-- Actions -->
    <div class="flex gap-3 pt-2">
      <button type="submit" class="btn-primary flex-1">
        {{ isEditing ? 'Save changes' : 'Create budget' }}
      </button>
      <button type="button" class="btn-secondary" @click="emit('cancel')">
        Cancel
      </button>
    </div>
  </form>
</template>
