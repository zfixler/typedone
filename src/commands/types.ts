export type ParsedCommand =
  | { type: 'add'; title: string; projectName: string | null; due: string | null }
  | { type: 'complete'; taskNumber: number }
  | { type: 'restore'; taskNumber: number }
  | { type: 'delete'; taskNumber: number }
  | { type: 'show'; taskNumber: number }
  | {
      type: 'edit';
      taskNumber: number;
      field: 'title' | 'due' | 'directory' | 'project';
      value: string;
    }
  | { type: 'note'; taskNumber: number; value: string }
  | { type: 'navigate'; view: 'inbox' | 'today' | 'upcoming' | 'completed' }
  | { type: 'navigate-project'; projectName: string }
  | { type: 'directory-list' }
  | { type: 'search'; query: string }
  | { type: 'project-add'; name: string }
  | { type: 'project-rename'; currentName: string; newName: string }
  | { type: 'project-archive'; name: string }
  | { type: 'project-archived' }
  | { type: 'project-restore'; name: string }
  | { type: 'project-delete'; name: string }
  | { type: 'undo' }
  | { type: 'theme'; theme: 'system' | 'light' | 'dark' }
  | { type: 'clear' }
  | { type: 'legal'; document: 'privacy' | 'terms' }
  | { type: 'help'; topic: string | null };

export type ParseResult =
  | { status: 'success'; command: ParsedCommand }
  | { status: 'incomplete'; message: string }
  | { status: 'error'; message: string };
