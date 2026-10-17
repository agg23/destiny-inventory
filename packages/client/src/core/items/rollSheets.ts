import type { DimItem } from "app/inventory/item-types";
import type { WishListRoll } from "app/wishlists/types";
import type { InventoryWishListRoll } from "app/wishlists/wishlists";
import { createSignal } from "solid-js";

import type { AegisData, AegisPerk, AegisSetBonus, Tier } from "@dvm/defs-core";
import type { ArtifactIndex } from "@dvm/service";

import { fetchTable, hasArtifact } from "../api/artifacts.ts";
import { PROFILE, type DefStore } from "../profile/store.ts";
import {
  MODES,
  rank,
  rankOf,
  type Assessment,
  type CachedRolls,
  type CachedSheets,
  type Mode,
  type Rating,
  type Sheet,
} from "./rollTypes.ts";

const ARTIFACTS: Record<Mode, string> = { pve: "rolls", pvp: "pvprolls" };

const EMPTY_SHEET: Sheet = {
  byHash: new Map(),
  ratings: new Map(),
  perkRanks: new Map(),
  setBonuses: new Map(),
  slotsByHash: new Map(),
  versionsByHash: new Map(),
  captured: undefined,
};

const [sheets, setSheets] = createSignal<Record<Mode, Sheet>>({
  pve: EMPTY_SHEET,
  pvp: EMPTY_SHEET,
});

export const sheet = (mode: Mode): Sheet => sheets()[mode];

export let matched = new Map<string, InventoryWishListRoll | undefined>();

export const assessed: Record<Mode, WeakMap<DimItem, Assessment | undefined>> = {
  pve: new WeakMap(),
  pvp: new WeakMap(),
};

const better = (
  current: Tier | undefined,
  candidate: Tier | undefined,
): Tier | undefined => (rank(candidate) < rank(current) ? candidate : current);

const combos = (slots: number[][]): number[][] =>
  slots.reduce<number[][]>(
    (rows, slot) => rows.flatMap((row) => slot.map((hash) => [...row, hash])),
    [[]],
  );

export const setRolls = (data: AegisData, mode: Mode = "pve") => {
  const rolls = new Map<number, WishListRoll[]>();
  const rated = new Map<number, Rating>();
  const slotted = new Map<number, number[][]>();
  const versions = new Map<number, number[]>();

  for (const entry of data.rolls) {
    for (const hash of entry.hashes) {
      // Reissues collapse onto one hash; keep the better rating
      if (better(rated.get(hash)?.tier, entry.tier) !== entry.tier) {
        continue;
      }

      const { hashes, slots, ...rating } = entry;

      rated.set(hash, rating);
    }

    // Exotics have no perk columns and an empty roll matches anything
    if (entry.slots.length === 0) {
      continue;
    }

    for (const hash of entry.hashes) {
      if (!slotted.has(hash)) {
        slotted.set(hash, entry.slots);
        versions.set(hash, entry.hashes);
      }
    }

    for (const combo of combos(entry.slots)) {
      for (const hash of entry.hashes) {
        const roll: WishListRoll = {
          itemHash: hash,
          recommendedPerks: new Set(combo),
          // Non-expert needs every perk socket covered; Aegis skips barrel and mag
          isExpertMode: true,
          notes: entry.notes,
        };

        const existing = rolls.get(hash) ?? [];

        existing.push(roll);
        rolls.set(hash, existing);
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
      versionsByHash: versions,
      captured: data.captured,
    },
  });
};

const loadedFrom: Record<Mode, string | undefined> = {
  pve: undefined,
  pvp: undefined,
};

const sourceOf = (index: ArtifactIndex, mode: Mode): string | undefined =>
  hasArtifact(index, ARTIFACTS[mode])
    ? index.files[ARTIFACTS[mode]]!.join()
    : undefined;

/** Persisted sheets, for boots that skip the inline prefetch */
export const readCachedRolls = async (
  store: DefStore,
): Promise<CachedSheets> => {
  const [pve, pvp] = await Promise.all(
    MODES.map((mode) => store.getOne<CachedRolls>(PROFILE, ARTIFACTS[mode])),
  );

  return { pve, pvp };
};

/** Applies cached sheets that still match the index, ahead of the first render */
export const primeRolls = (
  cached: CachedSheets,
  index: ArtifactIndex,
): void => {
  for (const mode of MODES) {
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
    ?.putOne(PROFILE, ARTIFACTS[mode], { source, data })
    .catch((e: unknown) => {
      console.warn("Rolls cache failed", e);
    });
};

/** Loads both roll artifacts once per source file; one missing from the index stays empty */
export const loadRolls = async (
  index: ArtifactIndex,
  store?: DefStore,
): Promise<void> => {
  await Promise.all(MODES.map((mode) => loadSheet(index, mode, store)));
};
