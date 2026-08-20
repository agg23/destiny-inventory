import type { DimItem } from "app/inventory/item-types";
import type { InventoryBuckets } from "app/inventory/inventory-buckets";
import type { DimStore } from "app/inventory/store-types";
import type {
  DestinyCharacterActivitiesComponent,
  DestinyInventoryItemDefinition,
  DestinyPlugSetDefinition,
  DestinyProfileResponse,
} from "bungie-api-ts/destiny2";

import { materializeClosure } from "@dvm/defs-core";

import { accessToken } from "./auth.ts";
import { buildStoresFrom, storeItems, type Failure } from "./stores.ts";
import { seedInventory } from "./moves.ts";
import { fetchRecords, fetchTable, hasArtifact } from "./artifacts.ts";
import { loadConfig, type ArtifactIndex } from "./config.ts";
import {
  currentMemberships,
  fetchProfile,
  pickMembership,
  type Membership,
} from "./bungie.ts";
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
  session: Session;
  playing: string | undefined;
  activities: CharacterActivities;
  variables: StringVariables;
}

export type CharacterActivities = Record<
  string,
  DestinyCharacterActivitiesComponent
>;

export type StringVariables = Record<string, Record<number, number>>;

const stringVariables = (profile: DestinyProfileResponse): StringVariables => {
  const shared =
    profile.profileStringVariables?.data?.integerValuesByHash ?? {};
  const rows: StringVariables = {};

  for (const [id, held] of Object.entries(
    profile.characterStringVariables?.data ?? {},
  )) {
    rows[id] = { ...shared, ...held.integerValuesByHash };
  }

  return rows;
};

export class NotSignedIn extends Error {
  constructor() {
    super("Not signed in");
    this.name = "NotSignedIn";
  }
}

const byHash = <T extends { hash: number }>(
  records: T[],
): Record<number, T> => {
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
        tables.set(
          name,
          await fetchTable<Record<string, unknown>>(index, name),
        );
      }
    }),
  );

  return tables;
};

// Tier 1 and tier 2 are separate stores
const readMerged = async (
  store: DefStore,
  hashes: number[],
): Promise<ItemDef[]> => {
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

// Only field that says which response is newer
const mintedAt = (profile: DestinyProfileResponse): number =>
  new Date(profile.responseMintedTimestamp ?? 0).getTime();

const LIVE_WINDOW = 10 * 60_000;

// currentActivityHash sits stale after a logout
const playingNow = (profile: DestinyProfileResponse): string | undefined => {
  const characters = profile.characters?.data ?? {};
  const now = Date.now();

  for (const [id, activity] of Object.entries(
    profile.characterActivities?.data ?? {},
  )) {
    const lastPlayed = new Date(characters[id]?.dateLastPlayed ?? 0).getTime();

    if (activity.currentActivityHash !== 0 && now - lastPlayed < LIVE_WINDOW) {
      return id;
    }
  }

  return undefined;
};

const profileItems = (profile: DestinyProfileResponse) => [
  ...(profile.profileInventory?.data?.items ?? []),
  ...Object.values(profile.characterInventories?.data ?? {}).flatMap(
    (i) => i.items,
  ),
  ...Object.values(profile.characterEquipment?.data ?? {}).flatMap(
    (e) => e.items,
  ),
];

// Crafted and enhanced perks sit outside the plug set
const liveReferences = (profile: DestinyProfileResponse): number[] => {
  const hashes: number[] = [];

  for (const item of Object.values(
    profile.itemComponents?.sockets?.data ?? {},
  )) {
    for (const socket of item.sockets) {
      if (socket.plugHash !== undefined) {
        hashes.push(socket.plugHash);
      }
    }
  }

  for (const item of Object.values(
    profile.itemComponents?.reusablePlugs?.data ?? {},
  )) {
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

export interface Session {
  store: DefStore;
  index: ArtifactIndex;
  membership: Membership;
  support: Map<string, Record<string, unknown>>;
  items: Record<number, ItemDef>;
  plugSets: Record<number, PlugSetDef>;
  hidden: Set<number>;
  minted: number;
}

export const load = async (
  onUpgrade?: (result: LoadResult) => void,
): Promise<LoadResult> => {
  const started = performance.now();
  const token = await accessToken();

  if (!token) {
    throw new NotSignedIn();
  }

  const indexStart = performance.now();
  const [store, config] = await Promise.all([openStore(), loadConfig()]);
  const index = config.artifacts;
  const indexTime = performance.now() - indexStart;

  const stored = await store.manifestVersion();
  const fresh =
    stored !== index.manifestVersion || (await store.count(CORE)) === 0;

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
    const closure = await materializeClosure(owned, {
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

  await seedInventory(built.stores, membership);

  const session: Session = {
    store,
    index,
    membership,
    support,
    items,
    plugSets,
    hidden,
    minted: mintedAt(profile),
  };

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
    playing: playingNow(profile),
    activities: profile.characterActivities?.data ?? {},
    variables: stringVariables(profile),
    counts: {
      owned: owned.size,
      defs: Object.keys(items).length,
      skipped: built.skipped.reduce((total, group) => total + group.count, 0),
      hidden: built.hidden,
    },
    skipped: built.skipped,
    degraded: built.degraded,
    session,
  };

  if (fresh && core && onUpgrade) {
    void populate({
      store,
      index,
      core,
      support,
      items,
      profile,
      hidden,
      membership,
      onUpgrade,
      first: result,
      started,
    });
  }

  return result;
};

interface Populate {
  store: DefStore;
  index: ArtifactIndex;
  core: ItemDef[];
  support: Map<string, Record<string, unknown>>;
  items: Record<number, ItemDef>;
  profile: DestinyProfileResponse;
  hidden: Set<number>;
  membership: Membership;
  onUpgrade: (result: LoadResult) => void;
  first: LoadResult;
  started: number;
}

// The version marker lands last
const populate = async ({
  store,
  index,
  core,
  support,
  items,
  profile,
  hidden,
  membership,
  onUpgrade,
  first,
  started,
}: Populate) => {
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
  const plugSets = byHash(plugsets);
  const built = buildStoresFrom(support, items, plugSets, profile, hidden);
  const itemsTime = performance.now() - itemsStart;

  await seedInventory(built.stores, membership);

  first.session.plugSets = plugSets;

  onUpgrade({
    ...first,
    stores: built.stores,
    buckets: built.buckets,
    items: storeItems(built.stores),
    timings: {
      ...first.timings,
      items: itemsTime,
      total: performance.now() - started,
    },
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

export type RefreshStatus = "updated" | "unchanged" | "manifest-changed";

export interface RefreshOutcome {
  status: RefreshStatus;
  skipped: Failure[];
  degraded: Failure[];
  playing: string | undefined;
  activities: CharacterActivities | undefined;
}

// New items can reference definitions the load-time closure never reached
const materializeNew = async (
  session: Session,
  profile: DestinyProfileResponse,
) => {
  const wanted = new Set([
    ...profileItems(profile).map((item) => item.itemHash),
    ...liveReferences(profile),
  ]);

  const missing = [...wanted].filter((hash) => !(hash in session.items));

  if (missing.length === 0) {
    return;
  }

  const closure = await materializeClosure(missing, {
    items: (hashes) => readMerged(session.store, hashes),
    plugSets: (hashes) => session.store.getMany<PlugSetDef>(PLUG_SETS, hashes),
  });

  Object.assign(session.items, closure.items);
  Object.assign(session.plugSets, closure.plugSets);
};

export const refreshProfile = async (
  session: Session,
): Promise<RefreshOutcome> => {
  const token = await accessToken();

  if (!token) {
    throw new NotSignedIn();
  }

  const config = await loadConfig();

  if (config.artifacts.manifestVersion !== session.index.manifestVersion) {
    return {
      status: "manifest-changed",
      skipped: [],
      degraded: [],
      playing: undefined,
      activities: undefined,
    };
  }

  const profile = await fetchProfile(session.membership, token);
  const minted = mintedAt(profile);

  // Bungie's cache can hand back stale data
  if (minted <= session.minted) {
    return {
      status: "unchanged",
      skipped: [],
      degraded: [],
      playing: playingNow(profile),
      activities: profile.characterActivities?.data,
    };
  }

  await materializeNew(session, profile);

  const built = buildStoresFrom(
    session.support,
    session.items,
    session.plugSets,
    profile,
    session.hidden,
  );

  session.minted = minted;
  await seedInventory(built.stores, session.membership);

  return {
    status: "updated",
    skipped: built.skipped,
    degraded: built.degraded,
    playing: playingNow(profile),
    activities: profile.characterActivities?.data,
  };
};
