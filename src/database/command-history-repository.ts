import type { CommandHistoryEntry } from '../domain/models';
import { requestResult, transactionComplete } from './database';
import { STORE_NAMES } from './migrations';
import type { CommandHistoryRepository } from './types';

const HISTORY_LIMIT = 100;

export class IndexedDbCommandHistoryRepository implements CommandHistoryRepository {
  constructor(private readonly database: IDBDatabase) {}

  async list(): Promise<CommandHistoryEntry[]> {
    const transaction = this.database.transaction(STORE_NAMES.commandHistory, 'readonly');
    const entries = await requestResult(
      transaction.objectStore(STORE_NAMES.commandHistory).getAll() as IDBRequest<
        CommandHistoryEntry[]
      >,
    );
    return entries.sort((left, right) => left.executedAt.localeCompare(right.executedAt));
  }

  async add(entry: CommandHistoryEntry): Promise<void> {
    const existing = await this.list();
    if (existing.at(-1)?.input === entry.input) return;

    const transaction = this.database.transaction(STORE_NAMES.commandHistory, 'readwrite');
    const store = transaction.objectStore(STORE_NAMES.commandHistory);
    store.put(entry);

    const overflow = existing.length + 1 - HISTORY_LIMIT;
    if (overflow > 0) {
      for (const expired of existing.slice(0, overflow)) store.delete(expired.id);
    }
    await transactionComplete(transaction);
  }

  async clear(): Promise<void> {
    const transaction = this.database.transaction(STORE_NAMES.commandHistory, 'readwrite');
    transaction.objectStore(STORE_NAMES.commandHistory).clear();
    await transactionComplete(transaction);
  }
}
