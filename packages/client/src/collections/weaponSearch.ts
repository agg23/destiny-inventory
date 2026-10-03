import type { DimItem } from "app/inventory/item-types";
import { autocompleteTermSuggestions } from "app/search/autocomplete";
import type {
  ItemFilterDefinition,
  ItemSearchConfig,
  SuggestionsContext,
} from "app/search/items/item-filter-types";
import knownValuesFilters, {
  ammoTypeFilter,
  damageFilter,
  itemCategoryFilter,
  itemTypeFilter,
} from "app/search/items/search-filters/known-values";
import {
  parseQuery,
  quoteFilterString,
  type QueryAST,
} from "app/search/query-parser";
import { buildFiltersMap, buildSearchConfig } from "app/search/search-config";
import {
  makeSearchFilterFactory,
  parseAndValidateQuery,
} from "app/search/search-filter";
import { matchText, plainString, startWordRegexp } from "app/search/text-utils";
import D2Sources from "data/d2/source-info-v2";

import {
  CATALYSTS,
  collections,
  OTHER,
  STATUSES,
  type Collections,
  type Weapon,
  type WeaponFacts,
} from "../collections.ts";
import { makeComplete } from "../complete.ts";
import { defs } from "../defs.ts";
import type { SearchEngine, Suggestion } from "../search.ts";
import { weaponPerks, type PerkText } from "./weaponPerks.ts";

interface Context {
  facts: WeaponFacts;
  language: "en";
}

type StandIn = DimItem & { weapon: Weapon };

const NAME_FILTERS = new Set(["keyword", "name", "exactname"]);

const SEARCH_FILTERS = new Set([
  ...NAME_FILTERS,
  "perk",
  "perkname",
  "exactperk",
]);

const weaponOf = (item: DimItem): Weapon => (item as StandIn).weapon;

const factsOf = (args: unknown): WeaponFacts => (args as Context).facts;

const perksOf = (
  pool: Map<Weapon, PerkText[]> | undefined,
  item: DimItem,
): PerkText[] => pool?.get(weaponOf(item)) ?? [];

// Won't be undefined, known-values ships it
const rarityFilter = knownValuesFilters.find(
  (filter) =>
    Array.isArray(filter.keywords) && filter.keywords.includes("legendary"),
)!;

const weaponFilters: ItemFilterDefinition[] = [
  rarityFilter,
  itemCategoryFilter,
  damageFilter,
  ammoTypeFilter,
  {
    ...itemTypeFilter,
    keywords: ["kineticslot", "energy", "power"],
    description: "Shows weapons based on their slot",
  },
  {
    keywords: ["name", "exactname"],
    description: "Shows weapons by name",
    format: "freeform",
    suggestionsGenerator: ({ allItems }) =>
      allItems?.map(
        (item) => `exactname:${quoteFilterString(item.name.toLowerCase())}`,
      ),
    filter: ({ filterValue, language, lhs }) => {
      const test = matchText(filterValue, language, lhs === "exactname");

      return (item) => test(item.name);
    },
  },
  {
    keywords: "keyword",
    description: "Shows weapons by name",
    format: "freeform",
    filter: ({ filterValue, language }) => {
      const test = matchText(filterValue, language, false);

      return (item) => test(item.name);
    },
  },
  {
    keywords: "perk",
    description: "Shows weapons that can roll a perk, by name or description",
    format: "freeform",
    filter: ({ filterValue, language }) => {
      const startWord = startWordRegexp(
        plainString(filterValue, language),
        language,
      );
      const test = (text: string) => startWord.test(text);
      const pool = weaponPerks();

      return (item) =>
        perksOf(pool, item).some(
          (perk) => perk.names.some(test) || perk.descriptions.some(test),
        );
    },
  },
  {
    keywords: ["perkname", "exactperk"],
    description: "Shows weapons that can roll a perk, by name",
    format: "freeform",
    suggestionsGenerator: () => {
      const names = new Set<string>();

      for (const perks of weaponPerks()?.values() ?? []) {
        for (const perk of perks) {
          names.add(perk.names[0]!);
        }
      }

      return [...names].map((name) => `exactperk:${quoteFilterString(name)}`);
    },
    filter: ({ filterValue, language, lhs }) => {
      const wanted = plainString(filterValue, language);
      const startWord = startWordRegexp(wanted, language);
      const test =
        lhs === "exactperk"
          ? (name: string) => name === wanted
          : (name: string) => startWord.test(name);
      const pool = weaponPerks();

      return (item) =>
        perksOf(pool, item).some((perk) => perk.names.some(test));
    },
  },
  {
    keywords: "source",
    description: "Shows weapons based on where they drop",
    format: "query",
    suggestions: [...Object.keys(D2Sources), OTHER],
    destinyVersion: 2,
    filter: ({ filterValue }) => {
      if (filterValue !== OTHER) {
        return (item) => weaponOf(item).sourceKeys.includes(filterValue);
      }

      const others = new Set(
        collections()
          ?.sections.source.flatMap((section) => section.groups)
          .find((group) => group.key === OTHER)?.weapons,
      );

      return (item) => others.has(weaponOf(item));
    },
  },
  {
    keywords: "status",
    description: "Shows weapons you hold, have collected, or have not",
    format: "query",
    suggestions: [...STATUSES],
    destinyVersion: 2,
    filter: (args) => (item) =>
      factsOf(args).ownership(weaponOf(item)) === args.filterValue,
  },
  {
    keywords: "catalyst",
    description: "Shows exotics based on their catalyst",
    format: "query",
    suggestions: [...CATALYSTS],
    destinyVersion: 2,
    filter: (args) => (item) => {
      const catalyst = factsOf(args).catalyst(weaponOf(item));

      if (!catalyst) {
        return false;
      }

      const state = catalyst.complete
        ? "complete"
        : catalyst.unlocked
          ? "obtained"
          : "missing";

      return state === args.filterValue;
    },
  },
];

const FILTERS_MAP = buildFiltersMap(2, weaponFilters);

interface Built {
  index: Collections;
  perks: ReturnType<typeof weaponPerks>;
  standIns: Map<Weapon, DimItem>;
  config: ItemSearchConfig;
  complete: (term: string) => string[];
}

let built: Built | undefined = undefined;

// DIM's filters only read these fields
const prepare = (index: Collections): Built => {
  const perks = weaponPerks();

  if (built?.index === index && built.perks === perks) {
    return built;
  }

  const standIns = new Map<Weapon, DimItem>();

  for (const weapon of index.weapons) {
    standIns.set(weapon, {
      weapon,
      hash: weapon.newestItemHash,
      name: weapon.name,
      rarity: weapon.rarity,
      itemCategoryHashes: weapon.itemCategoryHashes,
      ammoType: weapon.ammoType,
      element:
        weapon.damageTypeHash === undefined
          ? null
          : (defs()?.DamageType.getOptional(weapon.damageTypeHash) ?? null),
      bucket: { hash: weapon.bucketHash, inWeapons: true },
    } as unknown as StandIn);
  }

  const suggestions: SuggestionsContext = {
    allItems: [...standIns.values()],
    customStats: [],
  };
  const config = buildSearchConfig("en", suggestions, FILTERS_MAP);
  const prepared = {
    index,
    perks,
    standIns,
    config,
    complete: makeComplete(config),
  };

  built = prepared;

  return prepared;
};

const valid = (query: string): boolean =>
  parseAndValidateQuery(query, FILTERS_MAP).valid;

const suggest = (query: string, caret: number): Suggestion[] => {
  const index = collections();

  if (!index) {
    return [];
  }

  const { config, complete } = prepare(index);

  return autocompleteTermSuggestions(query, caret, complete, config).flatMap(
    (item) =>
      item.highlightRange === undefined
        ? []
        : [
            {
              query: item.query.fullText,
              help: item.query.helpText,
              range: item.highlightRange.range,
            },
          ],
  );
};

const completion = (query: string, caret: number): string | undefined => {
  if (query === "" || valid(query)) {
    return undefined;
  }

  const [first] = suggest(query, caret);

  return first?.query.startsWith(query) ? first.query : undefined;
};

export const WEAPON_SEARCH: SearchEngine = {
  suggest,
  completion,
  valid,
  recents: "dvm.weaponSearches",
};

/** Compile a query into a weapon predicate. An unfinished term is completed */
export const weaponFilter = (
  index: Collections,
  query: string,
  facts: WeaponFacts,
): ((weapon: Weapon) => boolean) => {
  const { config, standIns } = prepare(index);
  // The weapon filters read nothing else off the context
  const context = { facts, language: "en" } as Context as never;
  const applied = completion(query, query.length) ?? query;
  const test = makeSearchFilterFactory(config, context)(applied);

  // Every weapon in the index has one
  return (weapon) => !!test(standIns.get(weapon)!);
};

const filterArgs = (query: string, types: Set<string>): string[] => {
  const found: string[] = [];

  const walk = (ast: QueryAST) => {
    if (ast.op === "filter" && types.has(ast.type)) {
      found.push(ast.args);
    } else if (ast.op === "and" || ast.op === "or") {
      for (const operand of ast.operands) {
        walk(operand);
      }
    }
  };

  walk(parseQuery(query.trim().toLowerCase()));

  return found;
};

/** The name text a query searches for, outside any not */
export const queryName = (query: string): string =>
  filterArgs(query, NAME_FILTERS).join(" ");

/** Whether a query looks for weapons by name or perk, outside any not */
export const isSearch = (query: string): boolean =>
  filterArgs(query, SEARCH_FILTERS).length > 0;
