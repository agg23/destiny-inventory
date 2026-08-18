import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { describe, expect, it } from "vitest";

import { acquired, powerDelta } from "./arrivals.ts";

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

  // Instance ids outgrow any digit count, so they only sort correctly padded
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

  it("measures power against the best of the same slot", () => {
    const stores = [store([item("a", 500), item("b", 512), item("c", 400, 2)])];

    expect(powerDelta(item("a", 500), stores)).toBe(-12);
    expect(powerDelta(item("d", 520), stores)).toBe(8);
  });
});
