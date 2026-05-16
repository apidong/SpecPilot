import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../api/client.js';

interface Ticket {
  id: number;
  spec_id: number;
  task_id?: string;
  title: string;
  description?: string;
  branch_name?: string;
  status: string;
  agent_id?: number;
  created_at: string;
  updated_at: string;
}

export const useTicketStore = defineStore('ticket', () => {
  const tickets = ref<Ticket[]>([]);
  const activeTicket = ref<Ticket | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchTickets(projectId: number): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      tickets.value = await api.get<Ticket[]>(`/projects/${projectId}/tickets`);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load tickets';
    } finally {
      loading.value = false;
    }
  }

  async function fetchTicket(ticketId: number): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      activeTicket.value = await api.get<Ticket>(`/tickets/${ticketId}`);
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load ticket';
    } finally {
      loading.value = false;
    }
  }

  async function createTicket(
    specId: number,
    data: { title: string; description?: string; task_id?: string; agent_id?: number },
  ): Promise<Ticket> {
    const ticket = await api.post<Ticket>(`/specs/${specId}/tickets`, data);
    tickets.value.unshift(ticket);
    return ticket;
  }

  async function updateTicket(
    ticketId: number,
    data: Partial<{ title: string; description: string; agent_id: number }>,
  ): Promise<Ticket> {
    const updated = await api.put<Ticket>(`/tickets/${ticketId}`, data);
    const idx = tickets.value.findIndex((t) => t.id === ticketId);
    if (idx !== -1) tickets.value[idx] = updated;
    if (activeTicket.value?.id === ticketId) activeTicket.value = updated;
    return updated;
  }

  async function runTicket(ticketId: number): Promise<{ execution_id: number }> {
    return api.post<{ execution_id: number }>(`/tickets/${ticketId}/run`);
  }

  async function approveTicket(ticketId: number): Promise<Ticket> {
    const updated = await api.post<Ticket>(`/tickets/${ticketId}/approve`);
    if (activeTicket.value?.id === ticketId) activeTicket.value = updated;
    return updated;
  }

  async function rejectTicket(ticketId: number): Promise<Ticket> {
    const updated = await api.post<Ticket>(`/tickets/${ticketId}/reject`);
    if (activeTicket.value?.id === ticketId) activeTicket.value = updated;
    return updated;
  }

  async function commitTicket(ticketId: number): Promise<{ sha: string }> {
    return api.post<{ sha: string }>(`/tickets/${ticketId}/commit`);
  }

  async function askAgentFix(
    ticketId: number,
    comments: string[],
  ): Promise<{ execution_id: number }> {
    return api.post<{ execution_id: number }>(`/tickets/${ticketId}/ask-agent-fix`, {
      comments,
    });
  }

  function reset() {
    tickets.value = [];
    activeTicket.value = null;
    error.value = null;
  }

  return {
    tickets,
    activeTicket,
    loading,
    error,
    fetchTickets,
    fetchTicket,
    createTicket,
    updateTicket,
    runTicket,
    approveTicket,
    rejectTicket,
    commitTicket,
    askAgentFix,
    reset,
  };
});
