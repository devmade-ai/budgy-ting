import { describe, it, expect } from 'vitest'
import { formatStorageSize, reconcileRemoveRow } from './reviewHelpers'

describe('formatStorageSize', () => {
  it('formats bytes < 1 MB as KB with no decimals', () => {
    expect(formatStorageSize(0)).toBe('0 KB')
    expect(formatStorageSize(512)).toBe('1 KB') // rounds
    expect(formatStorageSize(1024)).toBe('1 KB')
    expect(formatStorageSize(1024 * 500)).toBe('500 KB')
    expect(formatStorageSize(1024 * 1024 - 1)).toBe('1024 KB')
  })

  it('formats bytes < 1 GB as MB with one decimal', () => {
    expect(formatStorageSize(1024 * 1024)).toBe('1.0 MB')
    expect(formatStorageSize(1024 * 1024 * 2.5)).toBe('2.5 MB')
    expect(formatStorageSize(1024 * 1024 * 1023)).toBe('1023.0 MB')
  })

  it('formats bytes >= 1 GB as GB with two decimals', () => {
    expect(formatStorageSize(1024 * 1024 * 1024)).toBe('1.00 GB')
    expect(formatStorageSize(1024 * 1024 * 1024 * 2.5)).toBe('2.50 GB')
    expect(formatStorageSize(1024 * 1024 * 1024 * 10)).toBe('10.00 GB')
  })
})

describe('reconcileRemoveRow', () => {
  it('clears tagInputIndex when the edited row is the one removed', () => {
    const r = reconcileRemoveRow({
      tagInputIndex: 3,
      currentPage: 1,
      totalPagesAfter: 2,
      removedIndex: 3,
    })
    expect(r.tagInputIndex).toBe(-1)
  })

  it('shifts tagInputIndex down when a row before it is removed', () => {
    const r = reconcileRemoveRow({
      tagInputIndex: 5,
      currentPage: 1,
      totalPagesAfter: 2,
      removedIndex: 2,
    })
    expect(r.tagInputIndex).toBe(4)
  })

  it('leaves tagInputIndex unchanged when a row after it is removed', () => {
    const r = reconcileRemoveRow({
      tagInputIndex: 1,
      currentPage: 1,
      totalPagesAfter: 2,
      removedIndex: 5,
    })
    expect(r.tagInputIndex).toBe(1)
  })

  it('treats -1 (no active tag input) as stable', () => {
    const r = reconcileRemoveRow({
      tagInputIndex: -1,
      currentPage: 1,
      totalPagesAfter: 2,
      removedIndex: 3,
    })
    expect(r.tagInputIndex).toBe(-1)
  })

  it('clamps currentPage when the last page is emptied by the splice', () => {
    const r = reconcileRemoveRow({
      tagInputIndex: -1,
      currentPage: 3,
      totalPagesAfter: 2,
      removedIndex: 10,
    })
    expect(r.currentPage).toBe(2)
  })

  it('does not clamp currentPage if it is still within bounds', () => {
    const r = reconcileRemoveRow({
      tagInputIndex: -1,
      currentPage: 2,
      totalPagesAfter: 3,
      removedIndex: 10,
    })
    expect(r.currentPage).toBe(2)
  })

  it('clamps to 1 when the list is empty after splice', () => {
    const r = reconcileRemoveRow({
      tagInputIndex: 0,
      currentPage: 1,
      totalPagesAfter: 0,
      removedIndex: 0,
    })
    expect(r.currentPage).toBe(1)
    expect(r.tagInputIndex).toBe(-1)
  })
})
