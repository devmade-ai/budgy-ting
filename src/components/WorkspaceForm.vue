<script setup lang="ts">
/**
 * Requirement: Create/edit workspace form with name, currency, period type, dates
 * Approach: Single form component reused for create and edit via optional workspace prop
 * Alternatives:
 *   - Separate create/edit components: Rejected — too much duplication
 *   - Modal form: Rejected — full page form is simpler on mobile
 */

import { ref, computed, nextTick } from 'vue'
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

// Period-type radiogroup: arrow keys toggle selection and move focus to the
// newly selected radio (WAI-ARIA radiogroup pattern).
const periodMonthlyBtn = ref<HTMLButtonElement | null>(null)
const periodCustomBtn = ref<HTMLButtonElement | null>(null)
async function selectPeriod(value: PeriodType) {
  periodType.value = value
  await nextTick()
  if (value === 'monthly') periodMonthlyBtn.value?.focus()
  else periodCustomBtn.value?.focus()
}

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
      <label class="block text-sm font-medium text-base-content/80 mb-1" for="workspace-name">
        Workspace name
      </label>
      <input
        id="workspace-name"
        v-model="name"
        type="text"
        class="input input-bordered w-full text-base min-h-[44px]"
        placeholder="e.g. Household, Side Hustle, Wedding"
        autofocus
      />
      <p v-if="errors['name']" class="text-sm text-error mt-1">{{ errors['name'] }}</p>
    </div>

    <!-- Currency label -->
    <div>
      <label class="block text-sm font-medium text-base-content/80 mb-1" for="currency-label">
        Currency symbol
      </label>
      <input
        id="currency-label"
        v-model="currencyLabel"
        type="text"
        class="input input-bordered w-20 text-base min-h-[44px]"
        placeholder="R"
        maxlength="5"
      />
      <p class="text-sm text-base-content/60 mt-1">Display only — shown next to amounts</p>
    </div>

    <!-- Period type — ARIA radiogroup with arrow-key navigation.
         Requirement: Keyboard users need arrow keys between options, and AT
         should announce the group as a radio group with selection state.
         Approach: role="radiogroup" on wrapper; each button gets role="radio"
         + aria-checked; left/right arrow keys shift selection. Only the
         selected option is in the tab order (roving tabindex).
         Alternatives:
           - Native <input type="radio">: Rejected — button styling via DaisyUI
             join/btn-active is easier than styling native radios cross-browser. -->
    <div>
      <p id="period-label" class="block text-sm font-medium text-base-content/80 mb-2">
        Period
      </p>
      <div
        role="radiogroup"
        aria-labelledby="period-label"
        class="join w-full"
        @keydown.left.prevent="selectPeriod('monthly')"
        @keydown.right.prevent="selectPeriod('custom')"
        @keydown.up.prevent="selectPeriod('monthly')"
        @keydown.down.prevent="selectPeriod('custom')"
      >
        <button
          ref="periodMonthlyBtn"
          type="button"
          role="radio"
          :aria-checked="periodType === 'monthly'"
          :tabindex="periodType === 'monthly' ? 0 : -1"
          class="join-item btn flex-1"
          :class="periodType === 'monthly' ? 'btn-active' : ''"
          @click="selectPeriod('monthly')"
        >
          Monthly
        </button>
        <button
          ref="periodCustomBtn"
          type="button"
          role="radio"
          :aria-checked="periodType === 'custom'"
          :tabindex="periodType === 'custom' ? 0 : -1"
          class="join-item btn flex-1"
          :class="periodType === 'custom' ? 'btn-active' : ''"
          @click="selectPeriod('custom')"
        >
          Custom dates
        </button>
      </div>
    </div>

    <!-- Custom date range -->
    <div v-if="periodType === 'custom'" class="space-y-3">
      <div>
        <label class="block text-sm font-medium text-base-content/80 mb-1" for="start-date">
          Start date
        </label>
        <DateInput id="start-date" v-model="startDate" />
      </div>
      <div>
        <label class="block text-sm font-medium text-base-content/80 mb-1" for="end-date">
          End date
        </label>
        <DateInput id="end-date" v-model="endDate" :min="startDate" />
      </div>
      <p v-if="errors['dates']" class="text-sm text-error">{{ errors['dates'] }}</p>
    </div>

    <!-- Actions -->
    <div class="flex gap-3 pt-2">
      <button type="submit" class="btn btn-primary flex-1">
        {{ isEditing ? 'Save changes' : 'Create workspace' }}
      </button>
      <button type="button" class="btn btn-ghost" @click="emit('cancel')">
        Cancel
      </button>
    </div>
  </form>
</template>
