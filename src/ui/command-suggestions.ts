import { selectVisibleTasks } from '../app/selectors';
import type { AppState } from '../app/state';
import type { CommandSuggestion } from './command-bar';

const TOP_LEVEL_COMMANDS = [
  ['add', 'Create a task'],
  ['done', 'Complete a task'],
  ['restore', 'Restore a task'],
  ['show', 'Inspect a task'],
  ['edit', 'Edit a task'],
  ['note', 'Edit task notes'],
  ['delete', 'Delete a task'],
  ['inbox', 'Open Inbox'],
  ['today', 'Open Today'],
  ['upcoming', 'Open Upcoming'],
  ['completed', 'Open Completed'],
  ['dir', 'Browse directories'],
  ['find', 'Search tasks'],
  ['undo', 'Undo the latest action'],
  ['theme', 'Change theme'],
  ['clear', 'Dismiss status'],
  ['help', 'Show command help'],
] as const;
const COMMANDS_REQUIRING_ARGUMENTS = new Set([
  'add',
  'done',
  'restore',
  'show',
  'edit',
  'note',
  'delete',
  'dir',
  'find',
  'theme',
]);
const TASK_TARGET_COMMANDS = new Set([
  'done',
  'complete',
  'x',
  'restore',
  'show',
  'view',
  'delete',
  'edit',
  'note',
]);
const DATE_SUGGESTIONS = ['today', 'tomorrow', 'monday', 'friday'] as const;

export function getCommandSuggestions(
  input: string,
  state: Readonly<AppState>,
): CommandSuggestion[] {
  const raw = input.trim().toLocaleLowerCase();
  const slash = raw.startsWith('/');
  const command = raw.replace(/^\//, '');
  const prefix = slash ? '/' : '';

  if (!command.includes(' ')) {
    const exact = TOP_LEVEL_COMMANDS.some(([value]) => value === command);
    if (!exact || raw === '/') {
      const matches = TOP_LEVEL_COMMANDS.filter(([value]) => value.startsWith(command));
      if (matches.length > 0 || raw === '/') {
        return matches.map(([value, label]) => ({
          label: `${value} — ${label}`,
          value: `${prefix}${value}`,
          submit: !COMMANDS_REQUIRING_ARGUMENTS.has(value),
        }));
      }
    }
  }

  if (command === 'dir' || command === 'dirs') {
    const builtIns = [
      ['Inbox', 'All unassigned active tasks'],
      ['Today', 'Due today or overdue'],
      ['Upcoming', 'Future tasks'],
      ['Completed', 'Completed tasks'],
    ].map(([name = '', label = '']) => ({
      label: `${name} — ${label}`,
      value: `${prefix}dir ${name.toLocaleLowerCase()}`,
    }));
    const directories = state.projects
      .filter(({ archivedAt }) => archivedAt === null)
      .sort(
        (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
      )
      .map(({ name }) => ({ label: name, value: `${prefix}dir ${name}` }));
    return [...builtIns, ...directories];
  }

  if (command === 'theme') {
    return (['system', 'light', 'dark'] as const).map((theme) => ({
      label: `${theme} theme`,
      value: `${prefix}theme ${theme}`,
    }));
  }

  const dateMatch = /(?:due|-d)\s+([^\s]*)$/i.exec(input);
  if (dateMatch) {
    const datePrefix = dateMatch[1]?.toLocaleLowerCase() ?? '';
    if (DATE_SUGGESTIONS.some((value) => value === datePrefix)) return [];
    return DATE_SUGGESTIONS.filter((value) => value.startsWith(datePrefix)).map((value) => ({
      label: value,
      value: input.slice(0, input.length - datePrefix.length) + value,
      submit: false,
    }));
  }

  if (!TASK_TARGET_COMMANDS.has(command)) return [];
  return selectVisibleTasks(state).map((task, index) => ({
    label: `${String(index + 1).padStart(2, '0')}  ${task.title}`,
    value: `${prefix}${command} ${String(index + 1)}${command === 'edit' || command === 'note' ? ' ' : ''}`,
    submit: command !== 'edit' && command !== 'note',
  }));
}
