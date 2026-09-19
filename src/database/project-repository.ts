import type { Project } from '../domain/models';
import { requestResult, transactionComplete } from './database';
import { STORE_NAMES } from './migrations';
import type { ProjectRepository } from './types';

export class IndexedDbProjectRepository implements ProjectRepository {
  constructor(private readonly database: IDBDatabase) {}

  list(): Promise<Project[]> {
    const transaction = this.database.transaction(STORE_NAMES.projects, 'readonly');
    return requestResult(
      transaction.objectStore(STORE_NAMES.projects).getAll() as IDBRequest<Project[]>,
    );
  }

  get(id: string): Promise<Project | undefined> {
    const transaction = this.database.transaction(STORE_NAMES.projects, 'readonly');
    return requestResult(
      transaction.objectStore(STORE_NAMES.projects).get(id) as IDBRequest<Project | undefined>,
    );
  }

  async put(project: Project): Promise<void> {
    const transaction = this.database.transaction(STORE_NAMES.projects, 'readwrite');
    transaction.objectStore(STORE_NAMES.projects).put(project);
    await transactionComplete(transaction);
  }

  async delete(id: string): Promise<void> {
    const transaction = this.database.transaction(STORE_NAMES.projects, 'readwrite');
    transaction.objectStore(STORE_NAMES.projects).delete(id);
    await transactionComplete(transaction);
  }
}
