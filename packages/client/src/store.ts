const DB_NAME = "dvm";
const DB_VERSION = 2;

export const CORE = "core";
export const DETAIL = "detail";
export const PLUG_SETS = "plugSets";

const META = "meta";
const STORES = [CORE, DETAIL, PLUG_SETS];

// Small enough that a transaction never holds the main thread long
const CHUNK = 2000;

interface HashRecord {
  hash: number;
}

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

      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META);
      }
    };

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
  putAll: (store: string, records: HashRecord[]) => Promise<void>;
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

    // Chunked so a first-load population never blocks a frame for long
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
