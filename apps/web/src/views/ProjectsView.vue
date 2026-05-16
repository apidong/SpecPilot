<template>
  <div>
    <div class="header">
      <h1>Projects</h1>
      <button @click="showCreate = true">+ New Project</button>
    </div>

    <div v-if="loading">Loading...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else>
      <div v-for="project in projects" :key="project.id" class="project-card">
        <RouterLink :to="`/projects/${project.id}`">
          <h3>{{ project.name }}</h3>
          <p>{{ project.description }}</p>
        </RouterLink>
      </div>
      <p v-if="projects.length === 0">No projects yet.</p>
    </div>

    <dialog v-if="showCreate">
      <form @submit.prevent="handleCreate">
        <h2>New Project</h2>
        <input v-model="newName" placeholder="Project name" required />
        <input v-model="newDesc" placeholder="Description" />
        <input v-model="newRepo" placeholder="Repository URL" />
        <div>
          <button type="submit">Create</button>
          <button type="button" @click="showCreate = false">Cancel</button>
        </div>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { useProjectsStore } from '../stores/projects.js';
import { storeToRefs } from 'pinia';

const store = useProjectsStore();
const { projects, loading, error } = storeToRefs(store);
const showCreate = ref(false);
const newName = ref('');
const newDesc = ref('');
const newRepo = ref('');

onMounted(() => store.fetchProjects());

async function handleCreate(): Promise<void> {
  await store.createProject({
    name: newName.value,
    description: newDesc.value,
    repository_url: newRepo.value || undefined,
  });
  showCreate.value = false;
  newName.value = '';
  newDesc.value = '';
  newRepo.value = '';
}
</script>
