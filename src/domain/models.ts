export interface Project {
  id: string;
  name: string;
  normalizedName: string;
  color: string | null;
  sortOrder: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string | null;
  title: string;
  notes: string;
  dueDate: string | null;
  sortOrder: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommandHistoryEntry {
  id: string;
  input: string;
  executedAt: string;
  succeeded: boolean;
}
