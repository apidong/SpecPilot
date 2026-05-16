// Main exports for @specpilot/shared
export { parseTasks } from './parsers/tasks-parser.js';
export type { ParseResult, ParseError } from './parsers/tasks-parser.js';
export { serializeTasks } from './parsers/tasks-serializer.js';
export { diff } from './diff/line-diff.js';
export { isValidEarsRequirement, validateEarsRequirements } from './validators/ears.js';
export type {
  Task,
  TaskType,
  TaskPriority,
  TaskStatus,
  ArtifactType,
  SpecArtifact,
  TicketStatus,
  ExecutionStatus,
  DiffLine,
  DiffLineKind,
  DiffResult,
  SpecStatus,
  AgentProvider,
  ACTIVE_EXECUTION_STATUSES,
} from './types/index.js';
export {
  TICKET_TRANSITIONS,
  VALID_SPEC_STATUSES,
  VALID_AGENT_PROVIDERS,
} from './types/index.js';
