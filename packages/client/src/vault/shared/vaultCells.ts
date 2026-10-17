import type {
  InventoryBucket,
  InventoryBuckets,
} from "app/inventory/inventory-buckets";
import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { groupBy } from "es-toolkit";
import { createMemo } from "solid-js";

import { tagFor } from "../../core/items/tags.ts";
import { settings } from "../../core/settings.ts";

const CATEGORIES = ["Postmaster", "Weapons", "Armor", "General", "Inventory"];

export const SECTIONS = [...CATEGORIES, "Other"];

const sameBuckets = (was: InventoryBucket[], next: InventoryBucket[]): boolean =>
  was.length === next.length && was.every((bucket, at) => bucket === next[at]);

const ordered = (items: DimItem[]): DimItem[] =>
  [...items].sort(
    (a, b) => Number(b.equipped) - Number(a.equipped) || b.power - a.power,
  );

const orderedVault = (items: DimItem[]): DimItem[] =>
  settings().sort === "name"
    ? [...items].sort(
        (a, b) => a.name.localeCompare(b.name) || b.power - a.power,
      )
    : ordered(items);

const favorite = (item: DimItem): boolean => tagFor(item.id)?.id === "favorite";

export const createVaultCells = (
  stores: () => DimStore[],
  buckets: () => InventoryBuckets,
) => {
  const vault = () => stores().find((store) => store.isVault);

  // Quests and Orders carry no sort
  const uncategorized = createMemo<InventoryBucket[]>(
    () => {
      const known = new Set(
        CATEGORIES.flatMap(
          (category) => buckets().byCategory[category] ?? [],
        ).map((bucket) => bucket.hash),
      );

      const found = new Map<number, InventoryBucket>();

      for (const store of stores()) {
        for (const item of store.items) {
          if (!known.has(item.location.hash)) {
            found.set(item.location.hash, item.location);
          }
        }
      }

      return [...found.values()].sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? ""),
      );
    },
    [],
    { equals: sameBuckets },
  );

  const bucketsIn = (category: string) =>
    category === "Other"
      ? uncategorized()
      : (buckets().byCategory[category] ?? []);

  const cells = createMemo(() => {
    const built = new Map<string, DimItem[]>();
    const vaultId = vault()?.id;

    for (const store of stores()) {
      const byBucket = groupBy(store.items, (item) => item.location.hash);

      for (const [hash, items] of Object.entries(byBucket)) {
        built.set(
          `${store.id}:${hash}`,
          store.id === vaultId ? orderedVault(items) : ordered(items),
        );
      }
    }

    return built;
  });

  const cell = (store: DimStore, bucket: InventoryBucket) =>
    cells().get(`${store.id}:${bucket.hash}`) ?? [];

  const vaultCells = createMemo(() => {
    const split = new Map<number, { favorites: DimItem[]; rest: DimItem[] }>();
    const held = vault();

    if (!held) {
      return split;
    }

    for (const [key, items] of cells()) {
      if (key.startsWith(`${held.id}:`)) {
        split.set(Number(key.slice(held.id.length + 1)), {
          favorites: items.filter((item) => favorite(item)),
          rest: items.filter((item) => !favorite(item)),
        });
      }
    }

    return split;
  });

  const vaultCell = (bucket: InventoryBucket) =>
    vaultCells().get(bucket.hash) ?? { favorites: [], rest: [] };

  const vaultOrder = (bucket: InventoryBucket) => {
    const split = vaultCell(bucket);

    return [...split.favorites, ...split.rest];
  };

  return { bucketsIn, cell, vaultCell, vaultOrder };
};
