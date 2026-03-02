<script setup lang="ts">
/**
 * Requirement: Create/edit workspace form with name, currency, period type, dates
 * Approach: Single form component reused for create and edit via optional workspace prop
 * Alternatives:
 *   - Separate create/edit components: Rejected — too much duplication
 *   - Modal form: Rejected — full page form is simpler on mobile
 */

import { ref, computed } from 'vue'
import type { Workspace, PeriodType } from '@/types/models'
import { todayISO } from '@/composables/useTimestamp'
import { useFormValidation, required, dateAfter } from '@/composables/useFormValidation'
import DateInput from '@/components/DateInput.vue'

const props = defineProps<{
  workspace?: Workspace
}>()

const emit = defineEmits<{
  submit: [data: {
    name: string
    currencyLabel: string
    periodType: PeriodType
    startDate: string
    endDate: string | null
  }]
  cancel: []
}>()

const name = ref(props.workspace?.name ?? '')
const currencyLabel = ref(props.workspace?.currencyLabel ?? 'R')
const periodType = ref<PeriodType>(props.workspace?.periodType ?? 'monthly')
const startDate = ref(props.workspace?.startDate ?? todayISO())
const endDate = ref(props.workspace?.endDate ?? '')

const isEditing = computed(() => !!props.workspace)

const { errors, validate } = useFormValidation([name, startDate, endDate])

function runValidation(): boolean {
  return validate([
    required('name', name, 'Workspace name is required'),
    {
      field: 'dates',
      check: () => periodType.value !== 'custom' || !!startDate.value,
      message: 'Start date is required',
    },
    dateAfter('dates', startDate, endDate),
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
  })
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="handleSubmit">
    <!-- Workspace name -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-1" for="workspace-name">
        Workspace name
      </label>
      <input
        id="workspace-name"
        v-model="name"
        type="text"
        class="input-field"
        placeholder="e.g. Household, Side Hustle, Wedding"
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

    <!-- Period type -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Period
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
        {{ isEditing ? 'Save changes' : 'Create workspace' }}
      </button>
      <button type="button" class="btn-secondary" @click="emit('cancel')">
        Cancel
      </button>
    </div>
  </form>
</template>
