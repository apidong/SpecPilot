import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../api/client.js';

interface AgentConfigJson {
  api_key?: string;
  base_url?: string;
  timeout_seconds?: number;
  allowed_commands?: string[];
  [key: string]: unknown;
}

interface Agent {
  id: number;
  name: string;
  type: string;
  provider: string;
  model: string;
  is_default: boolean;
  config_json: AgentConfigJson;
  created_at: string;
  updated_at: string;
}

export const useAgentStore = defineStore('agent', () => {
  const agents = ref<Agent[]>([]);
  const activeAgent = ref<Agent | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchAgents(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      agents.value = await api.get<Agent[]>('/agents');
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load agents';
    } finally {
      loading.value = false;
    }
  }

  async function fetchAgent(agentId: number): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      activeAgent.value = await api.get<Agent>(`/agents/${agentId}`);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load agent';
    } finally {
      loading.value = false;
    }
  }

  async function createAgent(data: {
    name: string;
    type: string;
    provider: string;
    model: string;
    config_json: AgentConfigJson;
    is_default?: boolean;
  }): Promise<Agent> {
    const agent = await api.post<Agent>('/agents', data);
    agents.value.push(agent);
    return agent;
  }

  async function updateAgent(
    agentId: number,
    data: Partial<{
      name: string;
      type: string;
      model: string;
      config_json: AgentConfigJson;
      is_default: boolean;
    }>,
  ): Promise<Agent> {
    const updated = await api.put<Agent>(`/agents/${agentId}`, data);
    const idx = agents.value.findIndex((a) => a.id === agentId);
    if (idx !== -1) agents.value[idx] = updated;
    if (activeAgent.value?.id === agentId) activeAgent.value = updated;
    return updated;
  }

  async function deleteAgent(agentId: number): Promise<void> {
    await api.delete(`/agents/${agentId}`);
    agents.value = agents.value.filter((a) => a.id !== agentId);
    if (activeAgent.value?.id === agentId) activeAgent.value = null;
  }

  /**
   * Mask API key for display (Req 21.6–21.7).
   * len >= 4 → '•'.repeat(len-4) + last4
   * len < 4  → '•'.repeat(len)
   */
  function maskApiKey(apiKey: string): string {
    if (apiKey.length >= 4) {
      return '•'.repeat(apiKey.length - 4) + apiKey.slice(-4);
    }
    return '•'.repeat(apiKey.length);
  }

  function reset() {
    agents.value = [];
    activeAgent.value = null;
    error.value = null;
  }

  return {
    agents,
    activeAgent,
    loading,
    error,
    fetchAgents,
    fetchAgent,
    createAgent,
    updateAgent,
    deleteAgent,
    maskApiKey,
    reset,
  };
});
