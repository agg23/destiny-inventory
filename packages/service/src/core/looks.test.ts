import { describe, expect, it } from "vitest";

import { parseLook } from "./looks.ts";

const EMPTY = {
  armorHash: undefined,
  ornamentHash: undefined,
  shaderHash: undefined,
};

const look = (pieces: Record<string, unknown>) => ({
  id: "a1",
  name: " Wild Hunt ",
  classType: 1,
  female: true,
  pieces: {
    helmet: {},
    arms: {},
    chest: {},
    legs: {},
    class: {},
    ...pieces,
  },
});

describe("parseLook", () => {
  it("accepts a look with empty slots", () => {
    expect(
      parseLook(look({ helmet: { armorHash: 12, shaderHash: 34 } })),
    ).toEqual({
      id: "a1",
      name: "Wild Hunt",
      classType: 1,
      female: true,
      pieces: {
        helmet: { armorHash: 12, ornamentHash: undefined, shaderHash: 34 },
        arms: EMPTY,
        chest: EMPTY,
        legs: EMPTY,
        class: EMPTY,
      },
      removed: false,
    });
  });

  it("rejects a bad hash, class, or missing slot", () => {
    expect(parseLook(look({ arms: { shaderHash: "12" } }))).toBeUndefined();
    expect(parseLook({ ...look({}), classType: 3 })).toBeUndefined();
    expect(parseLook({ ...look({}), pieces: { helmet: {} } })).toBeUndefined();
  });
});
