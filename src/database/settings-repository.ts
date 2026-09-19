import { requestResult, transactionComplete } from './database';
import { STORE_NAMES } from './migrations';
import type { SettingRecord, SettingsRepository } from './types';

export class IndexedDbSettingsRepository implements SettingsRepository {
  constructor(private readonly database: IDBDatabase) {}

  async list(): Promise<Record<string, unknown>> {
    const transaction = this.database.transaction(STORE_NAMES.settings, 'readonly');
    const records = await requestResult(
      transaction.objectStore(STORE_NAMES.settings).getAll() as IDBRequest<SettingRecord[]>,
    );
    return Object.fromEntries(records.map(({ name, value }) => [name, value]));
  }

  async get<T = unknown>(name: string): Promise<T | undefined> {
    const transaction = this.database.transaction(STORE_NAMES.settings, 'readonly');
    const record = await requestResult(
      transaction.objectStore(STORE_NAMES.settings).get(name) as IDBRequest<
        SettingRecord | undefined
      >,
    );
    return record?.value as T | undefined;
  }

  async put(name: string, value: unknown): Promise<void> {
    const transaction = this.database.transaction(STORE_NAMES.settings, 'readwrite');
    const record: SettingRecord = { name, value };
    transaction.objectStore(STORE_NAMES.settings).put(record);
    await transactionComplete(transaction);
  }

  async delete(name: string): Promise<void> {
    const transaction = this.database.transaction(STORE_NAMES.settings, 'readwrite');
    transaction.objectStore(STORE_NAMES.settings).delete(name);
    await transactionComplete(transaction);
  }
}
