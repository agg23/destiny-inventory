import type { InventoryBuckets } from "app/inventory/inventory-buckets";
import type { DimStore } from "app/inventory/store-types";

import { storedMembership, type Membership } from "./bungie.ts";
import type { ArtifactIndex } from "./config.ts";
import type {
  CharacterActivities,
  LoadResult,
  StringVariables,
} from "./load.ts";
import { seedInventory } from "./moves.ts";
import {
  loadRolls,
  primeRolls,
  readCachedRolls,
  type CachedRolls,
} from "./rolls.ts";
import { openStore, PROFILE, type DefStore } from "./store.ts";
import { storeItems, type Failure } from "./stores.ts";

const PRIME_CAP = 400;

// Filled by the inline script in index.html
interface Prefetched {
  snapshot: Snapshot | undefined;
  stored: string | undefined;
  rolls: CachedRolls | undefined;
}

declare global {
  interface Window {
    __snapshot?: Promise<Prefetched | undefined>;
  }
}

const BUILT = "built";

// Built stores saved whole, so the next boot paints without building anything
interface Snapshot {
  stamp: string;
  index: ArtifactIndex;
  minted: number;
  tier: "core" | "detail";
  stores: DimStore[];
  buckets: Omit<InventoryBuckets, "setHasUnknown">;
  counts: LoadResult["counts"];
  skipped: Failure[];
  degraded: Failure[];
  playing: string | undefined;
  activities: CharacterActivities;
  variables: StringVariables;
}

const hydrate = (
  store: DefStore,
  snapshot: Snapshot | undefined,
  stored: string | undefined,
  rolls: CachedRolls | undefined,
  membership: Membership,
  indexTime: number,
  started: number,
): LoadResult | undefined => {
  if (!snapshot?.index || stored === undefined || snapshot.stamp !== stored) {
    return undefined;
  }

  // A matching cached sheet is in the first render; otherwise it renders when fetched
  primeRolls(rolls, snapshot.index);
  loadRolls(snapshot.index, store).catch((e: unknown) => {
    console.warn("Rolls failed", e);
  });

  seedInventory(snapshot.stores, membership).catch((e: unknown) => {
    console.warn("Seed failed", e);
  });

  return fromSnapshot(snapshot, store, membership, indexTime, started);
};

/**
 * Snapshot read for before the first render, so the data is there when the app mounts.
 * Prefers the read the inline script started at HTML parse; capped so a slow database
 * delays startup by at most PRIME_CAP
 */
export const primeBoot = async (): Promise<LoadResult | undefined> => {
  const started = performance.now();
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
        performance.now() - started,
        started,
      );
    }

    return bootFromSnapshot(
      store,
      membership,
      performance.now() - started,
      started,
    );
  })().catch((e: unknown) => {
    console.warn("Prime failed", e);

    return undefined;
  });

  const cap = new Promise<undefined>((resolve) => {
    setTimeout(() => resolve(undefined), PRIME_CAP);
  });

  return Promise.race([read, cap]);
};

/**
 * Paints the last saved build without touching the network: validates the snapshot against
 * the locally stored manifest stamp, seeds the move engine behind the paint, and hands back
 * a LoadResult, or undefined when there is nothing usable to show
 */
export const bootFromSnapshot = async (
  store: DefStore,
  membership: Membership | undefined,
  indexTime: number,
  started: number,
): Promise<LoadResult | undefined> => {
  if (!membership) {
    return undefined;
  }

  const [snapshot, stored, rolls] = await Promise.all([
    store.getOne<Snapshot>(PROFILE, BUILT),
    store.manifestVersion(),
    readCachedRolls(store),
  ]);

  return hydrate(
    store,
    snapshot,
    stored,
    rolls,
    membership,
    indexTime,
    started,
  );
};

/** Persists a built result for the next boot; setHasUnknown breaks structured clone */
export const saveSnapshot = (
  store: DefStore,
  result: LoadResult,
  stampValue: string,
) => {
  const { setHasUnknown, ...buckets } = result.buckets;

  const snapshot: Snapshot = {
    stamp: stampValue,
    index: result.session.index,
    minted: result.session.minted,
    tier: result.tier,
    stores: result.stores,
    buckets,
    counts: result.counts,
    skipped: result.skipped,
    degraded: result.degraded,
    playing: result.playing,
    activities: result.activities,
    variables: result.variables,
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
  indexTime: number,
  started: number,
): LoadResult => ({
  stores: snapshot.stores,
  buckets: { ...snapshot.buckets, setHasUnknown: () => {} },
  items: storeItems(snapshot.stores),
  timings: {
    index: indexTime,
    profile: 0,
    defs: 0,
    items: 0,
    total: performance.now() - started,
  },
  manifestVersion: snapshot.index.manifestVersion,
  tier: snapshot.tier,
  source: "cache",
  counts: snapshot.counts,
  skipped: snapshot.skipped,
  degraded: snapshot.degraded,
  playing: snapshot.playing,
  activities: snapshot.activities,
  variables: snapshot.variables,
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
  },
});
