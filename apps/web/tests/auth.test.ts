import { describe, it, expect } from 'vitest';
import { useAuthStore } from '../src/stores/auth.js';
import { setActivePinia, createPinia } from 'pinia';

describe('Auth Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('isAuthenticated is false when no token', () => {
    const store = useAuthStore();
    expect(store.isAuthenticated).toBe(false);
  });

  it('isAuthenticated is true when token exists in localStorage', () => {
    localStorage.setItem('token', 'mock-jwt-token');
    const store = useAuthStore();
    expect(store.isAuthenticated).toBe(true);
  });
});
