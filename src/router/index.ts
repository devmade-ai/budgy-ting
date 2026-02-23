/**
 * Vue Router configuration.
 *
 * Routes:
 *   / — Budget list (home)
 *   /budget/new — Create budget
 *   /budget/:id — Budget detail with nested tab views
 *   /budget/:id/edit — Edit budget
 *   /budget/:id/expenses/new — Add expense
 *   /budget/:id/expenses/:expenseId/edit — Edit expense
 *   /budget/:id/import — Import actuals wizard
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
      path: '/budget/new',
      name: 'budget-create',
      component: () => import('@/views/BudgetCreateView.vue'),
    },
    {
      path: '/budget/:id/edit',
      name: 'budget-edit',
      component: () => import('@/views/BudgetEditView.vue'),
      props: true,
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
    {
      path: '/budget/:id/expenses/new',
      name: 'expense-create',
      component: () => import('@/views/ExpenseCreateView.vue'),
      props: true,
    },
    {
      path: '/budget/:id/expenses/:expenseId/edit',
      name: 'expense-edit',
      component: () => import('@/views/ExpenseEditView.vue'),
      props: true,
    },
    {
      path: '/budget/:id/import',
      name: 'import-actuals',
      component: () => import('@/views/ImportWizardView.vue'),
      props: true,
    },
  ],
})

export default router
