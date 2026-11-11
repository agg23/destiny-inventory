import {
  d2AmmoTypes,
  itemCategoryFilter,
} from "app/search/items/search-filters/known-values";

import type { Group } from "./types.ts";

// DestinyAmmunitionType
export const AMMO_SECTIONS: [number, string][] = [
  [1, "Primary"],
  [2, "Special"],
  [3, "Heavy"],
];

export const SOURCE_SECTIONS: { label: string; keys: [string, string][] }[] = [
  {
    label: "Raids",
    keys: [
      ["desertperpetual", "The Desert Perpetual"],
      ["salvationsedge", "Salvation's Edge"],
      ["crotasend", "Crota's End"],
      ["rootofnightmares", "Root of Nightmares"],
      ["kingsfall", "King's Fall"],
      ["vowofthedisciple", "Vow of the Disciple"],
      ["vaultofglass", "Vault of Glass"],
      ["deepstonecrypt", "Deep Stone Crypt"],
      ["gardenofsalvation", "Garden of Salvation"],
      ["crownofsorrow", "Crown of Sorrow"],
      ["scourgeofthepast", "Scourge of the Past"],
      ["lastwish", "Last Wish"],
      ["spireofstars", "Spire of Stars"],
      ["eow", "Eater of Worlds"],
      ["leviathan", "Leviathan"],
    ],
  },
  {
    label: "Dungeons",
    keys: [
      ["equilibrium", "Equilibrium"],
      ["sundereddoctrine", "Sundered Doctrine"],
      ["vespershost", "Vesper's Host"],
      ["warlordsruin", "Warlord's Ruin"],
      ["ghostsofthedeep", "Ghosts of the Deep"],
      ["spireofthewatcher", "Spire of the Watcher"],
      ["duality", "Duality"],
      ["grasp", "Grasp of Avarice"],
      ["prophecy", "Prophecy"],
      ["pit", "Pit of Heresy"],
      ["shatteredthrone", "The Shattered Throne"],
    ],
  },
  {
    label: "Playlists",
    keys: [
      ["nightfall", "Nightfall"],
      ["strikes", "Vanguard"],
      ["pinnacleops", "Pinnacle Ops"],
      ["crucible", "Crucible"],
      ["trials", "Trials of Osiris"],
      ["ironbanner", "Iron Banner"],
      ["gambit", "Gambit"],
      ["gambitprime", "Gambit Prime"],
    ],
  },
  {
    label: "Destinations",
    keys: [
      ["kepler", "Kepler"],
      ["paleheart", "The Pale Heart"],
      ["neomuna", "Neomuna"],
      ["throneworld", "Throne World"],
      ["europa", "Europa"],
      ["moon", "The Moon"],
      ["dreaming", "Dreaming City"],
      ["tangled", "Tangled Shore"],
      ["nessus", "Nessus"],
      ["edz", "European Dead Zone"],
    ],
  },
  {
    label: "Elsewhere",
    keys: [
      ["legendaryengram", "World drops"],
      ["campaign", "Campaigns"],
      ["seasonpass", "Seasons"],
      ["events", "Events"],
      ["gunsmith", "Gunsmith"],
      ["exoticquest", "Exotic quests"],
      ["eververse", "Eververse"],
    ],
  },
];

export const OTHER = "other";

export const EXOTIC = "exotic";

export const CLASSES = ["titan", "hunter", "warlock"] as const;

export type ClassName = (typeof CLASSES)[number];

export const AMMO_NAMES = new Map<number, string>(
  Object.entries(d2AmmoTypes).map(([name, ammo]) => [ammo, name]),
);

const CATEGORY_KEYWORDS = new Set<string>(itemCategoryFilter.keywords);

/** Whether a rail click should replace this term */
export const isRailTerm = (key: string | undefined, value: string): boolean =>
  key === "source" ||
  (key === "is" &&
    (CATEGORY_KEYWORDS.has(value) ||
      (d2AmmoTypes as Record<string, number>)[value] !== undefined));

/** The armor rail only writes sources and the exotics entry */
export const isArmorRailTerm = (
  key: string | undefined,
  value: string,
): boolean => key === "source" || (key === "is" && value === EXOTIC);

/** The query with a class term added when it names none */
export const withClass = (query: string, classType: number): string => {
  if (termValue(query, "is", CLASSES) !== undefined) {
    return query;
  }

  return `${query} is:${CLASSES[classType] ?? CLASSES[0]}`.trim();
};

export const RARITIES = [
  "common",
  "uncommon",
  "rare",
  "legendary",
  "exotic",
] as const;

export const STATUSES = ["owned", "unlocked", "neverseen"] as const;

export const CATALYSTS = ["missing", "obtained", "complete"] as const;

const TERM = /(-?)(?:(\w+):)?("[^"]*"|\S+)/g;

/** The one value set for key, or undefined when the query sets none or several */
export const termValue = <T extends string>(
  query: string,
  key: string,
  values: readonly T[],
): T | undefined => {
  const found = [...query.matchAll(TERM)].flatMap(([, negated, term, raw]) =>
    !negated && term === key && values.includes(raw!.toLowerCase() as T)
      ? [raw!.toLowerCase() as T]
      : [],
  );

  return found.length === 1 ? found[0] : undefined;
};

/** The query with every term drop picks removed and added appended */
export const withTerms = (
  query: string,
  drop: (key: string | undefined, value: string) => boolean,
  added: string[],
): string =>
  [
    ...[...query.matchAll(TERM)]
      .filter(
        ([, negated, key, raw]) => negated || !drop(key, raw!.toLowerCase()),
      )
      .map(([whole]) => whole),
    ...added,
  ].join(" ");

/** Replaces key's terms from values with value */
export const withTerm = (
  query: string,
  key: string,
  values: readonly string[],
  value: string | undefined,
): string =>
  withTerms(
    query,
    (term, raw) => term === key && values.includes(raw),
    value === undefined ? [] : [`${key}:${value}`],
  );

/** Whether a group's terms are all in the query, ammo optional when none is set */
export const queryPicks = (query: string, group: Group): boolean => {
  const present = new Set(
    [...query.matchAll(TERM)].flatMap(([, negated, key, raw]) =>
      negated || key === undefined ? [] : [`${key}:${raw!.toLowerCase()}`],
    ),
  );
  const anyAmmo = [...AMMO_NAMES.values()].some((ammo) =>
    present.has(`is:${ammo}`),
  );

  return (
    group.terms.length > 0 &&
    group.terms.every(
      (term) =>
        present.has(term) ||
        (!anyAmmo &&
          [...AMMO_NAMES.values()].some((ammo) => term === `is:${ammo}`)),
    )
  );
};
