import { getBuckets } from "app/destiny2/d2-buckets";
import type { D2ManifestDefinitions } from "app/destiny2/d2-definitions";
import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { buildStores } from "app/inventory/store/d2-store-factory";
import { getTestDefinitions, getTestProfile } from "testing/test-utils.ts";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  assess,
  perkFor,
  perkRanked,
  ratingFor,
  rollFor,
  rollsByHash,
  setRolls,
  type AegisPerk,
  type AegisRoll,
} from "./rolls.ts";
import { itemFilter, valid } from "./search.ts";

const ALL_OR_NOTHING = 3984776322;
const SLICE = 3422796781;
const DESPERADO = 624891305;
const FLUTED_BARREL = 1840239774;
// Sits in the same socket as Desperado without being what rolled there
const KILL_CLIP = 1015611457;

let defs: D2ManifestDefinitions;
let stores: DimStore[] = [];
let items: DimItem[] = [];
let weapon: DimItem;
let copies = 0;

const roll = (overrides: Partial<AegisRoll>): AegisRoll => ({
  name: "All or Nothing",
  category: "Pulses",
  tier: "S",
  rank: 1,
  ranked: 59,
  hashes: [ALL_OR_NOTHING],
  slots: [],
  notes: "test note",
  season: "29",
  ...overrides,
});

const perk = (overrides: Partial<AegisPerk>): AegisPerk => ({
  name: "Slice",
  hashes: [SLICE],
  kind: "perk",
  rank: 12,
  tier: undefined,
  tags: "utility",
  effect: "applies slice",
  ...overrides,
});

const load = (...rolls: AegisRoll[]) =>
  setRolls({
    source: "test",
    captured: "2026-08-22",
    rolls,
    perks: [],
    setBonuses: [],
  });

const loadPerks = (rolls: AegisRoll[], perks: AegisPerk[]) =>
  setRolls({
    source: "test",
    captured: "2026-08-22",
    rolls,
    perks,
    setBonuses: [],
  });

beforeAll(async () => {
  defs = await getTestDefinitions();
  stores = buildStores({
    defs,
    buckets: getBuckets(defs),
    profileResponse: getTestProfile(),
    customStats: [],
  });
  items = stores.flatMap((store) => store.items);
  weapon = items.find(
    (item) => item.hash === ALL_OR_NOTHING && item.sockets !== null,
  )!;
  copies = items.filter((item) => item.hash === ALL_OR_NOTHING).length;
});

beforeEach(() => {
  load();
});

describe("setRolls", () => {
  it("expands the slots into one roll per combination", () => {
    load(
      roll({
        slots: [
          [1, 2],
          [3, 4, 5],
        ],
      }),
    );

    expect(rollsByHash().get(ALL_OR_NOTHING)?.length).toBe(6);
  });

  it("emits a roll per item hash so reissues match", () => {
    load(roll({ hashes: [ALL_OR_NOTHING, 999], slots: [[1], [2]] }));

    expect(rollsByHash().get(ALL_OR_NOTHING)?.length).toBe(1);
    expect(rollsByHash().get(999)?.length).toBe(1);
  });

  it("carries the weapon rank and category size", () => {
    load(roll({ rank: 3, ranked: 62 }));

    expect(ratingFor(ALL_OR_NOTHING)?.rank).toBe(3);
    expect(ratingFor(ALL_OR_NOTHING)?.ranked).toBe(62);
  });

  it("keeps the best tier when two rows claim one hash", () => {
    load(roll({ tier: "D" }), roll({ tier: "B" }));

    expect(ratingFor(ALL_OR_NOTHING)?.tier).toBe("B");
  });

  it("keeps the best tier whichever order the rows arrive in", () => {
    load(roll({ tier: "B" }), roll({ tier: "D" }));

    expect(ratingFor(ALL_OR_NOTHING)?.tier).toBe("B");
  });

  it("prefers any tier over an unrated row", () => {
    load(roll({ tier: undefined }), roll({ tier: "F" }));

    expect(ratingFor(ALL_OR_NOTHING)?.tier).toBe("F");
  });

  it("keeps the rolls from every row that claims the hash", () => {
    load(
      roll({ tier: "B", slots: [[1], [2]] }),
      roll({ tier: "D", slots: [[3], [4]] }),
    );

    expect(rollsByHash().get(ALL_OR_NOTHING)?.length).toBe(2);
  });

  it("rates an exotic without giving it a roll that matches anything", () => {
    load(roll({ name: "Osteo Striga", tier: "A", hashes: [46524085] }));

    expect(ratingFor(46524085)?.tier).toBe("A");
    expect(rollsByHash().has(46524085)).toBe(false);
  });
});

describe("perkFor", () => {
  it("grades a perk apart from any weapon", () => {
    loadPerks([roll({})], [perk({})]);

    expect(perkFor(SLICE)?.rank).toBe(12);
    expect(perkFor(DESPERADO)).toBeUndefined();
  });

  it("keeps the best rank when one hash carries two entries", () => {
    loadPerks([roll({})], [perk({ rank: 40 }), perk({ rank: 9 })]);

    expect(perkFor(SLICE)?.rank).toBe(9);
  });

  it("prefers a ranked entry over an unranked one", () => {
    loadPerks([roll({})], [perk({ rank: undefined }), perk({ rank: 77 })]);

    expect(perkFor(SLICE)?.rank).toBe(77);
  });

  it("counts the ranked perks of each kind", () => {
    loadPerks(
      [roll({})],
      [
        perk({}),
        perk({ name: "Desperado", hashes: [DESPERADO], rank: 3 }),
        perk({
          name: "Dealer's Choice",
          hashes: [FLUTED_BARREL],
          kind: "origin",
          rank: 1,
        }),
      ],
    );

    expect(perkRanked("perk")).toBe(2);
    expect(perkRanked("origin")).toBe(1);
  });
});

describe("assess", () => {
  it("marks a column that rolled one of the picks", () => {
    load(roll({ slots: [[SLICE], [DESPERADO]] }));

    const read = assess(weapon)!;

    expect(read.slots.map((s) => s.matched)).toEqual([true, true]);
    expect(read.slots.map((s) => s.rolled?.name)).toEqual([
      "Slice",
      "Desperado",
    ]);
    expect(read.score).toBe(2);
    expect(read.of).toBe(2);
  });

  it("marks a column whose pick rolled without being selected", () => {
    load(roll({ slots: [[FLUTED_BARREL], [DESPERADO]] }));

    const read = assess(weapon)!;

    // Chambered Compensator is plugged, Fluted Barrel rolled beside it
    expect(read.slots.map((s) => s.matched)).toEqual([true, true]);
    expect(read.slots[0]?.rolled?.name).toBe("Fluted Barrel");
    expect(read.score).toBe(2);
  });

  it("marks a column that missed and still names what rolled there", () => {
    load(roll({ slots: [[SLICE], [KILL_CLIP]] }));

    const read = assess(weapon)!;

    expect(read.slots.map((s) => s.matched)).toEqual([true, false]);
    // The pick is in that socket's pool, so the column resolves and names what rolled
    expect(read.slots[1]?.rolled?.name).toBe("Desperado");
    expect(read.score).toBe(1);
  });

  it("lists every perk the column rolled, marking the wanted and the selected", () => {
    load(roll({ slots: [[FLUTED_BARREL], [DESPERADO]] }));

    const read = assess(weapon)!;

    expect(read.slots[0]?.options).toEqual([
      {
        name: "Chambered Compensator",
        hash: 3661387068,
        rank: undefined,
        wanted: false,
        plugged: true,
      },
      {
        name: "Fluted Barrel",
        hash: FLUTED_BARREL,
        rank: undefined,
        wanted: true,
        plugged: false,
      },
    ]);
  });

  it("carries the perk rank onto each rolled option", () => {
    loadPerks(
      [roll({ slots: [[SLICE], [DESPERADO]] })],
      [perk({ name: "Desperado", hashes: [DESPERADO], rank: 3 })],
    );

    const desperado = assess(weapon)?.slots[1]?.options[0];

    expect(desperado?.name).toBe("Desperado");
    expect(desperado?.rank).toBe(3);
  });

  it("names every pick the column offers, not only what rolled", () => {
    load(roll({ slots: [[SLICE], [DESPERADO, KILL_CLIP]] }));

    const read = assess(weapon)!;

    expect(read.slots[0]?.picks).toEqual(["Slice"]);
    expect(read.slots[1]?.picks).toEqual(["Desperado", "Kill Clip"]);
  });

  it("leaves out a pick the weapon cannot roll", () => {
    load(roll({ slots: [[SLICE], [DESPERADO, 12345]] }));

    expect(assess(weapon)?.slots[1]?.picks).toEqual(["Desperado"]);
  });

  it("leaves a column unresolved when the pick is nowhere on the weapon", () => {
    load(roll({ slots: [[SLICE], [12345]] }));

    const read = assess(weapon)!;

    expect(read.slots[1]?.matched).toBe(false);
    expect(read.slots[1]?.rolled).toBeUndefined();
  });

  it("steps the tier down once per column that missed", () => {
    load(roll({ tier: "S", slots: [[SLICE], [DESPERADO]] }));
    expect(assess(weapon)?.overall).toBe("S");

    load(roll({ tier: "S", slots: [[SLICE], [KILL_CLIP]] }));
    expect(assess(weapon)?.overall).toBe("A");

    load(roll({ tier: "S", slots: [[12345], [KILL_CLIP]] }));
    expect(assess(weapon)?.overall).toBe("B");
  });

  it("does not step past the bottom tier", () => {
    load(roll({ tier: "F", slots: [[12345], [KILL_CLIP]] }));

    expect(assess(weapon)?.overall).toBe("F");
  });

  it("rates an exotic with no columns to judge", () => {
    load(roll({ tier: "A", hashes: [46524085] }));

    const read = assess(items.find((i) => i.hash === 46524085)!)!;

    expect(read.of).toBe(0);
    expect(read.overall).toBe("A");
  });
});

describe("rollFor", () => {
  it("matches an item carrying both recommended perks", () => {
    load(roll({ slots: [[SLICE], [DESPERADO]] }));

    const matched = rollFor(weapon);

    expect(matched).toBeDefined();
    expect(matched?.notes).toBe("test note");
    expect([...(matched?.wishListPerks ?? [])].sort()).toEqual(
      [SLICE, DESPERADO].sort(),
    );
  });

  it("matches when the pick rolled in a column without being selected", () => {
    load(roll({ slots: [[FLUTED_BARREL], [DESPERADO]] }));

    expect(rollFor(weapon)).toBeDefined();
  });

  it("matches when one slot lists a perk the item did not roll", () => {
    load(roll({ slots: [[SLICE], [DESPERADO, 12345]] }));

    expect(rollFor(weapon)).toBeDefined();
  });

  it("does not match when a column could select a pick but did not roll it", () => {
    load(roll({ slots: [[SLICE], [KILL_CLIP]] }));

    expect(assess(weapon)?.score).toBe(1);
    expect(rollFor(weapon)).toBeUndefined();
  });

  it("does not match when a recommended perk is absent", () => {
    load(roll({ slots: [[SLICE], [12345]] }));

    expect(rollFor(weapon)).toBeUndefined();
  });

  it("does not match a barrel standing in for a trait", () => {
    load(roll({ slots: [[FLUTED_BARREL], [12345]] }));

    expect(rollFor(weapon)).toBeUndefined();
  });

  it("returns undefined with no roll data loaded", () => {
    expect(rollFor(weapon)).toBeUndefined();
  });
});

describe("the rating filters", () => {
  const found = (query: string) => {
    const filter = itemFilter(query, stores, defs);

    return items.filter((item) => filter(item));
  };

  it("accepts both spellings of each keyword", () => {
    expect(valid("rate:s")).toBe(true);
    expect(valid("rating:s")).toBe(true);
    expect(valid("ratebase:s")).toBe(true);
    expect(valid("ratingbase:s")).toBe(true);
  });

  it("is case insensitive", () => {
    load(roll({ tier: "S", slots: [[SLICE], [DESPERADO]] }));

    expect(has("rating:S", weapon)).toBe(true);
    expect(has("ratebase:S", weapon)).toBe(true);
  });

  const has = (query: string, item: DimItem) =>
    found(query).some((one) => one.id === item.id);

  it("searches the overall rating, not the weapon's own", () => {
    load(roll({ tier: "S", slots: [[SLICE], [KILL_CLIP]] }));

    // S base with one column missed comes to A
    expect(has("rating:a", weapon)).toBe(true);
    expect(has("rating:s", weapon)).toBe(false);
  });

  it("searches the weapon's own rating apart from the roll", () => {
    load(roll({ tier: "S", slots: [[SLICE], [KILL_CLIP]] }));

    expect(has("ratingbase:s", weapon)).toBe(true);
    expect(has("ratingbase:a", weapon)).toBe(false);
  });

  it("agrees with itself on a roll that missed nothing", () => {
    load(roll({ tier: "B", slots: [[SLICE], [DESPERADO]] }));

    expect(has("rating:b", weapon)).toBe(true);
    expect(has("ratingbase:b", weapon)).toBe(true);
  });

  it("rates every copy the same on the base and by its roll on the overall", () => {
    load(roll({ tier: "S", slots: [[SLICE], [DESPERADO]] }));

    // The profile holds two of this weapon, rolled differently
    expect(copies).toBeGreaterThan(1);
    expect(found("ratingbase:s").length).toBe(copies);
    expect(found("rating:s").length).toBeLessThan(copies);
  });
});

describe("the wishlist search filter", () => {
  const found = (query: string) => {
    const filter = itemFilter(query, stores, defs);

    return items.filter((item) => filter(item));
  };

  it("finds only the rated roll", () => {
    load(roll({ slots: [[SLICE], [DESPERADO]] }));

    const results = found("is:wishlist");

    expect(results.length).toBe(1);
    expect(results[0]?.hash).toBe(ALL_OR_NOTHING);
  });

  it("finds nothing when the roll does not match", () => {
    load(roll({ slots: [[SLICE], [12345]] }));

    expect(found("is:wishlist").length).toBe(0);
  });
});
