<script setup lang="ts">
import AppLayout from '@/components/AppLayout.vue'
import ErrorBoundary from '@/components/ErrorBoundary.vue'
</script>

<template>
  <AppLayout>
    <ErrorBoundary>
      <RouterView />
    </ErrorBoundary>
  </AppLayout>
</template>
