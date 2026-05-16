import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { api } from '../api/client.js';

interface Spec {
  id: number;
  project_id: number;
  title: string;
  summary?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface SpecArtifact {
  id: number;
  spec_id: number;
  type: 'requirements' | 'design' | 'tasks';
  content: string;
  version: number;
  is_current: boolean;
  generated_by: 'llm' | 'user';
  change_summary?: string;
  created_at: string;
}

interface SpecDetail extends Spec {
  requirements: SpecArtifact | null;
  design: SpecArtifact | null;
  tasks: SpecArtifact | null;
}

export const useSpecStore = defineStore('spec', () => {
  const specs = ref<Spec[]>([]);
  const activeSpec = ref<SpecDetail | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchSpecs(projectId: number): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      specs.value = await api.get<Spec[]>(`/projects/${projectId}/specs`);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load specs';
    } finally {
      loading.value = false;
    }
  }

  async function fetchSpec(specId: number): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      activeSpec.value = await api.get<SpecDetail>(`/specs/${specId}`);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load spec';
    } finally {
      loading.value = false;
    }
  }

  async function createSpec(
    projectId: number,
    data: { title: string; summary?: string },
  ): Promise<Spec> {
    const spec = await api.post<Spec>(`/projects/${projectId}/specs`, data);
    specs.value.unshift(spec);
    return spec;
  }

  async function updateSpec(
    specId: number,
    data: Partial<{ title: string; summary: string; status: string }>,
  ): Promise<Spec> {
    const updated = await api.put<Spec>(`/specs/${specId}`, data);
    const idx = specs.value.findIndex((s) => s.id === specId);
    if (idx !== -1) specs.value[idx] = updated;
    if (activeSpec.value?.id === specId) {
      activeSpec.value = { ...activeSpec.value, ...updated };
    }
    return updated;
  }

  async function deleteSpec(specId: number): Promise<void> {
    await api.delete(`/specs/${specId}`);
    specs.value = specs.value.filter((s) => s.id !== specId);
    if (activeSpec.value?.id === specId) activeSpec.value = null;
  }

  async function generateRequirements(specId: number, prompt: string): Promise<void> {
    await api.post(`/specs/${specId}/generate-requirements`, { prompt });
    await fetchSpec(specId);
  }

  async function generateDesign(specId: number): Promise<void> {
    await api.post(`/specs/${specId}/generate-design`);
    await fetchSpec(specId);
  }

  async function generateTasks(specId: number): Promise<void> {
    await api.post(`/specs/${specId}/generate-tasks`);
    await fetchSpec(specId);
  }

  return {
    specs,
    activeSpec,
    loading,
    error,
    fetchSpecs,
    fetchSpec,
    createSpec,
    updateSpec,
    deleteSpec,
    generateRequirements,
    generateDesign,
    generateTasks,
  };
});
