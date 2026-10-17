import type { DestinyProfileResponse } from "bungie-api-ts/destiny2";
import { keyBy } from "es-toolkit";

import { materializeClosure } from "@dvm/defs-core";
import type { ArtifactIndex } from "@dvm/service";

import { fetchRecords, fetchTable, hasArtifact } from "../api/artifacts.ts";
import { requireToken } from "../api/auth.ts";
import {
  cachedMembership,
  fetchProfile,
  storedMembership,
  type Membership,
} from "../api/bungie.ts";
import { loadConfig } from "../api/config.ts";
import { loadRolls } from "../items/rollSheets.ts";
import type { ItemDef, LoadResult, PlugSetDef, Session } from "./loadTypes.ts";
import { seedInventory } from "./moves.ts";
import {
  contentsOf,
  isStale,
  liveFields,
  liveReferences,
  mintedAt,
  profileItems,
  sameContents,
  type LiveFields,
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
import { buildStoresFrom, fromBuilt } from "./stores.ts";

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

// Bump when the shipped def shape changes
const SHAPE = 8;

export const stamp = (version: string): string => `${version}/${SHAPE}`;

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

const mergeDetail = (items: Record<number, ItemDef>, detail: ItemDef[]) => {
  for (const record of detail) {
    const existing = items[record.hash];

    if (existing) {
      Object.assign(existing, record);
    } else {
      items[record.hash] = record;
    }
  }
};

/** Reads items from both the tier 1 and tier 2 stores */
export const readMerged = async (
  store: DefStore,
  hashes: number[],
): Promise<ItemDef[]> => {
  const [core, detail] = await Promise.all([
    store.getMany<ItemDef>(CORE, hashes),
    store.getMany<ItemDef>(DETAIL, hashes),
  ]);

  const merged = keyBy(
    core.map((record) => ({ ...record })),
    (record) => record.hash,
  );

  mergeDetail(merged, detail);

  return Object.values(merged);
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

      live = requireToken().then((token) => fetchProfile(held, token));

      // Handled by revive after the cached build
      live.catch(() => undefined);
    } else {
      const token = await requireToken();

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
      items = keyBy(core, (record) => record.hash);
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
      ...fromBuilt(built, {
        owned: owned.size,
        defs: Object.keys(items).length,
      }),
      ...liveFields(profile),
      manifestVersion: index.manifestVersion,
      tier: fresh ? "core" : "detail",
      source: cached ? "cache" : "live",
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

  // Don't blank the primed snapshot on a live failure
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

type Rebuilt =
  | { kind: "stale" }
  | { kind: "same" }
  | { kind: "rebuilt"; result: LoadResult };

/** Rebuilds the stores from a newer profile that changed an item */
export const rebuildProfile = async (
  first: LoadResult,
  profile: DestinyProfileResponse,
  fields: LiveFields,
): Promise<Rebuilt> => {
  const session = first.session;
  const minted = mintedAt(profile);

  if (isStale(session, minted)) {
    return { kind: "stale" };
  }

  const contents = contentsOf(profile);

  if (sameContents(session, contents)) {
    session.minted = minted;

    return { kind: "same" };
  }

  await materializeNew(session, profile);

  if (isStale(session, minted)) {
    return { kind: "stale" };
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

  return {
    kind: "rebuilt",
    result: { ...first, ...fromBuilt(built, first.counts), ...fields },
  };
};

const revive = async (
  first: LoadResult,
  live: Promise<DestinyProfileResponse>,
  onUpgrade: (result: LoadResult) => void,
  onLiveError?: (e: unknown) => void,
) => {
  try {
    const profile = await live;
    const fields = liveFields(profile);

    const kept: LoadResult = {
      ...first,
      ...fields,
      activities: profile.characterActivities?.data ?? first.activities,
      variables: first.variables,
    };

    const rebuilt = await rebuildProfile(first, profile, fields);

    if (rebuilt.kind === "stale") {
      onUpgrade(kept);

      return;
    }

    if (rebuilt.kind === "same") {
      onUpgrade({ ...kept, variables: fields.variables });

      return;
    }

    onUpgrade(rebuilt.result);
    saveSnapshot(
      first.session.store,
      rebuilt.result,
      stamp(first.manifestVersion),
    );
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

  mergeDetail(items, detail);

  const plugSets = keyBy(plugsets, (record) => record.hash);
  const built = buildStoresFrom(support, items, plugSets, profile, hidden);

  await seedInventory(built.stores, membership);

  first.session.plugSets = plugSets;

  const upgraded: LoadResult = {
    ...first,
    ...fromBuilt(built, { ...first.counts, defs: Object.keys(items).length }),
    tier: "detail",
  };

  onUpgrade(upgraded);
  saveSnapshot(store, upgraded, stamp(index.manifestVersion));

  await store.putAll(CORE, core);
  await store.putAll(DETAIL, detail);
  await store.putAll(PLUG_SETS, plugsets);
  await store.setManifestVersion(stamp(index.manifestVersion));
};

/** Pulls definitions the load-time closure never reached */
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
