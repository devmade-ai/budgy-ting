<script setup lang="ts">
/**
 * Requirement: Step 1 of import wizard — file upload with auto-detection
 * Approach: Extracted from ImportWizardView to reduce component size
 */

import { ref } from 'vue'
import { parseCSV, parseJSONImport } from '@/engine/csvParser'
import { DATE_FORMATS, detectDateFormat } from '@/engine/matching'
import type { ParsedCSV } from '@/engine/csvParser'

const emit = defineEmits<{
  complete: [data: {
    parsedData: ParsedCSV
    dateColumn: string
    amountColumn: string
    categoryColumn: string
    descriptionColumn: string
    dateFormatIndex: number
  }]
}>()

const parsedData = ref<ParsedCSV | null>(null)
const fileError = ref('')

// Column auto-detection results
const dateColumn = ref('')
const amountColumn = ref('')
const categoryColumn = ref('')
const descriptionColumn = ref('')
const dateFormatIndex = ref(0)

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  fileError.value = ''

  // 10MB cap per product definition security considerations
  if (file.size > 10 * 1024 * 1024) {
    fileError.value = 'File is too large (max 10 MB)'
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result as string
    if (!content) {
      fileError.value = 'Could not read file'
      return
    }

    const isJSON = file.name.endsWith('.json')
    parsedData.value = isJSON ? parseJSONImport(content) : parseCSV(content)

    if (parsedData.value.rows.length === 0) {
      fileError.value = parsedData.value.errors[0] || 'No data found in file'
      parsedData.value = null
      return
    }

    autoDetectColumns()
  }
  reader.onerror = () => {
    fileError.value = 'Failed to read file'
  }
  reader.readAsText(file)
}

function autoDetectColumns() {
  if (!parsedData.value) return
  const headers = parsedData.value.headers.map((h) => h.toLowerCase())

  const dateHints = ['date', 'transaction date', 'trans date', 'posting date']
  const dateIdx = headers.findIndex((h) => dateHints.some((hint) => h.includes(hint)))
  if (dateIdx >= 0) dateColumn.value = parsedData.value.headers[dateIdx]!

  const amountHints = ['amount', 'debit', 'value', 'total']
  const amountIdx = headers.findIndex((h) => amountHints.some((hint) => h.includes(hint)))
  if (amountIdx >= 0) amountColumn.value = parsedData.value.headers[amountIdx]!

  const catHints = ['category', 'type', 'group']
  const catIdx = headers.findIndex((h) => catHints.some((hint) => h.includes(hint)))
  if (catIdx >= 0) categoryColumn.value = parsedData.value.headers[catIdx]!

  const descHints = ['description', 'desc', 'memo', 'reference', 'narrative', 'details']
  const descIdx = headers.findIndex((h) => descHints.some((hint) => h.includes(hint)))
  if (descIdx >= 0) descriptionColumn.value = parsedData.value.headers[descIdx]!

  if (dateColumn.value) {
    const samples = parsedData.value.rows
      .slice(0, 10)
      .map((r) => r[dateColumn.value] ?? '')
      .filter(Boolean)
    const detected = detectDateFormat(samples)
    if (detected) {
      dateFormatIndex.value = DATE_FORMATS.indexOf(detected)
    }
  }
}

function handleContinue() {
  if (!parsedData.value) return
  emit('complete', {
    parsedData: parsedData.value,
    dateColumn: dateColumn.value,
    amountColumn: amountColumn.value,
    categoryColumn: categoryColumn.value,
    descriptionColumn: descriptionColumn.value,
    dateFormatIndex: dateFormatIndex.value,
  })
}
</script>

<template>
  <div>
    <h1 class="page-title mb-2">Import Actuals</h1>
    <p class="text-gray-500 text-sm mb-6">
      Upload a CSV or JSON file with your actual spending data
    </p>

    <label
      class="card flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-300 hover:border-brand-400 transition-colors cursor-pointer"
    >
      <div class="i-lucide-upload text-3xl text-gray-400 mb-3" />
      <p class="text-gray-600 font-medium">Choose a file</p>
      <p class="text-gray-400 text-sm mt-1">CSV or JSON, max 10 MB</p>
      <input
        type="file"
        accept=".csv,.json"
        class="hidden"
        @change="handleFileSelect"
      />
    </label>

    <p v-if="fileError" class="text-sm text-red-500 mt-3">{{ fileError }}</p>

    <!-- Preview -->
    <template v-if="parsedData">
      <div class="mt-6">
        <p class="text-sm text-gray-600 mb-2">
          {{ parsedData.totalRows }} rows detected with {{ parsedData.headers.length }} columns
        </p>
        <div class="overflow-x-auto">
          <table class="w-full text-xs border border-gray-200 rounded-lg">
            <thead>
              <tr class="bg-gray-50">
                <th
                  v-for="h in parsedData.headers"
                  :key="h"
                  class="text-left px-2 py-1.5 font-medium text-gray-600"
                >
                  {{ h }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, i) in parsedData.rows.slice(0, 5)"
                :key="i"
                class="border-t border-gray-100"
              >
                <td
                  v-for="h in parsedData.headers"
                  :key="h"
                  class="px-2 py-1.5 text-gray-700 truncate max-w-[150px]"
                >
                  {{ row[h] }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="parsedData.errors.length > 0" class="text-xs text-amber-600 mt-2">
          {{ parsedData.errors.length }} warning(s): {{ parsedData.errors[0] }}
        </p>
      </div>

      <button class="btn-primary mt-4" @click="handleContinue">
        Continue to mapping
      </button>
    </template>
  </div>
</template>
