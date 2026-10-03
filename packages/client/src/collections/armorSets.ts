import { BucketHashes } from "data/d2/generated-enums";

import type { Entry } from "../collections.ts";

export const ARMOR_SLOTS = [
  BucketHashes.Helmet,
  BucketHashes.Gauntlets,
  BucketHashes.ChestArmor,
  BucketHashes.LegArmor,
  BucketHashes.ClassArmor,
];

export const bySlot = (pieces: Entry[]): Entry[] =>
  [...pieces].sort(
    (one, other) =>
      ARMOR_SLOTS.indexOf(one.bucketHash) -
      ARMOR_SLOTS.indexOf(other.bucketHash),
  );

/** Pieces keyed by set, in the order each set's first piece appears */
export const setsOf = (entries: Entry[]): Map<string, Entry[]> => {
  const sets = new Map<string, Entry[]>();

  for (const entry of entries) {
    if (entry.kind !== "armor" || entry.setKey === undefined) {
      continue;
    }

    const pieces = sets.get(entry.setKey);

    if (pieces) {
      pieces.push(entry);
    } else {
      sets.set(entry.setKey, [entry]);
    }
  }

  return sets;
};

export const setless = (entries: Entry[]): Entry[] =>
  entries.filter(
    (entry) => entry.kind === "armor" && entry.setKey === undefined,
  );

/** Exotics by slot, then each set in slot order, for the list view */
export const armorOrder = (entries: Entry[]): Entry[] => [
  ...bySlot(setless(entries)),
  ...[...setsOf(entries).values()].flatMap(bySlot),
];
