<script setup lang="ts">
/**
 * Requirement: Step 2 of import wizard — column mapping with validation
 * Approach: Extracted from ImportWizardView to reduce component size
 */

import { ref, computed } from 'vue'
import {
  DATE_FORMATS,
  parseDate,
  parseAmount,
  matchImportedRows,
} from '@/engine/matching'
import type { ParsedCSV } from '@/engine/csvParser'
import type { Expense } from '@/types/models'
import type { ImportedRow, MatchResult } from '@/engine/matching'

const props = defineProps<{
  parsedData: ParsedCSV
  initialDateColumn: string
  initialAmountColumn: string
  initialCategoryColumn: string
  initialDescriptionColumn: string
  initialDateFormatIndex: number
  expenses: Expense[]
}>()

const emit = defineEmits<{
  complete: [data: { matchResults: MatchResult[]; skippedRows: number }]
  back: []
}>()

const dateColumn = ref(props.initialDateColumn)
const amountColumn = ref(props.initialAmountColumn)
const categoryColumn = ref(props.initialCategoryColumn)
const descriptionColumn = ref(props.initialDescriptionColumn)
const dateFormatIndex = ref(props.initialDateFormatIndex)
const mappingErrors = ref<string[]>([])

const previewRows = computed(() => {
  return props.parsedData.rows.slice(0, 5)
})

function validateMapping(): boolean {
  const errs: string[] = []

  if (!dateColumn.value) errs.push('Date column is required')
  if (!amountColumn.value) errs.push('Amount column is required')
  if (!categoryColumn.value && !descriptionColumn.value) {
    errs.push('At least one of Category or Description is required')
  }

  if (dateColumn.value && amountColumn.value) {
    let dateErrors = 0
    let amountErrors = 0
    for (const row of props.parsedData.rows.slice(0, 20)) {
      const dateVal = row[dateColumn.value] ?? ''
      if (dateVal && parseDate(dateVal, dateFormatIndex.value) === null) dateErrors++

      const amountVal = row[amountColumn.value] ?? ''
      if (amountVal && parseAmount(amountVal) === null) amountErrors++
    }

    if (dateErrors > 5) errs.push(`Many dates couldn't be parsed — check the date format`)
    if (amountErrors > 5) errs.push(`Many amounts couldn't be parsed — check the amount column`)
  }

  mappingErrors.value = errs
  return errs.length === 0
}

function handleSubmit() {
  if (!validateMapping()) return

  const importedRows: ImportedRow[] = []
  let skipped = 0

  for (const row of props.parsedData.rows) {
    const dateStr = row[dateColumn.value] ?? ''
    const amountStr = row[amountColumn.value] ?? ''

    const parsedDateVal = parseDate(dateStr, dateFormatIndex.value)
    const parsedAmountVal = parseAmount(amountStr)

    if (!parsedDateVal || parsedAmountVal === null) {
      skipped++
      continue
    }

    importedRows.push({
      date: parsedDateVal,
      amount: Math.abs(parsedAmountVal),
      category: categoryColumn.value ? (row[categoryColumn.value] ?? '') : '',
      description: descriptionColumn.value ? (row[descriptionColumn.value] ?? '') : '',
      originalRow: row,
    })
  }

  const matchResults = matchImportedRows(importedRows, props.expenses)
  emit('complete', { matchResults, skippedRows: skipped })
}
</script>

<template>
  <div>
    <h1 class="page-title mb-2">Map Columns</h1>
    <p class="text-gray-500 text-sm mb-6">
      Tell us which columns contain the date, amount, and category/description
    </p>

    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Date column <span class="text-red-500">*</span>
        </label>
        <select v-model="dateColumn" class="input-field">
          <option value="">Select column...</option>
          <option v-for="h in parsedData.headers" :key="h" :value="h">{{ h }}</option>
        </select>
      </div>

      <div v-if="dateColumn">
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Date format
        </label>
        <select v-model.number="dateFormatIndex" class="input-field">
          <option v-for="(fmt, i) in DATE_FORMATS" :key="i" :value="i">
            {{ fmt.label }}
          </option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Amount column <span class="text-red-500">*</span>
        </label>
        <select v-model="amountColumn" class="input-field">
          <option value="">Select column...</option>
          <option v-for="h in parsedData.headers" :key="h" :value="h">{{ h }}</option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Category column
        </label>
        <select v-model="categoryColumn" class="input-field">
          <option value="">None</option>
          <option v-for="h in parsedData.headers" :key="h" :value="h">{{ h }}</option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Description column
        </label>
        <select v-model="descriptionColumn" class="input-field">
          <option value="">None</option>
          <option v-for="h in parsedData.headers" :key="h" :value="h">{{ h }}</option>
        </select>
      </div>
    </div>

    <!-- Mapping errors -->
    <div v-if="mappingErrors.length > 0" class="mt-4 p-3 bg-red-50 rounded-lg">
      <p
        v-for="(err, i) in mappingErrors"
        :key="i"
        class="text-sm text-red-600"
      >
        {{ err }}
      </p>
    </div>

    <!-- Preview mapped data -->
    <div v-if="previewRows.length > 0 && dateColumn && amountColumn" class="mt-6">
      <p class="text-sm font-medium text-gray-700 mb-2">Preview (first 5 rows mapped)</p>
      <div class="overflow-x-auto">
        <table class="w-full text-xs border border-gray-200 rounded-lg">
          <thead>
            <tr class="bg-gray-50">
              <th class="text-left px-2 py-1.5 font-medium text-gray-600">Date</th>
              <th class="text-right px-2 py-1.5 font-medium text-gray-600">Amount</th>
              <th v-if="categoryColumn" class="text-left px-2 py-1.5 font-medium text-gray-600">Category</th>
              <th v-if="descriptionColumn" class="text-left px-2 py-1.5 font-medium text-gray-600">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, i) in previewRows"
              :key="i"
              class="border-t border-gray-100"
            >
              <td class="px-2 py-1.5 text-gray-700">{{ row[dateColumn] }}</td>
              <td class="px-2 py-1.5 text-gray-700 text-right">{{ row[amountColumn] }}</td>
              <td v-if="categoryColumn" class="px-2 py-1.5 text-gray-700">{{ row[categoryColumn] }}</td>
              <td v-if="descriptionColumn" class="px-2 py-1.5 text-gray-700 truncate max-w-[200px]">{{ row[descriptionColumn] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="flex gap-3 mt-6">
      <button class="btn-primary" @click="handleSubmit">
        Run matching
      </button>
      <button class="btn-secondary" @click="emit('back')">
        Back
      </button>
    </div>
  </div>
</template>
