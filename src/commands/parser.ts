import { tokenize } from './tokenize';
import type { ParseResult, ParsedCommand } from './types';

const incomplete = (message: string): ParseResult => ({ status: 'incomplete', message });
const error = (message: string): ParseResult => ({ status: 'error', message });
const success = (command: ParsedCommand): ParseResult => ({ status: 'success', command });

const taskNumber = (value: string | undefined): number | null => {
  if (!value || !/^\d+$/.test(value)) return null;
  const number = Number(value);
  return number > 0 ? number : null;
};

export function parseCommand(input: string): ParseResult {
  const tokenized = tokenize(input);
  if (tokenized.status === 'incomplete') return tokenized;
  const [rawName, ...arguments_] = tokenized.tokens;
  if (!rawName) return incomplete('Type a command. Try “help”.');
  const name = rawName.replace(/^\//, '').toLocaleLowerCase();

  if (name === 'help' || name === '?') {
    return success({ type: 'help', topic: arguments_.join(' ') || null });
  }
  if (name === 'privacy' || name === 'terms') {
    return success({ type: 'legal', document: name });
  }
  if (name === 'undo') return success({ type: 'undo' });
  if (name === 'clear') return success({ type: 'clear' });
  if (name === 'theme') {
    const theme = arguments_[0]?.toLocaleLowerCase();
    return theme === 'system' || theme === 'light' || theme === 'dark'
      ? success({ type: 'theme', theme })
      : incomplete('Use: theme <system|light|dark>.');
  }
  if (['inbox', 'today', 'upcoming', 'completed'].includes(name)) {
    return success({
      type: 'navigate',
      view: name as 'inbox' | 'today' | 'upcoming' | 'completed',
    });
  }
  if (['find', 'search', 'f'].includes(name)) {
    const query = arguments_.join(' ');
    return query ? success({ type: 'search', query }) : incomplete('Search needs a query.');
  }
  if (name === 'projects') {
    const projectName = arguments_.join(' ');
    return projectName
      ? success({ type: 'navigate-project', projectName })
      : success({ type: 'directory-list' });
  }
  if (name === 'dirs') return success({ type: 'directory-list' });
  if (name === 'dir') {
    const action = arguments_[0]?.toLocaleLowerCase();
    if (
      ['add', 'rename', 'edit', 'archive', 'archived', 'restore', 'delete'].includes(action ?? '')
    ) {
      return parseDirectory(arguments_);
    }
    const target = arguments_.join(' ').trim().toLocaleLowerCase();
    if (!target) return success({ type: 'directory-list' });
    if (['inbox', 'today', 'upcoming', 'completed'].includes(target)) {
      return success({
        type: 'navigate',
        view: target as 'inbox' | 'today' | 'upcoming' | 'completed',
      });
    }
    return success({ type: 'navigate-project', projectName: arguments_.join(' ').trim() });
  }
  if (['done', 'complete', 'x', 'restore', 'delete'].includes(name)) {
    const number = taskNumber(arguments_[0]);
    if (!number) return incomplete(`${name} needs a visible task number.`);
    const type = name === 'restore' ? 'restore' : name === 'delete' ? 'delete' : 'complete';
    return success({ type, taskNumber: number });
  }
  if (name === 'show' || name === 'view') {
    const number = taskNumber(arguments_[0]);
    return number
      ? success({ type: 'show', taskNumber: number })
      : incomplete(`${name} needs a visible task number.`);
  }
  if (name === 'note') {
    const number = taskNumber(arguments_[0]);
    if (!number) return incomplete('note needs a visible task number and text.');
    const value = arguments_.slice(1).join(' ');
    return value
      ? success({ type: 'note', taskNumber: number, value })
      : incomplete('Add note text or “none”.');
  }
  if (name === 'edit') {
    const number = taskNumber(arguments_[0]);
    const field = arguments_[1]?.toLocaleLowerCase();
    const value = arguments_.slice(2).join(' ');
    if (!number || !field || !value)
      return incomplete('Use: edit <number> <title|due|directory> <value>.');
    if (!['title', 'due', 'directory', 'project'].includes(field))
      return error('Editable fields are title, due, and directory.');
    return success({
      type: 'edit',
      taskNumber: number,
      field: field as 'title' | 'due' | 'directory' | 'project',
      value,
    });
  }
  if (name === 'dir' || name === 'directory' || name === 'project' || name === 'p')
    return parseDirectory(arguments_);
  if (name === 'add' || name === 'a') return parseAdd(arguments_);
  return error(`Unknown command “${rawName}”. Type “help” to see commands.`);
}

function parseDirectory(arguments_: string[]): ParseResult {
  const action = arguments_[0]?.toLocaleLowerCase();
  if (action === 'add') {
    const projectName = arguments_.slice(1).join(' ');
    return projectName
      ? success({ type: 'project-add', name: projectName })
      : incomplete('Use: dir add <name>.');
  }
  if (action === 'rename' || action === 'edit') {
    if (arguments_.length < 3)
      return incomplete('Use quoted names: dir edit "Old name" "New name".');
    return success({
      type: 'project-rename',
      currentName: arguments_[1] ?? '',
      newName: arguments_.slice(2).join(' '),
    });
  }
  if (action === 'archive') {
    const projectName = arguments_.slice(1).join(' ');
    return projectName
      ? success({ type: 'project-archive', name: projectName })
      : incomplete('Use: dir archive <name>.');
  }
  if (action === 'archived') return success({ type: 'project-archived' });
  if (action === 'restore') {
    const projectName = arguments_.slice(1).join(' ');
    return projectName
      ? success({ type: 'project-restore', name: projectName })
      : incomplete('Use: dir restore <name>.');
  }
  if (action === 'delete') {
    const projectName = arguments_.slice(1).join(' ');
    return projectName
      ? success({ type: 'project-delete', name: projectName })
      : incomplete('Use: dir delete <name>.');
  }
  const projectName = arguments_.join(' ');
  return projectName
    ? success({ type: 'navigate-project', projectName })
    : incomplete('Use: dir <name>.');
}

function parseAdd(arguments_: string[]): ParseResult {
  if (arguments_.length === 0) return incomplete('Add needs a task title.');
  const titleParts: string[] = [];
  let projectName: string | null = null;
  let due: string | null = null;

  for (let index = 0; index < arguments_.length; index += 1) {
    const keyword = arguments_[index]?.toLocaleLowerCase();
    const naturalClause =
      titleParts.length > 0 &&
      (keyword === 'project' || keyword === 'directory' || keyword === 'due');
    if (keyword === '-p' || keyword === '--dir' || keyword === '-d' || naturalClause) {
      const value = arguments_[index + 1];
      if (!value) return incomplete(`${keyword} needs a value.`);
      if (
        keyword === '-p' ||
        keyword === '--dir' ||
        keyword === 'project' ||
        keyword === 'directory'
      )
        projectName = value;
      else due = value;
      index += 1;
    } else {
      titleParts.push(arguments_[index] ?? '');
    }
  }
  const title = titleParts.join(' ').trim();
  return title
    ? success({ type: 'add', title, projectName, due })
    : incomplete('Add needs a task title.');
}
