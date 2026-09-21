import { describe, expect, it } from 'vitest';
import type { Task } from '../domain/models';
import { nextSelectionAfterRemoval, selectVisibleTasks } from './selectors';
import type { AppState } from './state';
import { initialState } from './state';

const now = new Date(2026, 8, 18, 12);

const task = (id: string, overrides: Partial<Task> = {}): Task => ({
  id,
  projectId: null,
  title: id,
  notes: '',
  dueDate: null,
  sortOrder: 0,
  completedAt: null,
  createdAt: `2026-09-18T12:00:0${id}.000Z`,
  updatedAt: '2026-09-18T12:00:00.000Z',
  ...overrides,
});

const state = (overrides: Partial<AppState>): AppState => ({
  ...initialState,
  ...overrides,
});

describe('view selection', () => {
  it('filters and manually sorts inbox tasks', () => {
    const tasks = [
      task('1', { sortOrder: 2 }),
      task('2', { sortOrder: 1 }),
      task('3', { projectId: 'project-1' }),
      task('4', { completedAt: '2026-09-18T13:00:00.000Z' }),
    ];
    expect(
      selectVisibleTasks(state({ activeView: 'inbox', tasks }), now).map(({ id }) => id),
    ).toEqual(['2', '1']);
  });

  it('sorts overdue tasks before today tasks', () => {
    const tasks = [
      task('1', { dueDate: '2026-09-18' }),
      task('2', { dueDate: '2026-09-16' }),
      task('3', { dueDate: '2026-09-19' }),
    ];
    expect(
      selectVisibleTasks(state({ activeView: 'today', tasks }), now).map(({ id }) => id),
    ).toEqual(['2', '1']);
  });

  it('limits upcoming to 30 days unless show-all is enabled', () => {
    const tasks = [
      task('1', { dueDate: '2026-09-19' }),
      task('2', { dueDate: '2026-10-18' }),
      task('3', { dueDate: '2026-10-19' }),
    ];
    expect(
      selectVisibleTasks(state({ activeView: 'upcoming', tasks }), now).map(({ id }) => id),
    ).toEqual(['1', '2']);
    expect(
      selectVisibleTasks(state({ activeView: 'upcoming', tasks, showAllUpcoming: true }), now).map(
        ({ id }) => id,
      ),
    ).toEqual(['1', '2', '3']);
  });

  it('finds title and note substrings without case sensitivity', () => {
    const tasks = [task('1', { title: 'Send Invoice' }), task('2', { notes: 'Revised drawing' })];
    expect(
      selectVisibleTasks(state({ activeView: 'search', searchQuery: 'invoice', tasks }), now).map(
        ({ id }) => id,
      ),
    ).toEqual(['1']);
    expect(
      selectVisibleTasks(state({ activeView: 'search', searchQuery: 'DRAW', tasks }), now).map(
        ({ id }) => id,
      ),
    ).toEqual(['2']);
  });

  it('orders completed tasks newest first', () => {
    const tasks = [
      task('1', { completedAt: '2026-09-17T12:00:00.000Z' }),
      task('2', { completedAt: '2026-09-18T12:00:00.000Z' }),
    ];
    expect(
      selectVisibleTasks(state({ activeView: 'completed', tasks }), now).map(({ id }) => id),
    ).toEqual(['2', '1']);
  });
});

describe('selection movement', () => {
  it('selects the next item, then the previous item', () => {
    expect(nextSelectionAfterRemoval(['a', 'b', 'c'], 'b')).toBe('c');
    expect(nextSelectionAfterRemoval(['a', 'b'], 'b')).toBe('a');
    expect(nextSelectionAfterRemoval(['a'], 'a')).toBeNull();
  });
});
