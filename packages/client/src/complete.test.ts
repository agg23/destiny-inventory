import type { D2ManifestDefinitions } from "app/destiny2/d2-definitions";
import { getBuckets } from "app/destiny2/d2-buckets";
import type { DimStore } from "app/inventory/store-types";
import { buildStores } from "app/inventory/store/d2-store-factory";
import { makeFilterComplete } from "app/search/autocomplete";
import { getTestDefinitions, getTestProfile } from "testing/test-utils.ts";
import { beforeAll, describe, expect, it } from "vitest";

import { makeComplete, ROWS } from "./complete.ts";
import { searchConfig } from "./search.ts";

const TERMS = [
  "e",
  "ex",
  "exa",
  "exact",
  "exactname:",
  "exactname:h",
  "exactname:hun",
  "name:",
  "name:a",
  "perkname:vor",
  "hun",
  "is:",
  "is:d",
  "is:dupe",
  "not",
  "not:w",
  "stat",
  "stat:",
  "stat:rpm:",
  "masterwork:",
  "power:>",
  "power:>=",
  "season:",
  "tag:",
  "source:",
  "dupe",
  "sunsetsoon",
  "zzzz",
];

let stores: DimStore[] = [];
let defs: D2ManifestDefinitions;

beforeAll(async () => {
  defs = await getTestDefinitions();
  stores = buildStores({
    defs,
    buckets: getBuckets(defs),
    profileResponse: getTestProfile(),
    customStats: [],
  });
});

describe("makeComplete", () => {
  it("ranks the visible rows the way DIM does", () => {
    const config = searchConfig(stores, defs);
    const ours = makeComplete(config);
    const theirs = makeFilterComplete(config);

    for (const term of TERMS) {
      expect([term, ours(term)]).toEqual([term, theirs(term).slice(0, ROWS)]);
    }
  });
});
