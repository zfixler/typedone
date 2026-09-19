import { describe, expect, it } from 'vitest';
import { parseCommand } from './parser';

describe('command parser', () => {
  it.each([
    ['/done 3', { type: 'complete', taskNumber: 3 }],
    ['/complete 2', { type: 'complete', taskNumber: 2 }],
    ['/restore 1', { type: 'restore', taskNumber: 1 }],
    ['/delete 4', { type: 'delete', taskNumber: 4 }],
    ['f revised drawing', { type: 'search', query: 'revised drawing' }],
    ['today', { type: 'navigate', view: 'today' }],
    ['dir Home', { type: 'navigate-project', projectName: 'Home' }],
    ['/dir Home', { type: 'navigate-project', projectName: 'Home' }],
    ['/dirs', { type: 'directory-list' }],
    ['/dir', { type: 'directory-list' }],
    ['/dir today', { type: 'navigate', view: 'today' }],
    ['/note 2 none', { type: 'note', taskNumber: 2, value: 'none' }],
    ['/privacy', { type: 'legal', document: 'privacy' }],
    ['/terms', { type: 'legal', document: 'terms' }],
  ])('parses %s', (input, command) => {
    expect(parseCommand(input)).toEqual({ status: 'success', command });
  });

  it('parses add clauses in either order', () => {
    expect(parseCommand('add Send quote -d tomorrow --dir Work')).toEqual({
      status: 'success',
      command: { type: 'add', title: 'Send quote', due: 'tomorrow', projectName: 'Work' },
    });
    expect(parseCommand('a Send quote --dir Work -d 9/25/2026')).toEqual({
      status: 'success',
      command: { type: 'add', title: 'Send quote', due: '9/25/2026', projectName: 'Work' },
    });
  });

  it('treats project and due as title words without flags', () => {
    expect(parseCommand('add Discuss project due dates')).toEqual({
      status: 'success',
      command: {
        type: 'add',
        title: 'Discuss project due dates',
        due: null,
        projectName: null,
      },
    });
  });

  it('requires values after add flags', () => {
    expect(parseCommand('add Send quote --dir')).toEqual({
      status: 'incomplete',
      message: '--dir needs a value.',
    });
    expect(parseCommand('add Send quote -d')).toEqual({
      status: 'incomplete',
      message: '-d needs a value.',
    });
  });

  it('handles quoted values and repeated whitespace', () => {
    expect(parseCommand(' dir   add   "Client Work" ')).toEqual({
      status: 'success',
      command: { type: 'project-add', name: 'Client Work' },
    });
  });

  it('parses directory edit and delete commands', () => {
    expect(parseCommand('dir edit "Client Work" "Client Success"')).toEqual({
      status: 'success',
      command: {
        type: 'project-rename',
        currentName: 'Client Work',
        newName: 'Client Success',
      },
    });
    expect(parseCommand('dir delete "Client Success"')).toEqual({
      status: 'success',
      command: { type: 'project-delete', name: 'Client Success' },
    });
  });

  it('returns structured incomplete and error results', () => {
    expect(parseCommand('add').status).toBe('incomplete');
    expect(parseCommand('add "unfinished').status).toBe('incomplete');
    expect(parseCommand('wat').status).toBe('error');
    expect(parseCommand('done 1').status).toBe('error');
  });
});
