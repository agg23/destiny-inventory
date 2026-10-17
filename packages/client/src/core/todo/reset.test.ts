import { describe, expect, it } from "vitest";

import {
  DAY,
  nextDailyReset,
  nextWeeklyReset,
  nextWeekendReset,
  remaining,
  WEEK,
  xurPresent,
} from "./reset.ts";

const MONDAY = Date.UTC(2026, 8, 7, 12);

const iso = (at: number): string => new Date(at).toISOString();

describe("nextDailyReset", () => {
  it("lands on 17:00 UTC the same day when the morning is still early", () => {
    expect(iso(nextDailyReset(MONDAY))).toBe("2026-09-07T17:00:00.000Z");
  });

  it("rolls to tomorrow once the hour has passed", () => {
    expect(iso(nextDailyReset(Date.UTC(2026, 8, 7, 17)))).toBe(
      "2026-09-08T17:00:00.000Z",
    );
  });

  it("stays exactly a day apart across a year", () => {
    for (let day = 0; day < 365; day += 1) {
      const now = MONDAY + day * DAY;

      expect(nextDailyReset(now) - nextDailyReset(now - DAY)).toBe(DAY);
    }
  });
});

describe("nextWeeklyReset", () => {
  it("lands on Tuesday 17:00 UTC", () => {
    expect(iso(nextWeeklyReset(MONDAY))).toBe("2026-09-08T17:00:00.000Z");
  });

  it("rolls to the following Tuesday right after the reset", () => {
    expect(iso(nextWeeklyReset(Date.UTC(2026, 8, 8, 17)))).toBe(
      "2026-09-15T17:00:00.000Z",
    );
  });

  it("always names a Tuesday", () => {
    for (let hour = 0; hour < 400; hour += 1) {
      const at = new Date(nextWeeklyReset(MONDAY + hour * 3_600_000));

      expect(at.getUTCDay()).toBe(2);
      expect(at.getUTCHours()).toBe(17);
    }
  });
});

// Xur's own nextRefreshDate returned 2026-09-11T09:00:00Z
describe("nextWeekendReset", () => {
  it("lands on Friday 09:00 UTC", () => {
    expect(iso(nextWeekendReset(MONDAY))).toBe("2026-09-11T09:00:00.000Z");
  });

  it("stays a week apart", () => {
    expect(
      nextWeekendReset(MONDAY + WEEK) - nextWeekendReset(MONDAY),
    ).toBe(WEEK);
  });
});

describe("xurPresent", () => {
  it("is true from Friday evening through Monday", () => {
    expect(xurPresent(Date.UTC(2026, 8, 11, 9))).toBe(true);
    expect(xurPresent(Date.UTC(2026, 8, 13, 12))).toBe(true);
    expect(xurPresent(MONDAY + 7 * DAY)).toBe(true);
  });

  it("is false from the weekly reset until he arrives again", () => {
    expect(xurPresent(Date.UTC(2026, 8, 15, 17))).toBe(false);
    expect(xurPresent(Date.UTC(2026, 8, 16, 12))).toBe(false);
    expect(xurPresent(Date.UTC(2026, 8, 11, 8))).toBe(false);
  });
});

describe("remaining", () => {
  it("drops to days and hours over a day out", () => {
    expect(remaining(2 * DAY + 5 * 3_600_000)).toBe("2d 5h");
  });

  it("reads as hours and minutes under a day", () => {
    expect(remaining(4 * 3_600_000 + 12 * 60_000)).toBe("4h 12m");
  });

  it("reads as minutes and seconds under an hour", () => {
    expect(remaining(12 * 60_000 + 30_000)).toBe("12m 30s");
  });

  it("never shows negative time", () => {
    expect(remaining(-5_000)).toBe("0m 0s");
  });
});
