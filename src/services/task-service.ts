import type { Project, Task } from '../domain/models';
import { validateTask, type ValidationIssue } from '../domain/validation';
import type { TaskRepository } from '../database/types';
import { createId } from '../utilities/ids';

export interface TaskInput {
  title: string;
  notes: string;
  projectId: string | null;
  dueDate: string | null;
}

export class TaskValidationError extends Error {
  override readonly name = 'TaskValidationError';

  constructor(readonly issues: ValidationIssue[]) {
    super(issues[0]?.message ?? 'The task is invalid.');
  }
}

export class TaskNotFoundError extends Error {
  override readonly name = 'TaskNotFoundError';

  constructor() {
    super('The task no longer exists.');
  }
}

export class TaskService {
  constructor(private readonly repository: TaskRepository) {}

  async create(
    input: TaskInput,
    projects: readonly Project[],
    existingTasks: readonly Task[],
  ): Promise<Task> {
    const now = new Date().toISOString();
    const task: Task = {
      id: createId(),
      title: input.title.trim(),
      notes: input.notes,
      projectId: input.projectId,
      dueDate: input.dueDate,
      sortOrder: Math.max(-1, ...existingTasks.map(({ sortOrder }) => sortOrder)) + 1,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.assertValid(task, projects);
    await this.repository.put(task);
    return task;
  }

  async update(id: string, input: TaskInput, projects: readonly Project[]): Promise<Task> {
    const existing = await this.requireTask(id);
    const task: Task = {
      ...existing,
      title: input.title.trim(),
      notes: input.notes,
      projectId: input.projectId,
      dueDate: input.dueDate,
      updatedAt: new Date().toISOString(),
    };
    this.assertValid(task, projects);
    await this.repository.put(task);
    return task;
  }

  async setCompleted(id: string, completed: boolean): Promise<Task> {
    const existing = await this.requireTask(id);
    const now = new Date().toISOString();
    const task: Task = {
      ...existing,
      completedAt: completed ? now : null,
      updatedAt: now,
    };
    await this.repository.put(task);
    return task;
  }

  async delete(id: string): Promise<void> {
    await this.requireTask(id);
    await this.repository.delete(id);
  }

  private async requireTask(id: string): Promise<Task> {
    const task = await this.repository.get(id);
    if (!task) throw new TaskNotFoundError();
    return task;
  }

  private assertValid(task: Task, projects: readonly Project[]): void {
    const issues = validateTask(task, projects);
    if (issues.length > 0) throw new TaskValidationError(issues);
  }
}
