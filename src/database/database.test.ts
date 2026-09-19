import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { CommandHistoryEntry, Project, Task } from '../domain/models';
import { createRepositories, openDatabase, requestResult } from './database';
import { DATABASE_VERSION, STORE_NAMES } from './migrations';

const databaseNames: string[] = [];

const uniqueName = (): string => {
  const name = `terminal-todo-test-${crypto.randomUUID()}`;
  databaseNames.push(name);
  return name;
};

afterEach(async () => {
  await Promise.all(
    databaseNames.splice(0).map((name) => requestResult(indexedDB.deleteDatabase(name))),
  );
});

const timestamp = (offset = 0): string =>
  new Date(Date.UTC(2026, 8, 18, 12, 0, offset)).toISOString();

const project = (): Project => ({
  id: 'project-1',
  name: 'Work',
  normalizedName: 'work',
  color: null,
  sortOrder: 0,
  archivedAt: null,
  createdAt: timestamp(),
  updatedAt: timestamp(),
});

const task = (): Task => ({
  id: 'task-1',
  projectId: 'project-1',
  title: 'Send quote',
  notes: '',
  dueDate: '2026-09-25',
  sortOrder: 0,
  completedAt: null,
  createdAt: timestamp(),
  updatedAt: timestamp(),
});

describe('database migrations', () => {
  it('creates the versioned stores, indexes, and schema metadata', async () => {
    const database = await openDatabase(uniqueName());

    expect(database.version).toBe(DATABASE_VERSION);
    expect([...database.objectStoreNames]).toEqual([
      'commandHistory',
      'metadata',
      'projects',
      'settings',
      'tasks',
    ]);

    const transaction = database.transaction(
      [STORE_NAMES.tasks, STORE_NAMES.projects, STORE_NAMES.metadata],
      'readonly',
    );
    expect([...transaction.objectStore(STORE_NAMES.tasks).indexNames]).toEqual([
      'completedAt',
      'dueDate',
      'projectId',
    ]);
    expect([...transaction.objectStore(STORE_NAMES.projects).indexNames]).toEqual([
      'normalizedName',
    ]);
    await expect(
      requestResult(transaction.objectStore(STORE_NAMES.metadata).get('schemaVersion')),
    ).resolves.toEqual({
      name: 'schemaVersion',
      value: DATABASE_VERSION,
    });
    database.close();
  });
});

describe('repositories', () => {
  it('round-trips and deletes tasks', async () => {
    const database = await openDatabase(uniqueName());
    const repositories = createRepositories(database);
    await repositories.tasks.put(task());
    await expect(repositories.tasks.get('task-1')).resolves.toEqual(task());
    await expect(repositories.tasks.list()).resolves.toEqual([task()]);
    await repositories.tasks.delete('task-1');
    await expect(repositories.tasks.get('task-1')).resolves.toBeUndefined();
    database.close();
  });

  it('round-trips projects and settings', async () => {
    const database = await openDatabase(uniqueName());
    const repositories = createRepositories(database);
    await repositories.projects.put(project());
    await repositories.settings.put('theme', 'dark');
    await repositories.settings.put('upcoming.showAll', true);

    await expect(repositories.projects.list()).resolves.toEqual([project()]);
    await expect(repositories.settings.get<string>('theme')).resolves.toBe('dark');
    await expect(repositories.settings.list()).resolves.toEqual({
      theme: 'dark',
      'upcoming.showAll': true,
    });
    await repositories.settings.delete('theme');
    await expect(repositories.settings.get('theme')).resolves.toBeUndefined();
    await repositories.projects.delete('project-1');
    await expect(repositories.projects.get('project-1')).resolves.toBeUndefined();
    database.close();
  });

  it('deduplicates consecutive history and retains only the latest 100 entries', async () => {
    const database = await openDatabase(uniqueName());
    const { commandHistory } = createRepositories(database);

    for (let index = 0; index < 101; index += 1) {
      const entry: CommandHistoryEntry = {
        id: `history-${String(index).padStart(3, '0')}`,
        input: `add task ${String(index)}`,
        executedAt: timestamp(index),
        succeeded: true,
      };
      await commandHistory.add(entry);
    }
    await commandHistory.add({
      id: 'duplicate',
      input: 'add task 100',
      executedAt: timestamp(102),
      succeeded: true,
    });

    const entries = await commandHistory.list();
    expect(entries).toHaveLength(100);
    expect(entries[0]?.input).toBe('add task 1');
    expect(entries.at(-1)?.input).toBe('add task 100');
    await commandHistory.clear();
    await expect(commandHistory.list()).resolves.toEqual([]);
    database.close();
  });
});
