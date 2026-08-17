const DB_NAME = "dvm";
const DB_VERSION = 1;

const ITEMS = "items";
const PLUG_SETS = "plugSets";
const META = "meta";

const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      for (const name of [ITEMS, PLUG_SETS]) {
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

export interface DefStore {
  manifestVersion: () => Promise<string | undefined>;
  keys: (store: string) => Promise<number[]>;
  all: (store: string) => Promise<Record<number, unknown>>;
  merge: (version: string, items: unknown[], plugSets: unknown[]) => Promise<void>;
  clear: () => Promise<void>;
}

export const openStore = async (): Promise<DefStore> => {
  const db = await open();

  const manifestVersion = () =>
    run(db.transaction(META, "readonly").objectStore(META).get("manifestVersion")) as Promise<
      string | undefined
    >;

  return {
    manifestVersion,

    keys: (store) =>
      run(db.transaction(store, "readonly").objectStore(store).getAllKeys()) as Promise<number[]>,

    all: async (store) => {
      const rows = (await run(
        db.transaction(store, "readonly").objectStore(store).getAll(),
      )) as { hash: number }[];

      const table: Record<number, unknown> = {};

      for (const row of rows) {
        table[row.hash] = row;
      }

      return table;
    },

    merge: (version, items, plugSets) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction([ITEMS, PLUG_SETS, META], "readwrite");

        for (const item of items) {
          tx.objectStore(ITEMS).put(item);
        }

        for (const plugSet of plugSets) {
          tx.objectStore(PLUG_SETS).put(plugSet);
        }

        tx.objectStore(META).put(version, "manifestVersion");

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),

    clear: () =>
      new Promise((resolve, reject) => {
        const tx = db.transaction([ITEMS, PLUG_SETS, META], "readwrite");

        tx.objectStore(ITEMS).clear();
        tx.objectStore(PLUG_SETS).clear();
        tx.objectStore(META).clear();

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  };
};
