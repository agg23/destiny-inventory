import { describe, expect, it } from "vitest";

import { clock, HOUR, schedule, ZONES } from "./distortion.ts";

// The window verified in-game: Europa active 2026-07-26 13:00-14:00 UTC
const VERIFIED = Date.UTC(2026, 6, 26, 13);

const active = (now: number): string => schedule(now)[0]?.name ?? "";

describe("schedule", () => {
  it("names the zone verified in-game", () => {
    expect(active(VERIFIED + HOUR / 2)).toBe("Europa");
  });

  it("advances one zone per hour", () => {
    expect(active(VERIFIED + HOUR)).toBe("Nessus");
    expect(active(VERIFIED + 2 * HOUR)).toBe("Cosmodrome");
  });

  it("runs the same cycle before the anchor", () => {
    expect(active(VERIFIED - HOUR)).toBe("Moon");
    expect(active(VERIFIED - 5 * HOUR)).toBe("Cosmodrome");
    expect(active(VERIFIED - 6 * HOUR)).toBe("Nessus");
  });

  it("covers each zone exactly once, starting with the active hour", () => {
    const turns = schedule(VERIFIED + HOUR / 2);

    expect(turns.map((turn) => turn.name)).toEqual([
      "Europa",
      "Nessus",
      "Cosmodrome",
      "European Dead Zone",
      "Dreaming City",
      "Savathûn's Throne World",
      "Moon",
    ]);
  });

  it("stamps each turn with the top of its hour", () => {
    const turns = schedule(VERIFIED + HOUR / 2);

    expect(turns.map((turn) => turn.start)).toEqual(
      ZONES.map((_, ahead) => VERIFIED + ahead * HOUR),
    );
  });

  it("carries the zone's armor set", () => {
    const nessus = schedule(VERIFIED).find((turn) => turn.name === "Nessus");

    expect(nessus?.set).toBe(3120219904);
  });

  it("shortens only the names that need it", () => {
    const shortened = ZONES.filter((zone) => zone.short);

    expect(shortened.map((zone) => zone.short)).toEqual([
      "EDZ",
      "Throne World",
    ]);
  });

  // The other OSS tracker's formula, floor((epoch_s + 14400) / 3600) mod 7, phrased differently
  it("agrees with the independent tracker for a week", () => {
    for (let hour = 0; hour < 168; hour += 1) {
      const now = VERIFIED + hour * HOUR;
      const theirs = Math.floor((now / 1000 + 14_400) / 3600) % ZONES.length;

      expect(active(now)).toBe(ZONES[theirs]?.name);
    }
  });
});

describe("clock", () => {
  it("reads as minutes and padded seconds", () => {
    expect(clock(45 * 60_000)).toBe("45:00");
    expect(clock(9 * 60_000 + 7_000)).toBe("9:07");
  });

  it("never shows negative time", () => {
    expect(clock(-500)).toBe("0:00");
  });
});
