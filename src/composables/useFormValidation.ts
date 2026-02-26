/**
 * Requirement: Shared form validation logic for BudgetForm and ExpenseForm
 * Approach: Provides reactive errors map, common validation rules, and a validate() runner.
 *   Each form defines its own rules array; the composable runs them and populates errors.
 * Alternatives:
 *   - Inline validation per-form: Previous approach — led to duplicated required/date/amount checks
 *   - Third-party library (vee-validate, vuelidate): Rejected — overkill for 2 forms with simple rules
 */

import { ref, watch, type Ref } from 'vue'

export type ValidationRule = {
  field: string
  check: () => boolean
  message: string
}

/**
 * Reactive form validation composable.
 *
 * @param watchTargets - Reactive values that clear errors when changed
 * @returns errors ref + validate function
 */
export function useFormValidation(watchTargets: Ref[]) {
  const errors = ref<Record<string, string>>({})

  // Clear all errors whenever any watched field changes
  watch(watchTargets, () => {
    errors.value = {}
  })

  function validate(rules: ValidationRule[]): boolean {
    const e: Record<string, string> = {}
    for (const rule of rules) {
      if (!rule.check()) {
        // Only set first error per field
        if (!e[rule.field]) {
          e[rule.field] = rule.message
        }
      }
    }
    errors.value = e
    return Object.keys(e).length === 0
  }

  return { errors, validate }
}

// Common validation rule factories

export function required(field: string, value: Ref<string>, message = `${field} is required`): ValidationRule {
  return { field, check: () => value.value.trim().length > 0, message }
}

export function positiveNumber(field: string, value: Ref<string>, message = 'Enter a positive amount'): ValidationRule {
  return {
    field,
    check: () => {
      const n = parseFloat(value.value)
      return !isNaN(n) && n > 0
    },
    message,
  }
}

export function dateAfter(
  field: string,
  startDate: Ref<string>,
  endDate: Ref<string>,
  message = 'End date must be after start date',
): ValidationRule {
  return {
    field,
    check: () => !endDate.value || !startDate.value || endDate.value >= startDate.value,
    message,
  }
}
