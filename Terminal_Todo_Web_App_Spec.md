# Terminal-Style Todo Web App — Product and Implementation Specification

**Status:** Ready for implementation  
**Version:** 1.0  
**Audience:** Coding agent or developer  
**Product type:** Single-user, local-first web application  

## 1. Product Summary

Build a small personal todo web app that captures the speed and simplicity of a terminal todo application while remaining approachable through conventional clickable controls.

The application must be keyboard-first, but not keyboard-only. A persistent command bar is the fastest way to add, find, navigate, and update tasks. Every essential operation must also have a visible mouse/touch interaction.

This is a genuinely vanilla web application. Do not introduce a frontend framework, component library, CSS framework, backend, hosted database, user-account system, or production runtime dependency unless this specification is revised.

## 2. Product Principles

1. **Immediate:** Opening the app and capturing a task should take only a few seconds.
2. **Keyboard-first:** The complete core workflow must be possible without a mouse.
3. **Discoverable:** Users must not need to memorize commands before using the app.
4. **Forgiving:** Commands should accept aliases, flexible whitespace, and case-insensitive keywords.
5. **Local-first:** The app must work offline and store data in the browser.
6. **Small:** Prefer browser APIs and straightforward code over abstractions and dependencies.
7. **Calm:** The interface should feel like a focused developer tool, not a novelty terminal simulation.

## 3. Target User

The MVP is for one technically comfortable user. It does not need collaboration, sharing, teams, roles, or public registration.

The user may eventually want cross-device access, but synchronization is explicitly outside the MVP. The architecture must avoid making a future JSON API impossible, but it does not need to implement one now.

## 4. MVP Scope

### 4.1 Included

- Create, view, edit, complete, restore, and delete tasks.
- Create, rename, reorder, and archive projects.
- Assign zero or one project to a task.
- Assign an optional calendar due date to a task.
- Add optional plain-text notes to a task.
- Inbox, Today, Upcoming, Project, and Completed views.
- Persistent command bar with parsing, execution, history, suggestions, and help.
- Keyboard navigation and shortcuts.
- Clickable and touch-friendly equivalents for core actions.
- Local persistence in IndexedDB.
- Import and export of all user data as versioned JSON.
- Light and dark themes, including automatic system-theme selection.
- Responsive behavior suitable for desktop and mobile browsers.
- Offline use after the initial load.
- Unit and end-to-end tests for critical behavior.

### 4.2 Explicitly excluded

- Accounts or authentication.
- Backend services or server-side rendering.
- Cross-device synchronization.
- Collaboration or shared lists.
- Recurring tasks.
- Reminders, push notifications, or email.
- Subtasks or task dependencies.
- Task priority levels.
- Tags or labels.
- Attachments.
- Calendar integrations.
- Natural-language AI features.
- Markdown or rich-text notes.
- Drag-and-drop as a required interaction.
- Exact due times; due values are calendar dates only.

Do not add excluded capabilities opportunistically.

## 5. Technical Stack and Constraints

### 5.1 Required stack

- Vite
- TypeScript with `strict: true`
- Semantic HTML
- Modern vanilla CSS
- Native DOM APIs
- IndexedDB
- Vitest
- Playwright
- ESLint and Prettier
- pnpm

### 5.2 Dependency policy

The application must begin with **zero production dependencies**. Development dependencies are allowed for building, linting, formatting, and testing.

Do not add a date library, state library, router, IndexedDB wrapper, template library, UI toolkit, icon library, or command parser package for the MVP. If a production dependency becomes necessary, document the exact limitation that requires it and request approval before adding it.

### 5.3 Browser support

Support current stable versions of Chrome, Edge, Firefox, and Safari. Progressive enhancement is acceptable for optional polish, but all core features must work in each supported browser.

## 6. Core Information Architecture

The app has one main workspace with three persistent conceptual areas:

1. **Sidebar/navigation** — Inbox, Today, Upcoming, projects, and Completed.
2. **Main task list** — Tasks belonging to the active view.
3. **Command bar** — Persistent entry point for commands and task capture.

Task details open in a native `<dialog>` on wider screens and may use a full-screen dialog presentation on narrow screens. Do not create separate pages for task creation or task editing.

### 6.1 Views

#### Inbox

Shows incomplete tasks with no project. Sort by manual order, then creation date as a stable fallback.

#### Today

Shows incomplete tasks whose due date is today or earlier. Overdue tasks must be visually distinguishable but not alarmist. Sort overdue dates first, then today, then manual order.

#### Upcoming

Shows incomplete tasks due after today, grouped by calendar date. Initially show the next 30 days; provide a simple control to show all future tasks.

#### Project

Shows incomplete tasks assigned to the selected project. Sort by manual order. Show due dates where present.

#### Completed

Shows completed tasks in descending completion order. Allow a task to be restored. This view may group tasks by completion date.

### 6.2 Empty states

Each view must show a short, useful empty state. Where appropriate, include a clickable example command that places the example into the command bar without immediately executing it.

## 7. Data Model

Use string IDs generated with `crypto.randomUUID()`.

```ts
export interface Project {
  id: string;
  name: string;
  normalizedName: string;
  color: string | null;
  sortOrder: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string | null;
  title: string;
  notes: string;
  dueDate: string | null; // YYYY-MM-DD in the user's local calendar
  sortOrder: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommandHistoryEntry {
  id: string;
  input: string;
  executedAt: string;
  succeeded: boolean;
}
```

Timestamps must be ISO 8601 instants. `dueDate` must be a date-only local-calendar value and must never be converted to midnight UTC.

### 7.1 Validation rules

- Task title: trimmed, 1–300 characters.
- Task notes: 0–10,000 characters.
- Project name: trimmed, 1–60 characters.
- Active project names must be unique case-insensitively.
- A task may reference only an existing, non-archived project.
- A due date must be a real calendar date serialized as `YYYY-MM-DD`.
- Archived projects remain referenced by existing tasks but are hidden from normal project navigation.
- Deleting a project is not part of the MVP; archive it instead.
- Deleting a task is permanent and requires confirmation.

## 8. Persistence

Use a dedicated IndexedDB database. Suggested name: `terminal-todo`.

### 8.1 Object stores

- `tasks`, keyed by `id`
- `projects`, keyed by `id`
- `commandHistory`, keyed by `id`
- `settings`, keyed by setting name
- `metadata`, keyed by metadata name, including schema version

Create useful indexes for `projectId`, `dueDate`, `completedAt`, and normalized project name where supported by the record shape.

### 8.2 Database boundaries

DOM and command modules must not call IndexedDB directly. Access persistence through repository interfaces so that a future remote implementation can satisfy the same application-level contracts.

```ts
export interface TaskRepository {
  list(): Promise<Task[]>;
  get(id: string): Promise<Task | undefined>;
  put(task: Task): Promise<void>;
  delete(id: string): Promise<void>;
}
```

Equivalent interfaces should exist for projects, settings, and command history.

### 8.3 Migrations

Implement explicit schema migrations driven by the IndexedDB version. Never delete the database to resolve a schema change. Seed no sample tasks automatically.

## 9. Import and Export

Export a single UTF-8 JSON file with this shape:

```ts
interface ExportFileV1 {
  format: "terminal-todo-export";
  version: 1;
  exportedAt: string;
  projects: Project[];
  tasks: Task[];
  settings: Record<string, unknown>;
}
```

Command history should not be exported.

Import must:

1. Parse and validate the complete file before writing anything.
2. Reject unsupported versions with a clear message.
3. Show counts of projects and tasks before confirmation.
4. Offer only a full replacement import in the MVP.
5. Write the replacement atomically in one transaction where possible.
6. Preserve the existing database if validation or writing fails.

## 10. Command Language

### 10.1 General behavior

- Commands are case-insensitive, except task titles and note text preserve their original case.
- Ignore leading, trailing, and repeated whitespace outside quoted values.
- Support quoted multiword values using `"..."`.
- Do not execute an incomplete or ambiguous destructive command.
- The parser must return structured success, incomplete, or error results; it must never throw for user input.
- Parsing and execution must be separate modules.
- Commands must operate on stable task IDs internally. Displayed task numbers are temporary aliases based on the currently rendered view.

### 10.2 Required commands

#### Add a task

```text
add Buy chicken feed
add Send revised quote due tomorrow
add Schedule inspection project work due 2026-09-25
a Call insurance due friday project personal
```

Grammar:

```text
(add|a) <title> [project <project-name>] [due <date-expression>]
```

`project` and `due` clauses may appear in either order. If keywords need to be part of a title, quoted titles must disambiguate them.

#### Complete a task

```text
done 3
complete 3
x 3
```

#### Restore a task

```text
restore 3
```

#### Edit a task

```text
edit 3 title Send final quote
edit 3 due friday
edit 3 due none
edit 3 project home
edit 3 project none
```

#### Add or replace notes

```text
note 3 Ask about the revised drawing
note 3 none
```

#### Delete a task

```text
delete 3
```

This command must open a confirmation UI. It must not immediately delete.

#### Navigate

```text
inbox
today
upcoming
completed
project home
p home
```

#### Search

```text
find invoice
search revised drawing
f invoice
```

Search title and notes case-insensitively. Search is substring-based in the MVP.

#### Projects

```text
project add Home
project rename Home House
project archive Home
```

Archiving requires confirmation when the project contains incomplete tasks.

#### Help

```text
help
help add
?
```

Show command syntax and examples without leaving the current view.

### 10.3 Date expressions

Support only:

- `today`
- `tomorrow`
- `yesterday` when editing an existing task
- Full weekday names and unambiguous three-letter forms
- ISO dates: `YYYY-MM-DD`
- US numeric dates: `M/D` and `M/D/YYYY`
- `none` for removing a due date

A weekday refers to the next occurrence, including today when the named weekday is today. A numeric date without a year refers to the next occurrence of that month/day that is not in the past.

Invalid or impossible dates must produce an error rather than being normalized by the JavaScript `Date` constructor.

### 10.4 Suggestions and errors

While typing, show context-sensitive suggestions for:

- Command names and aliases
- Project names after `project`
- Date keywords after `due`
- Matching task numbers/titles where a task target is expected

Errors must be concise and actionable. Example:

```text
Unknown project “shop”. Create it with: project add Shop
```

Do not erase unsuccessful input. On success, clear the input and announce the outcome.

### 10.5 Command history

- Up and Down navigate recent successfully submitted command text.
- Store at most the latest 100 entries.
- Consecutive identical inputs should be stored once.
- Command history is local to the browser and can be cleared from Settings.

## 11. Keyboard Interaction

Required shortcuts when focus is not inside another editable field:

| Shortcut | Action |
| --- | --- |
| `/` | Focus command bar |
| `Ctrl/Cmd + K` | Focus command bar and show command suggestions |
| `j` or `ArrowDown` | Select next visible task |
| `k` or `ArrowUp` | Select previous visible task |
| `Enter` | Open selected task details |
| `x` | Complete or restore selected task, depending on view |
| `e` | Edit selected task title |
| `n` | Focus command bar prefilled with `add ` |
| `Escape` | Close suggestions/dialog or return focus to task list |
| `?` | Open keyboard and command help |

Never intercept a shortcut while the user is typing in an input, textarea, select, or content-editable region, except Escape and explicitly documented command-history behavior.

Visible focus indicators are required. After completing, restoring, or deleting a task, selection should move predictably to the next item, then the previous item if no next item exists.

## 12. Mouse and Touch Interaction

Every core action must have a visible equivalent:

- Checkbox/button to complete or restore.
- Task row or explicit details button to open details.
- Add-task button that focuses or prefills the command bar.
- Project controls for create, rename, reorder, and archive.
- Date input in task details.
- Project select in task details.
- Delete button in task details with confirmation.
- Navigation buttons/links for each view.

Touch targets should be at least 44 by 44 CSS pixels where practical.

## 13. Task Detail Dialog

The task detail interface must provide:

- Editable title.
- Project select with Inbox/none option.
- Native date input plus clear control.
- Plain-text notes textarea.
- Read-only created and completed timestamps.
- Complete/restore action.
- Permanent delete action with confirmation.

Save field edits on explicit submit or a clearly indicated Save action. Do not rely solely on blur. Closing with unsaved changes must prompt the user to discard or continue editing.

## 14. State Management and Rendering

Use a small explicit store written in TypeScript. Do not add a state library.

```ts
export interface AppState {
  activeView: "inbox" | "today" | "upcoming" | "project" | "completed" | "search";
  activeProjectId: string | null;
  searchQuery: string;
  selectedTaskId: string | null;
  tasks: Task[];
  projects: Project[];
  theme: "system" | "light" | "dark";
  loading: boolean;
}
```

Prefer targeted DOM updates over replacing the entire application with `innerHTML`. Use native `<template>` elements, `DocumentFragment`, event delegation, and persistent layout regions. User-provided strings must be inserted with `textContent` or form values, never interpolated into HTML.

Separate these concerns:

- Domain models and validation
- Repositories/persistence
- Application services/use cases
- Command parsing
- Command execution
- State
- DOM views/controllers
- Date utilities

## 15. Suggested Project Structure

```text
src/
  main.ts
  index.html
  app/
    app.ts
    state.ts
    actions.ts
    routes.ts
  domain/
    task.ts
    project.ts
    validation.ts
  commands/
    types.ts
    tokenize.ts
    parser.ts
    execute.ts
    suggestions.ts
    help.ts
  database/
    database.ts
    migrations.ts
    task-repository.ts
    project-repository.ts
    settings-repository.ts
    command-history-repository.ts
  services/
    task-service.ts
    project-service.ts
    import-export-service.ts
  ui/
    sidebar.ts
    task-list.ts
    task-row.ts
    command-bar.ts
    task-dialog.ts
    confirmation-dialog.ts
    toast.ts
    empty-state.ts
  utilities/
    dates.ts
    ids.ts
    keyboard.ts
    strings.ts
  styles/
    tokens.css
    base.css
    layout.css
    components.css
    themes.css
tests/
  e2e/
```

The exact split may change if a simpler organization emerges, but do not collapse parsing, persistence, and DOM behavior into a single module.

## 16. Routing and URLs

Use the History API or hash routing without a routing dependency. Refreshing or bookmarking a view must work.

Suggested routes:

```text
/#/inbox
/#/today
/#/upcoming
/#/projects/<project-id>
/#/completed
/#/search?q=invoice
```

Use project IDs in URLs so renaming a project does not break links.

## 17. Visual Design

The visual direction is a calm, compact developer tool—not a simulated CRT terminal.

Requirements:

- Use a readable system sans-serif font for general UI.
- Use a system monospace stack for the command bar, command help, and task numbers.
- Use CSS custom properties for all design tokens.
- Support light, dark, and system themes.
- Keep task rows dense on desktop while preserving touch usability on mobile.
- Use color as enhancement, never as the only status signal.
- Avoid gratuitous animation. Respect `prefers-reduced-motion`.
- Do not use emoji as interface icons. Prefer text labels or small inline SVGs authored in the project.
- The command prompt should be recognizable without making the whole interface look like a terminal emulator.

## 18. Accessibility

Target WCAG 2.2 AA for the MVP.

- Use semantic landmarks, headings, lists, buttons, labels, and dialogs.
- All functionality must be keyboard accessible.
- Maintain logical focus when views change and dialogs close.
- Announce command success and errors with an appropriate ARIA live region.
- Ensure sufficient contrast in both themes.
- Do not remove browser focus outlines without a visible replacement.
- Associate visible or screen-reader labels with every form field.
- Make task completion state available to assistive technology.
- Use `aria-current` for active navigation.
- Test at 200% zoom and with reduced motion.

## 19. Offline Behavior

The production build must be usable after the initial successful load while offline.

Implement a minimal service worker that caches only the application shell and versioned static assets. Do not cache imported/exported user files. Updates should activate predictably and should not silently discard unsaved edits.

If service-worker implementation would materially delay the core application, complete it after all other MVP acceptance criteria but before declaring the MVP finished.

## 20. Error Handling

- Show a blocking recovery screen if IndexedDB cannot be opened.
- Show actionable inline errors for invalid fields and commands.
- Use non-blocking status messages for successful actions.
- Log unexpected errors to the console in development.
- Do not claim an action succeeded until persistence succeeds.
- If persistence fails, retain the user's input and restore the prior in-memory state.
- Global error handling must not expose a stack trace in the interface.

## 21. Testing Requirements

### 21.1 Unit tests

At minimum, test:

- Every required command and alias.
- Tokenization, quoted text, repeated whitespace, and case handling.
- Incomplete, unknown, and invalid commands.
- Date expressions at month, year, and daylight-saving boundaries.
- Leap-year and invalid-date handling.
- Project-name uniqueness.
- Task and project validation.
- View filtering and sorting.
- Export validation and import rejection.
- Selection movement after task removal from a view.

Command parser tests should be table-driven and must not require the DOM or IndexedDB.

### 21.2 End-to-end tests

At minimum, test these user journeys in Chromium and one additional browser engine:

1. Create projects and tasks entirely from the command bar.
2. Create a task using clickable controls.
3. Add a due date and confirm appearance in Today or Upcoming.
4. Navigate and complete a task entirely by keyboard.
5. Open a task, edit notes, reload, and verify persistence.
6. Complete and restore a task.
7. Delete a task and confirm cancellation and approval paths.
8. Export, replace local data, import, and confirm restoration.
9. Reload a bookmarked project URL.
10. Load the app after assets have been cached and the browser is offline.

## 22. Definition of Done

The MVP is done only when:

- All included scope is implemented.
- No excluded scope has been added.
- TypeScript passes with strict checking and no suppressed errors used to bypass design problems.
- Linting and formatting checks pass.
- Unit and end-to-end tests pass.
- Production build succeeds.
- Core workflows work with keyboard, mouse, and touch.
- Data survives reload and browser restart.
- Import/export round-trips without losing supported fields.
- The app works offline after one successful online load.
- Both themes are readable and accessible.
- There are no known high-severity accessibility failures.
- The README explains setup, scripts, architecture, command syntax, storage limitations, backup/export, and deployment.

## 23. Acceptance Scenarios

### Scenario A: Rapid capture

Given the user is on any view, when they press `/`, type:

```text
add Send revised quote due tomorrow project Work
```

and press Enter, then the task is persisted, assigned to Work, due tomorrow, displayed when relevant, and confirmed through an accessible status message.

### Scenario B: Keyboard review

Given Today contains at least three tasks, the user can select tasks using `j` and `k`, complete the selected task with `x`, and continue navigating without focus being lost.

### Scenario C: Clickable workflow

Given the user does not know any commands, they can create a task, assign its project and date, add notes, complete it, and restore it using visible controls.

### Scenario D: Invalid input

Given the user enters an impossible date or unknown project, no task is created, their input remains available, and the app explains how to correct the problem.

### Scenario E: Durable local data

Given the user creates projects and tasks, closing and reopening the browser preserves the data. Exporting and re-importing the data restores the same projects, tasks, dates, completion states, and settings.

## 24. Implementation Sequence

Implement in this order unless a concrete dependency requires a small adjustment:

1. Scaffold Vite, strict TypeScript, linting, formatting, Vitest, and Playwright.
2. Define domain models, validation, date utilities, and their unit tests.
3. Implement IndexedDB schema, migrations, and repositories.
4. Build the static semantic layout and design tokens.
5. Implement state, view filtering, sidebar navigation, task list, and task dialog.
6. Implement clickable task/project CRUD workflows.
7. Implement tokenizer, parser, parser tests, and command execution.
8. Add suggestions, help, history, and error/status feedback.
9. Add global keyboard navigation and focus management.
10. Add import/export and settings.
11. Add responsive styling, themes, and accessibility refinements.
12. Add the service worker and verify offline operation.
13. Complete end-to-end coverage, README, and final acceptance testing.

Each stage should leave the repository runnable and tests passing.

## 25. Agent Instructions

- Read this entire specification before modifying files.
- Inspect the existing repository and preserve unrelated user changes.
- Use pnpm for all package-management commands.
- Prefer small, testable modules and platform APIs.
- Do not introduce a framework or production dependency without explicit approval.
- Do not expand the product scope.
- When a requirement is ambiguous, choose the smallest behavior consistent with the product principles and document the decision.
- Implement actual functionality; do not leave placeholder controls, fake persistence, or TODO-based completion claims.
- Run type checking, linting, unit tests, end-to-end tests, and the production build before handoff.
- Report any remaining limitation explicitly.

## 26. Future Extension Points (Not MVP Work)

These are listed only to prevent avoidable architectural dead ends:

- A repository implementation backed by a JSON API.
- Single-user authentication and multi-device synchronization.
- Recurring tasks and reminders.
- Tags, saved filters, and priorities.
- Installable PWA enhancements.
- Optimistic synchronization and conflict handling.

Do not implement speculative abstractions for these features. Clear domain and repository boundaries are sufficient preparation.
