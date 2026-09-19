import { describe, expect, it } from 'vitest';
import type { Project, Task } from '../domain/models';
import type { TaskRepository } from '../database/types';
import { TaskService, TaskValidationError } from './task-service';

class MemoryTaskRepository implements TaskRepository {
  readonly tasks = new Map<string, Task>();

  list(): Promise<Task[]> {
    return Promise.resolve([...this.tasks.values()]);
  }

  get(id: string): Promise<Task | undefined> {
    return Promise.resolve(this.tasks.get(id));
  }

  put(task: Task): Promise<void> {
    this.tasks.set(task.id, task);
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    this.tasks.delete(id);
    return Promise.resolve();
  }
}

const project: Project = {
  id: 'project-1',
  name: 'Work',
  normalizedName: 'work',
  color: null,
  sortOrder: 0,
  archivedAt: null,
  createdAt: '2026-09-18T12:00:00.000Z',
  updatedAt: '2026-09-18T12:00:00.000Z',
};

describe('TaskService', () => {
  it('creates a trimmed, persisted task after validation', async () => {
    const repository = new MemoryTaskRepository();
    const service = new TaskService(repository);
    const created = await service.create(
      { title: '  Send quote  ', notes: 'Details', projectId: project.id, dueDate: '2026-09-25' },
      [project],
      [],
    );
    expect(created.title).toBe('Send quote');
    expect(created.sortOrder).toBe(0);
    await expect(repository.get(created.id)).resolves.toEqual(created);
  });

  it('rejects invalid input before persistence', async () => {
    const repository = new MemoryTaskRepository();
    const service = new TaskService(repository);
    await expect(
      service.create({ title: ' ', notes: '', projectId: null, dueDate: '2026-02-29' }, [], []),
    ).rejects.toBeInstanceOf(TaskValidationError);
    await expect(repository.list()).resolves.toEqual([]);
  });

  it('updates, completes, restores, and deletes an existing task', async () => {
    const repository = new MemoryTaskRepository();
    const service = new TaskService(repository);
    const created = await service.create(
      { title: 'First', notes: '', projectId: null, dueDate: null },
      [],
      [],
    );
    const updated = await service.update(
      created.id,
      { title: 'Second', notes: 'Note', projectId: project.id, dueDate: '2026-09-30' },
      [project],
    );
    expect(updated).toMatchObject({ title: 'Second', notes: 'Note', projectId: project.id });
    expect((await service.setCompleted(created.id, true)).completedAt).not.toBeNull();
    expect((await service.setCompleted(created.id, false)).completedAt).toBeNull();
    await service.delete(created.id);
    await expect(repository.get(created.id)).resolves.toBeUndefined();
  });
});
