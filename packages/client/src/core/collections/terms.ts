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

export const OTHER = "other";

export const EXOTIC = "exotic";

export const CLASSES = ["titan", "hunter", "warlock"] as const;

export type ClassName = (typeof CLASSES)[number];

export const AMMO_NAMES = new Map<number, string>(
  Object.entries(d2AmmoTypes).map(([name, ammo]) => [ammo, name]),
);

const CATEGORY_KEYWORDS = new Set<string>(itemCategoryFilter.keywords);

/** Whether a term is one the rail writes, so a rail click replaces it */
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

/** Replaces key's terms from values with value, leaving the rest of the query alone */
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

/** Whether a group's terms are all in the query; a missing ammo term is fine when none is set */
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
