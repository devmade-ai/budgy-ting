/**
 * Vue Router configuration.
 *
 * Routes:
 *   / — Workspace list (home)
 *   /workspace/new — Create workspace
 *   /workspace/:id — Workspace detail
 *   /workspace/:id/edit — Edit workspace
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
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      redirect: { name: 'workspace-list' },
    },
  ],
})

export default router
