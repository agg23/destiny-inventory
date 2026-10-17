import type { DimItem, DimStat } from "app/inventory/item-types";
import { THE_FORBIDDEN_BUCKET } from "app/search/d2-known-values";
import { ItemCategoryHashes } from "data/d2/generated-enums";

// DIM derives the armor total itself
export const TOTAL = -1000;

export interface Delta {
  value: number;
  better: boolean;
}

// A weapon in the postmaster sorts as Postmaster
const kind = (item: DimItem): string => {
  if (item.itemCategoryHashes.includes(ItemCategoryHashes.Weapon)) {
    return "weapon";
  }

  if (item.itemCategoryHashes.includes(ItemCategoryHashes.Armor)) {
    return "armor";
  }

  return `bucket:${item.bucket.hash}`;
};

export const unmovable = (item: DimItem): boolean =>
  item.isEngram ||
  // Home to distorted engrams
  item.bucket.hash === THE_FORBIDDEN_BUCKET ||
  Boolean(item.bucket.inPostmaster);

export const comparable = (a: DimItem, b: DimItem): boolean =>
  !unmovable(a) && !unmovable(b) && kind(a) === kind(b);

/** The first pinned item, when the item can be compared against it */
export const rivalFor = (
  pinned: DimItem[],
  item: DimItem | undefined,
): DimItem | undefined => {
  const [reference] = pinned;

  if (!reference || !item || reference.id === item.id) {
    return undefined;
  }

  return comparable(reference, item) ? reference : undefined;
};

/** A stat change and whether it helps */
export const deltaOf = (stat: DimStat, value: number): Delta => ({
  value,
  better: stat.smallerIsBetter ? value < 0 : value > 0,
});

export const delta = (
  mine: DimStat | undefined,
  theirs: DimStat | undefined,
): Delta | undefined => {
  if (!mine || !theirs || mine.value === theirs.value) {
    return undefined;
  }

  return deltaOf(mine, mine.value - theirs.value);
};

export const best = (stats: (DimStat | undefined)[]): number | undefined => {
  const present = stats.flatMap((stat) => (stat ? [stat] : []));
  const first = present[0];

  if (!first || present.length < 2) {
    return undefined;
  }

  const values = present.map((stat) => stat.value);

  if (values.every((value) => value === values[0])) {
    return undefined;
  }

  return first.smallerIsBetter ? Math.min(...values) : Math.max(...values);
};
