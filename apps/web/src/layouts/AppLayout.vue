<template>
  <div class="layout">
    <nav>
      <RouterLink to="/projects">Projects</RouterLink>
      <RouterLink to="/agents">Agents</RouterLink>
      <button @click="handleLogout">Logout</button>
    </nav>
    <main>
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const authStore = useAuthStore();
const router = useRouter();

async function handleLogout(): Promise<void> {
  await authStore.logout();
  await router.push('/login');
}
</script>
