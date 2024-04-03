import type { Nullable } from '@babylonjs/core';

import { noop } from '@/utils';
import type { ObjectStoreName } from '@/types';

let localDB: Nullable<IDBDatabase> = null;

const openDB = async () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('tankmedb', 1);

    request.addEventListener('upgradeneeded', (e) => {
      const database = (e.target as unknown as { result: IDBDatabase }).result;

      createSchema(database);
    });

    request.addEventListener('success', (e) => {
      localDB = (e.target as unknown as { result: IDBDatabase }).result;
      localDB.addEventListener('close', closeListener);
      resolve(localDB);
    });

    request.addEventListener('error', (e) => {
      reject((e.target as any).error);
    });

    request.addEventListener('blocked', (e) => {
      reject((e.target as any).error);
    });
  });
};
const createSchema = (database: IDBDatabase) => {
  if (!database.objectStoreNames.contains('users')) {
    database.createObjectStore('users');
  }
  if (!database.objectStoreNames.contains('files')) {
    database.createObjectStore('files');
  }
  if (!database.objectStoreNames.contains('preferences')) {
    database.createObjectStore('preferences');
  }
};
const closeDB = () => {
  localDB?.removeEventListener('close', closeListener);
  localDB?.close();
};
const closeListener = noop;

const getObject = async <T>(objStoreName: ObjectStoreName, key: string): Promise<Nullable<T>> => {
  return new Promise((resolve, reject) => {
    if (!localDB) resolve(null);
    else
      try {
        const request: IDBRequest<T> = localDB.transaction(objStoreName).objectStore(objStoreName).get(key);
        request.onsuccess = (event) => resolve((event.target as unknown as { result: T }).result);
        request.onerror = (event) => reject((event.target as any).error);
      } catch (error) {
        reject(error);
      }
  });
};
const updateObject = async (objStoreName: ObjectStoreName, key: string, value: any): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (!localDB) resolve(false);
    else
      try {
        const request = localDB
          .transaction(objStoreName, 'readwrite')
          .objectStore(objStoreName)
          .put(value, key);
        request.onsuccess = () => resolve(true);
        request.onerror = (event) => reject((event.target as any).error);
      } catch (error) {
        reject(error);
      }
  });
};
const deleteObject = async (objStoreName: ObjectStoreName, key: string) => {
  return new Promise((resolve, reject) => {
    if (!localDB) resolve(false);
    else
      try {
        const request = localDB.transaction(objStoreName, 'readwrite').objectStore(objStoreName).delete(key);
        request.onsuccess = () => resolve(true);
        request.onerror = (event) => reject((event.target as any).error);
      } catch (error) {
        reject(error);
      }
  });
};
const getAll = async <T>(objStoreName: ObjectStoreName): Promise<T[]> => {
  return new Promise((resolve, reject) => {
    if (!localDB) resolve([]);
    else {
      try {
        const request: IDBRequest = localDB.transaction(objStoreName).objectStore(objStoreName).getAll();
        request.onsuccess = (event) => resolve((event.target as unknown as { result: T[] }).result);
        request.onerror = (event) => reject((event.target as any).error);
      } catch (error) {
        reject(error);
      }
    }
  });
};
const getCount = async (objStoreName: ObjectStoreName): Promise<number> => {
  return new Promise((resolve, reject) => {
    if (!localDB) resolve(-1);
    else
      try {
        const request: IDBRequest = localDB.transaction(objStoreName).objectStore(objStoreName).count();
        request.onsuccess = () => resolve(request.result as number);
        request.onerror = (event) => reject((event.target as any).error);
      } catch (error) {
        reject(error);
      }
  });
};

export { localDB, openDB, closeDB, getObject, updateObject, deleteObject, getAll, getCount };
