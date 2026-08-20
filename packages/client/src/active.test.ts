import type { DimStore } from "app/inventory/store-types";
import { describe, expect, it } from "vitest";

import { activeStore, NOBODY, observe, prefer } from "./active.ts";

const store = (id: string, current = false) =>
  ({ id, current, isVault: false }) as DimStore;

const TITAN = store("titan");
const HUNTER = store("hunter", true);
const VAULT = { id: "vault", isVault: true } as DimStore;
const STORES = [TITAN, HUNTER, VAULT];

describe("active character", () => {
  it("falls back to the last played character", () => {
    expect(activeStore(NOBODY, STORES)?.id).toBe("hunter");
  });

  it("never picks the vault", () => {
    expect(activeStore(prefer(NOBODY, "vault"), STORES)?.id).toBe("hunter");
  });

  it("prefers whoever is in the game over whoever played last", () => {
    expect(activeStore(observe(NOBODY, "titan"), STORES)?.id).toBe("titan");
  });

  it("prefers the override over the game", () => {
    const active = prefer(observe(NOBODY, "titan"), "hunter");

    expect(activeStore(active, STORES)?.id).toBe("hunter");
  });

  it("keeps the override while the game stays put", () => {
    const active = observe(prefer(observe(NOBODY, "titan"), "hunter"), "titan");

    expect(activeStore(active, STORES)?.id).toBe("hunter");
  });

  it("drops the override when the game switches characters", () => {
    const active = observe(
      prefer(observe(NOBODY, "titan"), "hunter"),
      "warlock",
    );

    expect(active.override).toBeUndefined();
  });

  it("drops the override when the game closes", () => {
    const active = observe(
      prefer(observe(NOBODY, "titan"), "hunter"),
      undefined,
    );

    expect(active.override).toBeUndefined();
  });

  it("drops the override when the game starts", () => {
    const active = observe(prefer(NOBODY, "titan"), "hunter");

    expect(active.override).toBeUndefined();
    expect(activeStore(active, STORES)?.id).toBe("hunter");
  });
});
