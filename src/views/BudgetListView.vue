<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '@/db'
import type { Budget } from '@/types/models'

const router = useRouter()
const budgets = ref<Budget[]>([])
const loading = ref(true)

onMounted(async () => {
  budgets.value = await db.budgets.orderBy('createdAt').reverse().toArray()
  loading.value = false
})

function openBudget(id: string) {
  router.push({ name: 'budget-detail', params: { id } })
}

function createBudget() {
  // Phase 1: will navigate to create form
  router.push({ name: 'budget-list' })
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="page-title">Budgets</h1>
      <button class="btn-primary" @click="createBudget">
        <span class="i-lucide-plus mr-1" />
        New Budget
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="text-center py-12 text-gray-400">
      Loading...
    </div>

    <!-- Empty state -->
    <div
      v-else-if="budgets.length === 0"
      class="text-center py-16"
    >
      <div class="i-lucide-wallet text-5xl text-gray-300 mx-auto mb-4" />
      <p class="text-gray-500 text-lg mb-2">No budgets yet</p>
      <p class="text-gray-400 text-sm mb-6">
        Create your first budget to start tracking expenses
      </p>
      <button class="btn-primary" @click="createBudget">
        Create your first budget
      </button>
    </div>

    <!-- Budget list -->
    <div v-else class="space-y-3">
      <button
        v-for="budget in budgets"
        :key="budget.id"
        class="card w-full text-left hover:border-brand-300 transition-colors cursor-pointer"
        @click="openBudget(budget.id)"
      >
        <div class="flex items-center justify-between">
          <div>
            <h2 class="font-semibold text-gray-900">{{ budget.name }}</h2>
            <p class="text-sm text-gray-500 mt-0.5">
              {{ budget.periodType === 'monthly' ? 'Monthly' : 'Custom period' }}
              <span v-if="budget.currencyLabel" class="ml-1">
                &middot; {{ budget.currencyLabel }}
              </span>
            </p>
          </div>
          <span class="i-lucide-chevron-right text-gray-400" />
        </div>
      </button>
    </div>
  </div>
</template>
