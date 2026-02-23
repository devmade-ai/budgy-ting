<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { db } from '@/db'
import type { Budget } from '@/types/models'

const props = defineProps<{ id: string }>()
const route = useRoute()
const router = useRouter()

const budget = ref<Budget | null>(null)
const loading = ref(true)

onMounted(async () => {
  const found = await db.budgets.get(props.id)
  if (!found) {
    router.replace({ name: 'budget-list' })
    return
  }
  budget.value = found
  loading.value = false
})

const tabs = [
  { name: 'budget-expenses', label: 'Expenses', icon: 'i-lucide-list' },
  { name: 'budget-projected', label: 'Projected', icon: 'i-lucide-trending-up' },
  { name: 'budget-compare', label: 'Compare', icon: 'i-lucide-bar-chart-3' },
] as const

const activeTab = computed(() => route.name as string)
</script>

<template>
  <div v-if="loading" class="text-center py-12 text-gray-400">
    Loading...
  </div>

  <div v-else-if="budget">
    <!-- Budget header -->
    <div class="mb-6">
      <button
        class="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
        @click="router.push({ name: 'budget-list' })"
      >
        <span class="i-lucide-arrow-left" />
        Budgets
      </button>
      <div class="flex items-center justify-between">
        <div>
          <h1 class="page-title">{{ budget.name }}</h1>
          <p class="text-sm text-gray-500 mt-0.5">
            {{ budget.periodType === 'monthly' ? 'Monthly' : 'Custom period' }}
            <span v-if="budget.currencyLabel"> &middot; {{ budget.currencyLabel }}</span>
          </p>
        </div>
      </div>
    </div>

    <!-- Tab navigation -->
    <nav class="flex border-b border-gray-200 mb-6">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.name"
        :to="{ name: tab.name, params: { id: budget.id } }"
        class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
        :class="
          activeTab === tab.name
            ? 'border-brand-500 text-brand-600'
            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        "
      >
        <span :class="tab.icon" class="mr-1.5" />
        {{ tab.label }}
      </RouterLink>
    </nav>

    <!-- Tab content -->
    <RouterView :budget="budget" />
  </div>
</template>
