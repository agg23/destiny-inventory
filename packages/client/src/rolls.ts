import type { DimItem } from "app/inventory/item-types";
import type { WishListRoll } from "app/wishlists/types";
import {
  getInventoryWishListRoll,
  type InventoryWishListRoll,
} from "app/wishlists/wishlists";
import { createSignal } from "solid-js";

import { fetchTable, hasArtifact } from "./artifacts.ts";
import type { ArtifactIndex } from "./config.ts";
import { PROFILE, type DefStore } from "./store.ts";

export type Mode = "pve" | "pvp";

export const MODE_NAMES: Record<Mode, string> = { pve: "PvE", pvp: "PvP" };

const ARTIFACTS: Record<Mode, string> = { pve: "rolls", pvp: "pvprolls" };
const CACHE_KEYS: Record<Mode, string> = { pve: "rolls", pvp: "pvprolls" };

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

export interface AegisSetBonus {
  name: string;
  hash: number;
  set: string;
  pieces: number;
  rank: number | undefined;
  tier: Tier | undefined;
  tags: string | undefined;
  trigger: string | undefined;
  effect: string | undefined;
  notes: string | undefined;
}

export interface AegisData {
  source: string;
  captured: string;
  rolls: AegisRoll[];
  perks: AegisPerk[];
  setBonuses: AegisSetBonus[];
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

interface Sheet {
  byHash: Map<number, WishListRoll[]>;
  ratings: Map<number, Rating>;
  perkRanks: Map<number, AegisPerk>;
  setBonuses: Map<number, AegisSetBonus>;
  slotsByHash: Map<number, number[][]>;
  captured: string | undefined;
}

const EMPTY_SHEET: Sheet = {
  byHash: new Map(),
  ratings: new Map(),
  perkRanks: new Map(),
  setBonuses: new Map(),
  slotsByHash: new Map(),
  captured: undefined,
};

// A signal, so lookups made during render update when a sheet loads later
const [sheets, setSheets] = createSignal<Record<Mode, Sheet>>({
  pve: EMPTY_SHEET,
  pvp: EMPTY_SHEET,
});

const sheet = (mode: Mode): Sheet => sheets()[mode];

let matched = new Map<string, InventoryWishListRoll | undefined>();

const assessed: Record<Mode, WeakMap<DimItem, Assessment | undefined>> = {
  pve: new WeakMap(),
  pvp: new WeakMap(),
};

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

/** Replace one mode's roll data, which is how tests and other sources feed it in */
export const setRolls = (data: AegisData, mode: Mode = "pve") => {
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

  const bonuses = new Map<number, AegisSetBonus>();

  for (const bonus of data.setBonuses ?? []) {
    bonuses.set(bonus.hash, bonus);
  }

  if (mode === "pve") {
    matched = new Map();
  }

  assessed[mode] = new WeakMap();

  setSheets({
    ...sheets(),
    [mode]: {
      byHash: rolls,
      ratings: rated,
      perkRanks: graded,
      setBonuses: bonuses,
      slotsByHash: slotted,
      captured: data.captured,
    },
  });
};

const loadedFrom: Record<Mode, string | undefined> = {
  pve: undefined,
  pvp: undefined,
};

/** A sheet as persisted for the next boot's first render */
export interface CachedRolls {
  source: string;
  data: AegisData;
}

export type CachedSheets = Record<Mode, CachedRolls | undefined>;

const sourceOf = (index: ArtifactIndex, mode: Mode): string | undefined =>
  hasArtifact(index, ARTIFACTS[mode])
    ? index.files[ARTIFACTS[mode]]!.join()
    : undefined;

/** The persisted sheets, for boots that bypass the inline prefetch */
export const readCachedRolls = async (
  store: DefStore,
): Promise<CachedSheets> => {
  const [pve, pvp] = await Promise.all([
    store.getOne<CachedRolls>(PROFILE, CACHE_KEYS.pve),
    store.getOne<CachedRolls>(PROFILE, CACHE_KEYS.pvp),
  ]);

  return { pve, pvp };
};

/** Applies cached sheets that still match the index, ahead of the first render */
export const primeRolls = (
  cached: CachedSheets,
  index: ArtifactIndex,
): void => {
  for (const mode of ["pve", "pvp"] as const) {
    const source = sourceOf(index, mode);
    const sheetCache = cached[mode];

    if (!sheetCache || source === undefined || sheetCache.source !== source) {
      continue;
    }

    loadedFrom[mode] = source;
    setRolls(sheetCache.data, mode);
  }
};

const loadSheet = async (
  index: ArtifactIndex,
  mode: Mode,
  store: DefStore | undefined,
): Promise<void> => {
  const source = sourceOf(index, mode);

  if (source === undefined || source === loadedFrom[mode]) {
    return;
  }

  loadedFrom[mode] = source;

  const data = await fetchTable<AegisData>(index, ARTIFACTS[mode]);

  setRolls(data, mode);
  store
    ?.putOne(PROFILE, CACHE_KEYS[mode], { source, data })
    .catch((e: unknown) => {
      console.warn("Rolls cache failed", e);
    });
};

/** Load the PvE and PvP roll artifacts once per source file. One absent from the index leaves its lookups empty */
export const loadRolls = async (
  index: ArtifactIndex,
  store?: DefStore,
): Promise<void> => {
  await Promise.all([
    loadSheet(index, "pve", store),
    loadSheet(index, "pvp", store),
  ]);
};

/** The sheet's rating for an item hash, whether or not the instance rolled well */
export const ratingFor = (
  hash: number,
  mode: Mode = "pve",
): Rating | undefined => sheet(mode).ratings.get(hash);

/**
 * The matching Aegis roll for this instance. DIM counts a perk it could select as present, so
 * the columns have to have actually rolled it
 */
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

export interface SlotPerk {
  name: string;
  hash: number;
  rank: number | undefined;
  wanted: boolean;
  plugged: boolean;
}

export interface SlotVerdict {
  /** Which perk column this is, counting from one the way the sheet does */
  slot: number;
  /** The wanted perk when the column rolled one, otherwise what sits plugged */
  rolled: { name: string; hash: number; rank: number | undefined } | undefined;
  wanted: number[];
  /** Every perk the column rolled, in the order the socket lists them */
  options: SlotPerk[];
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

    // A column scores on everything it rolled, since any of it can be selected
    const hits = options.filter((option) => option.wanted);
    let shown = hits.find((option) => option.plugged);

    if (shown === undefined) {
      for (const hit of hits) {
        if (
          shown === undefined ||
          (hit.rank ?? Number.MAX_SAFE_INTEGER) <
            (shown.rank ?? Number.MAX_SAFE_INTEGER)
        ) {
          shown = hit;
        }
      }
    }

    shown = shown ?? options.find((option) => option.plugged);

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

/**
 * What the sheet says about this exact roll: the weapon's standing, which perk columns landed on
 * one of its picks, and the tier those two together come to
 */
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

/** Aegis's standing on a perk or origin trait, apart from the weapon carrying it */
export const perkFor = (hash: number): AegisPerk | undefined =>
  sheet("pve").perkRanks.get(hash);

/** How many perks of a kind Aegis ranks, so a rank reads as "4 of 120" */
export const perkRanked = (kind: AegisPerk["kind"]): number => {
  let count = 0;

  for (const perk of new Set(sheet("pve").perkRanks.values())) {
    if (perk.kind === kind && perk.rank !== undefined) {
      count += 1;
    }
  }

  return count;
};

/** The sheet's standing on one set bonus, found by the sandbox perk the set confers */
export const setBonusFor = (
  hash: number,
  mode: Mode = "pve",
): AegisSetBonus | undefined => sheet(mode).setBonuses.get(hash);

/** Both of an armor piece's set bonuses as the sheet rates them, the 2 piece first */
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

/** How many set bonuses the sheet ranks, so a rank reads as "7 of 112" */
export const setBonusesRanked = (mode: Mode = "pve"): number => {
  let count = 0;

  for (const bonus of sheet(mode).setBonuses.values()) {
    if (bonus.rank !== undefined) {
      count += 1;
    }
  }

  return count;
};

export const rollsByHash = (): Map<number, WishListRoll[]> =>
  sheet("pve").byHash;

export const rollsCaptured = (): string | undefined => sheet("pve").captured;
