import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../api/client.js';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './auth.js';

export interface ExecutionLog {
  id: number;
  level: string;
  source: string;
  message: string;
  created_at: string;
}

export interface Execution {
  id: number;
  ticket_id: number;
  project_id: number;
  status: string;
  error_message?: string;
  worktree_path?: string;
  branch_name?: string;
  created_at: string;
  updated_at: string;
}

export const useExecutionsStore = defineStore('executions', () => {
  const current = ref<Execution | null>(null);
  const logs = ref<ExecutionLog[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  let socket: Socket | null = null;

  async function fetchExecution(id: number): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      current.value = await api.get<Execution>(`/executions/${id}`);
      const result = await api.get<{ data: ExecutionLog[]; total: number }>(`/executions/${id}/logs`);
      logs.value = result.data;
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Failed to load execution';
    } finally {
      loading.value = false;
    }
  }

  const MAX_LOGS = 2000;

  function subscribe(executionId: number): void {
    if (socket?.connected) {
      socket.emit('unsubscribe', { executionId: current.value?.id });
      socket.disconnect();
    }
    socket = io('/executions', {
      transports: ['websocket'],
      auth: { token: useAuthStore().token.value },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      socket!.emit('subscribe', { executionId });
    });

    socket.on('disconnect', (reason) => {
      console.warn('Socket disconnected:', reason);
    });

    socket.on('log', (log: ExecutionLog) => {
      logs.value.push(log);
      if (logs.value.length > MAX_LOGS) {
        logs.value.splice(0, logs.value.length - MAX_LOGS);
      }
    });

    socket.on('status', (data: { status: string }) => {
      if (current.value) {
        current.value.status = data.status;
      }
    });
  }

  function unsubscribe(executionId: number): void {
    socket?.emit('unsubscribe', { executionId });
    socket?.disconnect();
    socket = null;
  }

  async function stopExecution(id: number): Promise<void> {
    await api.post(`/executions/${id}/stop`);
  }

  return {
    current,
    logs,
    loading,
    error,
    fetchExecution,
    subscribe,
    unsubscribe,
    stopExecution,
  };
});
