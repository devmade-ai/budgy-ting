/**
 * Vue Router configuration.
 *
 * Routes:
 *   / — Budget list (home)
 *   /budget/:id — Budget detail with nested tab views
 */

import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'budget-list',
      component: () => import('@/views/BudgetListView.vue'),
    },
    {
      path: '/budget/:id',
      name: 'budget-detail',
      component: () => import('@/views/BudgetDetailView.vue'),
      props: true,
      children: [
        {
          path: '',
          redirect: (to) => ({ name: 'budget-expenses', params: to.params }),
        },
        {
          path: 'expenses',
          name: 'budget-expenses',
          component: () => import('@/views/ExpensesTab.vue'),
        },
        {
          path: 'projected',
          name: 'budget-projected',
          component: () => import('@/views/ProjectedTab.vue'),
        },
        {
          path: 'compare',
          name: 'budget-compare',
          component: () => import('@/views/CompareTab.vue'),
        },
      ],
    },
  ],
})

export default router
