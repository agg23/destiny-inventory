const DB_NAME = "dvm";
const DB_VERSION = 4;

export const CORE = "core";
export const DETAIL = "detail";
export const PLUG_SETS = "plugSets";
export const RUNS = "runs";
export const REPORTS = "reports";
export const PROGRESS = "progress";

const META = "meta";
const STORES = [CORE, DETAIL, PLUG_SETS];
const INSTANCE_STORES = [RUNS, REPORTS];

const CHUNK = 2000;

const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "hash" });
        }
      }

      for (const name of INSTANCE_STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "instanceId" });
        }
      }

      if (!db.objectStoreNames.contains(PROGRESS)) {
        db.createObjectStore(PROGRESS, { keyPath: "characterId" });
      }

      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META);
      }
    };

    // A tab still holding the old version stalls the upgrade indefinitely
    request.onblocked = () =>
      reject(
        new Error(
          "Another tab is using an older database. Close it and reload",
        ),
      );

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const run = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const settled = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

const yieldToPaint = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

export interface DefStore {
  manifestVersion: () => Promise<string | undefined>;
  setManifestVersion: (version: string) => Promise<void>;
  count: (store: string) => Promise<number>;
  getMany: <T>(store: string, hashes: number[]) => Promise<T[]>;
  getAll: <T>(store: string) => Promise<T[]>;
  getOne: <T>(store: string, key: string) => Promise<T | undefined>;
  putAll: (store: string, records: object[]) => Promise<void>;
  clear: () => Promise<void>;
}

export const openStore = async (): Promise<DefStore> => {
  const db = await open();

  return {
    manifestVersion: () =>
      run(
        db
          .transaction(META, "readonly")
          .objectStore(META)
          .get("manifestVersion"),
      ) as Promise<string | undefined>,

    setManifestVersion: async (version) => {
      const tx = db.transaction(META, "readwrite");
      tx.objectStore(META).put(version, "manifestVersion");

      await settled(tx);
    },

    count: (store) =>
      run(db.transaction(store, "readonly").objectStore(store).count()),

    getMany: async <T>(store: string, hashes: number[]): Promise<T[]> => {
      if (hashes.length === 0) {
        return [];
      }

      const objectStore = db.transaction(store, "readonly").objectStore(store);

      const rows = await Promise.all(
        hashes.map((hash) => run<T | undefined>(objectStore.get(hash))),
      );

      return rows.filter((row) => row !== undefined);
    },

    getAll: <T>(store: string): Promise<T[]> =>
      run(
        db.transaction(store, "readonly").objectStore(store).getAll(),
      ) as Promise<T[]>,

    getOne: <T>(store: string, key: string): Promise<T | undefined> =>
      run(
        db.transaction(store, "readonly").objectStore(store).get(key),
      ) as Promise<T | undefined>,

    putAll: async (store, records) => {
      for (let start = 0; start < records.length; start += CHUNK) {
        const tx = db.transaction(store, "readwrite");
        const objectStore = tx.objectStore(store);

        for (const record of records.slice(start, start + CHUNK)) {
          objectStore.put(record);
        }

        await settled(tx);
        await yieldToPaint();
      }
    },

    // Runs and reports outlive the manifest
    clear: async () => {
      const tx = db.transaction([...STORES, META], "readwrite");

      for (const name of STORES) {
        tx.objectStore(name).clear();
      }

      tx.objectStore(META).clear();

      await settled(tx);
    },
  };
};
