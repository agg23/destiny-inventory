import type {
  D2ManifestDefinitions,
  DefinitionTable,
} from "app/destiny2/d2-definitions";
import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { getCurrentStore } from "app/inventory/stores-helpers";
import type { ItemFilter } from "app/search/filter-types";
import type {
  FilterContext,
  ItemFilterDefinition,
  ItemSearchConfig,
  SuggestionsContext,
} from "app/search/items/item-filter-types";
import advancedFilters from "app/search/items/search-filters/advanced";
import dupeFilters from "app/search/items/search-filters/dupes";
import freeformFilters from "app/search/items/search-filters/freeform";
import knownValuesFilters from "app/search/items/search-filters/known-values";
import simpleRangeFilters from "app/search/items/search-filters/range-numeric";
import overloadedRangeFilters from "app/search/items/search-filters/range-overload";
import simpleFilters from "app/search/items/search-filters/simple";
import socketFilters from "app/search/items/search-filters/sockets";
import wishlistFilters from "app/search/items/search-filters/wishlist";
import statFilters from "app/search/items/search-filters/stats";
import locationFilters from "app/search/items/search-filters/stores";
import { autocompleteTermSuggestions } from "app/search/autocomplete";
import { buildFiltersMap, buildSearchConfig } from "app/search/search-config";
import {
  makeSearchFilterFactory,
  parseAndValidateQuery,
} from "app/search/search-filter";

import { TIERS } from "@dvm/defs-core";

import {
  assess,
  ratingFor,
  rollFor,
  rollsByHash,
  setRatings,
} from "../items/rolls.ts";
import { MODES, type Mode } from "../items/rollTypes.ts";
import { tagDefs, tagFor } from "../items/tags.ts";
import { makeComplete } from "./complete.ts";
import { indexKeywords, keywordFilter } from "./keyword.ts";
import { ITEM_SEARCHES } from "./searches.ts";

const RATINGS = TIERS.map((tier) => tier.toLowerCase());

const PIECES: Record<string, number> = { "2pc": 2, "4pc": 4 };

const SET_SUGGESTIONS = [
  ...RATINGS,
  ...Object.keys(PIECES).flatMap((size) =>
    RATINGS.map((rating) => `${size}:${rating}`),
  ),
];

const setRated = (item: DimItem, value: string, mode: Mode): boolean => {
  const [head, tail] = value.split(":");
  const pieces = PIECES[head!];
  const wanted = pieces === undefined ? head : tail;

  return setRatings(item, mode).some(
    (bonus) =>
      bonus.tier?.toLowerCase() === wanted &&
      (pieces === undefined || bonus.pieces === pieces),
  );
};

const SHEET_NAMES: Record<Mode, string> = { pve: "Aegis", pvp: "PvP sheet" };

const KEYWORD_PREFIXES: Record<Mode, string> = { pve: "", pvp: "pvp" };

const ratingFilter = (
  keywords: string[],
  description: string,
  suggestions: string[],
  test: (item: DimItem, wanted: string) => boolean,
): ItemFilterDefinition => ({
  keywords,
  description,
  format: "query",
  suggestions,
  destinyVersion: 2,
  filter: ({ filterValue }) => {
    const wanted = filterValue.toLowerCase();

    return (item) => test(item, wanted);
  },
});

// DIM's tier: already means Destiny's gear tier
const ratingFilters: ItemFilterDefinition[] = MODES.flatMap(
  (mode): ItemFilterDefinition[] => {
    const prefix = KEYWORD_PREFIXES[mode];
    const sheetName = SHEET_NAMES[mode];

    return [
      ratingFilter(
        [`${prefix}rate`, `${prefix}rating`],
        `${sheetName} rating for the roll, the weapon's tier stepped down for each perk column that missed, or either of an armor set's bonuses`,
        RATINGS,
        (item, wanted) =>
          assess(item, mode)?.overall?.toLowerCase() === wanted ||
          setRated(item, wanted, mode),
      ),
      ratingFilter(
        [`${prefix}ratebase`, `${prefix}ratingbase`],
        `${sheetName} rating for the weapon itself, whatever this one rolled. Armor rates the same either way`,
        RATINGS,
        (item, wanted) =>
          ratingFor(item.hash, mode)?.tier?.toLowerCase() === wanted ||
          setRated(item, wanted, mode),
      ),
      ratingFilter(
        // The lexer only allows letters before the colon
        [`${prefix}setbonus`],
        `${sheetName} rating for an armor set bonus, either of them or ${prefix}setbonus:2pc: and ${prefix}setbonus:4pc: for one`,
        SET_SUGGESTIONS,
        (item, wanted) => setRated(item, wanted, mode),
      ),
    ];
  },
);

const tagFilters: ItemFilterDefinition[] = [
  {
    keywords: ["tag"],
    description: "Items carrying one of your specified tags",
    format: "freeform",
    suggestions: tagDefs().map((def) => def.id),
    destinyVersion: 2,
    filter: ({ filterValue }) => {
      const wanted = filterValue.toLowerCase();

      return (item) => tagFor(item.id)?.id === wanted;
    },
  },
];

// Notes and loadout filters need DIM Sync; left out to make their keywords unknown
const FILTERS = [
  ...dupeFilters,
  ...freeformFilters.filter((one) => one.keywords !== keywordFilter.keywords),
  keywordFilter,
  ...knownValuesFilters,
  ...simpleRangeFilters,
  ...overloadedRangeFilters,
  ...simpleFilters,
  ...socketFilters,
  ...statFilters,
  ...locationFilters,
  ...advancedFilters,
  ...wishlistFilters,
  ...ratingFilters,
  ...tagFilters,
];

const FILTERS_MAP = buildFiltersMap(2, FILTERS);

const CONFIG = buildSearchConfig("en", {}, FILTERS_MAP);

// Quest rewards are outside the shipped closure; freeform filters read strings off the lookup
const MISSING = {
  displayProperties: { name: "", description: "" },
} as unknown as never;

// DIM's tables return undefined on a miss; ours throw
const lenient = (definitions: D2ManifestDefinitions): D2ManifestDefinitions => {
  const tables = Object.entries(definitions).map(([name, table]) => {
    if (typeof table !== "object" || !("getOptional" in table)) {
      return [name, table];
    }

    const lookup = table as DefinitionTable<never>;

    return [
      name,
      { ...lookup, get: (hash: number) => lookup.getOptional(hash) ?? MISSING },
    ];
  });

  return Object.fromEntries(tables) as D2ManifestDefinitions;
};

let source: D2ManifestDefinitions | undefined = undefined;
let view: D2ManifestDefinitions | undefined = undefined;

const searchable = (
  definitions: D2ManifestDefinitions | undefined,
): D2ManifestDefinitions | undefined => {
  if (definitions === undefined) {
    return undefined;
  }

  if (definitions !== source) {
    source = definitions;
    view = lenient(definitions);
  }

  return view;
};

interface Completer {
  stores: DimStore[];
  config: ItemSearchConfig;
  complete: (term: string) => string[];
}

let suggesting: Completer | undefined = undefined;

// Name suggestions walk the whole manifest; cache per stores
const completer = (
  stores: DimStore[],
  definitions: D2ManifestDefinitions | undefined,
): Completer => {
  if (suggesting !== undefined && suggesting.stores === stores) {
    return suggesting;
  }

  const context: SuggestionsContext = {
    allItems: stores.flatMap((store) => store.items),
    d2Definitions: searchable(definitions),
    customStats: [],
  };

  const config = buildSearchConfig("en", context, FILTERS_MAP);

  suggesting = { stores, config, complete: makeComplete(config) };

  return suggesting;
};

/** Builds the keyword index ahead of the first search */
export const primeSearch = (
  stores: DimStore[],
  definitions: D2ManifestDefinitions | undefined,
) =>
  indexKeywords(
    stores.flatMap((store) => store.items),
    searchable(definitions),
    "en",
  );

export interface Suggestion {
  query: string;
  help: string | undefined;
  /** Span of the suggestion that completes what was typed */
  range: [number, number];
}

/** DIM's autocomplete rows for a query, minus any without a span to complete */
export const autocompleteRows = (
  query: string,
  caret: number,
  complete: (term: string) => string[],
  config: ItemSearchConfig,
): Suggestion[] =>
  autocompleteTermSuggestions(query, caret, complete, config).flatMap((item) =>
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

/** Top suggestion if it extends the query, undefined once the query parses */
export const topCompletion = (
  query: string,
  valid: (query: string) => boolean,
  suggest: () => Suggestion[],
): string | undefined => {
  if (query === "" || valid(query)) {
    return undefined;
  }

  const [first] = suggest();

  return first?.query.startsWith(query) ? first.query : undefined;
};

interface Suggested {
  query: string;
  caret: number;
  stores: DimStore[];
  definitions: D2ManifestDefinitions | undefined;
  rows: Suggestion[];
}

// Ghost, menu, and filter all ask for the same query
let suggested: Suggested | undefined = undefined;

/** Autocomplete rows for a partially typed query, in DIM's own ordering */
export const suggest = (
  query: string,
  caret: number,
  stores: DimStore[],
  definitions: D2ManifestDefinitions | undefined,
): Suggestion[] => {
  if (
    suggested !== undefined &&
    suggested.query === query &&
    suggested.caret === caret &&
    suggested.stores === stores &&
    suggested.definitions === definitions
  ) {
    return suggested.rows;
  }

  const { config, complete } = completer(stores, definitions);

  const rows = autocompleteRows(query, caret, complete, config);

  suggested = { query, caret, stores, definitions, rows };

  return rows;
};

let validated: { query: string; result: boolean } | undefined = undefined;

/** Whether every term in a query names a known filter and parses */
export const valid = (query: string): boolean => {
  if (validated !== undefined && validated.query === query) {
    return validated.result;
  }

  const result = parseAndValidateQuery(query, FILTERS_MAP).valid;

  validated = { query, result };

  return result;
};

/** Top completion for an unfinished query, undefined if it already parses (is:dupe vs is:dupelower) */
export const completion = (
  query: string,
  caret: number,
  stores: DimStore[],
  definitions: D2ManifestDefinitions | undefined,
): string | undefined =>
  topCompletion(query, valid, () => suggest(query, caret, stores, definitions));

/** Compiles a DIM search query into an item predicate, completing an unfinished term */
export const itemFilter = (
  query: string,
  stores: DimStore[],
  definitions: D2ManifestDefinitions | undefined,
): ItemFilter<DimItem> => {
  const current = getCurrentStore(stores);

  if (!current) {
    return () => true;
  }

  const context: FilterContext = {
    stores,
    allItems: stores.flatMap((store) => store.items),
    currentStore: current,
    loadoutsByItem: {},
    wishListFunction: rollFor,
    wishListsByHash: rollsByHash(),
    getTag: () => undefined,
    getNotes: () => undefined,
    language: "en",
    customStats: [],
    d2Definitions: searchable(definitions),
  };

  // Keep an uncompletable typo; dropping it widens the search
  const applied = completion(query, query.length, stores, definitions) ?? query;

  return makeSearchFilterFactory(CONFIG, context)(applied);
};

export interface SearchEngine {
  suggest: (query: string, caret: number) => Suggestion[];
  completion: (query: string, caret: number) => string | undefined;
  valid: (query: string) => boolean;
  /** Storage key for recent queries */
  recents: string;
}

export const itemSearch = (
  stores: () => DimStore[],
  definitions: () => D2ManifestDefinitions | undefined,
): SearchEngine => ({
  suggest: (query, caret) => suggest(query, caret, stores(), definitions()),
  completion: (query, caret) =>
    completion(query, caret, stores(), definitions()),
  valid,
  recents: ITEM_SEARCHES,
});
