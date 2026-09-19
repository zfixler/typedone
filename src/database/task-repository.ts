import type { Task } from '../domain/models';
import { STORE_NAMES } from './migrations';
import { requestResult, transactionComplete } from './database';
import type { TaskRepository } from './types';

export class IndexedDbTaskRepository implements TaskRepository {
  constructor(private readonly database: IDBDatabase) {}

  list(): Promise<Task[]> {
    const transaction = this.database.transaction(STORE_NAMES.tasks, 'readonly');
    return requestResult(transaction.objectStore(STORE_NAMES.tasks).getAll() as IDBRequest<Task[]>);
  }

  get(id: string): Promise<Task | undefined> {
    const transaction = this.database.transaction(STORE_NAMES.tasks, 'readonly');
    return requestResult(
      transaction.objectStore(STORE_NAMES.tasks).get(id) as IDBRequest<Task | undefined>,
    );
  }

  async put(task: Task): Promise<void> {
    const transaction = this.database.transaction(STORE_NAMES.tasks, 'readwrite');
    transaction.objectStore(STORE_NAMES.tasks).put(task);
    await transactionComplete(transaction);
  }

  async delete(id: string): Promise<void> {
    const transaction = this.database.transaction(STORE_NAMES.tasks, 'readwrite');
    transaction.objectStore(STORE_NAMES.tasks).delete(id);
    await transactionComplete(transaction);
  }
}
