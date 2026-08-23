import type { DimItem } from "app/inventory/item-types";
import type { WishListRoll } from "app/wishlists/types";
import {
  getInventoryWishListRoll,
  type InventoryWishListRoll,
} from "app/wishlists/wishlists";

import { fetchTable, hasArtifact } from "./artifacts.ts";
import type { ArtifactIndex } from "./config.ts";

const ARTIFACT = "rolls";

const TIERS = ["S", "A", "B", "C", "D", "E", "F"] as const;

export type Tier = (typeof TIERS)[number];

export interface AegisRoll {
  name: string;
  category: string;
  tier: Tier | undefined;
  rank: number | undefined;
  ranked: number;
  hashes: number[];
  slots: number[][];
  notes: string | undefined;
  season: string | undefined;
}

export interface AegisPerk {
  name: string;
  hashes: number[];
  kind: "perk" | "origin";
  rank: number | undefined;
  tier: Tier | undefined;
  tags: string | undefined;
  effect: string | undefined;
}

export interface AegisData {
  source: string;
  captured: string;
  rolls: AegisRoll[];
  perks: AegisPerk[];
}

export interface Rating {
  name: string;
  category: string;
  tier: Tier | undefined;
  rank: number | undefined;
  ranked: number;
  notes: string | undefined;
  season: string | undefined;
}

let slotsByHash = new Map<number, number[][]>();
let byHash = new Map<number, WishListRoll[]>();
let ratings = new Map<number, Rating>();
let perkRanks = new Map<number, AegisPerk>();
let matched = new Map<string, InventoryWishListRoll | undefined>();
let captured: string | undefined = undefined;

const rankOf = (perk: AegisPerk): number =>
  perk.rank ?? Number.MAX_SAFE_INTEGER;

const rank = (tier: Tier | undefined): number =>
  tier === undefined ? TIERS.length : TIERS.indexOf(tier);

const better = (
  current: Tier | undefined,
  candidate: Tier | undefined,
): Tier | undefined => (rank(candidate) < rank(current) ? candidate : current);

const combos = (slots: number[][]): number[][] =>
  slots.reduce<number[][]>(
    (rows, slot) => rows.flatMap((row) => slot.map((hash) => [...row, hash])),
    [[]],
  );

/** Replace the loaded roll data, which is how tests and other sources feed it in */
export const setRolls = (data: AegisData) => {
  const rolls = new Map<number, WishListRoll[]>();
  const rated = new Map<number, Rating>();
  const slotted = new Map<number, number[][]>();

  for (const entry of data.rolls) {
    for (const hash of entry.hashes) {
      // Reissues share a name and collapse onto one hash, so the kinder rating wins
      if (better(rated.get(hash)?.tier, entry.tier) !== entry.tier) {
        continue;
      }

      rated.set(hash, {
        name: entry.name,
        category: entry.category,
        tier: entry.tier,
        rank: entry.rank,
        ranked: entry.ranked,
        notes: entry.notes,
        season: entry.season,
      });
    }

    // Exotics carry a rating and no perk columns, and an empty roll matches anything
    if (entry.slots.length === 0) {
      continue;
    }

    for (const hash of entry.hashes) {
      if (!slotted.has(hash)) {
        slotted.set(hash, entry.slots);
      }
    }

    for (const combo of combos(entry.slots)) {
      for (const hash of entry.hashes) {
        const roll: WishListRoll = {
          itemHash: hash,
          recommendedPerks: new Set(combo),
          // Non-expert requires every plugged perk socket to be covered, and barrel and mag are not
          isExpertMode: true,
          notes: entry.notes,
        };

        const existing = rolls.get(hash);

        if (existing) {
          existing.push(roll);
        } else {
          rolls.set(hash, [roll]);
        }
      }
    }
  }

  const graded = new Map<number, AegisPerk>();

  for (const perk of data.perks ?? []) {
    for (const hash of perk.hashes) {
      const existing = graded.get(hash);

      if (!existing || rankOf(perk) < rankOf(existing)) {
        graded.set(hash, perk);
      }
    }
  }

  byHash = rolls;
  ratings = rated;
  perkRanks = graded;
  slotsByHash = slotted;
  matched = new Map();
  captured = data.captured;
};

/** Load the Aegis roll artifact. Absent from the index it leaves lookups empty */
export const loadRolls = async (index: ArtifactIndex): Promise<void> => {
  if (!hasArtifact(index, ARTIFACT)) {
    return;
  }

  setRolls(await fetchTable<AegisData>(index, ARTIFACT));
};

/** The Aegis rating for an item hash, whether or not the instance rolled well */
export const ratingFor = (hash: number): Rating | undefined =>
  ratings.get(hash);

/**
 * The matching Aegis roll for this instance. DIM counts a perk it could select as present, so
 * the columns have to have actually rolled it
 */
export const rollFor = (item: DimItem): InventoryWishListRoll | undefined => {
  if (byHash.size === 0 || !item.sockets || item.sockets.fromDefinitions) {
    return undefined;
  }

  if (matched.has(item.id)) {
    return matched.get(item.id);
  }

  const read = assess(item);
  const roll =
    read && read.of > 0 && read.score === read.of
      ? getInventoryWishListRoll(item, byHash)
      : undefined;

  matched.set(item.id, roll);

  return roll;
};

export interface SlotVerdict {
  /** Which perk column this is, counting from one the way the sheet does */
  slot: number;
  rolled: { name: string; hash: number; rank: number | undefined } | undefined;
  wanted: number[];
  /** What Aegis picked for the column, named off the socket's own pool */
  picks: string[];
  matched: boolean;
}

export interface Assessment {
  rating: Rating;
  slots: SlotVerdict[];
  /** How many perk columns rolled one of Aegis's picks */
  score: number;
  /** Every copy of the weapon rolls the same number of columns */
  of: number;
  /** The weapon's tier stepped down once per column that missed */
  overall: Tier | undefined;
}

const step = (tier: Tier | undefined, down: number): Tier | undefined => {
  if (tier === undefined) {
    return undefined;
  }

  return TIERS[Math.min(TIERS.length - 1, TIERS.indexOf(tier) + down)];
};

// A miss leaves the wanted perks out of plugOptions, so the pool is what names the socket
const socketFor = (item: DimItem, wanted: Set<number>) => {
  for (const socket of item.sockets?.allSockets ?? []) {
    if (socket.plugOptions.some((plug) => wanted.has(plug.plugDef.hash))) {
      return socket;
    }
  }

  for (const socket of item.sockets?.allSockets ?? []) {
    if (socket.plugSet?.plugs.some((plug) => wanted.has(plug.plugDef.hash))) {
      return socket;
    }
  }

  return undefined;
};

// Enhanced variants carry their own hash under the same name
const namePicks = (
  socket: ReturnType<typeof socketFor>,
  column: number[],
): string[] => {
  const names = new Map<number, string>();

  for (const plug of [
    ...(socket?.plugSet?.plugs ?? []),
    ...(socket?.plugOptions ?? []),
  ]) {
    names.set(plug.plugDef.hash, plug.plugDef.displayProperties.name);
  }

  const picks: string[] = [];

  for (const hash of column) {
    const name = names.get(hash);

    if (name !== undefined && !picks.includes(name)) {
      picks.push(name);
    }
  }

  return picks;
};

/**
 * What Aegis says about this exact roll: the weapon's standing, which perk columns landed on
 * one of its picks, and the tier those two together come to
 */
export const assess = (item: DimItem): Assessment | undefined => {
  const rating = ratings.get(item.hash);

  if (!rating) {
    return undefined;
  }

  const columns = slotsByHash.get(item.hash) ?? [];
  const slots: SlotVerdict[] = [];

  for (const [index, column] of columns.entries()) {
    const wanted = new Set(column);
    const socket = socketFor(item, wanted);
    const plugged = socket?.plugged;

    slots.push({
      slot: index + 1,
      rolled: plugged
        ? {
            name: plugged.plugDef.displayProperties.name,
            hash: plugged.plugDef.hash,
            rank: perkRanks.get(plugged.plugDef.hash)?.rank,
          }
        : undefined,
      wanted: column,
      picks: namePicks(socket, column),
      matched: plugged ? wanted.has(plugged.plugDef.hash) : false,
    });
  }

  const score = slots.filter((verdict) => verdict.matched).length;

  return {
    rating,
    slots,
    score,
    of: slots.length,
    overall: step(rating.tier, slots.length - score),
  };
};

/** Aegis's standing on a perk or origin trait, apart from the weapon carrying it */
export const perkFor = (hash: number): AegisPerk | undefined =>
  perkRanks.get(hash);

/** How many perks of a kind Aegis ranks, so a rank reads as "4 of 120" */
export const perkRanked = (kind: AegisPerk["kind"]): number => {
  let count = 0;

  for (const perk of new Set(perkRanks.values())) {
    if (perk.kind === kind && perk.rank !== undefined) {
      count += 1;
    }
  }

  return count;
};

export const rollsByHash = (): Map<number, WishListRoll[]> => byHash;

export const rollsCaptured = (): string | undefined => captured;
