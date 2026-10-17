import {
  DIFFICULTIES,
  difficultyOf,
  type GearTier,
  type SlimTier,
} from "@dvm/defs-core";

import type { Available, GearDrop, Loot, Matchmaking } from "./types.ts";

export type Values = Record<number, number>;

const MATCHMAKING: Record<Matchmaking, string | undefined> = {
  required: "Matchmade",
  optional: "MM optional",
  none: undefined,
};

export const TOP_GEAR_TIER = 5;

const ANY = "Any";
const RANGE = "Range";

const NORMAL_RANK = DIFFICULTIES.indexOf("Normal");
const TOP_RANK = DIFFICULTIES.length - 1;

const RUNG_ORDER = new Map(DIFFICULTIES.map((name, at) => [name, at]));

export const power = (entry: Available): string | undefined => {
  if (entry.power === undefined || entry.topPower === undefined) {
    return undefined;
  }

  return entry.power === entry.topPower
    ? String(entry.power)
    : `${entry.power}–${entry.topPower}`;
};

export const where = (entry: Available): string =>
  [entry.typeName, entry.location].filter(Boolean).join(" · ");

export const subline = (entry: Available): string =>
  [entry.typeName, entry.location, MATCHMAKING[entry.matchmaking]]
    .filter(Boolean)
    .join(" · ");

const byRung = (a: string, b: string): number =>
  (RUNG_ORDER.get(a) ?? TOP_RANK) - (RUNG_ORDER.get(b) ?? TOP_RANK);

const rungs = (entry: Available): string[] => {
  if (entry.difficulties.length > 0) {
    return entry.difficulties.map((tier) => tier.name);
  }

  const named = new Set(
    entry.variants.flatMap((one) => (one.difficulty ? [one.difficulty] : [])),
  );

  return [...named].sort(byRung);
};

const wholeLadder = (names: string[]): boolean => {
  const first = DIFFICULTIES.indexOf(names[0] ?? "");
  const last = DIFFICULTIES.indexOf(names[names.length - 1] ?? "");

  return first >= 0 && first <= NORMAL_RANK && last === TOP_RANK;
};

interface Rung {
  name: string;
  tier: SlimTier | undefined;
}

export const ladder = (entry: Available): Rung[] =>
  entry.difficulties.length > 0
    ? entry.difficulties.map((tier) => ({ name: tier.name, tier }))
    : rungs(entry).map((name) => ({ name, tier: undefined }));

export const rung = (entry: Available): string | undefined => {
  const names = rungs(entry);

  if (names.length === 0) {
    return difficultyOf(entry.name);
  }

  if (names.length === 1) {
    return names[0];
  }

  return wholeLadder(names) ? ANY : RANGE;
};

const gearLabel = (tier: GearTier): string =>
  tier.low === tier.high ? `T${tier.high}` : `T${tier.low}-${tier.high}`;

export const topTier = (gear: GearDrop): boolean => gear.base.low >= TOP_GEAR_TIER;

export const gearText = (gear: GearDrop): string => {
  const base = gearLabel(gear.base);
  const top = gearLabel(gear.top);

  return base === top ? base : `${base} / ${top}`;
};

interface Door {
  name: string | undefined;
  tier: GearTier;
}

export const doors = (entry: Available): Door[] => {
  const held = new Map<string, Door>();

  for (const one of entry.variants) {
    if (!one.gearTier) {
      continue;
    }

    held.set(`${one.difficulty ?? ""}|${gearLabel(one.gearTier)}`, {
      name: one.difficulty,
      tier: one.gearTier,
    });
  }

  return [...held.values()].sort((a, b) => byRung(a.name ?? "", b.name ?? ""));
};

export const rewardsOf = (entry: Available): { loot: Loot; spent: boolean }[] => [
  ...(entry.focus ? [{ loot: entry.focus, spent: false }] : []),
  ...entry.bonus.map((loot) => ({ loot, spent: false })),
  ...(entry.spentFocus ? [{ loot: entry.spentFocus, spent: true }] : []),
  ...entry.spentBonus.map((loot) => ({ loot, spent: true })),
];
