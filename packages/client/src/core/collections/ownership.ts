import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";

import { accessToken } from "../api/auth.ts";
import { fetchCollectibles } from "../api/bungie.ts";
import {
  NotSignedIn,
  type CharacterRecords,
  type Session,
} from "../profile/loadTypes.ts";
import { armorKey, CATALYST_RECORDS } from "./build.ts";
import type { Catalyst, Cosmetic, Entry, Ownership } from "./types.ts";

// DestinyCollectibleState
const NOT_ACQUIRED = 1;

// DestinyRecordState
const RECORD_REDEEMED = 1;
const OBJECTIVE_NOT_COMPLETED = 4;
const OBSCURED = 8;

const fetchAcquired = async (session: Session): Promise<Set<number>> => {
  const token = await accessToken();

  if (!token) {
    throw new NotSignedIn();
  }

  const profile = await fetchCollectibles(session.membership, token);
  const acquired = new Set<number>();
  const states = [
    profile.profileCollectibles?.data?.collectibles ?? {},
    ...Object.values(profile.characterCollectibles?.data ?? {}).map(
      (held) => held.collectibles,
    ),
  ];

  for (const collectibles of states) {
    for (const [hash, component] of Object.entries(collectibles)) {
      if ((component.state & NOT_ACQUIRED) === 0) {
        acquired.add(Number(hash));
      }
    }
  }

  return acquired;
};

const acquiredByMember = new Map<
  string,
  { builtFrom: number; pending: Promise<Set<number>> }
>();

/** Collected state, refetched when the stores are rebuilt from a newer profile */
export const acquiredFor = (session: Session): Promise<Set<number>> => {
  const key = session.membership.membershipId;
  const held = acquiredByMember.get(key);

  if (held && held.builtFrom === session.builtFrom) {
    return held.pending;
  }

  const pending = fetchAcquired(session);

  acquiredByMember.set(key, { builtFrom: session.builtFrom, pending });
  pending.catch(() => {
    if (acquiredByMember.get(key)?.pending === pending) {
      acquiredByMember.delete(key);
    }
  });

  return pending;
};

const SOURCE_PREFIX = /^Source:\s*/;

export const sourceLabel = (sourceString: string): string =>
  sourceString.replace(SOURCE_PREFIX, "");

export const isCollected = (entry: Entry, acquired: Set<number>): boolean =>
  entry.collectibleHashes.some((hash) => acquired.has(hash));

/** Held weapons and armor keyed like Entry.key, since reissues get new hashes */
export const copiesByKey = (stores: DimStore[]): Map<string, DimItem[]> => {
  const copies = new Map<string, DimItem[]>();

  for (const store of stores) {
    for (const item of store.items) {
      const key = item.bucket.inArmor
        ? armorKey(item.name, item.rarity, item.classType)
        : `${item.name}|${item.rarity}`;
      const held = copies.get(key);

      if (held) {
        held.push(item);
      } else {
        copies.set(key, [item]);
      }
    }
  }

  return copies;
};

/** Undefined until collection state arrives, unless a copy is held */
export const ownershipOf = (
  entry: Entry,
  copies: DimItem[] | undefined,
  acquired: Set<number> | undefined,
): Ownership | undefined => {
  if (copies && copies.length > 0) {
    return "owned";
  }

  if (!acquired) {
    return undefined;
  }

  return isCollected(entry, acquired) ? "unlocked" : "neverseen";
};

const catalystRecord = (
  recordHash: number | undefined,
  records: CharacterRecords,
): Catalyst | undefined => {
  if (recordHash === undefined) {
    return undefined;
  }

  const record = Object.values(records).find((held) => held[recordHash])?.[
    recordHash
  ];

  if (!record) {
    return undefined;
  }

  const objectives = record.objectives ?? [];
  const complete =
    (record.state & OBJECTIVE_NOT_COMPLETED) === 0 ||
    (record.state & RECORD_REDEEMED) !== 0;
  const fractions = objectives.map((objective) =>
    Math.min(
      1,
      (objective.progress ?? 0) / Math.max(1, objective.completionValue),
    ),
  );

  return {
    unlocked: (record.state & OBSCURED) === 0,
    complete,
    progress: complete
      ? 1
      : fractions.length === 0
        ? 0
        : fractions.reduce((total, one) => total + one, 0) / fractions.length,
    objectives,
  };
};

export const catalystFor = (
  entry: Entry | Cosmetic,
  records: CharacterRecords,
): Catalyst | undefined =>
  entry.kind === "weapon"
    ? catalystRecord(entry.catalystRecordHash, records)
    : undefined;

/** The account's catalyst triumph for one exotic item hash */
export const catalystForItem = (
  itemHash: number,
  records: CharacterRecords,
): Catalyst | undefined => catalystRecord(CATALYST_RECORDS[itemHash], records);
