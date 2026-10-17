import type { DimItem } from "app/inventory/item-types";
import { describe, expect, it } from "vitest";

import { feed, sweepFor } from "./triage.ts";

const item = (
  id: string,
  hash: number,
  extra: Partial<DimItem> = {},
): DimItem =>
  ({
    id,
    hash,
    power: 0,
    name: `Item ${hash}`,
    typeName: "Hand Cannon",
    bucket: { sort: "Weapons" },
    equipment: true,
    equipped: false,
    ...extra,
  }) as DimItem;

describe("triage", () => {
  it("feeds newest first and drops what cannot be tagged", () => {
    const items = [
      item("100", 1),
      item("0", 2),
      item("300", 3),
      item("200", 4, { equipment: false }),
    ];

    expect(feed(items, "received", true).map((one) => one.id)).toEqual([
      "300",
      "100",
    ]);
  });

  it("sorts by power then by recency", () => {
    const items = [
      item("100", 1, { power: 500 }),
      item("300", 2, { power: 700 }),
      item("200", 3, { power: 700 }),
    ];

    expect(feed(items, "power", true).map((one) => one.id)).toEqual([
      "300",
      "200",
      "100",
    ]);
  });

  it("sweeps the other copies, sparing the equipped one", () => {
    const kept = item("1", 55);
    const all = [
      kept,
      item("2", 55),
      item("3", 55, { equipped: true }),
      item("4", 66),
    ];

    const sweep = sweepFor(kept, all, all, false);

    expect(sweep.targets.map((one) => one.id)).toEqual(["2"]);
    expect(sweep.guarded).toBe(0);
    expect(sweep.offscreen).toBe(0);
  });

  it("counts copies the filter is hiding", () => {
    const kept = item("1", 55);
    const all = [kept, item("2", 55), item("3", 55)];

    expect(sweepFor(kept, all, [kept], false).offscreen).toBe(2);
  });
});
