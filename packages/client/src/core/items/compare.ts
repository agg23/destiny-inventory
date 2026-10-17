import type { DimItem, DimStat } from "app/inventory/item-types";

// DIM derives the armor total itself
export const TOTAL = -1000;

// DestinyItemCategoryDefinition hashes, inlined
const WEAPON = 1;
const ARMOR = 20;

export interface Delta {
  value: number;
  better: boolean;
}

// A weapon in the postmaster sorts as Postmaster
const kind = (item: DimItem): string => {
  if (item.itemCategoryHashes.includes(WEAPON)) {
    return "weapon";
  }

  if (item.itemCategoryHashes.includes(ARMOR)) {
    return "armor";
  }

  return `bucket:${item.bucket.hash}`;
};

// DIM's THE_FORBIDDEN_BUCKET, home to distorted engrams
const FORBIDDEN = 2422292810;

export const unmovable = (item: DimItem): boolean =>
  item.isEngram ||
  item.bucket.hash === FORBIDDEN ||
  Boolean(item.bucket.inPostmaster);

export const comparable = (a: DimItem, b: DimItem): boolean =>
  !unmovable(a) && !unmovable(b) && kind(a) === kind(b);

// Charge Time and Draw Time count down
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
