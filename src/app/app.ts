import { parseCommand } from '../commands/parser';
import type { ParsedCommand } from '../commands/types';
import type { Repositories } from '../database/types';
import type { Project, Task } from '../domain/models';
import { normalizeProjectName } from '../domain/validation';
import { ProjectService } from '../services/project-service';
import { TaskService, type TaskInput } from '../services/task-service';
import { createCommandBar, type CommandBarController } from '../ui/command-bar';
import { createConfirmationDialog } from '../ui/confirmation-dialog';
import { createTaskList } from '../ui/task-list';
import { parseDateExpression } from '../utilities/dates';
import { createId } from '../utilities/ids';
import { parseHash, routeToHash } from './routes';
import { nextSelectionAfterRemoval, selectVisibleTasks } from './selectors';
import { createStore, initialState, type AppStore, type Theme } from './state';

const HELP = `commands
  add <title> [directory <name>] [due <date>]
  done | restore | show | edit | note | delete <number>
  inbox | today | upcoming | completed
  dirs | dir <name> | dir add|rename|archive|archived|restore|delete ...
  find <text> | undo | theme <system|light|dark> | clear
  help [command] | privacy | terms

Tip: every command also accepts a leading slash.`;

const HELP_TOPICS: Record<string, string> = {
  add: 'add <title> [directory <name>] [due <date>]\nexample: add Take out the trash due tomorrow',
  done: 'done <number>\nComplete a task visible in the current view.',
  restore: 'restore <number>\nRestore a task visible in Completed.',
  show: 'show <number>\nShow all details for a visible task.',
  edit: 'edit <number> <title|due|directory> <value>\nUse “none” to clear a due date or directory.',
  note: 'note <number> <text|none>\nAdd, replace, or clear task notes.',
  delete: 'delete <number>\nPermanently delete a task after confirmation.',
  dir: 'dir [<name>]\ndir add|rename|archive|archived|restore|delete <name>',
  find: 'find <text>\nSearch task titles and notes.',
  undo: 'undo\nReverse the latest reversible action.',
  theme: 'theme <system|light|dark>\nSet and remember the app theme.',
};

const PRIVACY_POLICY = `privacy policy
effective: September 18, 2026

TypeDone stores your tasks, directories, settings, and command history locally in your browser using IndexedDB. TypeDone does not transmit that content to us and does not use advertising or analytics cookies.

Our hosting provider, Cloudflare, may process standard request information such as your IP address, browser details, requested URL, and security events to deliver and protect the service. Its handling of that information is governed by Cloudflare's privacy policy.

Your local data remains until you delete it or clear this site's browser storage. Removing the app, switching browsers or devices, or clearing browser data may permanently remove it. TypeDone currently provides no account sync or cloud backup.

Do not store sensitive or regulated information in TypeDone. This policy may change as the service evolves; an updated effective date will be shown here.`;

const TERMS_OF_SERVICE = `terms of service
effective: September 18, 2026

TypeDone is provided for personal task management. By using it, you agree to use it lawfully and not to interfere with, probe, abuse, or disrupt the service or its infrastructure.

The service is provided “as is” and “as available,” without warranties of any kind. Your data is stored locally in your browser. You are responsible for maintaining any backups you need, and we are not responsible for data loss, service interruption, or damages arising from use of the service, to the extent permitted by law.

We may change, suspend, or discontinue the service and may update these terms. Continued use after an update means you accept the revised terms. If you do not accept these terms, stop using TypeDone.`;

const BUILT_IN_DIRECTORIES = ['inbox', 'today', 'upcoming', 'completed'] as const;
interface UndoAction {
  label: string;
  run: () => Promise<void>;
}

const isTheme = (value: unknown): value is Theme =>
  value === 'system' || value === 'light' || value === 'dark';

export async function createApp(repositories: Repositories): Promise<HTMLElement> {
  const route = parseHash(window.location.hash);
  const [tasks, projects, storedTheme, showAllUpcoming, historyEntries] = await Promise.all([
    repositories.tasks.list(),
    repositories.projects.list(),
    repositories.settings.get('theme'),
    repositories.settings.get('upcoming.showAll'),
    repositories.commandHistory.list(),
  ]);
  const store = createStore({
    ...initialState,
    ...route,
    activeProjectId: route.projectId,
    tasks,
    projects,
    theme: isTheme(storedTheme) ? storedTheme : 'system',
    showAllUpcoming: showAllUpcoming === true,
    loading: false,
  });
  applyTheme(store.getState().theme);
  const taskService = new TaskService(repositories.tasks);
  const projectService = new ProjectService(repositories.projects);
  const confirmation = createConfirmationDialog();
  const shell = document.createElement('main');
  shell.className = 'terminal-shell';
  const masthead = document.createElement('header');
  masthead.className = 'masthead';
  const brand = document.createElement('span');
  brand.textContent = 'TypeDone';
  masthead.append(brand);
  const feedback = document.createElement('section');
  feedback.className = 'command-feedback';
  feedback.setAttribute('aria-label', 'Command status');
  feedback.setAttribute('aria-live', 'polite');
  feedback.hidden = true;
  const feedbackMessage = document.createElement('pre');
  const feedbackActions = document.createElement('div');
  feedbackActions.className = 'feedback-actions';
  feedback.append(feedbackMessage, feedbackActions);
  let feedbackTimer: number | undefined;
  let currentUndo: UndoAction | null = null;

  const hideFeedback = (): void => {
    feedback.hidden = true;
    if (feedbackTimer !== undefined) window.clearTimeout(feedbackTimer);
  };
  const announce = (
    message: string,
    kind: 'success' | 'error' | 'info' = 'success',
    undo?: UndoAction,
  ): void => {
    if (feedbackTimer !== undefined) window.clearTimeout(feedbackTimer);
    feedback.hidden = false;
    feedback.dataset.kind = kind;
    feedbackMessage.textContent = message;
    feedbackActions.replaceChildren();
    if (undo) {
      currentUndo = undo;
      const undoButton = document.createElement('button');
      undoButton.type = 'button';
      undoButton.textContent = undo.label;
      undoButton.addEventListener('click', () => {
        undoButton.disabled = true;
        currentUndo = null;
        void undo.run().then(() => {
          announce('Action undone.');
        });
      });
      feedbackActions.append(undoButton);
    }
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.setAttribute('aria-label', 'Dismiss status');
    dismiss.textContent = 'Dismiss';
    dismiss.addEventListener('click', hideFeedback);
    feedbackActions.append(dismiss);
    if (kind === 'success') feedbackTimer = window.setTimeout(hideFeedback, 6000);
  };
  const recordHistory = async (input: string, succeeded: boolean): Promise<void> => {
    if (!input.trim()) return;
    await repositories.commandHistory.add({
      id: createId(),
      input: input.trim(),
      executedAt: new Date().toISOString(),
      succeeded,
    });
  };
  const execute = async (command: ParsedCommand): Promise<string> => {
    const state = store.getState();
    const visible = selectVisibleTasks(state);
    const resolveTask = (number: number): Task => {
      const task = visible[number - 1];
      if (!task) throw new Error(`Task ${String(number)} is not visible in this view.`);
      return task;
    };
    const resolveProject = (name: string): Project => {
      const normalized = normalizeProjectName(name);
      const project = state.projects.find(
        (candidate) => candidate.archivedAt === null && candidate.normalizedName === normalized,
      );
      if (!project) throw new Error(`Unknown directory “${name}”. Create it with: dir add ${name}`);
      return project;
    };
    const resolveArchivedProject = (name: string): Project => {
      const normalized = normalizeProjectName(name);
      const project = state.projects.find(
        (candidate) => candidate.archivedAt !== null && candidate.normalizedName === normalized,
      );
      if (!project)
        throw new Error(`Unknown archived directory “${name}”. List them with: dir archived`);
      return project;
    };
    const assertAvailableDirectoryName = (name: string): void => {
      if (
        BUILT_IN_DIRECTORIES.includes(
          normalizeProjectName(name) as (typeof BUILT_IN_DIRECTORIES)[number],
        )
      ) {
        throw new Error(`“${name}” is a built-in directory name.`);
      }
    };
    const replaceTask = (task: Task): void => {
      store.setState((current) => ({
        tasks: current.tasks.map((candidate) => (candidate.id === task.id ? task : candidate)),
      }));
    };
    switch (command.type) {
      case 'help': {
        const topic = command.topic?.toLocaleLowerCase().replace(/^\//, '') ?? null;
        return topic ? (HELP_TOPICS[topic] ?? `No help topic for “${topic}”.\n\n${HELP}`) : HELP;
      }
      case 'clear':
        hideFeedback();
        return '';
      case 'undo': {
        if (!currentUndo) throw new Error('There is nothing to undo.');
        const undo = currentUndo;
        currentUndo = null;
        await undo.run();
        return 'Action undone.';
      }
      case 'theme':
        applyTheme(command.theme);
        store.setState({ theme: command.theme });
        await repositories.settings.put('theme', command.theme);
        return `theme: ${command.theme}`;
      case 'legal':
        return command.document === 'privacy' ? PRIVACY_POLICY : TERMS_OF_SERVICE;
      case 'navigate':
        window.location.hash = routeToHash({
          view: command.view,
          projectId: null,
          searchQuery: '',
        });
        return `view: ${command.view}`;
      case 'navigate-project': {
        const project = resolveProject(command.projectName);
        window.location.hash = routeToHash({
          view: 'project',
          projectId: project.id,
          searchQuery: '',
        });
        return `view: ${project.name}`;
      }
      case 'project-list':
      case 'directory-list': {
        const userDirectories = state.projects
          .filter(({ archivedAt }) => archivedAt === null)
          .sort(
            (left, right) =>
              left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
          )
          .map(({ name }) => `  ${name}`);
        return `directories\n  inbox\n  today\n  upcoming\n  completed${userDirectories.length > 0 ? `\n${userDirectories.join('\n')}` : ''}\n\nopen with: /dir <name>\ncreate with: dir add <name>`;
      }
      case 'search':
        window.location.hash = routeToHash({
          view: 'search',
          projectId: null,
          searchQuery: command.query,
        });
        return `search: ${command.query}`;
      case 'show': {
        const task = resolveTask(command.taskNumber);
        const directory = task.projectId
          ? (state.projects.find(({ id }) => id === task.projectId)?.name ?? 'Unknown')
          : 'Inbox';
        return [
          task.title,
          `directory: ${directory}`,
          `due: ${task.dueDate ?? 'none'}`,
          `status: ${task.completedAt ? 'completed' : 'active'}`,
          `notes: ${task.notes || 'none'}`,
          `created: ${task.createdAt}`,
          ...(task.completedAt ? [`completed: ${task.completedAt}`] : []),
        ].join('\n');
      }
      case 'add': {
        let project: Project | null =
          state.activeView === 'project'
            ? (state.projects.find(
                (candidate) =>
                  candidate.id === state.activeProjectId && candidate.archivedAt === null,
              ) ?? null)
            : null;
        let availableProjects = state.projects;
        let createdProject = false;
        if (command.projectName) {
          assertAvailableDirectoryName(command.projectName);
          const normalized = normalizeProjectName(command.projectName);
          project =
            state.projects.find(
              (candidate) =>
                candidate.archivedAt === null && candidate.normalizedName === normalized,
            ) ?? null;
          if (!project) {
            project = await projectService.create(command.projectName, state.projects);
            availableProjects = [...state.projects, project];
            createdProject = true;
          }
        }
        const date = command.due
          ? parseDateExpression(command.due)
          : { status: 'success' as const, value: null };
        if (date.status === 'error') throw new Error(date.message);
        const task = await taskService.create(
          {
            title: command.title,
            notes: '',
            projectId: project?.id ?? null,
            dueDate: date.value,
          },
          availableProjects,
          state.tasks,
        );
        store.setState({
          projects: availableProjects,
          tasks: [...state.tasks, task],
          selectedTaskId: task.id,
        });
        return `${createdProject && project ? `created directory: ${project.name}\n` : ''}created: ${task.title}`;
      }
      case 'complete':
      case 'restore': {
        const current = resolveTask(command.taskNumber);
        const next = nextSelectionAfterRemoval(
          visible.map(({ id }) => id),
          current.id,
        );
        const task = await taskService.setCompleted(current.id, command.type === 'complete');
        replaceTask(task);
        store.setState({ selectedTaskId: next });
        announce(
          `${command.type === 'complete' ? 'completed' : 'restored'}: ${task.title}`,
          'success',
          {
            label: 'Undo',
            run: async () => {
              const restored = await taskService.setCompleted(
                current.id,
                current.completedAt !== null,
              );
              replaceTask(restored);
            },
          },
        );
        return '';
      }
      case 'delete': {
        const task = resolveTask(command.taskNumber);
        const confirmed = await confirmation.ask({
          title: 'Delete task permanently?',
          message: `“${task.title}” cannot be recovered.`,
          confirmLabel: 'Delete',
          destructive: true,
        });
        if (!confirmed) return 'delete cancelled';
        await taskService.delete(task.id);
        store.setState({
          tasks: state.tasks.filter(({ id }) => id !== task.id),
          selectedTaskId: null,
        });
        announce(`deleted: ${task.title}`, 'success', {
          label: 'Undo',
          run: async () => {
            await repositories.tasks.put(task);
            store.setState((current) => ({
              tasks: [...current.tasks, task],
              selectedTaskId: task.id,
            }));
          },
        });
        return '';
      }
      case 'edit': {
        const task = resolveTask(command.taskNumber);
        const input: TaskInput = {
          title: task.title,
          notes: task.notes,
          projectId: task.projectId,
          dueDate: task.dueDate,
        };
        if (command.field === 'title') input.title = command.value;
        if (command.field === 'project' || command.field === 'directory') {
          input.projectId =
            command.value.toLocaleLowerCase() === 'none' ? null : resolveProject(command.value).id;
        }
        if (command.field === 'due') {
          const date = parseDateExpression(command.value, new Date(), 'edit');
          if (date.status === 'error') throw new Error(date.message);
          input.dueDate = date.value;
        }
        const updated = await taskService.update(task.id, input, state.projects);
        replaceTask(updated);
        return `updated: ${updated.title}`;
      }
      case 'note': {
        const task = resolveTask(command.taskNumber);
        const updated = await taskService.update(
          task.id,
          {
            title: task.title,
            notes: command.value.toLocaleLowerCase() === 'none' ? '' : command.value,
            projectId: task.projectId,
            dueDate: task.dueDate,
          },
          state.projects,
        );
        replaceTask(updated);
        return `updated notes: ${updated.title}`;
      }
      case 'project-add': {
        assertAvailableDirectoryName(command.name);
        const project = await projectService.create(command.name, state.projects);
        store.setState({ projects: [...state.projects, project] });
        return `created directory: ${project.name}`;
      }
      case 'project-rename': {
        assertAvailableDirectoryName(command.newName);
        const project = resolveProject(command.currentName);
        const updated = await projectService.rename(project, command.newName, state.projects);
        store.setState({
          projects: state.projects.map((candidate) =>
            candidate.id === updated.id ? updated : candidate,
          ),
        });
        announce(`renamed directory: ${updated.name}`, 'success', {
          label: 'Undo',
          run: async () => {
            await repositories.projects.put(project);
            store.setState((current) => ({
              projects: current.projects.map((candidate) =>
                candidate.id === project.id ? project : candidate,
              ),
            }));
          },
        });
        return '';
      }
      case 'project-archive': {
        const project = resolveProject(command.name);
        const incomplete = state.tasks.filter(
          ({ projectId, completedAt }) => projectId === project.id && completedAt === null,
        ).length;
        if (incomplete > 0) {
          const confirmed = await confirmation.ask({
            title: 'Archive directory?',
            message: `${project.name} contains ${String(incomplete)} incomplete tasks.`,
            confirmLabel: 'Archive',
            destructive: true,
          });
          if (!confirmed) return 'archive cancelled';
        }
        const archived = await projectService.archive(project);
        store.setState({
          projects: state.projects.map((candidate) =>
            candidate.id === archived.id ? archived : candidate,
          ),
        });
        if (state.activeProjectId === archived.id) window.location.hash = '#/inbox';
        announce(`archived directory: ${archived.name}`, 'success', {
          label: 'Undo',
          run: async () => {
            await repositories.projects.put(project);
            store.setState((current) => ({
              projects: current.projects.map((candidate) =>
                candidate.id === project.id ? project : candidate,
              ),
            }));
          },
        });
        return '';
      }
      case 'project-archived': {
        const archived = state.projects
          .filter(({ archivedAt }) => archivedAt !== null)
          .sort((left, right) => left.name.localeCompare(right.name));
        return archived.length > 0
          ? `archived directories\n${archived.map(({ name }) => `  ${name}`).join('\n')}\n\nrestore with: dir restore <name>`
          : 'archived directories\n  none';
      }
      case 'project-restore': {
        const project = resolveArchivedProject(command.name);
        const restored = await projectService.restore(project);
        store.setState({
          projects: state.projects.map((candidate) =>
            candidate.id === restored.id ? restored : candidate,
          ),
        });
        announce(`restored directory: ${restored.name}`, 'success', {
          label: 'Undo',
          run: async () => {
            await repositories.projects.put(project);
            store.setState((current) => ({
              projects: current.projects.map((candidate) =>
                candidate.id === project.id ? project : candidate,
              ),
            }));
          },
        });
        return '';
      }
      case 'project-delete': {
        const project = resolveProject(command.name);
        const affectedTasks = state.tasks.filter(({ projectId }) => projectId === project.id);
        const confirmed = await confirmation.ask({
          title: 'Delete directory?',
          message:
            affectedTasks.length > 0
              ? `${project.name} contains ${String(affectedTasks.length)} task${affectedTasks.length === 1 ? '' : 's'}. They will be moved to Inbox.`
              : `${project.name} will be permanently deleted.`,
          confirmLabel: 'Delete',
          destructive: true,
        });
        if (!confirmed) return 'delete cancelled';
        const movedTasks = await Promise.all(
          affectedTasks.map((task) =>
            taskService.update(
              task.id,
              {
                title: task.title,
                notes: task.notes,
                projectId: null,
                dueDate: task.dueDate,
              },
              state.projects,
            ),
          ),
        );
        await projectService.delete(project);
        const movedById = new Map(movedTasks.map((task) => [task.id, task]));
        store.setState({
          projects: state.projects.filter(({ id }) => id !== project.id),
          tasks: state.tasks.map((task) => movedById.get(task.id) ?? task),
        });
        if (state.activeProjectId === project.id) window.location.hash = '#/inbox';
        announce(`deleted directory: ${project.name}`, 'success', {
          label: 'Undo',
          run: async () => {
            await repositories.projects.put(project);
            await Promise.all(affectedTasks.map((task) => repositories.tasks.put(task)));
            store.setState((current) => ({
              projects: [...current.projects, project],
              tasks: current.tasks.map(
                (task) => affectedTasks.find(({ id }) => id === task.id) ?? task,
              ),
            }));
          },
        });
        return '';
      }
    }
  };
  const run = async (input: string): Promise<boolean> => {
    const parsed = parseCommand(input);
    if (parsed.status !== 'success') {
      announce(parsed.message, 'error');
      await recordHistory(input, false);
      return false;
    }
    try {
      const message = await execute(parsed.command);
      if (message)
        announce(
          message,
          parsed.command.type === 'help' || parsed.command.type === 'legal' ? 'info' : 'success',
        );
      await recordHistory(input, true);
      return true;
    } catch (error) {
      console.error(error);
      announce(
        error instanceof Error ? error.message : 'The command could not be completed.',
        'error',
      );
      await recordHistory(input, false);
      return false;
    }
  };

  const commandBar = createCommandBar(
    historyEntries.filter(({ succeeded }) => succeeded).map(({ input }) => input),
    run,
    (input) => {
      const raw = input.trim().toLocaleLowerCase();
      const slash = raw.startsWith('/');
      const command = raw.replace(/^\//, '');
      const topLevel = [
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
      if (!command.includes(' ')) {
        const exact = topLevel.some(([value]) => value === command);
        const needsArguments = [
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
        ];
        if (!exact || raw === '/') {
          const matches = topLevel.filter(([value]) => value.startsWith(command));
          if (matches.length > 0 || raw === '/') {
            return matches.map(([value, label]) => ({
              label: `${value} — ${label}`,
              value: `${slash ? '/' : ''}${value}`,
              submit: !needsArguments.includes(value),
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
          value: `${slash ? '/' : ''}dir ${name.toLocaleLowerCase()}`,
        }));
        const userDirectories = store
          .getState()
          .projects.filter(({ archivedAt }) => archivedAt === null)
          .sort(
            (left, right) =>
              left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
          )
          .map(({ name }) => ({ label: name, value: `${slash ? '/' : ''}dir ${name}` }));
        return [...builtIns, ...userDirectories];
      }
      if (command === 'theme') {
        return (['system', 'light', 'dark'] as const).map((theme) => ({
          label: `${theme} theme`,
          value: `${slash ? '/' : ''}theme ${theme}`,
        }));
      }
      const dateMatch = /(?:due|-d)\s+([^\s]*)$/i.exec(input);
      if (dateMatch) {
        const prefix = dateMatch[1]?.toLocaleLowerCase() ?? '';
        const dates = ['today', 'tomorrow', 'monday', 'friday'];
        if (dates.includes(prefix)) return [];
        return dates
          .filter((value) => value.startsWith(prefix))
          .map((value) => ({
            label: value,
            value: input.slice(0, input.length - prefix.length) + value,
            submit: false,
          }));
      }
      const taskCommands = [
        'done',
        'complete',
        'x',
        'restore',
        'show',
        'view',
        'delete',
        'edit',
        'note',
      ];
      if (!taskCommands.includes(command)) return [];
      return selectVisibleTasks(store.getState()).map((task, index) => ({
        label: `${String(index + 1).padStart(2, '0')}  ${task.title}`,
        value: `${slash ? '/' : ''}${command} ${String(index + 1)}${command === 'edit' || command === 'note' ? ' ' : ''}`,
        submit: command !== 'edit' && command !== 'note',
      }));
    },
  );
  const taskList = createTaskList(
    store,
    (taskNumber, completed) => {
      void run(`/${completed ? 'restore' : 'done'} ${String(taskNumber)}`);
    },
    (value) => {
      commandBar.focus(value);
    },
  );
  shell.append(masthead, feedback, commandBar.element, taskList, confirmation.element);
  const updatePrompt = (): void => {
    const current = store.getState();
    const project = current.projects.find(({ id }) => id === current.activeProjectId);
    const location =
      current.activeView === 'project'
        ? (project?.name ?? 'missing-directory')
        : current.activeView;
    commandBar.setPrompt(`~/${location} >`);
  };
  updatePrompt();
  store.subscribe(updatePrompt);
  installRouting(store);
  installKeyboard(store, commandBar, run);
  window.setTimeout(() => {
    commandBar.focus();
  }, 0);
  return shell;
}

function installRouting(store: AppStore): void {
  const sync = (): void => {
    const route = parseHash(window.location.hash);
    store.setState({
      activeView: route.view,
      activeProjectId: route.projectId,
      searchQuery: route.searchQuery,
      selectedTaskId: null,
    });
  };
  window.addEventListener('hashchange', sync);
  if (!window.location.hash) window.location.replace('#/inbox');
}

function installKeyboard(
  store: AppStore,
  bar: CommandBarController,
  run: (input: string) => Promise<boolean>,
): void {
  window.addEventListener('keydown', (event) => {
    const target = event.target;
    const editing =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable);
    if (editing) return;
    if (
      event.key === '/' ||
      ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')
    ) {
      event.preventDefault();
      bar.focus();
      return;
    }
    if (event.key === '?') {
      event.preventDefault();
      void run('help');
      return;
    }
    if (event.key.toLowerCase() === 'n') {
      event.preventDefault();
      bar.focus('add ');
      return;
    }
    const tasks = selectVisibleTasks(store.getState());
    if (event.key.toLowerCase() === 'x' && store.getState().selectedTaskId) {
      const index = tasks.findIndex(({ id }) => id === store.getState().selectedTaskId);
      if (index >= 0) {
        void run(
          `/${store.getState().activeView === 'completed' ? 'restore' : 'done'} ${String(index + 1)}`,
        );
      }
      return;
    }
    if (!['j', 'k', 'ArrowDown', 'ArrowUp'].includes(event.key) || tasks.length === 0) return;
    event.preventDefault();
    const current = tasks.findIndex(({ id }) => id === store.getState().selectedTaskId);
    const down = event.key === 'j' || event.key === 'ArrowDown';
    const index = down
      ? Math.min(current + 1, tasks.length - 1)
      : Math.max(current < 0 ? tasks.length - 1 : current - 1, 0);
    store.setState({ selectedTaskId: tasks[index]?.id ?? null });
  });
}

function applyTheme(theme: Theme): void {
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}
