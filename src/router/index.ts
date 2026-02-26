/**
 * Vue Router configuration.
 *
 * Routes:
 *   / — Workspace list (home)
 *   /workspace/new — Create workspace
 *   /workspace/:id — Workspace detail with nested tab views
 *   /workspace/:id/edit — Edit workspace
 *   /workspace/:id/expenses/new — Add expense
 *   /workspace/:id/expenses/:expenseId/edit — Edit expense
 *   /workspace/:id/import — Import actuals wizard
 */

import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  // import.meta.env.BASE_URL comes from Vite's `base` config so routes
  // resolve correctly on GitHub Pages (e.g. /budgy-ting/…).
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'workspace-list',
      component: () => import('@/views/WorkspaceListView.vue'),
    },
    {
      path: '/workspace/new',
      name: 'workspace-create',
      component: () => import('@/views/WorkspaceCreateView.vue'),
    },
    {
      path: '/workspace/:id/edit',
      name: 'workspace-edit',
      component: () => import('@/views/WorkspaceEditView.vue'),
      props: true,
    },
    {
      path: '/workspace/:id',
      name: 'workspace-detail',
      component: () => import('@/views/WorkspaceDetailView.vue'),
      props: true,
      children: [
        {
          path: '',
          redirect: (to) => ({ name: 'workspace-expenses', params: to.params }),
        },
        {
          path: 'expenses',
          name: 'workspace-expenses',
          component: () => import('@/views/ExpensesTab.vue'),
        },
        {
          path: 'projected',
          name: 'workspace-projected',
          component: () => import('@/views/ProjectedTab.vue'),
        },
        {
          path: 'compare',
          name: 'workspace-compare',
          component: () => import('@/views/CompareTab.vue'),
        },
        {
          path: 'cashflow',
          name: 'workspace-cashflow',
          component: () => import('@/views/CashflowTab.vue'),
        },
      ],
    },
    {
      path: '/workspace/:id/expenses/new',
      name: 'expense-create',
      component: () => import('@/views/ExpenseCreateView.vue'),
      props: true,
    },
    {
      path: '/workspace/:id/expenses/:expenseId/edit',
      name: 'expense-edit',
      component: () => import('@/views/ExpenseEditView.vue'),
      props: true,
    },
    {
      path: '/workspace/:id/import',
      name: 'import-actuals',
      component: () => import('@/views/ImportWizardView.vue'),
      props: true,
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      redirect: { name: 'workspace-list' },
    },
  ],
})

export default router
