import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../api/client.js';

export interface Project {
  id: number;
  name: string;
  description?: string;
  repository_url?: string;
  default_branch: string;
  root_path?: string;
  test_command?: string;
  lint_command?: string;
  build_command?: string;
  created_at: string;
  updated_at: string;
}

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref<Project[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchProjects(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const data = await api.get<{ data: Project[]; total: number }>('/projects');
      projects.value = data.data;
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to load projects';
    } finally {
      loading.value = false;
    }
  }

  async function createProject(dto: Partial<Project>): Promise<Project> {
    const project = await api.post<Project>('/projects', dto);
    projects.value.unshift(project);
    return project;
  }

  async function updateProject(id: number, dto: Partial<Project>): Promise<Project> {
    const updated = await api.put<Project>(`/projects/${id}`, dto);
    const idx = projects.value.findIndex((p) => p.id === id);
    if (idx !== -1) projects.value[idx] = updated;
    return updated;
  }

  async function deleteProject(id: number): Promise<void> {
    await api.delete(`/projects/${id}`);
    projects.value = projects.value.filter((p) => p.id !== id);
  }

  async function cloneProject(id: number): Promise<void> {
    await api.post(`/projects/${id}/clone`);
  }

  async function syncProject(id: number): Promise<void> {
    await api.post(`/projects/${id}/sync`);
  }

  return {
    projects,
    loading,
    error,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    cloneProject,
    syncProject,
  };
});
