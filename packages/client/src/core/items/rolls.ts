import type { DimItem } from "app/inventory/item-types";
import type { WishListRoll } from "app/wishlists/types";
import {
  getInventoryWishListRoll,
  type InventoryWishListRoll,
} from "app/wishlists/wishlists";
import { minBy } from "es-toolkit";

import {
  TIERS,
  type AegisPerk,
  type AegisSetBonus,
  type Tier,
} from "@dvm/defs-core";

import { assessed, matched, sheet } from "./rollSheets.ts";
import {
  rankOf,
  type Assessment,
  type Mode,
  type Rating,
  type Sheet,
  type SlotPerk,
  type SlotVerdict,
} from "./rollTypes.ts";

/** Sheet rating for an item hash, regardless of the instance's roll */
export const ratingFor = (
  hash: number,
  mode: Mode = "pve",
): Rating | undefined => sheet(mode).ratings.get(hash);

/** Matching Aegis roll; every column must have rolled a pick since DIM counts selectable perks */
export const rollFor = (item: DimItem): InventoryWishListRoll | undefined => {
  const { byHash } = sheet("pve");

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

const step = (tier: Tier | undefined, down: number): Tier | undefined => {
  if (tier === undefined) {
    return undefined;
  }

  return TIERS[Math.min(TIERS.length - 1, TIERS.indexOf(tier) + down)];
};

// A miss leaves the wanted perks out of plugOptions; fall back to the plug set
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

const assessRoll = (item: DimItem, current: Sheet): Assessment | undefined => {
  const { ratings, slotsByHash, perkRanks } = current;
  const rating = ratings.get(item.hash);

  if (!rating) {
    return undefined;
  }

  const columns = slotsByHash.get(item.hash) ?? [];
  const slots: SlotVerdict[] = [];

  for (const [index, column] of columns.entries()) {
    const wanted = new Set(column);
    const socket = socketFor(item, wanted);
    const plugged = socket?.plugged ?? undefined;

    const rollable =
      socket && socket.plugOptions.length > 0
        ? socket.plugOptions
        : plugged
          ? [plugged]
          : [];

    const options: SlotPerk[] = [];

    for (const plug of rollable) {
      const { name } = plug.plugDef.displayProperties;
      const hash = plug.plugDef.hash;
      const isWanted = wanted.has(hash);
      const isPlugged = hash === plugged?.plugDef.hash;
      const seen = options.find((option) => option.name === name);

      if (seen) {
        seen.wanted = seen.wanted || isWanted;
        seen.plugged = seen.plugged || isPlugged;
        continue;
      }

      options.push({
        name,
        hash,
        rank: perkRanks.get(hash)?.rank,
        wanted: isWanted,
        plugged: isPlugged,
      });
    }

    // Any rolled perk in the column can be selected
    const hits = options.filter((option) => option.wanted);
    const shown =
      hits.find((option) => option.plugged) ??
      minBy(hits, rankOf) ??
      options.find((option) => option.plugged);

    slots.push({
      slot: index + 1,
      rolled: shown
        ? { name: shown.name, hash: shown.hash, rank: shown.rank }
        : undefined,
      wanted: column,
      options,
      picks: namePicks(socket, column),
      matched: hits.length > 0,
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

/** Sheet rating, matched perk columns, and resulting tier for this exact roll */
export const assess = (
  item: DimItem,
  mode: Mode = "pve",
): Assessment | undefined => {
  const current = sheet(mode);

  if (assessed[mode].has(item)) {
    return assessed[mode].get(item);
  }

  const read = assessRoll(item, current);

  assessed[mode].set(item, read);

  return read;
};

/** Aegis's rank for a perk or origin trait, independent of the weapon */
export const perkFor = (hash: number): AegisPerk | undefined =>
  sheet("pve").perkRanks.get(hash);

/** Sheet rating for a set bonus, keyed by its sandbox perk hash */
export const setBonusFor = (
  hash: number,
  mode: Mode = "pve",
): AegisSetBonus | undefined => sheet(mode).setBonuses.get(hash);

/** An armor piece's rated set bonuses, 2 piece first */
export const setRatings = (
  item: DimItem,
  mode: Mode = "pve",
): AegisSetBonus[] => {
  const { setBonuses } = sheet(mode);

  return (item.setBonus?.setPerks ?? [])
    .flatMap((perk) => {
      const found = setBonuses.get(perk.sandboxPerkHash);

      return found ? [found] : [];
    })
    .sort((a, b) => a.pieces - b.pieces);
};

/** Count of ranked set bonuses, the 112 in "7 of 112" */
export const setBonusesRanked = (mode: Mode = "pve"): number =>
  [...sheet(mode).setBonuses.values()].filter(
    (bonus) => bonus.rank !== undefined,
  ).length;

/** Every hash sharing this hash's rated columns, itself included */
export const versionsOf = (hash: number, mode: Mode = "pve"): number[] =>
  sheet(mode).versionsByHash.get(hash) ?? [hash];

export const rollsByHash = (): Map<number, WishListRoll[]> =>
  sheet("pve").byHash;
