import { getBuckets } from "app/destiny2/d2-buckets";
import type { DimItem } from "app/inventory/item-types";
import { makeItem } from "app/inventory/store/d2-item-factory";
import type { DimStore } from "app/inventory/store-types";
import type {
  DestinyInventoryItemDefinition,
  DestinyPlugSetDefinition,
  DestinyProfileResponse,
} from "bungie-api-ts/destiny2";

import { materialiseClosure } from "@dvm/defs-core";
import { buildDefinitions } from "@dvm/dim-bridge";

import { accessToken } from "./auth.ts";
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

const VAULT_STORE = { id: "vault", name: "Vault" } as DimStore;

type ItemDef = DestinyInventoryItemDefinition;
type PlugSetDef = DestinyPlugSetDefinition;

export interface Timings {
  index: number;
  profile: number;
  defs: number;
  items: number;
  total: number;
}

export interface Skipped {
  reason: string;
  count: number;
  examples: number[];
  origin?: string;
}

export interface LoadResult {
  items: DimItem[];
  timings: Timings;
  manifestVersion: string;
  tier: "core" | "detail";
  counts: { owned: number; defs: number; skipped: number; hidden: number };
  skipped: Skipped[];
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

const buildItems = (
  support: Map<string, Record<string, unknown>>,
  items: Record<number, ItemDef>,
  plugSets: Record<number, PlugSetDef>,
  profile: DestinyProfileResponse,
  hidden: Set<number>,
): { items: DimItem[]; skipped: Skipped[]; hidden: number } => {
  const tables = new Map(support);
  tables.set("InventoryItem", items as unknown as Record<string, unknown>);
  tables.set("PlugSet", plugSets as unknown as Record<string, unknown>);

  const defs = buildDefinitions(tables);
  const buckets = getBuckets(defs);

  const built: DimItem[] = [];
  const failures = new Map<string, Omit<Skipped, "reason">>();
  let withheld = 0;

  // One unexpected definition should cost its own tile, not the whole page. Grouped by
  // reason rather than counted, because a bare count cannot say what is missing
  for (const component of profileItems(profile)) {
    // Dummies and the like, deliberately not shipped and not meant to render
    if (hidden.has(component.itemHash)) {
      withheld += 1;

      continue;
    }

    try {
      const item = makeItem(
        { defs, buckets, profileResponse: profile, customStats: [] },
        component,
        VAULT_STORE,
      );

      if (item) {
        built.push(item);
      }
    } catch (e) {
      const reason =
        e instanceof Error ? `${e.name}: ${e.message.replace(/\[\d+\]/, "[hash]")}` : String(e);

      const seen = failures.get(reason) ?? {
        count: 0,
        examples: [],
        // The message alone cannot say which table was missing
        origin: e instanceof Error ? e.stack?.split("\n").slice(1, 4).join(" | ") : undefined,
      };

      seen.count += 1;

      if (seen.examples.length < 5) {
        seen.examples.push(component.itemHash);
      }

      failures.set(reason, seen);
    }
  }

  const skipped = [...failures.entries()]
    .map(([reason, seen]) => ({ reason, ...seen }))
    .sort((a, b) => b.count - a.count);

  if (skipped.length > 0) {
    console.warn(`Skipped items by reason\n${JSON.stringify(skipped, undefined, 2)}`);
  }

  return { items: built, skipped, hidden: withheld };
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

  const owned = new Set(profileItems(profile).map((item) => item.itemHash));

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
  const built = buildItems(support, items, plugSets, profile, hidden);
  const itemsTime = performance.now() - itemsStart;

  const result: LoadResult = {
    items: built.items,
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
  const built = buildItems(support, items, byHash(plugsets), profile, hidden);
  const itemsTime = performance.now() - itemsStart;

  onUpgrade({
    ...first,
    items: built.items,
    timings: { ...first.timings, items: itemsTime, total: performance.now() - started },
    tier: "detail",
    counts: {
      ...first.counts,
      defs: Object.keys(items).length,
      skipped: built.skipped.reduce((total, group) => total + group.count, 0),
      hidden: built.hidden,
    },
    skipped: built.skipped,
  });

  await store.putAll(CORE, core);
  await store.putAll(DETAIL, detail);
  await store.putAll(PLUG_SETS, plugsets);
  await store.setManifestVersion(index.manifestVersion);
};
