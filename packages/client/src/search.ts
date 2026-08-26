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
import {
  autocompleteTermSuggestions,
  makeFilterComplete,
} from "app/search/autocomplete";

import {
  assess,
  ratingFor,
  rollFor,
  rollsByHash,
  setRatings,
} from "./rolls.ts";
import { buildFiltersMap, buildSearchConfig } from "app/search/search-config";
import {
  makeSearchFilterFactory,
  parseAndValidateQuery,
} from "app/search/search-filter";

const RATINGS = ["s", "a", "b", "c", "d", "e", "f"];

const PIECES: Record<string, number> = { "2pc": 2, "4pc": 4 };

const SET_SUGGESTIONS = [
  ...RATINGS,
  ...Object.keys(PIECES).flatMap((size) =>
    RATINGS.map((rating) => `${size}:${rating}`),
  ),
];

const setRated = (item: DimItem, value: string): boolean => {
  const [head, tail] = value.split(":");
  const pieces = PIECES[head!];
  const wanted = pieces === undefined ? head : tail;

  return setRatings(item).some(
    (bonus) =>
      bonus.tier?.toLowerCase() === wanted &&
      (pieces === undefined || bonus.pieces === pieces),
  );
};

// DIM's tier: is a range over Destiny's own gear tiers, so the Aegis rating takes its own keyword
const ratingFilters: ItemFilterDefinition[] = [
  {
    keywords: ["rate", "rating"],
    description:
      "Aegis rating for the roll, the weapon's tier stepped down for each perk column that missed, or either of an armor set's bonuses",
    format: "query",
    suggestions: RATINGS,
    destinyVersion: 2,
    filter: ({ filterValue }) => {
      const wanted = filterValue.toLowerCase();

      return (item) =>
        assess(item)?.overall?.toLowerCase() === wanted ||
        setRated(item, wanted);
    },
  },
  {
    keywords: ["ratebase", "ratingbase"],
    description:
      "Aegis rating for the weapon itself, whatever this one rolled. Armor rates the same either way",
    format: "query",
    suggestions: RATINGS,
    destinyVersion: 2,
    filter: ({ filterValue }) => {
      const wanted = filterValue.toLowerCase();

      return (item) =>
        ratingFor(item.hash)?.tier?.toLowerCase() === wanted ||
        setRated(item, wanted);
    },
  },
  {
    // The query lexer only takes letters before the colon, so the size is an argument
    keywords: ["setbonus"],
    description:
      "Aegis rating for an armor set bonus, either of them or setbonus:2pc: and setbonus:4pc: for one",
    format: "query",
    suggestions: SET_SUGGESTIONS,
    destinyVersion: 2,
    filter: ({ filterValue }) => {
      const wanted = filterValue.toLowerCase();

      return (item) => setRated(item, wanted);
    },
  },
];

// Tags, notes and loadouts arrive with DIM Sync, so those filter sets are left out
// and their keywords read as unknown instead of matching nothing
const FILTERS = [
  ...dupeFilters,
  ...freeformFilters,
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
];

const FILTERS_MAP = buildFiltersMap(2, FILTERS);

const CONFIG = buildSearchConfig("en", {}, FILTERS_MAP);

// A quest's reward items sit outside the closure we ship, and the freeform filters read
// strings straight off the result of a lookup
const MISSING = {
  displayProperties: { name: "", description: "" },
} as unknown as never;

// DIM's tables answer a miss with undefined; ours throw, which the filters never expect
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

// Item and perk name suggestions are generated from the whole manifest, so this is built once
// per set of stores rather than per keystroke
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

  suggesting = { stores, config, complete: makeFilterComplete(config) };

  return suggesting;
};

export interface Suggestion {
  query: string;
  help: string | undefined;
  /** The characters of the suggested query that complete what was typed */
  range: [number, number];
}

/** Autocomplete rows for a partially typed query, in DIM's own ordering */
export const suggest = (
  query: string,
  caret: number,
  stores: DimStore[],
  definitions: D2ManifestDefinitions | undefined,
): Suggestion[] => {
  const { config, complete } = completer(stores, definitions);

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

// A query is invalid until its last term is finished, so the term being typed is dropped
// instead of emptying the results
/** Whether every term in a query names a filter we carry and parses */
export const valid = (query: string): boolean =>
  parseAndValidateQuery(query, FILTERS_MAP).valid;

/**
 * The completion that stands in for an unfinished query. A query that is already valid gets none,
 * so `is:dupe` never quietly becomes `is:dupelower`
 */
export const completion = (
  query: string,
  caret: number,
  stores: DimStore[],
  definitions: D2ManifestDefinitions | undefined,
): string | undefined => {
  if (query === "" || valid(query)) {
    return undefined;
  }

  const [first] = suggest(query, caret, stores, definitions);

  return first?.query.startsWith(query) ? first.query : undefined;
};

/** Compile a DIM search query into a predicate over items. An unfinished term is completed */
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

  // A term nothing can complete is a typo, and dropping it would quietly widen the search
  const applied = completion(query, query.length, stores, definitions) ?? query;

  return makeSearchFilterFactory(CONFIG, context)(applied);
};
