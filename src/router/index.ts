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
 *   /workspace/:id/import — Import actuals wizard (2-step)
 */

import { createRouter, createWebHistory } from 'vue-router'
import type { Component } from 'vue'

// Requirement: Prevent ChunkLoadError when deploying new versions.
// Approach: Wrap lazy imports with a retry that reloads once on 404. During the window
//   between deploy (old chunks deleted) and SW update (new precache), lazy-loaded routes
//   can 404. The SW precache covers most cases, but first-time visitors or users without
//   an active SW hit this window.
// Alternatives:
//   - Keep old build artifacts: Rejected — complicates deploy pipeline, GitHub Pages auto-cleans
//   - No protection: Rejected — 404 on navigation is a hard crash with no recovery
// Reference: glow-props docs/implementations/PWA_SYSTEM.md (ChunkLoadError Prevention)
const RETRY_KEY = 'farlume:chunk-retry-refreshed'

function lazyRetry(importFn: () => Promise<{ default: Component }>): () => Promise<{ default: Component }> {
  return () =>
    new Promise((resolve, reject) => {
      const hasRefreshed = sessionStorage.getItem(RETRY_KEY) === 'true'
      importFn()
        .then((module) => {
          // Success — clear retry flag so future failures can retry again
          sessionStorage.removeItem(RETRY_KEY)
          resolve(module)
        })
        .catch((error: unknown) => {
          if (!hasRefreshed) {
            sessionStorage.setItem(RETRY_KEY, 'true')
            window.location.reload()
          } else {
            reject(error)
          }
        })
    })
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'workspace-list',
      component: lazyRetry(() => import('@/views/WorkspaceListView.vue')),
    },
    {
      path: '/workspace/new',
      name: 'workspace-create',
      component: lazyRetry(() => import('@/views/WorkspaceCreateView.vue')),
    },
    {
      path: '/workspace/:id/edit',
      name: 'workspace-edit',
      component: lazyRetry(() => import('@/views/WorkspaceEditView.vue')),
      props: true,
    },
    {
      path: '/workspace/:id',
      name: 'workspace-detail',
      component: lazyRetry(() => import('@/views/WorkspaceDetailView.vue')),
      props: true,
    },
    {
      path: '/workspace/:id/import',
      name: 'import-actuals',
      component: lazyRetry(() => import('@/views/NewImportWizard.vue')),
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
