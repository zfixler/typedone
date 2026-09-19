import { DATABASE_VERSION, runMigrations } from './migrations';
import { IndexedDbCommandHistoryRepository } from './command-history-repository';
import { IndexedDbProjectRepository } from './project-repository';
import { IndexedDbSettingsRepository } from './settings-repository';
import { IndexedDbTaskRepository } from './task-repository';
import type { Repositories } from './types';

export const DATABASE_NAME = 'terminal-todo';

export class DatabaseOpenError extends Error {
  override readonly name = 'DatabaseOpenError';
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB request failed.'));
    };
  });
}

export function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve();
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error('IndexedDB transaction aborted.'));
    };
    transaction.onerror = () => {
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    };
  });
}

export function openDatabase(
  name: string = DATABASE_NAME,
  version: number = DATABASE_VERSION,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    let openingFailed = false;

    request.onupgradeneeded = (event) => {
      const transaction = request.transaction;
      if (!transaction) {
        openingFailed = true;
        reject(new DatabaseOpenError('The database upgrade transaction was not available.'));
        return;
      }
      runMigrations(request.result, transaction, event.oldVersion);
    };
    request.onsuccess = () => {
      const database = request.result;
      if (openingFailed) {
        database.close();
        return;
      }
      database.onversionchange = () => {
        database.close();
      };
      resolve(database);
    };
    request.onerror = () => {
      reject(
        new DatabaseOpenError(request.error?.message ?? 'The local database could not be opened.'),
      );
    };
    request.onblocked = () => {
      openingFailed = true;
      reject(
        new DatabaseOpenError(
          'A previous version of the app is blocking the database upgrade. Close other tabs and retry.',
        ),
      );
    };
  });
}

export function createRepositories(database: IDBDatabase): Repositories {
  return {
    tasks: new IndexedDbTaskRepository(database),
    projects: new IndexedDbProjectRepository(database),
    settings: new IndexedDbSettingsRepository(database),
    commandHistory: new IndexedDbCommandHistoryRepository(database),
  };
}
