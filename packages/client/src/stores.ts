import { getBuckets } from "app/destiny2/d2-buckets";
import { buildStores } from "app/inventory/store/d2-store-factory";
import type { InventoryBuckets } from "app/inventory/inventory-buckets";
import type { DimStore } from "app/inventory/store-types";
import type {
  DestinyInventoryItemDefinition,
  DestinyItemComponent,
  DestinyPlugSetDefinition,
  DestinyProfileResponse,
} from "bungie-api-ts/destiny2";
import { collectErrors } from "app/utils/log";

import { buildDefinitions } from "@dvm/dim-bridge";

export interface Failure {
  reason: string;
  count: number;
  origin?: string;
}

export interface BuiltStores {
  stores: DimStore[];
  buckets: InventoryBuckets;
  skipped: Failure[];
  degraded: Failure[];
  hidden: number;
}

// The factory drops an item it cannot build and logs this; every other failure it logs is
// partial, leaving a rendered item with something missing
const DROPPED = "Error processing item";

type ItemDef = DestinyInventoryItemDefinition;
type PlugSetDef = DestinyPlugSetDefinition;

interface Withheld {
  profile: DestinyProfileResponse;
  count: number;
}

// Withheld definitions never reach makeItem, so a surviving failure is always a real defect
const stripHidden = (profile: DestinyProfileResponse, hidden: Set<number>): Withheld => {
  let count = 0;

  const keep = (items: DestinyItemComponent[]): DestinyItemComponent[] =>
    items.filter((item) => {
      const withheld = hidden.has(item.itemHash);
      count += withheld ? 1 : 0;

      return !withheld;
    });

  const byCharacter = <T extends { items: DestinyItemComponent[] }>(
    group: Record<string, T> | undefined,
  ): Record<string, T> =>
    Object.fromEntries(
      Object.entries(group ?? {}).map(([id, entry]) => [id, { ...entry, items: keep(entry.items) }]),
    );

  const stripped: DestinyProfileResponse = {
    ...profile,
    profileInventory: {
      ...profile.profileInventory,
      data: profile.profileInventory.data && {
        ...profile.profileInventory.data,
        items: keep(profile.profileInventory.data.items),
      },
    },
    characterInventories: {
      ...profile.characterInventories,
      data: profile.characterInventories.data && byCharacter(profile.characterInventories.data),
    },
    characterEquipment: {
      ...profile.characterEquipment,
      data: profile.characterEquipment.data && byCharacter(profile.characterEquipment.data),
    },
  };

  return { profile: stripped, count };
};

export const buildStoresFrom = (
  support: Map<string, Record<string, unknown>>,
  items: Record<number, ItemDef>,
  plugSets: Record<number, PlugSetDef>,
  profile: DestinyProfileResponse,
  hidden: Set<number>,
): BuiltStores => {
  const tables = new Map(support);
  tables.set("InventoryItem", items as unknown as Record<string, unknown>);
  tables.set("PlugSet", plugSets as unknown as Record<string, unknown>);

  const defs = buildDefinitions(tables);
  const buckets = getBuckets(defs);
  const withheld = stripHidden(profile, hidden);

  const groups = { skipped: new Map<string, Failure>(), degraded: new Map<string, Failure>() };

  collectErrors((_tag, message, error) => {
    const into = message === DROPPED ? groups.skipped : groups.degraded;
    const reason = `${error.name}: ${error.message.replace(/\[\d+\]/, "[hash]")}`;

    const seen = into.get(reason) ?? {
      reason,
      count: 0,
      // The message alone cannot say which table was missing
      origin: error.stack?.split("\n").slice(1, 4).join(" | "),
    };

    seen.count += 1;
    into.set(reason, seen);
  });

  try {
    const stores = buildStores({
      defs,
      buckets,
      profileResponse: withheld.profile,
      customStats: [],
    });

    const ranked = (group: Map<string, Failure>) =>
      [...group.values()].sort((a, b) => b.count - a.count);

    const skipped = ranked(groups.skipped);
    const degraded = ranked(groups.degraded);

    if (skipped.length > 0 || degraded.length > 0) {
      console.warn(`Item failures\n${JSON.stringify({ skipped, degraded }, undefined, 2)}`);
    }

    return { stores, buckets, skipped, degraded, hidden: withheld.count };
  } finally {
    collectErrors(undefined);
  }
};

export const storeItems = (stores: DimStore[]) => stores.flatMap((store) => store.items);
