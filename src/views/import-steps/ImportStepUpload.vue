<script setup lang="ts">
/**
 * Requirement: Step 1 of import wizard — file upload with auto-detection
 * Approach: Extracted from ImportWizardView to reduce component size
 */

import { ref, onUnmounted } from 'vue'
import { Upload, File } from 'lucide-vue-next'
import { parseCSV, parseJSONImport } from '@/engine/csvParser'
import { DATE_FORMATS, detectDateFormat } from '@/engine/matching'
import type { ParsedCSV } from '@/engine/csvParser'

const emit = defineEmits<{
  complete: [data: {
    parsedData: ParsedCSV
    dateColumn: string
    amountColumn: string
    descriptionColumn: string
    dateFormatIndex: number
  }]
}>()

const parsedData = ref<ParsedCSV | null>(null)
const fileError = ref('')
const selectedFile = ref<{ name: string; size: string } | null>(null)
const parsing = ref(false)
let activeReader: FileReader | null = null

// Abort FileReader if component unmounts mid-parse (prevents stale state updates)
onUnmounted(() => {
  if (activeReader) {
    activeReader.abort()
    activeReader = null
  }
})

// Column auto-detection results
const dateColumn = ref('')
const amountColumn = ref('')
const descriptionColumn = ref('')
const dateFormatIndex = ref(0)

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  fileError.value = ''

  // Show file info immediately before parsing
  const sizeKB = (file.size / 1024).toFixed(1)
  const sizeLabel = file.size > 1024 * 1024
    ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
    : `${sizeKB} KB`
  selectedFile.value = { name: file.name, size: sizeLabel }

  // 10MB cap per product definition security considerations
  if (file.size > 10 * 1024 * 1024) {
    fileError.value = 'File is too large (max 10 MB)'
    return
  }

  parsing.value = true
  const reader = new FileReader()
  activeReader = reader
  reader.onload = (e) => {
    activeReader = null
    parsing.value = false
    const content = e.target?.result as string
    if (!content) {
      fileError.value = 'Could not read file'
      return
    }

    const isJSON = file.name.endsWith('.json')
    parsedData.value = isJSON ? parseJSONImport(content) : parseCSV(content)

    if (parsedData.value.rows.length === 0) {
      if (parsedData.value.headers.length === 0) {
        fileError.value = 'The file appears to be empty. Check that it contains data rows.'
      } else {
        fileError.value = parsedData.value.errors[0]
          || `Found ${parsedData.value.headers.length} column headers but no data rows. Check that the file has data below the header row.`
      }
      parsedData.value = null
      return
    }

    autoDetectColumns()
  }
  reader.onerror = () => {
    activeReader = null
    parsing.value = false
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
      <Upload :size="28" class="text-gray-400 mb-3" />
      <p class="text-gray-600 font-medium">Choose a file</p>
      <p class="text-gray-400 text-sm mt-1">CSV or JSON, max 10 MB</p>
      <input
        type="file"
        accept=".csv,.json"
        class="hidden"
        @change="handleFileSelect"
      />
    </label>

    <!-- File info — shown immediately after selection, before parsing completes -->
    <div v-if="selectedFile && !parsedData" class="mt-4 flex items-center gap-3 text-sm text-gray-600">
      <File :size="18" class="text-gray-400" />
      <div>
        <p class="font-medium">{{ selectedFile.name }}</p>
        <p class="text-xs text-gray-400">{{ selectedFile.size }}</p>
      </div>
      <span v-if="parsing" class="text-xs text-gray-400 ml-auto">Parsing...</span>
    </div>

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

      <!-- Date format override — lets user correct auto-detection if needed
           Requirement: User must be able to fix DD/MM vs MM/DD ambiguity
           Approach: Dropdown showing detected format with option to change -->
      <div class="mt-4 flex items-center gap-3">
        <label class="text-sm text-gray-600">Date format:</label>
        <select
          v-model.number="dateFormatIndex"
          class="input-field w-auto min-h-[44px]"
        >
          <option
            v-for="(fmt, i) in DATE_FORMATS"
            :key="i"
            :value="i"
          >
            {{ fmt.label }}
          </option>
        </select>
      </div>

      <button class="btn-primary mt-4" @click="handleContinue">
        Continue to classify
      </button>
    </template>
  </div>
</template>
