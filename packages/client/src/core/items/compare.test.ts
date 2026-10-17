import type { DimItem, DimStat } from "app/inventory/item-types";
import { describe, expect, it } from "vitest";

import { best, comparable, delta } from "./compare.ts";

const WEAPON = 1;
const ARMOR = 20;

const item = (categories: number[], bucket = 1) =>
  ({ itemCategoryHashes: categories, bucket: { hash: bucket } }) as DimItem;

const engram = () =>
  ({
    itemCategoryHashes: [],
    isEngram: true,
    bucket: { hash: 375726501, inPostmaster: true },
  }) as unknown as DimItem;

// Shipped defs carry neither isEngram nor a Postmaster sort
const distorted = () =>
  ({
    itemCategoryHashes: [],
    isEngram: false,
    bucket: { hash: 2422292810 },
  }) as unknown as DimItem;

const stat = (value: number, smallerIsBetter = false) =>
  ({ value, smallerIsBetter }) as DimStat;

describe("comparable", () => {
  it("pairs two weapons from different buckets", () => {
    expect(
      comparable(item([WEAPON], 1498876634), item([WEAPON], 2465295065)),
    ).toBe(true);
  });

  it("refuses armor against a weapon", () => {
    expect(comparable(item([WEAPON]), item([ARMOR]))).toBe(false);
  });

  it("pairs a postmaster weapon with an equipped one", () => {
    expect(
      comparable(item([WEAPON], 215593132), item([WEAPON], 1498876634)),
    ).toBe(true);
  });

  it("pairs consumables by bucket when they are neither", () => {
    expect(comparable(item([], 5), item([], 5))).toBe(true);
    expect(comparable(item([], 5), item([], 6))).toBe(false);
  });

  it("refuses engrams even against each other", () => {
    expect(comparable(engram(), engram())).toBe(false);
    expect(comparable(engram(), item([WEAPON]))).toBe(false);
    expect(comparable(distorted(), distorted())).toBe(false);
  });
});

describe("delta", () => {
  it("reads a rise as better", () => {
    expect(delta(stat(70), stat(58))).toEqual({ value: 12, better: true });
  });

  it("reads a rise as worse where smaller wins", () => {
    expect(delta(stat(700, true), stat(600, true))).toEqual({
      value: 100,
      better: false,
    });
  });

  it("returns nothing on a tie or a missing side", () => {
    expect(delta(stat(70), stat(70))).toBeUndefined();
    expect(delta(stat(70), undefined)).toBeUndefined();
  });
});

describe("best", () => {
  it("takes the smaller value where smaller wins", () => {
    expect(best([stat(700, true), stat(600, true)])).toBe(600);
  });

  it("marks nothing when the items tie", () => {
    expect(best([stat(70), stat(70)])).toBeUndefined();
  });

  it("marks nothing on a single item", () => {
    expect(best([stat(70), undefined])).toBeUndefined();
  });
});
