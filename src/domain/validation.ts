import type { Project, Task } from './models';
import { isDateOnly } from '../utilities/dates';

export interface ValidationIssue {
  field: string;
  message: string;
}

export const normalizeProjectName = (name: string): string => name.trim().toLocaleLowerCase();

const isIsoInstant = (value: string): boolean => {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
};

const validateTimestamp = (
  value: string | null,
  field: string,
  issues: ValidationIssue[],
): void => {
  if (value !== null && !isIsoInstant(value)) {
    issues.push({ field, message: 'Must be an ISO 8601 instant.' });
  }
};

export function validateTask(task: Task, projects: readonly Project[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const title = task.title.trim();

  if (title.length === 0 || title.length > 300) {
    issues.push({ field: 'title', message: 'Title must be between 1 and 300 characters.' });
  }
  if (task.notes.length > 10_000) {
    issues.push({ field: 'notes', message: 'Notes must be at most 10,000 characters.' });
  }
  if (task.dueDate !== null && !isDateOnly(task.dueDate)) {
    issues.push({ field: 'dueDate', message: 'Due date must be a real date in YYYY-MM-DD form.' });
  }
  if (!Number.isFinite(task.sortOrder)) {
    issues.push({ field: 'sortOrder', message: 'Sort order must be a finite number.' });
  }
  if (task.projectId !== null) {
    const project = projects.find(({ id }) => id === task.projectId);
    if (project?.archivedAt !== null) {
      issues.push({ field: 'projectId', message: 'Directory must exist and be active.' });
    }
  }

  validateTimestamp(task.completedAt, 'completedAt', issues);
  validateTimestamp(task.createdAt, 'createdAt', issues);
  validateTimestamp(task.updatedAt, 'updatedAt', issues);
  return issues;
}

export function validateProject(
  project: Project,
  existingProjects: readonly Project[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const name = project.name.trim();

  if (name.length === 0 || name.length > 60) {
    issues.push({ field: 'name', message: 'Directory name must be between 1 and 60 characters.' });
  }

  const normalizedName = normalizeProjectName(project.name);
  if (project.normalizedName !== normalizedName) {
    issues.push({ field: 'normalizedName', message: 'Normalized name does not match the name.' });
  }

  const duplicate = existingProjects.some(
    (candidate) =>
      candidate.id !== project.id &&
      candidate.archivedAt === null &&
      candidate.normalizedName === normalizedName,
  );
  if (project.archivedAt === null && duplicate) {
    issues.push({ field: 'name', message: 'An active directory with this name already exists.' });
  }
  if (!Number.isFinite(project.sortOrder)) {
    issues.push({ field: 'sortOrder', message: 'Sort order must be a finite number.' });
  }

  validateTimestamp(project.archivedAt, 'archivedAt', issues);
  validateTimestamp(project.createdAt, 'createdAt', issues);
  validateTimestamp(project.updatedAt, 'updatedAt', issues);
  return issues;
}
