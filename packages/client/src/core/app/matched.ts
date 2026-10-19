import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { isClassCompatible } from "app/utils/item-utils";
import { createEffect, createMemo } from "solid-js";

import { defs } from "../profile/defs.ts";
import { vaultable } from "../profile/moveTargets.ts";
import { itemFilter, primeSearch } from "../search/search.ts";

/** Filtered items grouped as the grid draws them, plus the total */
export interface Matched {
  byStore: Map<string, Map<number, DimItem[]>>;
  total: number;
}

// Most keystrokes don't change what matches
const sameMatched = (was: Matched, next: Matched): boolean => {
  if (was.total !== next.total || was.byStore.size !== next.byStore.size) {
    return false;
  }

  for (const [id, buckets] of next.byStore) {
    const before = was.byStore.get(id);

    if (before === undefined || before.size !== buckets.size) {
      return false;
    }

    for (const [hash, items] of buckets) {
      const held = before.get(hash);

      if (held === undefined || held.length !== items.length) {
        return false;
      }

      for (let at = 0; at < items.length; at += 1) {
        if (held[at] !== items[at]) {
          return false;
        }
      }
    }
  }

  return true;
};

export const createMatched = (
  stores: () => DimStore[],
  query: () => string,
  previewQuery: () => string | undefined,
  vaultArmorClass: () => DimStore["classType"] | undefined,
) => {
  createEffect(() => {
    const held = stores();
    const tables = defs();

    if (held.length > 0) {
      requestIdleCallback(() => primeSearch(held, tables));
    }
  });

  const filter = createMemo(() =>
    itemFilter(previewQuery() ?? query(), stores(), defs()),
  );

  const matched = createMemo<Matched>(
    () => {
      const test = filter();
      const armorClass = vaultArmorClass();
      const byStore = new Map<string, Map<number, DimItem[]>>();
      let total = 0;

      for (const store of stores()) {
        const buckets = new Map<number, DimItem[]>();

        for (const item of store.items) {
          if (!test(item)) {
            continue;
          }

          if (
            armorClass !== undefined &&
            store.isVault &&
            item.bucket.inArmor &&
            !isClassCompatible(item.classType, armorClass)
          ) {
            continue;
          }

          const bucket = buckets.get(item.location.hash) ?? [];
          bucket.push(item);
          buckets.set(item.location.hash, bucket);

          if (vaultable(item)) {
            total += 1;
          }
        }

        byStore.set(store.id, buckets);
      }

      return { byStore, total };
    },
    { byStore: new Map(), total: 0 },
    { equals: sameMatched },
  );

  const shown = () => matched().total;

  return { matched, shown };
};
