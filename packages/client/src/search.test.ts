import { buildDefinitions } from "@dvm/dim-bridge";
import type { D2ManifestDefinitions } from "app/destiny2/d2-definitions";
import { getBuckets } from "app/destiny2/d2-buckets";
import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { buildStores } from "app/inventory/store/d2-store-factory";
import { getTestDefinitions, getTestProfile } from "testing/test-utils.ts";
import { beforeAll, describe, expect, it } from "vitest";

import { completion, itemFilter, suggest, valid } from "./search.ts";

let defs: D2ManifestDefinitions;
let stores: DimStore[] = [];
let items: DimItem[] = [];

beforeAll(async () => {
  defs = await getTestDefinitions();
  stores = buildStores({
    defs,
    buckets: getBuckets(defs),
    profileResponse: getTestProfile(),
    customStats: [],
  });
  items = stores.flatMap((store) => store.items);
});

const found = (query: string) => {
  const filter = itemFilter(query, stores, defs);

  return items.filter((item) => filter(item));
};

describe("itemFilter", () => {
  it("matches everything on an empty query", () => {
    expect(found("").length).toBe(items.length);
  });

  it("matches names", () => {
    const results = found("name:hunger");

    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every((item) => item.name.toLowerCase().includes("hunger")),
    ).toBe(true);
  });

  // Bare text reads as keyword:, which covers perks and descriptions too
  it("matches more than names on bare text", () => {
    expect(found("hunger").length).toBeGreaterThan(found("name:hunger").length);
  });

  // Bare text runs off a prebuilt index, which has to reach as far as DIM's own walk
  it("reaches perk names on bare text", () => {
    const [perked] = items.flatMap((item) =>
      (item.sockets?.allSockets ?? []).flatMap((socket) => {
        const name = socket.isPerk
          ? (socket.plugged?.plugDef.displayProperties.name ?? "")
          : "";

        return /^[a-z]{5,}$/i.test(name)
          ? [{ item, perk: name.toLowerCase() }]
          : [];
      }),
    );

    expect(found(perked!.perk).map((one) => one.id)).toContain(perked!.item.id);
    expect(found(`name:${perked!.perk}`).map((one) => one.id)).not.toContain(
      perked!.item.id,
    );
  });

  it("reaches type names on bare text", () => {
    const item = items.find((one) => one.typeName === "Hand Cannon")!;

    expect(found("cannon").map((one) => one.id)).toContain(item.id);
  });

  it("matches item categories", () => {
    const results = found("is:handcannon");

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => item.typeName === "Hand Cannon")).toBe(true);
  });

  it("negates", () => {
    const weapons = found("is:weapon").length;

    expect(found("-is:weapon").length).toBe(items.length - weapons);
  });

  it("combines terms", () => {
    const results = found("is:exotic is:armor");

    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every((item) => item.rarity === "Exotic" && item.bucket.inArmor),
    ).toBe(true);
  });

  it("groups with or", () => {
    const results = found("(is:sniperrifle or is:shotgun) is:legendary");

    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every(
        (item) =>
          item.rarity === "Legendary" &&
          ["Sniper Rifle", "Shotgun"].includes(item.typeName),
      ),
    ).toBe(true);
  });

  it("compares stats", () => {
    const results = found("is:armor stat:health:>=10");

    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every(
        (item) =>
          item.stats?.some(
            (stat) =>
              stat.displayProperties.name === "Health" && stat.value >= 10,
          ),
      ),
    ).toBe(true);
  });

  it("matches locations", () => {
    const vault = stores.find((store) => store.isVault)!;
    const results = found("is:invault");

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => item.owner === vault.id)).toBe(true);
  });

  // The shipped manifest holds only the closure the profile reaches, and quest rewards are
  // outside it. A lookup miss used to throw straight out of the freeform filters
  it("survives a manifest missing the hashes a filter reaches for", () => {
    const owned = new Set(items.map((item) => item.hash));
    const all = defs.InventoryItem.getAll();
    const trimmed: Record<string, unknown> = {};

    for (const hash of owned) {
      trimmed[hash] = all[hash];
    }

    const tables = new Map<string, Record<string, unknown>>([
      ["DestinyInventoryItemDefinition", trimmed],
      ["DestinyObjectiveDefinition", defs.Objective.getAll()],
      ["DestinySandboxPerkDefinition", defs.SandboxPerk.getAll()],
      ["DestinyEquipableItemSetDefinition", defs.EquipableItemSet.getAll()],
    ]);

    const closure = buildDefinitions(tables);
    const filter = itemFilter("hunger", stores, closure);

    expect(items.filter((item) => filter(item)).length).toBe(
      found("hunger").length,
    );
  });

  // The DIM Sync filter sets are left out, so their keywords cannot be honored
  it("matches nothing for a filter we do not carry", () => {
    expect(found("tag:junk").length).toBe(0);
  });

  it("applies the completion of a term still being typed", () => {
    expect(found("is:exo").length).toBe(found("is:exotic").length);
  });

  it("completes only the unfinished term", () => {
    expect(found("is:weapon is:exo").length).toBe(
      found("is:weapon is:exotic").length,
    );
  });

  // is:dupe stands on its own, so it must not be read as is:dupelower
  it("leaves a query that is already valid alone", () => {
    expect(found("is:dupe").length).not.toBe(found("is:dupelower").length);
  });

  // A typo has no completion, and honoring the terms around it would widen the search
  it("matches nothing when a term cannot be completed", () => {
    expect(found("is:arc is:handcannond").length).toBe(0);
    expect(found("is:weapon tag:ju").length).toBe(0);
  });
});

describe("suggest", () => {
  it("completes a term that is still being typed", () => {
    const rows = suggest("is:exo", 6, stores, defs);

    expect(rows.map((row) => row.query)).toContain("is:exotic");
  });

  it("keeps the rest of the query around the completion", () => {
    const rows = suggest("is:handcannon is:ex", 19, stores, defs);

    expect(rows.map((row) => row.query)).toContain("is:handcannon is:exotic");
    expect(rows[0]?.range).toEqual([14, 23]);
  });

  it("carries help text out of DIM's catalogue", () => {
    const [row] = suggest("is:exo", 6, stores, defs);

    expect(row?.help).toBe("Shows items based on their rarity tier");
  });

  // Descriptions reference each other as $t(Filter.Foo)
  it("resolves a description that nests another", () => {
    const [row] = suggest("power:>", 7, stores, defs);

    expect(row?.help).toContain("current season's power limits");
  });
});

describe("completion", () => {
  it("offers the completion that will apply", () => {
    expect(completion("is:exo", 6, stores, defs)).toBe("is:exotic");
  });

  it("offers none for a query that stands on its own", () => {
    expect(completion("is:dupe", 7, stores, defs)).toBeUndefined();
  });

  it("offers none for an empty query", () => {
    expect(completion("", 0, stores, defs)).toBeUndefined();
  });
});

describe("valid", () => {
  it("accepts a finished query", () => {
    expect(valid("is:arc is:handcannon")).toBe(true);
  });

  it("rejects a typo", () => {
    expect(valid("is:arc is:handcannond")).toBe(false);
  });

  it("rejects a filter we do not carry", () => {
    expect(valid("tag:junk")).toBe(false);
  });

  it("accepts a set bonus rating, whole or by size", () => {
    expect(valid("setbonus:s")).toBe(true);
    expect(valid("setbonus:4pc:s")).toBe(true);
    expect(valid("setbonus:3pc:s")).toBe(false);
  });
});
