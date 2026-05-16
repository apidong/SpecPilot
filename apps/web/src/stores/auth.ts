import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '../api/client.js';

interface AuthUser {
  id: number;
  name: string;
  email: string;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'));
  const user = ref<AuthUser | null>(null);

  const isAuthenticated = computed(() => !!token.value);

  async function login(email: string, password: string): Promise<void> {
    const data = await api.post<{ token: string; user: AuthUser }>(
      '/auth/login',
      { email, password },
    );
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem('token', data.token);
  }

  async function register(name: string, email: string, password: string): Promise<void> {
    await api.post('/auth/register', { name, email, password });
    await login(email, password);
  }

  async function logout(): Promise<void> {
    await api.post('/auth/logout').catch(() => {});
    token.value = null;
    user.value = null;
    localStorage.removeItem('token');
  }

  return { token, user, isAuthenticated, login, register, logout };
});
