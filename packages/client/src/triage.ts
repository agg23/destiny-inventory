import type { DimItem } from "app/inventory/item-types";

import { recency } from "./arrivals.ts";
import { protectedTag, tagFor } from "./tags.ts";
import type { TriageSort } from "./url.ts";

export interface Bundle {
  hash: number;
  name: string;
  items: DimItem[];
}

export interface Sweep {
  targets: DimItem[];
  guarded: number;
  offscreen: number;
}

const newestFirst = (a: DimItem, b: DimItem): number =>
  recency(a) < recency(b) ? 1 : -1;

const ORDERS: Record<TriageSort, (a: DimItem, b: DimItem) => number> = {
  received: newestFirst,
  power: (a, b) => b.power - a.power || newestFirst(a, b),
  name: (a, b) => a.name.localeCompare(b.name) || b.power - a.power,
  type: (a, b) =>
    a.typeName.localeCompare(b.typeName) ||
    b.power - a.power ||
    newestFirst(a, b),
};

/** The only inventory categories triage walks, in display order */
export const CATEGORIES = ["Weapons", "Armor"] as const;

const WALKED = new Set<string>(CATEGORIES);

/** Gear that can carry a tag. Stacks share the id "0" and would all tag together */
export const triageable = (item: DimItem): boolean =>
  item.equipment && item.id !== "0" && WALKED.has(item.bucket.sort ?? "");

/** Instance ids carrying one tag */
export const taggedIds = (items: DimItem[], tagId: string): string[] =>
  items.filter((item) => tagFor(item.id)?.id === tagId).map((item) => item.id);

/** Same-item groups, biggest first */
export const bundlesOf = (items: DimItem[]): Bundle[] => {
  const byHash = new Map<number, DimItem[]>();

  for (const item of items) {
    const held = byHash.get(item.hash);

    if (held) {
      held.push(item);
      continue;
    }

    byHash.set(item.hash, [item]);
  }

  return [...byHash.values()]
    .map((held) => ({
      hash: held[0]!.hash,
      name: held[0]!.name,
      items: [...held].sort((a, b) => b.power - a.power || newestFirst(a, b)),
    }))
    .sort(
      (a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name),
    );
};

export const feed = (
  items: DimItem[],
  sort: TriageSort,
  showTagged: boolean,
): DimItem[] =>
  items
    .filter(
      (item) =>
        triageable(item) && (showTagged || tagFor(item.id) === undefined),
    )
    .sort(ORDERS[sort]);

/**
 * The other copies a keep-one sweep would tag, counting what the guard skipped and what
 * the current filter is not showing
 */
export const sweepFor = (
  item: DimItem,
  all: DimItem[],
  shown: DimItem[],
  guarded: boolean,
): Sweep => {
  const visible = new Set(shown.map((one) => one.id));

  const copies = all.filter(
    (one) =>
      one.hash === item.hash &&
      one.id !== item.id &&
      triageable(one) &&
      !one.equipped,
  );

  const targets = copies.filter((one) => !guarded || !protectedTag(one.id));

  return {
    targets,
    guarded: copies.length - targets.length,
    offscreen: targets.filter((one) => !visible.has(one.id)).length,
  };
};
