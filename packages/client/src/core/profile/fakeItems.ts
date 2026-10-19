import type { D2ManifestDefinitions } from "app/destiny2/d2-definitions";
import type { DimItem } from "app/inventory/item-types";
import {
  makeFakeItem,
  type ItemCreationContext,
} from "app/inventory/store/d2-item-factory";
import type { DestinyProfileResponse } from "bungie-api-ts/destiny2";

import { componentsOf, rebuildItem } from "../stats/rebuild.ts";
import type { ItemSnapshot } from "../stats/types.ts";
import type { VendorComponents } from "../todo/vendorTypes.ts";
import { defs } from "./defs.ts";
import { CURRENT, materializeItems } from "./load.ts";
import type { LoadResult } from "./loadTypes.ts";
import { componentPlugHashes } from "./profileReads.ts";
import { PROFILE } from "./store.ts";

// An uninstanced item reads nothing off the profile
const NO_PROFILE = {} as DestinyProfileResponse;

const makeFake = (
  loaded: LoadResult,
  table: D2ManifestDefinitions,
  hash: number,
  itemComponents?: ItemCreationContext["itemComponents"],
  itemInstanceId?: string,
): DimItem | undefined => {
  // The factory reads the bucket unchecked
  if (table.InventoryItem.getOptional(hash)?.inventory === undefined) {
    return undefined;
  }

  return makeFakeItem(
    {
      defs: table,
      buckets: loaded.buckets,
      profileResponse: NO_PROFILE,
      customStats: [],
      itemComponents,
    },
    hash,
    { itemInstanceId },
  );
};

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

  const found = builtFakes(wanted);

  if (!table) {
    return found;
  }

  for (const hash of missing) {
    const item = makeFake(loaded, table, hash);

    if (!item) {
      continue;
    }

    found.set(hash, item);

    // Core defs carry no sockets
    if (loaded.tier === "detail") {
      FAKES.set(hash, item);
    }
  }

  return found;
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
    ...Object.values(components).flatMap(componentPlugHashes),
  ]);

  const table = defs();
  const built = new Map<string, DimItem>();

  if (!table) {
    return built;
  }

  for (const tile of wanted) {
    const item = makeFake(
      loaded,
      table,
      tile.itemHash,
      components[tile.vendor],
      // Vendor components are keyed by sale index
      String(tile.vendorItemIndex),
    );

    if (item) {
      built.set(tileKey(tile.vendor, tile.vendorItemIndex), item);
    }
  }

  lastTiles = built;

  return built;
};

const REBUILT = new Map<string, DimItem>();

/** Items gone from the profile, rebuilt with their real roll from a logged snapshot */
export const rebuiltItems = async (
  loaded: LoadResult,
  snapshots: ItemSnapshot[],
): Promise<Map<string, DimItem>> => {
  const found = new Map<string, DimItem>();
  const missing = snapshots.filter((snapshot) => {
    const id = snapshot.item.itemInstanceId ?? "0";
    const held = REBUILT.get(id);

    if (held) {
      found.set(id, held);
    }

    return !held;
  });

  await materializeItems(loaded.session, [
    ...missing.map((snapshot) => snapshot.item.itemHash),
    ...missing.map(componentsOf).flatMap(componentPlugHashes),
  ]);

  const table = defs();
  const profile = await loaded.session.store.getOne<DestinyProfileResponse>(
    PROFILE,
    CURRENT,
  );

  if (!table || !profile) {
    return found;
  }

  for (const snapshot of missing) {
    const id = snapshot.item.itemInstanceId ?? "0";
    const item = rebuildItem(table, loaded.buckets, profile, snapshot);

    if (!item) {
      continue;
    }

    found.set(id, item);

    // Core defs carry no sockets
    if (loaded.tier === "detail") {
      REBUILT.set(id, item);
    }
  }

  return found;
};
