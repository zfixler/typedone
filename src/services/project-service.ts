import type { Project } from '../domain/models';
import type { ProjectRepository } from '../database/types';
import { normalizeProjectName, validateProject } from '../domain/validation';
import { createId } from '../utilities/ids';

export class ProjectService {
  constructor(private readonly repository: ProjectRepository) {}

  async create(name: string, projects: readonly Project[]): Promise<Project> {
    const now = new Date().toISOString();
    const project: Project = {
      id: createId(),
      name: name.trim(),
      normalizedName: normalizeProjectName(name),
      color: null,
      sortOrder: Math.max(-1, ...projects.map(({ sortOrder }) => sortOrder)) + 1,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.assertValid(project, projects);
    await this.repository.put(project);
    return project;
  }

  async rename(project: Project, name: string, projects: readonly Project[]): Promise<Project> {
    const updated = {
      ...project,
      name: name.trim(),
      normalizedName: normalizeProjectName(name),
      updatedAt: new Date().toISOString(),
    };
    this.assertValid(updated, projects);
    await this.repository.put(updated);
    return updated;
  }

  async archive(project: Project): Promise<Project> {
    const now = new Date().toISOString();
    const updated = { ...project, archivedAt: now, updatedAt: now };
    await this.repository.put(updated);
    return updated;
  }

  async delete(project: Project): Promise<void> {
    await this.repository.delete(project.id);
  }

  private assertValid(project: Project, projects: readonly Project[]): void {
    const issues = validateProject(project, projects);
    if (issues.length > 0) throw new Error(issues.map(({ message }) => message).join(' '));
  }
}
