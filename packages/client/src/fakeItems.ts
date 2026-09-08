import type { DimItem } from "app/inventory/item-types";
import { makeFakeItem } from "app/inventory/store/d2-item-factory";
import type { DestinyProfileResponse } from "bungie-api-ts/destiny2";

import { defs } from "./defs.ts";
import { materializeItems, type LoadResult } from "./load.ts";
import { vendorPlugHashes, type VendorComponents } from "./vendors.ts";

// An uninstanced item reads nothing off the profile
const NO_PROFILE = {} as DestinyProfileResponse;

const FAKES = new Map<number, DimItem>();

/** Whatever of a fakeItems set is already built */
export const builtFakes = (hashes: number[]): Map<number, DimItem> => {
  const found = new Map<number, DimItem>();

  for (const hash of hashes) {
    const item = FAKES.get(hash);

    if (item) {
      found.set(hash, item);
    }
  }

  return found;
};

/** Display-only items for hashes the profile never owned, carrying no roll */
export const fakeItems = async (
  loaded: LoadResult,
  hashes: number[],
): Promise<Map<number, DimItem>> => {
  const wanted = [...new Set(hashes)];
  const missing = wanted.filter((hash) => !FAKES.has(hash));

  await materializeItems(loaded.session, missing);

  const table = defs();

  if (!table) {
    return builtFakes(wanted);
  }

  const context = {
    defs: table,
    buckets: loaded.buckets,
    profileResponse: NO_PROFILE,
    customStats: [],
  };

  for (const hash of missing) {
    // The factory reads the bucket unchecked, and a profile-level item has none
    if (table.InventoryItem.getOptional(hash)?.inventory === undefined) {
      continue;
    }

    const item = makeFakeItem(context, hash);

    if (item) {
      FAKES.set(hash, item);
    }
  }

  return builtFakes(wanted);
};

export interface VendorTile {
  vendor: number;
  itemHash: number;
  vendorItemIndex: number;
}

export const tileKey = (vendor: number, vendorItemIndex: number): string =>
  `${vendor}:${vendorItemIndex}`;

let lastTiles = new Map<string, DimItem>();

/** The previous build, for painting while the stock is refetched */
export const builtTiles = (): Map<string, DimItem> => lastTiles;

/** Sale items carrying the vendor's own roll, falling back to the bare definition */
export const vendorTiles = async (
  loaded: LoadResult,
  components: VendorComponents,
  wanted: VendorTile[],
): Promise<Map<string, DimItem>> => {
  await materializeItems(loaded.session, [
    ...wanted.map((tile) => tile.itemHash),
    ...vendorPlugHashes(components),
  ]);

  const table = defs();
  const built = new Map<string, DimItem>();

  if (!table) {
    return built;
  }

  for (const tile of wanted) {
    if (
      table.InventoryItem.getOptional(tile.itemHash)?.inventory === undefined
    ) {
      continue;
    }

    const item = makeFakeItem(
      {
        defs: table,
        buckets: loaded.buckets,
        profileResponse: NO_PROFILE,
        customStats: [],
        itemComponents: components[tile.vendor],
      },
      tile.itemHash,
      // The vendor's components are keyed by sale index, which the factory reads as the id
      { itemInstanceId: String(tile.vendorItemIndex) },
    );

    if (item) {
      built.set(tileKey(tile.vendor, tile.vendorItemIndex), item);
    }
  }

  lastTiles = built;

  return built;
};
