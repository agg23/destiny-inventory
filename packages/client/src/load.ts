import { getBuckets } from "app/destiny2/d2-buckets";
import type { DimItem } from "app/inventory/item-types";
import { makeItem } from "app/inventory/store/d2-item-factory";
import type { DimStore } from "app/inventory/store-types";
import type { DestinyProfileResponse } from "bungie-api-ts/destiny2";

import { resolveClosure, type Tables } from "@dvm/defs-core";
import { buildDefinitions } from "@dvm/dim-bridge";

import { openStore } from "./store.ts";

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
  "Race",
  "Gender",
  "Faction",
  "SeasonPass",
  "Collectible",
  "Record",
  "Metric",
  "Trait",
  "PresentationNode",
  "VendorGroup",
  "Vendor",
  "Icon",
];

const VAULT_STORE = { id: "vault", name: "Vault" } as DimStore;

export interface Timings {
  transfer: number;
  merge: number;
  read: number;
  defs: number;
  items: number;
  total: number;
}

export interface LoadResult {
  items: DimItem[];
  timings: Timings;
  counts: { owned: number; cached: number; fetched: number };
  manifestVersion: string;
}

const fetchSupport = async (): Promise<Map<string, Record<string, unknown>>> => {
  const tables = new Map<string, Record<string, unknown>>();

  await Promise.all(
    SUPPORT.map(async (name) => {
      const response = await fetch(`/api/artifacts/${name}`);

      if (response.ok) {
        tables.set(name, (await response.json()) as Record<string, unknown>);
      }
    }),
  );

  return tables;
};

export const load = async (
  membershipType: number,
  membershipId: string,
): Promise<LoadResult> => {
  const started = performance.now();
  const store = await openStore();

  const knownHashes = await store.keys("items");
  const knownPlugSets = await store.keys("plugSets");

  const transferStart = performance.now();

  const [support, refresh] = await Promise.all([
    fetchSupport(),
    fetch("/api/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ membershipType, membershipId, knownHashes, knownPlugSets }),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`refresh failed: ${response.status}`);
      }

      return response.json() as Promise<{
        manifestVersion: string;
        profile: DestinyProfileResponse;
        defs: { items: { hash: number }[]; plugSets: { hash: number }[] };
      }>;
    }),
  ]);

  const transfer = performance.now() - transferStart;

  const stored = await store.manifestVersion();

  if (stored && stored !== refresh.manifestVersion) {
    await store.clear();
  }

  const mergeStart = performance.now();
  await store.merge(refresh.manifestVersion, refresh.defs.items, refresh.defs.plugSets);
  const merge = performance.now() - mergeStart;

  const readStart = performance.now();

  const items = (await store.all("items")) as Tables["items"];
  const plugSets = (await store.all("plugSets")) as Tables["plugSets"];

  const read = performance.now() - readStart;
  const defsStart = performance.now();

  const tables = new Map(support);
  tables.set("InventoryItem", items as unknown as Record<string, unknown>);
  tables.set("PlugSet", plugSets as unknown as Record<string, unknown>);

  const defs = buildDefinitions(tables);
  const buckets = getBuckets(defs);
  const defsTime = performance.now() - defsStart;

  const profile = refresh.profile;
  const raw = [
    ...(profile.profileInventory?.data?.items ?? []),
    ...Object.values(profile.characterInventories?.data ?? {}).flatMap((i) => i.items),
    ...Object.values(profile.characterEquipment?.data ?? {}).flatMap((e) => e.items),
  ];

  const owned = new Set(raw.map((item) => item.itemHash));
  const dangling = resolveClosure(owned, { items, plugSets }).missing;

  if (dangling.length > 0) {
    throw new Error(`${dangling.length} dangling references, refusing to render`);
  }

  const itemsStart = performance.now();
  const built: DimItem[] = [];

  for (const component of raw) {
    const item = makeItem(
      { defs, buckets, profileResponse: profile, customStats: [] },
      component,
      VAULT_STORE,
    );

    if (item) {
      built.push(item);
    }
  }

  const itemsTime = performance.now() - itemsStart;

  return {
    items: built,
    timings: {
      transfer,
      merge,
      read,
      defs: defsTime,
      items: itemsTime,
      total: performance.now() - started,
    },
    counts: {
      owned: owned.size,
      cached: knownHashes.length,
      fetched: refresh.defs.items.length,
    },
    manifestVersion: refresh.manifestVersion,
  };
};
