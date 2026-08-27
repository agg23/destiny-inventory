import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { describe, expect, it } from "vitest";

import { acquired, verdictOf, type Contender } from "./arrivals.ts";
import type { Assessment } from "./rolls.ts";

const item = (id: string, power = 0, bucket = 1, equipment = true) =>
  ({ id, power, bucket: { hash: bucket }, equipment }) as DimItem;

const store = (items: DimItem[]) => ({ items }) as unknown as DimStore;

describe("arrivals", () => {
  it("orders by instance id, newest first", () => {
    const stores = [store([item("100"), item("300"), item("200")])];

    expect(acquired(stores).map((found) => found.id)).toEqual([
      "300",
      "200",
      "100",
    ]);
  });

  // Instance ids outgrow any digit count
  it("orders long ids above short ones", () => {
    const stores = [store([item("9999"), item("10000")])];

    expect(acquired(stores).map((found) => found.id)).toEqual([
      "10000",
      "9999",
    ]);
  });

  it("ignores stacks", () => {
    expect(
      acquired([store([item("0"), item("5")])]).map((found) => found.id),
    ).toEqual(["5"]);
  });

  // Orders and quests carry instance ids but are not loot
  it("ignores anything that cannot be equipped", () => {
    const stores = [store([item("7", 0, 1, false), item("5")])];

    expect(acquired(stores).map((found) => found.id)).toEqual(["5"]);
  });
});

const read = (hits: boolean[]): Assessment => ({
  rating: {
    name: "",
    category: "",
    tier: "A",
    rank: undefined,
    ranked: 0,
    notes: undefined,
    season: undefined,
  },
  slots: hits.map((matched, index) => ({
    slot: index + 1,
    rolled: { name: `Perk ${index + 1}`, hash: index, rank: undefined },
    wanted: [],
    options: [],
    picks: [],
    matched,
  })),
  score: hits.filter(Boolean).length,
  of: hits.length,
  overall: undefined,
});

const rival = (id: string, hits: boolean[]): Contender => ({
  item: item(id),
  read: read(hits),
});

describe("verdict", () => {
  it("stands alone without another copy", () => {
    expect(verdictOf(read([true, false]), []).kind).toBe("only");
  });

  it("loses to a copy that hits everything it does and more", () => {
    const verdict = verdictOf(read([true, false, false]), [
      rival("a", [true, true, false]),
    ]);

    expect(verdict.kind).toBe("worse");
    expect(verdict.rival?.id).toBe("a");
    expect(verdict.losses).toEqual(["Perk 2"]);
    expect(verdict.gains).toEqual([]);
  });

  it("equals a copy with the same hits", () => {
    const verdict = verdictOf(read([true, false]), [
      rival("a", [true, false]),
    ]);

    expect(verdict.kind).toBe("equal");
    expect(verdict.rival?.id).toBe("a");
  });

  it("beats copies it strictly improves on", () => {
    const verdict = verdictOf(read([true, true]), [
      rival("a", [true, false]),
      rival("b", [false, false]),
    ]);

    expect(verdict.kind).toBe("better");
    expect(verdict.rival?.id).toBe("a");
    expect(verdict.gains).toEqual(["Perk 2"]);
  });

  it("names the trade when neither roll dominates", () => {
    const verdict = verdictOf(read([true, false]), [
      rival("a", [false, true]),
    ]);

    expect(verdict.kind).toBe("mixed");
    expect(verdict.gains).toEqual(["Perk 1"]);
    expect(verdict.losses).toEqual(["Perk 2"]);
  });

  it("judges against the strongest copy", () => {
    const verdict = verdictOf(read([true, false, false]), [
      rival("weak", [true, false, false]),
      rival("strong", [true, true, false]),
    ]);

    expect(verdict.kind).toBe("worse");
    expect(verdict.rival?.id).toBe("strong");
  });

  it("misses everywhere and still loses only to a copy that hits", () => {
    const verdict = verdictOf(read([false, false]), [
      rival("a", [false, false]),
    ]);

    expect(verdict.kind).toBe("equal");
  });
});
