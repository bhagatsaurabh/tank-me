import type { Null } from '@/interfaces/types';

let localDB: Null<IDBDatabase> = null;

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
};
const closeDB = () => {
  localDB?.removeEventListener('close', closeListener);
  localDB?.close();
};
const closeListener = () => {
  console.log('tankmedb closed');
};

const getSingleton = async <T>(objStoreName: 'users'): Promise<Null<T>> => {
  return new Promise((resolve, reject) => {
    if (!localDB) resolve(null);
    else
      try {
        const request: IDBRequest<T> = localDB
          .transaction(objStoreName)
          .objectStore(objStoreName)
          .get('default');
        request.onsuccess = (event) => resolve((event.target as unknown as { result: T }).result);
        request.onerror = (event) => reject((event.target as any).error);
      } catch (error) {
        reject(error);
      }
  });
};
const updateSingleton = async (objStoreName: 'users', value: any): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (!localDB) resolve(false);
    else
      try {
        const request = localDB
          .transaction(objStoreName, 'readwrite')
          .objectStore(objStoreName)
          .put(value, 'default');
        request.onsuccess = () => resolve(true);
        request.onerror = (event) => reject((event.target as any).error);
      } catch (error) {
        reject(error);
      }
  });
};

const getObject = async <T>(objStoreName: 'users', key: string): Promise<Null<T>> => {
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
const updateObject = async (objStoreName: 'users', key: string, value: any): Promise<boolean> => {
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
const deleteObject = async (objStoreName: 'users', key: string) => {
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
const getAll = async <T>(objStoreName: 'users'): Promise<T[]> => {
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
const getCount = async (objStoreName: 'users'): Promise<number> => {
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

export {
  localDB,
  openDB,
  closeDB,
  getSingleton,
  updateSingleton,
  getObject,
  updateObject,
  deleteObject,
  getAll,
  getCount
};
