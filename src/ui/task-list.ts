import { selectVisibleTasks } from '../app/selectors';
import type { AppStore } from '../app/state';
import { formatFriendlyDate, formatLocalDate } from '../utilities/dates';

export function createTaskList(
  store: AppStore,
  activateTask: (taskNumber: number, completed: boolean) => void,
  prefillCommand: (value: string) => void,
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'terminal-output';
  section.setAttribute('aria-label', 'Tasks');
  const header = document.createElement('header');
  header.className = 'view-header';
  const headingGroup = document.createElement('div');
  const heading = document.createElement('h1');
  const summary = document.createElement('p');
  summary.className = 'view-summary';
  headingGroup.append(heading, summary);
  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'quiet-button';
  addButton.textContent = 'New task';
  addButton.addEventListener('click', () => {
    prefillCommand('add ');
  });
  header.append(headingGroup, addButton);
  const list = document.createElement('ol');
  list.className = 'task-list';
  list.setAttribute('aria-label', 'Tasks');
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  const emptyTitle = document.createElement('h2');
  const emptyCopy = document.createElement('p');
  const emptyAction = document.createElement('button');
  emptyAction.type = 'button';
  emptyAction.className = 'example-command';
  emptyAction.addEventListener('click', () => {
    prefillCommand(
      store.getState().activeView === 'search' ? 'find ' : 'add Take out the trash -d tomorrow',
    );
  });
  const onboarding = document.createElement('div');
  onboarding.className = 'onboarding-hints';
  for (const [label, command] of [
    ['1. Add a task', 'add '],
    ['2. Browse directories', '/dirs'],
    ['3. See every command', 'help'],
  ] as const) {
    const hint = document.createElement('button');
    hint.type = 'button';
    hint.className = 'example-command';
    hint.textContent = label;
    hint.addEventListener('click', () => {
      prefillCommand(command);
    });
    onboarding.append(hint);
  }
  empty.append(emptyTitle, emptyCopy, onboarding, emptyAction);
  section.append(header, list, empty);

  const render = (): void => {
    const state = store.getState();
    const tasks = selectVisibleTasks(state);
    const project = state.projects.find(({ id }) => id === state.activeProjectId);
    const titles = {
      inbox: 'Inbox',
      today: 'Today',
      upcoming: 'Upcoming',
      completed: 'Completed',
      search: `Search: ${state.searchQuery}`,
      project: project?.name ?? 'Directory not found',
    };
    heading.textContent = titles[state.activeView];
    summary.textContent = `${String(tasks.length)} ${tasks.length === 1 ? 'task' : 'tasks'}`;
    addButton.hidden = state.activeView === 'completed' || state.activeView === 'search';
    const today = formatLocalDate(new Date());
    list.replaceChildren(
      ...tasks.map((task, index) => {
        const row = document.createElement('li');
        row.className = 'task-row';
        row.dataset.taskId = task.id;
        if (task.id === state.selectedTaskId) row.classList.add('is-selected');
        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'task-action';
        action.tabIndex = -1;
        action.setAttribute(
          'aria-label',
          `${task.completedAt ? 'Restore' : 'Complete'} ${task.title}`,
        );
        action.addEventListener('click', () => {
          activateTask(index + 1, task.completedAt !== null);
        });
        const number = document.createElement('span');
        number.className = 'task-number';
        number.textContent = String(index + 1).padStart(2, '0');
        const marker = document.createElement('span');
        marker.className = 'task-marker';
        marker.textContent = task.completedAt ? '[x]' : '[ ]';
        const taskTitle = document.createElement('span');
        taskTitle.className = 'task-title';
        taskTitle.textContent = task.title;
        action.append(number, marker, taskTitle);
        if (task.notes) {
          const note = document.createElement('span');
          note.className = 'task-note';
          note.textContent = `• ${task.notes}`;
          action.append(note);
        }
        if (task.dueDate) {
          const due = document.createElement('time');
          due.dateTime = task.dueDate;
          due.className =
            task.dueDate < today && !task.completedAt ? 'task-due is-overdue' : 'task-due';
          due.textContent = formatFriendlyDate(task.dueDate);
          action.append(due);
        }
        row.append(action);
        return row;
      }),
    );
    list.hidden = tasks.length === 0;
    empty.hidden = tasks.length !== 0;
    const isSearch = state.activeView === 'search';
    const isCompleted = state.activeView === 'completed';
    const isFirstRun = state.activeView === 'inbox' && state.tasks.length === 0;
    emptyTitle.textContent = isSearch
      ? 'No matching tasks'
      : isCompleted
        ? 'Nothing completed yet'
        : state.activeView === 'today'
          ? 'Nothing needs your attention today'
          : 'You’re all clear';
    emptyCopy.textContent = isSearch
      ? 'Try a shorter or different search.'
      : isCompleted
        ? 'Completed tasks will collect here.'
        : 'Create a task with a command—the example below is ready to edit.';
    onboarding.hidden = !isFirstRun;
    emptyAction.textContent = isSearch
      ? 'Try another search'
      : 'add Take out the trash -d tomorrow';
    emptyAction.hidden = isCompleted || isFirstRun;
  };
  render();
  store.subscribe(render);
  return section;
}
