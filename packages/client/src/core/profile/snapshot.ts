import type { InventoryBuckets } from "app/inventory/inventory-buckets";
import { pick } from "es-toolkit";

import type { ArtifactIndex } from "@dvm/service";

import { storedMembership, type Membership } from "../api/bungie.ts";
import { loadRolls, primeRolls, readCachedRolls } from "../items/rollSheets.ts";
import type { CachedSheets } from "../items/rollTypes.ts";
import type { LoadResult } from "./loadTypes.ts";
import { seedInventory } from "./moves.ts";
import { openStore, PROFILE, type DefStore } from "./store.ts";
import { storeItems } from "./stores.ts";

const PRIME_CAP = 400;

// Filled by the inline script in index.html
interface Prefetched {
  snapshot: Snapshot | undefined;
  stored: string | undefined;
  rolls: CachedSheets;
}

declare global {
  interface Window {
    __snapshot?: Promise<Prefetched | undefined>;
  }
}

const BUILT = "built";

const SAVED = [
  "tier",
  "stores",
  "counts",
  "skipped",
  "degraded",
  "playing",
  "activities",
  "variables",
  "records",
  "orderRewards",
] as const;

interface Snapshot extends Pick<LoadResult, (typeof SAVED)[number]> {
  stamp: string;
  index: ArtifactIndex;
  minted: number;
  buckets: Omit<InventoryBuckets, "setHasUnknown">;
}

const hydrate = (
  store: DefStore,
  snapshot: Snapshot | undefined,
  stored: string | undefined,
  rolls: CachedSheets,
  membership: Membership,
): LoadResult | undefined => {
  if (!snapshot?.index || stored === undefined || snapshot.stamp !== stored) {
    return undefined;
  }

  // Cached sheets make the first render if they match
  primeRolls(rolls, snapshot.index);
  loadRolls(snapshot.index, store).catch((e: unknown) => {
    console.warn("Rolls failed", e);
  });

  seedInventory(snapshot.stores, membership).catch((e: unknown) => {
    console.warn("Seed failed", e);
  });

  return fromSnapshot(snapshot, store, membership);
};

/** Snapshot load before first render, reusing the index.html read and capped at PRIME_CAP */
export const primeBoot = async (): Promise<LoadResult | undefined> => {
  const membership = storedMembership();

  if (!membership) {
    return undefined;
  }

  const read = (async () => {
    const storePromise = openStore();
    const early = await window.__snapshot;
    const store = await storePromise;

    if (early !== undefined) {
      return hydrate(
        store,
        early.snapshot,
        early.stored,
        early.rolls,
        membership,
      );
    }

    return bootFromSnapshot(store, membership);
  })().catch((e: unknown) => {
    console.warn("Prime failed", e);

    return undefined;
  });

  const cap = new Promise<undefined>((resolve) => {
    setTimeout(() => resolve(undefined), PRIME_CAP);
  });

  return Promise.race([read, cap]);
};

/** Paints the last saved build without the network, or undefined if nothing usable */
export const bootFromSnapshot = async (
  store: DefStore,
  membership: Membership | undefined,
): Promise<LoadResult | undefined> => {
  if (!membership) {
    return undefined;
  }

  const [snapshot, stored, rolls] = await Promise.all([
    store.getOne<Snapshot>(PROFILE, BUILT),
    store.manifestVersion(),
    readCachedRolls(store),
  ]);

  return hydrate(store, snapshot, stored, rolls, membership);
};

/** Persists a built result for the next boot; setHasUnknown breaks structured clone */
export const saveSnapshot = (
  store: DefStore,
  result: LoadResult,
  stampValue: string,
) => {
  const { setHasUnknown, ...buckets } = result.buckets;

  const snapshot: Snapshot = {
    ...pick(result, SAVED),
    stamp: stampValue,
    index: result.session.index,
    minted: result.session.minted,
    buckets,
  };

  // Losing the snapshot only costs paint speed
  store.putOne(PROFILE, BUILT, snapshot).catch((e: unknown) => {
    console.warn("Snapshot save failed", e);
  });
};

const fromSnapshot = (
  snapshot: Snapshot,
  store: DefStore,
  membership: Membership,
): LoadResult => ({
  ...pick(snapshot, SAVED),
  buckets: { ...snapshot.buckets, setHasUnknown: () => {} },
  items: storeItems(snapshot.stores),
  manifestVersion: snapshot.index.manifestVersion,
  source: "cache",
  records: snapshot.records ?? {},
  orderRewards: snapshot.orderRewards ?? {},
  // Empty defs until the live pass fills them in
  session: {
    store,
    index: snapshot.index,
    membership,
    support: new Map(),
    items: {},
    plugSets: {},
    hidden: new Set(),
    minted: snapshot.minted,
    builtFrom: snapshot.minted,
    contents: "",
    guest: undefined,
  },
});
