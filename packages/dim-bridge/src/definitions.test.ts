import { describe, expect, it } from "vitest";

import { buildDefinitions, HashLookupFailure } from "./definitions.ts";

const CRAFTED_FRAME_IDENTIFIER = 2215619028;
const NEVER_SHIPPED = 1;

const tables = () =>
  new Map<string, Record<string, unknown>>([
    ["InventoryItem", { 100: { hash: 100 } }],
    ["PlugSet", { 200: { hash: 200 } }],
  ]);

describe("buildDefinitions", () => {
  it("throws on a hash nothing withheld", () => {
    const defs = buildDefinitions(tables());

    expect(() => defs.InventoryItem.get(NEVER_SHIPPED)).toThrow(
      HashLookupFailure,
    );
  });

  it("reads a withheld item as absent", () => {
    const defs = buildDefinitions(
      tables(),
      new Set([CRAFTED_FRAME_IDENTIFIER]),
    );

    expect(defs.InventoryItem.get(CRAFTED_FRAME_IDENTIFIER)).toBeUndefined();
    expect(defs.InventoryItem.get(100)).toEqual({ hash: 100 });
    expect(() => defs.InventoryItem.get(NEVER_SHIPPED)).toThrow(
      HashLookupFailure,
    );
  });

  it("withholds nothing from the other tables", () => {
    const defs = buildDefinitions(
      tables(),
      new Set([CRAFTED_FRAME_IDENTIFIER]),
    );

    expect(() => defs.PlugSet.get(CRAFTED_FRAME_IDENTIFIER)).toThrow(
      HashLookupFailure,
    );
  });
});
