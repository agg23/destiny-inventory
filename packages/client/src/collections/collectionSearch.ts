import type { DimItem } from "app/inventory/item-types";
import { autocompleteTermSuggestions } from "app/search/autocomplete";
import type {
  ItemFilterDefinition,
  ItemSearchConfig,
  SuggestionsContext,
} from "app/search/items/item-filter-types";
import knownValuesFilters, {
  ammoTypeFilter,
  classFilter,
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
  type Entry,
  type EntryFacts,
  type Weapon,
} from "../collections.ts";
import { makeComplete } from "../complete.ts";
import { defs } from "../defs.ts";
import type { SearchEngine, Suggestion } from "../search.ts";
import type { Kind } from "../url.ts";
import { weaponPerks, type PerkText } from "./weaponPerks.ts";

interface Context {
  facts: EntryFacts;
  language: "en";
}

type StandIn = DimItem & { entry: Entry };

const NAME_FILTERS = new Set(["keyword", "name", "exactname"]);

const SEARCH_FILTERS = new Set([
  ...NAME_FILTERS,
  "perk",
  "perkname",
  "exactperk",
]);

const entryOf = (item: DimItem): Entry => (item as StandIn).entry;

const factsOf = (args: unknown): EntryFacts => (args as Context).facts;

const perksOf = (
  pool: Map<Weapon, PerkText[]> | undefined,
  item: DimItem,
): PerkText[] => {
  const entry = entryOf(item);

  return entry.kind === "weapon" ? (pool?.get(entry) ?? []) : [];
};

// Won't be undefined, known-values ships it
const rarityFilter = knownValuesFilters.find(
  (filter) =>
    Array.isArray(filter.keywords) && filter.keywords.includes("legendary"),
)!;

const entryFilters: ItemFilterDefinition[] = [
  rarityFilter,
  itemCategoryFilter,
  damageFilter,
  ammoTypeFilter,
  classFilter,
  {
    ...itemTypeFilter,
    keywords: [
      "kineticslot",
      "energy",
      "power",
      "helmet",
      "gauntlets",
      "chest",
      "leg",
      "classitem",
    ],
    description: "Shows items based on their slot",
  },
  {
    keywords: ["name", "exactname"],
    description: "Shows items by name",
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
    description: "Shows items by name",
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
    description: "Shows items based on where they drop",
    format: "query",
    suggestions: [...Object.keys(D2Sources), OTHER],
    destinyVersion: 2,
    filter: ({ filterValue }) => {
      if (filterValue !== OTHER) {
        return (item) => entryOf(item).sourceKeys.includes(filterValue);
      }

      const index = collections();
      const others = new Set(
        [...(index?.sections.source ?? []), ...(index?.armorSections ?? [])]
          .flatMap((section) => section.groups)
          .filter((group) => group.key === OTHER)
          .flatMap((group) => group.entries),
      );

      return (item) => others.has(entryOf(item));
    },
  },
  {
    keywords: "status",
    description: "Shows items you hold, have collected, or have not",
    format: "query",
    suggestions: [...STATUSES],
    destinyVersion: 2,
    filter: (args) => (item) =>
      factsOf(args).ownership(entryOf(item)) === args.filterValue,
  },
  {
    keywords: "catalyst",
    description: "Shows exotics based on their catalyst",
    format: "query",
    suggestions: [...CATALYSTS],
    destinyVersion: 2,
    filter: (args) => (item) => {
      const catalyst = factsOf(args).catalyst(entryOf(item));

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

const FILTERS_MAP = buildFiltersMap(2, entryFilters);

// DestinyClass.Unknown
const ANY_CLASS = 3;

interface Built {
  index: Collections;
  perks: ReturnType<typeof weaponPerks>;
  standIns: Map<Entry, DimItem>;
  config: ItemSearchConfig;
  complete: (term: string) => string[];
}

const built = new Map<Kind, Built>();

// DIM's filters only read these fields
const prepare = (index: Collections, kind: Kind): Built => {
  const perks = weaponPerks();
  const held = built.get(kind);

  if (held?.index === index && held.perks === perks) {
    return held;
  }

  const standIns = new Map<Entry, DimItem>();

  for (const entry of kind === "weapon" ? index.weapons : index.armor) {
    standIns.set(entry, {
      entry,
      hash: entry.newestItemHash,
      name: entry.name,
      rarity: entry.rarity,
      itemCategoryHashes: entry.itemCategoryHashes,
      classType: entry.kind === "armor" ? entry.classType : ANY_CLASS,
      ammoType: entry.kind === "weapon" ? entry.ammoType : 0,
      element:
        entry.kind === "armor" || entry.damageTypeHash === undefined
          ? null
          : (defs()?.DamageType.getOptional(entry.damageTypeHash) ?? null),
      bucket: {
        hash: entry.bucketHash,
        inWeapons: entry.kind === "weapon",
        inArmor: entry.kind === "armor",
      },
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

  built.set(kind, prepared);

  return prepared;
};

const valid = (query: string): boolean =>
  parseAndValidateQuery(query, FILTERS_MAP).valid;

const suggest = (kind: Kind, query: string, caret: number): Suggestion[] => {
  const index = collections();

  if (!index) {
    return [];
  }

  const { config, complete } = prepare(index, kind);

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

const completion = (
  kind: Kind,
  query: string,
  caret: number,
): string | undefined => {
  if (query === "" || valid(query)) {
    return undefined;
  }

  const [first] = suggest(kind, query, caret);

  return first?.query.startsWith(query) ? first.query : undefined;
};

const engine = (kind: Kind, recents: string): SearchEngine => ({
  suggest: (query, caret) => suggest(kind, query, caret),
  completion: (query, caret) => completion(kind, query, caret),
  valid,
  recents,
});

export const SEARCHES: Record<Kind, SearchEngine> = {
  weapon: engine("weapon", "dvm.weaponSearches"),
  armor: engine("armor", "dvm.armorSearches"),
};

/** Compile a query into a predicate over one kind's entries. An unfinished term is completed */
export const collectionFilter = (
  index: Collections,
  kind: Kind,
  query: string,
  facts: EntryFacts,
): ((entry: Entry) => boolean) => {
  const { config, standIns } = prepare(index, kind);
  // The filters read nothing else off the context
  const context = { facts, language: "en" } as Context as never;
  const applied = completion(kind, query, query.length) ?? query;
  const test = makeSearchFilterFactory(config, context)(applied);

  return (entry) => {
    const standIn = standIns.get(entry);

    return !!standIn && !!test(standIn);
  };
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

/** Whether a query looks for items by name or perk, outside any not */
export const isSearch = (query: string): boolean =>
  filterArgs(query, SEARCH_FILTERS).length > 0;
