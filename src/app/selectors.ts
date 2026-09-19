import type { Task } from '../domain/models';
import { formatLocalDate } from '../utilities/dates';
import type { AppState } from './state';

const byManualOrder = (left: Task, right: Task): number =>
  left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt);

export function selectVisibleTasks(state: Readonly<AppState>, now: Date = new Date()): Task[] {
  const today = formatLocalDate(now);
  const incomplete = state.tasks.filter(({ completedAt }) => completedAt === null);

  switch (state.activeView) {
    case 'inbox':
      return incomplete.filter(({ projectId }) => projectId === null).sort(byManualOrder);
    case 'today':
      return incomplete
        .filter(({ dueDate }) => dueDate !== null && dueDate <= today)
        .sort(
          (left, right) =>
            (left.dueDate ?? '').localeCompare(right.dueDate ?? '') || byManualOrder(left, right),
        );
    case 'upcoming': {
      const limit = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30, 12);
      const limitValue = formatLocalDate(limit);
      return incomplete
        .filter(
          ({ dueDate }) =>
            dueDate !== null && dueDate > today && (state.showAllUpcoming || dueDate <= limitValue),
        )
        .sort(
          (left, right) =>
            (left.dueDate ?? '').localeCompare(right.dueDate ?? '') || byManualOrder(left, right),
        );
    }
    case 'project':
      return incomplete
        .filter(({ projectId }) => projectId === state.activeProjectId)
        .sort(byManualOrder);
    case 'completed':
      return state.tasks
        .filter((task) => task.completedAt !== null)
        .sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? ''));
    case 'search': {
      const query = state.searchQuery.trim().toLocaleLowerCase();
      if (!query) return [];
      return state.tasks
        .filter(
          ({ title, notes }) =>
            title.toLocaleLowerCase().includes(query) || notes.toLocaleLowerCase().includes(query),
        )
        .sort(byManualOrder);
    }
  }
}

export function nextSelectionAfterRemoval(
  visibleTaskIds: readonly string[],
  removedTaskId: string,
): string | null {
  const index = visibleTaskIds.indexOf(removedTaskId);
  if (index < 0) return visibleTaskIds[0] ?? null;
  return visibleTaskIds[index + 1] ?? visibleTaskIds[index - 1] ?? null;
}
