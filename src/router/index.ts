/**
 * Vue Router configuration.
 *
 * Requirement: Actuals-first single-screen workspace view replaces old 3-tab layout.
 * Approach: workspace-detail renders WorkspaceDetailView which embeds WorkspaceDashboard
 *   directly (no nested tab children). Import wizard is a separate route.
 * Alternatives:
 *   - Keep old tab children: Rejected — old tabs query dropped DB tables
 *   - Nested route for dashboard: Rejected — single-screen view doesn't need nesting
 *
 * Routes:
 *   / — Workspace list (home)
 *   /workspace/new — Create workspace
 *   /workspace/:id — Workspace detail (single-screen dashboard)
 *   /workspace/:id/edit — Edit workspace
 *   /workspace/:id/import — Import actuals wizard (3-step)
 */

import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
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
    },
    {
      path: '/workspace/:id/import',
      name: 'import-actuals',
      component: () => import('@/views/NewImportWizard.vue'),
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
