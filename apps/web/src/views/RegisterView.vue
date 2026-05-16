<template>
  <div class="register-view">
    <h1>Create Account</h1>
    <form @submit.prevent="handleSubmit">
      <div>
        <label>Name</label>
        <input v-model="name" type="text" required />
      </div>
      <div>
        <label>Email</label>
        <input v-model="email" type="email" required />
      </div>
      <div>
        <label>Password</label>
        <input v-model="password" type="password" required minlength="8" />
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="loading">
        {{ loading ? 'Creating...' : 'Register' }}
      </button>
    </form>
    <RouterLink to="/login">Already have an account?</RouterLink>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const name = ref('');
const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');
const authStore = useAuthStore();
const router = useRouter();

async function handleSubmit(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    await authStore.register(name.value, email.value, password.value);
    await router.push('/projects');
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Registration failed';
  } finally {
    loading.value = false;
  }
}
</script>
