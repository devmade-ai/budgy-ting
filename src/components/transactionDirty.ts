/**
 * Pure helper for "has this transaction edit form diverged from the original?".
 * Extracted from TransactionEditModal.vue so it can be unit-tested without
 * mounting the component.
 *
 * The amount field is stored in the form as an absolute value plus an
 * isIncome flag; the helper reconstructs the signed amount for comparison
 * against the persisted `original.amount` (where + = income, - = expense).
 */

import type { Transaction, TransactionClassification } from '@/types/models'

export interface TransactionEditLocal {
  description: string
  date: string
  amount: number
  isIncome: boolean
  classification: TransactionClassification
  tags: string[]
}

export function isTransactionDirty(
  original: Transaction,
  local: TransactionEditLocal,
): boolean {
  if (local.description !== original.description) return true
  if (local.date !== original.date) return true
  if (local.classification !== original.classification) return true
  const signed = local.isIncome ? Math.abs(local.amount) : -Math.abs(local.amount)
  if (signed !== original.amount) return true
  if (local.tags.length !== original.tags.length) return true
  for (let i = 0; i < local.tags.length; i++) {
    if (local.tags[i] !== original.tags[i]) return true
  }
  return false
}
