import { describe, expect, it } from "vitest";

import { parsePreferences } from "./perkPreferences.ts";

const UP = { mode: "pve", perk: "Kill Clip", stance: "up", removed: false };

const DOWN = { mode: "pvp", perk: "Rampage", stance: "down", removed: false };

describe("perk preference changes", () => {
  it("takes a well formed batch", () => {
    expect(parsePreferences({ preferences: [UP, DOWN] })).toEqual([UP, DOWN]);
  });

  it("rejects the whole batch when one change is malformed", () => {
    expect(
      parsePreferences({ preferences: [UP, { ...DOWN, mode: "gambit" }] }),
    ).toBeUndefined();
    expect(
      parsePreferences({ preferences: [UP, { ...DOWN, stance: "sideways" }] }),
    ).toBeUndefined();
    expect(
      parsePreferences({ preferences: [UP, { ...DOWN, perk: "" }] }),
    ).toBeUndefined();
  });

  it("rejects an empty batch", () => {
    expect(parsePreferences({ preferences: [] })).toBeUndefined();
    expect(parsePreferences({})).toBeUndefined();
  });
});
