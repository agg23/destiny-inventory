import type { DimItem } from "app/inventory/item-types";
import type { InventoryBuckets } from "app/inventory/inventory-buckets";
import type { DimStore } from "app/inventory/store-types";
import type {
  DestinyCharacterActivitiesComponent,
  DestinyInventoryItemDefinition,
  DestinyPlugSetDefinition,
  DestinyProfileResponse,
  DestinyRecordComponent,
} from "bungie-api-ts/destiny2";

import { materializeClosure } from "@dvm/defs-core";

import { accessToken } from "./auth.ts";
import { buildStoresFrom, storeItems, type Failure } from "./stores.ts";
import { seedInventory } from "./moves.ts";
import { fetchRecords, fetchTable, hasArtifact } from "./artifacts.ts";
import { loadConfig, type ArtifactIndex } from "./config.ts";
import { loadRolls } from "./rolls.ts";
import { bootFromSnapshot, saveSnapshot } from "./snapshot.ts";
import {
  cachedMembership,
  fetchProfile,
  storedMembership,
  type Membership,
} from "./bungie.ts";
import {
  CORE,
  DETAIL,
  openStore,
  PLUG_SETS,
  PROFILE,
  type DefStore,
} from "./store.ts";

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
  "PresentationNode",
  "EventCard",
  "GlobalConstants",
  "Race",
  "Gender",
  "Faction",
  "SeasonPass",
  "Trait",
  "VendorGroup",
  "Vendor",
];

const CURRENT = "current";

// Bumped whenever the shipped def shape changes, so cached records get refetched
const SHAPE = 4;

const stamp = (version: string): string => `${version}/${SHAPE}`;

type ItemDef = DestinyInventoryItemDefinition;
type PlugSetDef = DestinyPlugSetDefinition;

export interface LoadResult {
  stores: DimStore[];
  buckets: InventoryBuckets;
  items: DimItem[];
  manifestVersion: string;
  tier: "core" | "detail";
  source: "cache" | "live";
  counts: { owned: number; defs: number; skipped: number; hidden: number };
  skipped: Failure[];
  degraded: Failure[];
  session: Session;
  playing: string | undefined;
  activities: CharacterActivities;
  variables: StringVariables;
  records: CharacterRecords;
  orderRewards: OrderRewards;
}

export type CharacterActivities = Record<
  string,
  DestinyCharacterActivitiesComponent
>;

export type StringVariables = Record<string, Record<number, number>>;

export type CharacterRecords = Record<
  string,
  Record<number, DestinyRecordComponent>
>;

export type OrderRewards = Record<string, Record<number, number>>;

// The seasonal hub's challenges are character scoped, the lifetime counters are not
const characterRecords = (profile: DestinyProfileResponse): CharacterRecords => {
  const shared = profile.profileRecords?.data?.records ?? {};
  const rows: CharacterRecords = {};

  for (const [id, held] of Object.entries(
    profile.characterRecords?.data ?? {},
  )) {
    rows[id] = { ...shared, ...held.records };
  }

  return rows;
};

const orderRewards = (profile: DestinyProfileResponse): OrderRewards => {
  const rows: OrderRewards = {};

  for (const [id, held] of Object.entries(
    profile.characterProgressions?.data ?? {},
  )) {
    rows[id] = held.unclaimedOrderRewards ?? {};
  }

  return rows;
};

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
  onLiveError?: (e: unknown) => void,
  primed?: LoadResult,
): Promise<LoadResult> => {
  const store = primed?.session.store ?? (await openStore());

  const finish = async (useCachedProfile: boolean): Promise<LoadResult> => {
    const config = await loadConfig();
    const index = config.artifacts;

    const stored = await store.manifestVersion();
    const fresh =
      stored !== stamp(index.manifestVersion) ||
      (await store.count(CORE)) === 0;

    if (fresh && stored !== undefined) {
      await store.clear();
    }

    const supportPromise = fetchSupport(index);
    const rollsPromise = loadRolls(index, store);

    // The cached path paints without touching Bungie, even for auth
    let membership = storedMembership();
    const cached =
      !useCachedProfile || fresh || membership === undefined
        ? undefined
        : await store.getOne<DestinyProfileResponse>(PROFILE, CURRENT);

    let profile: DestinyProfileResponse;
    let live: Promise<DestinyProfileResponse> | undefined = undefined;

    if (cached && membership) {
      profile = cached;

      const held = membership;

      live = (async () => {
        const token = await accessToken();

        if (!token) {
          throw new NotSignedIn();
        }

        return fetchProfile(held, token);
      })();

      // Handled by revive after the cached build
      live.catch(() => undefined);
    } else {
      const token = await accessToken();

      if (!token) {
        throw new NotSignedIn();
      }

      membership = await cachedMembership(token);
      profile = await fetchProfile(membership, token);
      void store.putOne(PROFILE, CURRENT, profile);
    }

    const owned = new Set([
      ...profileItems(profile).map((item) => item.itemHash),
      ...liveReferences(profile),
    ]);

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

    const [support, hiddenHashes] = await Promise.all([
      supportPromise,
      fetchRecords<number>(index, "hidden"),
      rollsPromise,
    ]);

    const hidden = new Set(hiddenHashes);

    const built = buildStoresFrom(support, items, plugSets, profile, hidden);

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
      manifestVersion: index.manifestVersion,
      tier: fresh ? "core" : "detail",
      source: cached ? "cache" : "live",
      playing: playingNow(profile),
      activities: profile.characterActivities?.data ?? {},
      variables: stringVariables(profile),
      records: characterRecords(profile),
      orderRewards: orderRewards(profile),
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
      });
    }

    if (live && onUpgrade) {
      void revive(result, live, onUpgrade, onLiveError);
    }

    saveSnapshot(store, result, stamp(index.manifestVersion));

    return result;
  };

  // The primed snapshot is already on screen, so a live failure must not blank it
  if (primed) {
    try {
      return await finish(false);
    } catch (e: unknown) {
      onLiveError?.(e);

      return primed;
    }
  }

  if (onUpgrade) {
    const painted = await bootFromSnapshot(store, storedMembership());

    if (painted) {
      finish(false)
        .then(onUpgrade)
        .catch((e: unknown) => onLiveError?.(e));

      return painted;
    }
  }

  return finish(true);
};

// Swaps the cached paint for the live profile once Bungie answers
const revive = async (
  first: LoadResult,
  live: Promise<DestinyProfileResponse>,
  onUpgrade: (result: LoadResult) => void,
  onLiveError?: (e: unknown) => void,
) => {
  try {
    const profile = await live;
    const session = first.session;
    const minted = mintedAt(profile);

    if (minted <= session.minted) {
      onUpgrade({
        ...first,
        source: "live",
        playing: playingNow(profile),
        activities: profile.characterActivities?.data ?? first.activities,
        records: characterRecords(profile),
        orderRewards: orderRewards(profile),
      });

      return;
    }

    void session.store.putOne(PROFILE, CURRENT, profile);
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

    const next: LoadResult = {
      ...first,
      stores: built.stores,
      buckets: built.buckets,
      items: storeItems(built.stores),
      source: "live",
      playing: playingNow(profile),
      activities: profile.characterActivities?.data ?? {},
      variables: stringVariables(profile),
      records: characterRecords(profile),
      orderRewards: orderRewards(profile),
      counts: {
        ...first.counts,
        skipped: built.skipped.reduce((total, group) => total + group.count, 0),
        hidden: built.hidden,
      },
      skipped: built.skipped,
      degraded: built.degraded,
    };

    onUpgrade(next);
    saveSnapshot(session.store, next, stamp(first.manifestVersion));
  } catch (e: unknown) {
    onLiveError?.(e);
  }
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

  const plugSets = byHash(plugsets);
  const built = buildStoresFrom(support, items, plugSets, profile, hidden);

  await seedInventory(built.stores, membership);

  first.session.plugSets = plugSets;

  const upgraded: LoadResult = {
    ...first,
    stores: built.stores,
    buckets: built.buckets,
    items: storeItems(built.stores),
    tier: "detail",
    counts: {
      ...first.counts,
      defs: Object.keys(items).length,
      skipped: built.skipped.reduce((total, group) => total + group.count, 0),
      hidden: built.hidden,
    },
    skipped: built.skipped,
    degraded: built.degraded,
  };

  onUpgrade(upgraded);
  saveSnapshot(store, upgraded, stamp(index.manifestVersion));

  await store.putAll(CORE, core);
  await store.putAll(DETAIL, detail);
  await store.putAll(PLUG_SETS, plugsets);
  await store.setManifestVersion(stamp(index.manifestVersion));
};

export type RefreshStatus = "updated" | "unchanged" | "manifest-changed";

export interface RefreshOutcome {
  status: RefreshStatus;
  playing: string | undefined;
  result: LoadResult | undefined;
}

/** Pulls definitions the load-time closure never reached, such as a weapon nobody owns */
export const materializeItems = async (
  session: Session,
  hashes: Iterable<number>,
): Promise<void> => {
  const missing = [...new Set(hashes)].filter(
    (hash) => !(hash in session.items),
  );

  if (missing.length === 0) {
    return;
  }

  const closure = await materializeClosure(missing, {
    items: (wanted) => readMerged(session.store, wanted),
    plugSets: (wanted) => session.store.getMany<PlugSetDef>(PLUG_SETS, wanted),
  });

  Object.assign(session.items, closure.items);
  Object.assign(session.plugSets, closure.plugSets);
};

const materializeNew = (session: Session, profile: DestinyProfileResponse) =>
  materializeItems(session, [
    ...profileItems(profile).map((item) => item.itemHash),
    ...liveReferences(profile),
  ]);

export const refreshProfile = async (
  first: LoadResult,
): Promise<RefreshOutcome> => {
  const token = await accessToken();

  if (!token) {
    throw new NotSignedIn();
  }

  const session = first.session;
  const config = await loadConfig();

  if (config.artifacts.manifestVersion !== session.index.manifestVersion) {
    return {
      status: "manifest-changed",
      playing: undefined,
      result: undefined,
    };
  }

  const profile = await fetchProfile(session.membership, token);
  const minted = mintedAt(profile);
  const playing = playingNow(profile);

  // Bungie's cache can hand back stale data
  if (minted <= session.minted) {
    return { status: "unchanged", playing, result: undefined };
  }

  void session.store.putOne(PROFILE, CURRENT, profile);

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

  const result: LoadResult = {
    ...first,
    stores: built.stores,
    buckets: built.buckets,
    items: storeItems(built.stores),
    source: "live",
    playing,
    activities: profile.characterActivities?.data ?? {},
    variables: stringVariables(profile),
    records: characterRecords(profile),
    orderRewards: orderRewards(profile),
    counts: {
      ...first.counts,
      skipped: built.skipped.reduce((total, group) => total + group.count, 0),
      hidden: built.hidden,
    },
    skipped: built.skipped,
    degraded: built.degraded,
  };

  saveSnapshot(session.store, result, stamp(first.manifestVersion));

  return { status: "updated", playing, result };
};
