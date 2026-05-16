import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      component: () => import('../views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/register',
      component: () => import('../views/RegisterView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('../layouts/AppLayout.vue'),
      children: [
        {
          path: '',
          redirect: '/projects',
        },
        {
          path: 'projects',
          component: () => import('../views/ProjectsView.vue'),
        },
        {
          path: 'projects/:id',
          component: () => import('../views/ProjectDetailView.vue'),
        },
        {
          path: 'projects/:projectId/specs/:specId',
          component: () => import('../views/SpecDetailView.vue'),
        },
        {
          path: 'projects/:projectId/tickets/:ticketId',
          component: () => import('../views/TicketDetailView.vue'),
        },
        {
          path: 'executions/:id',
          component: () => import('../views/ExecutionView.vue'),
        },
        {
          path: 'agents',
          component: () => import('../views/AgentsView.vue'),
        },
      ],
    },
  ],
});

// Navigation guard
router.beforeEach((to) => {
  const authStore = useAuthStore();
  if (!to.meta.public && !authStore.isAuthenticated) {
    return { path: '/login' };
  }
  if (to.meta.public && authStore.isAuthenticated && (to.path === '/login' || to.path === '/register')) {
    return { path: '/projects' };
  }
});
