/**
 * Unit tests for isTransactionDirty — the pure helper behind the
 * unsaved-changes guard in TransactionEditModal.
 */
import { describe, it, expect } from 'vitest'
import { isTransactionDirty, type TransactionEditLocal } from './transactionDirty'
import type { Transaction } from '@/types/models'

function baseTransaction(overrides: Partial<Transaction> = {}): Transaction {
  const defaults: Transaction = {
    id: 'txn-1',
    workspaceId: 'ws-1',
    date: '2026-03-15',
    amount: -45.50, // expense
    description: 'Pick n Pay',
    tags: ['groceries'],
    source: 'import',
    classification: 'once-off',
    recurringGroupId: null,
    originalRow: null,
    importBatchId: null,
    createdAt: '2026-03-15T00:00:00Z',
    updatedAt: '2026-03-15T00:00:00Z',
  }
  return { ...defaults, ...overrides }
}

function mirroringLocal(txn: Transaction): TransactionEditLocal {
  // Mirror the form state of a loaded transaction — abs amount + isIncome flag
  return {
    description: txn.description,
    date: txn.date,
    amount: Math.abs(txn.amount),
    isIncome: txn.amount >= 0,
    classification: txn.classification,
    tags: [...txn.tags],
  }
}

describe('isTransactionDirty', () => {
  it('returns false when local mirrors the original', () => {
    const txn = baseTransaction()
    expect(isTransactionDirty(txn, mirroringLocal(txn))).toBe(false)
  })

  it('flags changed description', () => {
    const txn = baseTransaction()
    const local = mirroringLocal(txn)
    local.description = 'Checkers'
    expect(isTransactionDirty(txn, local)).toBe(true)
  })

  it('flags changed date', () => {
    const txn = baseTransaction()
    const local = mirroringLocal(txn)
    local.date = '2026-03-16'
    expect(isTransactionDirty(txn, local)).toBe(true)
  })

  it('flags changed amount magnitude', () => {
    const txn = baseTransaction()
    const local = mirroringLocal(txn)
    local.amount = 60
    expect(isTransactionDirty(txn, local)).toBe(true)
  })

  it('flags direction flip (expense → income) even with same magnitude', () => {
    const txn = baseTransaction({ amount: -45.50 })
    const local = mirroringLocal(txn)
    local.isIncome = true // magnitude unchanged, direction flipped
    expect(isTransactionDirty(txn, local)).toBe(true)
  })

  it('does not flag zero-amount ambiguity (zero is zero in either direction)', () => {
    // amount 0 signed either way is still 0
    const txn = baseTransaction({ amount: 0 })
    const local = mirroringLocal(txn)
    local.isIncome = !local.isIncome
    expect(isTransactionDirty(txn, local)).toBe(false)
  })

  it('flags changed classification', () => {
    const txn = baseTransaction({ classification: 'once-off' })
    const local = mirroringLocal(txn)
    local.classification = 'recurring'
    expect(isTransactionDirty(txn, local)).toBe(true)
  })

  it('flags added tag', () => {
    const txn = baseTransaction({ tags: ['groceries'] })
    const local = mirroringLocal(txn)
    local.tags = ['groceries', 'food']
    expect(isTransactionDirty(txn, local)).toBe(true)
  })

  it('flags removed tag', () => {
    const txn = baseTransaction({ tags: ['groceries', 'food'] })
    const local = mirroringLocal(txn)
    local.tags = ['groceries']
    expect(isTransactionDirty(txn, local)).toBe(true)
  })

  it('flags reordered tags', () => {
    // Tag order matters for the user's mental model — a deliberate reorder
    // should count as a change that warrants the unsaved-changes prompt.
    const txn = baseTransaction({ tags: ['a', 'b'] })
    const local = mirroringLocal(txn)
    local.tags = ['b', 'a']
    expect(isTransactionDirty(txn, local)).toBe(true)
  })

  it('not dirty when local is a fresh copy of original tags (different array identity)', () => {
    const txn = baseTransaction({ tags: ['groceries', 'monthly'] })
    const local = mirroringLocal(txn) // mirroringLocal spreads — new array, same contents
    expect(isTransactionDirty(txn, local)).toBe(false)
  })

  it('handles income amount (positive original) without treating it as dirty', () => {
    const txn = baseTransaction({ amount: 2500 })
    const local = mirroringLocal(txn)
    expect(isTransactionDirty(txn, local)).toBe(false)
  })
})
