import type { DimItem, DimStat } from "app/inventory/item-types";

// DestinyItemCategoryDefinition hashes, inlined rather than pulling in DIM's whole enum table
const WEAPON = 1;
const ARMOR = 20;

export interface Delta {
  value: number;
  better: boolean;
}

// The bucket cannot answer this: a weapon sitting in the postmaster sorts as Postmaster
const kind = (item: DimItem): string => {
  if (item.itemCategoryHashes.includes(WEAPON)) {
    return "weapon";
  }

  if (item.itemCategoryHashes.includes(ARMOR)) {
    return "armor";
  }

  return `bucket:${item.bucket.hash}`;
};

// DIM's THE_FORBIDDEN_BUCKET, home to distorted engrams. The shipped defs drop the category
// and trait DIM reads for isEngram, so the home bucket is the signal that survives
const FORBIDDEN = 2422292810;

// Engrams, messages and orders: the postmaster's own stock, which no API call moves
export const unmovable = (item: DimItem): boolean =>
  item.isEngram ||
  item.bucket.hash === FORBIDDEN ||
  Boolean(item.bucket.inPostmaster);

// Unmovable items also have no stats to line up, so nothing pairs with them
export const comparable = (a: DimItem, b: DimItem): boolean =>
  !unmovable(a) && !unmovable(b) && kind(a) === kind(b);

// Charge Time and Draw Time count down, so the sign alone cannot say which way is up
export const delta = (
  mine: DimStat | undefined,
  theirs: DimStat | undefined,
): Delta | undefined => {
  if (!mine || !theirs || mine.value === theirs.value) {
    return undefined;
  }

  const value = mine.value - theirs.value;

  return { value, better: mine.smallerIsBetter ? value < 0 : value > 0 };
};

// Undefined when every item ties, since marking all of them says nothing
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
