import type { MetadataRecord } from './types';

export const DATABASE_VERSION = 1;

export const STORE_NAMES = {
  tasks: 'tasks',
  projects: 'projects',
  commandHistory: 'commandHistory',
  settings: 'settings',
  metadata: 'metadata',
} as const;

export function runMigrations(
  database: IDBDatabase,
  transaction: IDBTransaction,
  oldVersion: number,
): void {
  if (oldVersion < 1) {
    const tasks = database.createObjectStore(STORE_NAMES.tasks, { keyPath: 'id' });
    tasks.createIndex('projectId', 'projectId', { unique: false });
    tasks.createIndex('dueDate', 'dueDate', { unique: false });
    tasks.createIndex('completedAt', 'completedAt', { unique: false });

    const projects = database.createObjectStore(STORE_NAMES.projects, { keyPath: 'id' });
    projects.createIndex('normalizedName', 'normalizedName', { unique: false });

    const history = database.createObjectStore(STORE_NAMES.commandHistory, { keyPath: 'id' });
    history.createIndex('executedAt', 'executedAt', { unique: false });

    database.createObjectStore(STORE_NAMES.settings, { keyPath: 'name' });
    const metadata = database.createObjectStore(STORE_NAMES.metadata, { keyPath: 'name' });
    const schemaVersion: MetadataRecord = { name: 'schemaVersion', value: DATABASE_VERSION };
    metadata.put(schemaVersion);
  }

  transaction.onerror = () => {
    console.error('The IndexedDB schema migration failed.', transaction.error);
  };
}
