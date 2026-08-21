import type { DimItem } from "app/inventory/item-types";
import { makeFakeItem } from "app/inventory/store/d2-item-factory";
import type { DestinyProfileResponse } from "bungie-api-ts/destiny2";

import { defs } from "./defs.ts";
import { materializeItems, type LoadResult } from "./load.ts";

// An uninstanced item reads nothing off the profile
const NO_PROFILE = {} as DestinyProfileResponse;

/** Display-only items for hashes the profile never owned, carrying no roll */
export const fakeItems = async (
  loaded: LoadResult,
  hashes: number[],
): Promise<Map<number, DimItem>> => {
  await materializeItems(loaded.session, hashes);

  const table = defs();
  const built = new Map<number, DimItem>();

  if (!table) {
    return built;
  }

  const context = {
    defs: table,
    buckets: loaded.buckets,
    profileResponse: NO_PROFILE,
    customStats: [],
  };

  for (const hash of new Set(hashes)) {
    // The factory reads the bucket unchecked, and a profile-level item has none
    if (table.InventoryItem.getOptional(hash)?.inventory === undefined) {
      continue;
    }

    const item = makeFakeItem(context, hash);

    if (item) {
      built.set(hash, item);
    }
  }

  return built;
};
