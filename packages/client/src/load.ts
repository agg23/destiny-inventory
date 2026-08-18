import type { DimItem } from "app/inventory/item-types";
import type { InventoryBuckets } from "app/inventory/inventory-buckets";
import type { DimStore } from "app/inventory/store-types";
import type {
  DestinyInventoryItemDefinition,
  DestinyPlugSetDefinition,
  DestinyProfileResponse,
} from "bungie-api-ts/destiny2";

import { materialiseClosure } from "@dvm/defs-core";

import { accessToken } from "./auth.ts";
import { buildStoresFrom, storeItems, type Failure } from "./stores.ts";
import { fetchRecords, fetchTable, hasArtifact } from "./artifacts.ts";
import { loadConfig, type ArtifactIndex } from "./config.ts";
import { currentMemberships, fetchProfile, pickMembership, type Membership } from "./bungie.ts";
import { CORE, DETAIL, openStore, PLUG_SETS, type DefStore } from "./store.ts";

const SUPPORT = [
  "InventoryBucket",
  "Stat",
  "StatGroup",
  "SocketType",
  "SocketCategory",
  "DamageType",
  "ItemCategory",
  "PowerCap",
  "BreakerType",
  "Season",
  "SandboxPerk",
  "Class",
  "EnergyType",
  "MaterialRequirementSet",
  "EquipableItemSet",
  "InventoryItemConstants",
  "Objective",
  "Progression",
  "Record",
  "Race",
  "Gender",
  "Faction",
  "SeasonPass",
  "Trait",
  "VendorGroup",
  "Vendor",
];

const MEMBERSHIP = "dvm.membership";

type ItemDef = DestinyInventoryItemDefinition;
type PlugSetDef = DestinyPlugSetDefinition;

export interface Timings {
  index: number;
  profile: number;
  defs: number;
  items: number;
  total: number;
}

export interface LoadResult {
  stores: DimStore[];
  buckets: InventoryBuckets;
  items: DimItem[];
  timings: Timings;
  manifestVersion: string;
  tier: "core" | "detail";
  counts: { owned: number; defs: number; skipped: number; hidden: number };
  skipped: Failure[];
  degraded: Failure[];
}

export class NotSignedIn extends Error {
  constructor() {
    super("Not signed in");
    this.name = "NotSignedIn";
  }
}

const byHash = <T extends { hash: number }>(records: T[]): Record<number, T> => {
  const table: Record<number, T> = {};

  for (const record of records) {
    table[record.hash] = record;
  }

  return table;
};

const fetchSupport = async (index: ArtifactIndex) => {
  const tables = new Map<string, Record<string, unknown>>();

  await Promise.all(
    SUPPORT.map(async (name) => {
      if (hasArtifact(index, name)) {
        tables.set(name, await fetchTable<Record<string, unknown>>(index, name));
      }
    }),
  );

  return tables;
};

// Tier 1 and tier 2 are separate stores, so a def is whole only once both are merged
const readMerged = async (store: DefStore, hashes: number[]): Promise<ItemDef[]> => {
  const [core, detail] = await Promise.all([
    store.getMany<ItemDef>(CORE, hashes),
    store.getMany<ItemDef>(DETAIL, hashes),
  ]);

  const merged = new Map<number, ItemDef>();

  for (const record of core) {
    merged.set(record.hash, { ...record });
  }

  for (const record of detail) {
    const existing = merged.get(record.hash);

    if (existing) {
      Object.assign(existing, record);
    } else {
      merged.set(record.hash, record);
    }
  }

  return [...merged.values()];
};

const cachedMembership = async (token: string): Promise<Membership> => {
  const cached = localStorage.getItem(MEMBERSHIP);

  if (cached) {
    return JSON.parse(cached) as Membership;
  }

  const membership = pickMembership(await currentMemberships(token));
  localStorage.setItem(MEMBERSHIP, JSON.stringify(membership));

  return membership;
};

const profileItems = (profile: DestinyProfileResponse) => [
  ...(profile.profileInventory?.data?.items ?? []),
  ...Object.values(profile.characterInventories?.data ?? {}).flatMap((i) => i.items),
  ...Object.values(profile.characterEquipment?.data ?? {}).flatMap((e) => e.items),
];

// What is actually plugged is live data, and the definition graph does not always reach it.
// Crafted and enhanced perks in particular sit outside the socket's own plug set, so seeding
// the walk from owned hashes alone leaves buildSockets looking up definitions we never loaded
const liveReferences = (profile: DestinyProfileResponse): number[] => {
  const hashes: number[] = [];

  for (const item of Object.values(profile.itemComponents?.sockets?.data ?? {})) {
    for (const socket of item.sockets) {
      if (socket.plugHash !== undefined) {
        hashes.push(socket.plugHash);
      }
    }
  }

  for (const item of Object.values(profile.itemComponents?.reusablePlugs?.data ?? {})) {
    for (const plugs of Object.values(item.plugs)) {
      for (const plug of plugs) {
        hashes.push(plug.plugItemHash);
      }
    }
  }

  const plugSets = [
    ...Object.values(profile.characterPlugSets?.data ?? {}),
    profile.profilePlugSets?.data,
  ];

  for (const component of plugSets) {
    for (const plugs of Object.values(component?.plugs ?? {})) {
      for (const plug of plugs) {
        hashes.push(plug.plugItemHash);
      }
    }
  }

  return hashes;
};

export const load = async (onUpgrade?: (result: LoadResult) => void): Promise<LoadResult> => {
  const started = performance.now();
  const token = await accessToken();

  if (!token) {
    throw new NotSignedIn();
  }

  const indexStart = performance.now();
  const [store, config] = await Promise.all([openStore(), loadConfig()]);
  const index = config.artifacts;
  const indexTime = performance.now() - indexStart;

  // A version marker alone can outlive its data, so an empty store counts as stale too
  const stored = await store.manifestVersion();
  const fresh = stored !== index.manifestVersion || (await store.count(CORE)) === 0;

  if (fresh && stored !== undefined) {
    await store.clear();
  }

  const profileStart = performance.now();
  const supportPromise = fetchSupport(index);
  const membership = await cachedMembership(token);
  const profile = await fetchProfile(membership, token);
  const profileTime = performance.now() - profileStart;

  const owned = new Set([
    ...profileItems(profile).map((item) => item.itemHash),
    ...liveReferences(profile),
  ]);

  const defsStart = performance.now();
  let core: ItemDef[] | undefined = undefined;
  let items: Record<number, ItemDef>;
  let plugSets: Record<number, PlugSetDef> = {};

  if (fresh) {
    core = await fetchRecords<ItemDef>(index, "core");
    items = byHash(core);
  } else {
    const closure = await materialiseClosure(owned, {
      items: (hashes) => readMerged(store, hashes),
      plugSets: (hashes) => store.getMany<PlugSetDef>(PLUG_SETS, hashes),
    });

    items = closure.items;
    plugSets = closure.plugSets;
  }

  const defsTime = performance.now() - defsStart;
  const [support, hiddenHashes] = await Promise.all([
    supportPromise,
    fetchRecords<number>(index, "hidden"),
  ]);

  const hidden = new Set(hiddenHashes);

  const itemsStart = performance.now();
  const built = buildStoresFrom(support, items, plugSets, profile, hidden);
  const itemsTime = performance.now() - itemsStart;

  const result: LoadResult = {
    stores: built.stores,
    buckets: built.buckets,
    items: storeItems(built.stores),
    timings: {
      index: indexTime,
      profile: profileTime,
      defs: defsTime,
      items: itemsTime,
      total: performance.now() - started,
    },
    manifestVersion: index.manifestVersion,
    tier: fresh ? "core" : "detail",
    counts: {
      owned: owned.size,
      defs: Object.keys(items).length,
      skipped: built.skipped.reduce((total, group) => total + group.count, 0),
      hidden: built.hidden,
    },
    skipped: built.skipped,
    degraded: built.degraded,
  };

  if (fresh && core && onUpgrade) {
    void populate(store, index, core, support, items, profile, hidden, onUpgrade, result, started);
  }

  return result;
};

// Runs after first paint; the version marker lands last so a half-written store never looks current
const populate = async (
  store: DefStore,
  index: ArtifactIndex,
  core: ItemDef[],
  support: Map<string, Record<string, unknown>>,
  items: Record<number, ItemDef>,
  profile: DestinyProfileResponse,
  hidden: Set<number>,
  onUpgrade: (result: LoadResult) => void,
  first: LoadResult,
  started: number,
) => {
  const [detail, plugsets] = await Promise.all([
    fetchRecords<ItemDef>(index, "detail"),
    fetchRecords<PlugSetDef>(index, "plugsets"),
  ]);

  for (const record of detail) {
    const existing = items[record.hash];

    if (existing) {
      Object.assign(existing, record);
    } else {
      items[record.hash] = record;
    }
  }

  const itemsStart = performance.now();
  const built = buildStoresFrom(support, items, byHash(plugsets), profile, hidden);
  const itemsTime = performance.now() - itemsStart;

  onUpgrade({
    ...first,
    stores: built.stores,
    buckets: built.buckets,
    items: storeItems(built.stores),
    timings: { ...first.timings, items: itemsTime, total: performance.now() - started },
    tier: "detail",
    counts: {
      ...first.counts,
      defs: Object.keys(items).length,
      skipped: built.skipped.reduce((total, group) => total + group.count, 0),
      hidden: built.hidden,
    },
    skipped: built.skipped,
    degraded: built.degraded,
  });

  await store.putAll(CORE, core);
  await store.putAll(DETAIL, detail);
  await store.putAll(PLUG_SETS, plugsets);
  await store.setManifestVersion(index.manifestVersion);
};
