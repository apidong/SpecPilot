import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../api/client.js';

interface ArtifactVersion {
  id: number;
  spec_id: number;
  type: 'requirements' | 'design' | 'tasks';
  content: string;
  version: number;
  parent_id: number | null;
  is_current: boolean;
  generated_by: 'llm' | 'user';
  change_summary?: string;
  created_at: string;
}

export const useArtifactVersionStore = defineStore('artifactVersion', () => {
  const versions = ref<ArtifactVersion[]>([]);
  const selectedVersion = ref<ArtifactVersion | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchVersions(
    specId: number,
    type: 'requirements' | 'design' | 'tasks',
  ): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      versions.value = await api.get<ArtifactVersion[]>(
        `/specs/${specId}/artifacts/${type}/versions`,
      );
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load versions';
    } finally {
      loading.value = false;
    }
  }

  async function fetchVersion(
    specId: number,
    type: 'requirements' | 'design' | 'tasks',
    version: number,
  ): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      selectedVersion.value = await api.get<ArtifactVersion>(
        `/specs/${specId}/artifacts/${type}/versions/${version}`,
      );
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load version';
    } finally {
      loading.value = false;
    }
  }

  async function restoreVersion(
    specId: number,
    type: 'requirements' | 'design' | 'tasks',
    version: number,
  ): Promise<void> {
    await api.post(`/specs/${specId}/artifacts/${type}/versions/${version}/restore`);
    await fetchVersions(specId, type);
  }

  async function getDiff(
    specId: number,
    type: 'requirements' | 'design' | 'tasks',
    versionA: number,
    versionB: number,
  ): Promise<unknown> {
    return api.get(
      `/specs/${specId}/artifacts/${type}/versions/${versionA}/diff/${versionB}`,
    );
  }

  function reset() {
    versions.value = [];
    selectedVersion.value = null;
    error.value = null;
  }

  return {
    versions,
    selectedVersion,
    loading,
    error,
    fetchVersions,
    fetchVersion,
    restoreVersion,
    getDiff,
    reset,
  };
});
