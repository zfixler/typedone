import type { CommandHistoryEntry, Project, Task } from '../domain/models';

export interface TaskRepository {
  list(): Promise<Task[]>;
  get(id: string): Promise<Task | undefined>;
  put(task: Task): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface ProjectRepository {
  list(): Promise<Project[]>;
  get(id: string): Promise<Project | undefined>;
  put(project: Project): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface SettingsRepository {
  list(): Promise<Record<string, unknown>>;
  get<T = unknown>(name: string): Promise<T | undefined>;
  put(name: string, value: unknown): Promise<void>;
  delete(name: string): Promise<void>;
}

export interface CommandHistoryRepository {
  list(): Promise<CommandHistoryEntry[]>;
  add(entry: CommandHistoryEntry): Promise<void>;
  clear(): Promise<void>;
}

export interface Repositories {
  tasks: TaskRepository;
  projects: ProjectRepository;
  settings: SettingsRepository;
  commandHistory: CommandHistoryRepository;
}

export interface SettingRecord {
  name: string;
  value: unknown;
}

export interface MetadataRecord {
  name: string;
  value: unknown;
}
