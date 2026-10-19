import { describe, expect, it } from "vitest";

import { HOUR, MINUTE } from "../../core/time.ts";
import { sessionsOf, timelineOf } from "./timeline.ts";

const START = 1_000_000_000_000;

// An hour, three hours offline, another hour
const RANGES = [
  { from: START, to: START + 30 * MINUTE },
  { from: START + 35 * MINUTE, to: START + HOUR },
  { from: START + 4 * HOUR, to: START + 5 * HOUR },
];

describe("stats timeline", () => {
  it("merges play closer than the session gap", () => {
    expect(sessionsOf(RANGES)).toEqual([
      { from: START, to: START + HOUR },
      { from: START + 4 * HOUR, to: START + 5 * HOUR },
    ]);
  });

  it("gives two equal sessions equal width around one thin break", () => {
    const timeline = timelineOf(RANGES);

    expect(timeline.breaks).toHaveLength(1);
    expect(timeline.toX(START)).toBe(0);
    expect(timeline.toX(START + 5 * HOUR)).toBeCloseTo(1);
    expect(timeline.toX(START + HOUR)).toBeCloseTo(0.49);
    expect(timeline.toX(START + 4 * HOUR)).toBeCloseTo(0.51);
    expect(timeline.toX(START + 2 * HOUR)).toBeCloseTo(0.5);
  });

  it("maps a position back to its time", () => {
    const timeline = timelineOf(RANGES);
    const at = START + 4.5 * HOUR;

    expect(timeline.toTime(timeline.toX(at))).toBeCloseTo(at, -2);
  });
});
