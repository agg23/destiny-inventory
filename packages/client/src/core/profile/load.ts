import type { DestinyProfileResponse } from "bungie-api-ts/destiny2";

import { materializeClosure } from "@dvm/defs-core";

import { fetchRecords, fetchTable, hasArtifact } from "../api/artifacts.ts";
import { accessToken } from "../api/auth.ts";
import {
  cachedMembership,
  fetchProfile,
  storedMembership,
  type Membership,
} from "../api/bungie.ts";
import { loadConfig, type ArtifactIndex } from "../api/config.ts";
import { loadRolls } from "../items/rolls.ts";
import {
  NotSignedIn,
  type ItemDef,
  type LoadResult,
  type PlugSetDef,
  type Session,
} from "./loadTypes.ts";
import { seedInventory } from "./moves.ts";
import {
  characterRecords,
  contentsOf,
  isStale,
  liveReferences,
  mintedAt,
  orderRewards,
  playingNow,
  profileItems,
  sameContents,
  stringVariables,
} from "./profileReads.ts";
import { bootFromSnapshot, saveSnapshot } from "./snapshot.ts";
import {
  CORE,
  DETAIL,
  openStore,
  PLUG_SETS,
  PROFILE,
  type DefStore,
} from "./store.ts";
import { buildStoresFrom, storeItems } from "./stores.ts";

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

export const CURRENT = "current";

// Bumped whenever the shipped def shape changes, so cached records get refetched
const SHAPE = 8;

export const stamp = (version: string): string => `${version}/${SHAPE}`;

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

/** Reads items from tier 1 and tier 2, which are separate stores */
export const readMerged = async (
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
      builtFrom: mintedAt(profile),
      contents: contentsOf(profile),
      guest: undefined,
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

    const kept: LoadResult = {
      ...first,
      source: "live",
      playing: playingNow(profile),
      activities: profile.characterActivities?.data ?? first.activities,
      records: characterRecords(profile),
      orderRewards: orderRewards(profile),
    };

    if (isStale(session, minted)) {
      onUpgrade(kept);

      return;
    }

    const contents = contentsOf(profile);

    if (sameContents(session, contents)) {
      session.minted = minted;
      onUpgrade({ ...kept, variables: stringVariables(profile) });

      return;
    }

    await materializeNew(session, profile);

    if (isStale(session, minted)) {
      onUpgrade(kept);

      return;
    }

    void session.store.putOne(PROFILE, CURRENT, profile);

    const built = buildStoresFrom(
      session.support,
      session.items,
      session.plugSets,
      profile,
      session.hidden,
    );

    session.minted = minted;
    session.builtFrom = minted;
    session.contents = contents;
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

  const closure = await materializeClosure(
    missing,
    {
      items: (wanted) => readMerged(session.store, wanted),
      plugSets: (wanted) =>
        session.store.getMany<PlugSetDef>(PLUG_SETS, wanted),
    },
    session,
  );

  Object.assign(session.items, closure.items);
  Object.assign(session.plugSets, closure.plugSets);
};

export const materializeNew = (session: Session, profile: DestinyProfileResponse) =>
  materializeItems(session, [
    ...profileItems(profile).map((item) => item.itemHash),
    ...liveReferences(profile),
  ]);
