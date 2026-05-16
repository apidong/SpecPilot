// Task types
export type TaskType = 'backend' | 'frontend' | 'fullstack' | 'infra' | 'docs' | 'test';
export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';

export interface Task {
  code: string; // TSK-NNN
  title: string;
  type: TaskType;
  priority: TaskPriority;
  depends_on: string[]; // TSK-NNN codes or []
  acceptance_criteria: string;
  checked: boolean;
}

// Artifact types
export type ArtifactType = 'requirements' | 'design' | 'tasks';

export interface SpecArtifact {
  id: number;
  spec_id: number;
  type: ArtifactType;
  content: string;
  version: number;
  parent_id: number | null;
  is_current: boolean;
  generated_by: 'llm' | 'user';
  change_summary?: string;
  created_at: Date;
  created_by?: number;
}

// Ticket status
export type TicketStatus =
  | 'Backlog'
  | 'Ready'
  | 'Running'
  | 'Waiting Review'
  | 'Approved'
  | 'Rejected'
  | 'Failed'
  | 'Merged'
  | 'Cancelled';

// Execution status
export type ExecutionStatus =
  | 'Queued'
  | 'Preparing Workspace'
  | 'Running Agent'
  | 'Running Verification'
  | 'Waiting Review'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

export const ACTIVE_EXECUTION_STATUSES: ExecutionStatus[] = [
  'Queued',
  'Preparing Workspace',
  'Running Agent',
  'Running Verification',
];

// Ticket transition matrix
export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  Backlog: ['Ready'],
  Ready: ['Backlog', 'Running'],
  Running: ['Waiting Review', 'Failed', 'Cancelled'],
  'Waiting Review': ['Approved', 'Rejected'],
  Approved: ['Merged'],
  Rejected: ['Backlog'],
  Failed: ['Backlog'],
  Cancelled: ['Backlog'],
  Merged: [],
};

// Diff types
export type DiffLineKind = 'unchanged' | 'added' | 'removed';

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  aLineNo?: number;
  bLineNo?: number;
}

export interface DiffResult {
  lines: DiffLine[];
}

// Spec status
export type SpecStatus =
  | 'Draft'
  | 'Ready'
  | 'In Progress'
  | 'Verification'
  | 'Completed'
  | 'Archived';

export const VALID_SPEC_STATUSES: SpecStatus[] = [
  'Draft',
  'Ready',
  'In Progress',
  'Verification',
  'Completed',
  'Archived',
];

// Agent provider
export type AgentProvider =
  | 'openai_compatible'
  | 'omniroute'
  | 'anthropic'
  | 'gemini'
  | 'ollama_local'
  | 'custom_endpoint';

export const VALID_AGENT_PROVIDERS: AgentProvider[] = [
  'openai_compatible',
  'omniroute',
  'anthropic',
  'gemini',
  'ollama_local',
  'custom_endpoint',
];
