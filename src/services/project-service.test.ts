import { describe, expect, it } from 'vitest';
import type { ProjectRepository } from '../database/types';
import type { Project } from '../domain/models';
import { ProjectService } from './project-service';

const project = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-1',
  name: 'Work',
  normalizedName: 'work',
  color: null,
  sortOrder: 0,
  archivedAt: '2026-09-20T12:00:00.000Z',
  createdAt: '2026-09-19T12:00:00.000Z',
  updatedAt: '2026-09-20T12:00:00.000Z',
  ...overrides,
});

class MemoryProjectRepository implements ProjectRepository {
  readonly records = new Map<string, Project>();

  list(): Promise<Project[]> {
    return Promise.resolve([...this.records.values()]);
  }

  get(id: string): Promise<Project | undefined> {
    return Promise.resolve(this.records.get(id));
  }

  put(value: Project): Promise<void> {
    this.records.set(value.id, value);
    return Promise.resolve();
  }

  delete(id: string): Promise<void> {
    this.records.delete(id);
    return Promise.resolve();
  }
}

describe('ProjectService.restore', () => {
  it('restores an archived directory', async () => {
    const repository = new MemoryProjectRepository();
    const service = new ProjectService(repository);
    const archived = project();

    const restored = await service.restore(archived, [archived]);

    expect(restored.archivedAt).toBeNull();
    expect(repository.records.get(archived.id)).toEqual(restored);
  });

  it('rejects a name collision without writing', async () => {
    const repository = new MemoryProjectRepository();
    const service = new ProjectService(repository);
    const archived = project();
    const active = project({ id: 'project-2', archivedAt: null });

    await expect(service.restore(archived, [archived, active])).rejects.toThrow(
      'An active directory with this name already exists.',
    );
    expect(repository.records.size).toBe(0);
  });
});
