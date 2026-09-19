import { describe, expect, it } from 'vitest';
import type { Project, Task } from './models';
import { normalizeProjectName, validateProject, validateTask } from './validation';

const now = '2026-09-17T12:00:00.000Z';

const project = (overrides: Partial<Project> = {}): Project => ({
  id: 'project-1',
  name: 'Work',
  normalizedName: 'work',
  color: null,
  sortOrder: 0,
  archivedAt: null,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  projectId: null,
  title: 'Send quote',
  notes: '',
  dueDate: null,
  sortOrder: 0,
  completedAt: null,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

describe('project validation', () => {
  it('normalizes names consistently', () => {
    expect(normalizeProjectName('  HoMe  ')).toBe('home');
  });

  it('rejects active names case-insensitively', () => {
    const issues = validateProject(
      project({ id: 'project-2', name: 'work', normalizedName: 'work' }),
      [project()],
    );
    expect(issues).toContainEqual({
      field: 'name',
      message: 'An active directory with this name already exists.',
    });
  });

  it('allows reuse of an archived project name', () => {
    const archived = project({ archivedAt: now });
    expect(validateProject(project({ id: 'project-2' }), [archived])).toEqual([]);
  });
});

describe('task validation', () => {
  it('accepts a valid task assigned to an active project', () => {
    expect(
      validateTask(task({ projectId: 'project-1', dueDate: '2028-02-29' }), [project()]),
    ).toEqual([]);
  });

  it('rejects invalid titles, dates, and archived projects', () => {
    const issues = validateTask(
      task({ title: ' ', dueDate: '2026-02-29', projectId: 'project-1' }),
      [project({ archivedAt: now })],
    );
    expect(issues.map(({ field }) => field)).toEqual(['title', 'dueDate', 'projectId']);
  });
});
