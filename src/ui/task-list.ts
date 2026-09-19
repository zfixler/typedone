import { selectVisibleTasks } from '../app/selectors';
import type { AppStore } from '../app/state';
import { formatLocalDate } from '../utilities/dates';

export function createTaskList(
  store: AppStore,
  activateTask: (taskNumber: number, completed: boolean) => void,
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'terminal-output';
  section.setAttribute('aria-label', 'Tasks');
  const list = document.createElement('ol');
  list.className = 'task-list';
  list.setAttribute('aria-label', 'Tasks');
  const empty = document.createElement('p');
  empty.className = 'empty-state';
  section.append(list, empty);

  const render = (): void => {
    const state = store.getState();
    const tasks = selectVisibleTasks(state);
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
          due.textContent = task.dueDate;
          action.append(due);
        }
        row.append(action);
        return row;
      }),
    );
    list.hidden = tasks.length === 0;
    empty.hidden = tasks.length !== 0;
    empty.textContent = state.activeView === 'search' ? 'no matches' : 'no tasks here';
  };
  render();
  store.subscribe(render);
  return section;
}
