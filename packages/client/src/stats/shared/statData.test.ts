import { describe, expect, it } from "vitest";

import { spansOf, type Span } from "../../core/stats/attribute.ts";
import type { Change } from "../../core/stats/types.ts";
import { HOUR, MINUTE } from "../../core/time.ts";
import {
  activityDigestsOf,
  earningsOf,
  flowsOf,
  killBarsOf,
  playDaysOf,
} from "./statData.ts";

const START = new Date(2026, 9, 18, 10, 0).getTime();
const STRIKE = 10;
const ORBIT = 82913930;
const GLIMMER = 3159615086;
const STEP = 15_000;

const window = (at: number) => ({ from: at - STEP, at });

const enter = (activityHash: number, at: number): Change => ({
  ...window(at + 5_000),
  kind: "activity",
  characterId: "c1",
  activityHash,
  modeHash: 0,
  playlistHash: 0,
  startedAt: at,
});

const item = (instanceId: string, at: number, added: boolean): Change => ({
  ...window(at),
  kind: "item",
  instanceId,
  itemHash: 1,
  characterId: "c1",
  bucketHash: 2,
  added,
});

const glimmer = (at: number, before: number, after: number): Change => ({
  ...window(at),
  kind: "currency",
  itemHash: GLIMMER,
  before,
  after,
});

// Strike for 20 minutes, then orbit
const SESSION: Change[] = [
  enter(STRIKE, START),
  item("a", START + 55_000, true),
  glimmer(START + 5 * MINUTE, 1_000, 2_000),
  item("b", START + 20 * MINUTE + 10_000, true),
  item("c", START + 20 * MINUTE + 10_000, true),
  enter(ORBIT, START + 20 * MINUTE),
  item("a", START + 22 * MINUTE, false),
  glimmer(START + 23 * MINUTE, 2_000, 500),
];

describe("stats page data", () => {
  it("links a dismantle in orbit back to the drop in the strike", () => {
    const [orbit, strike] = activityDigestsOf(SESSION, START, START + HOUR);

    expect(orbit?.span?.activityHash).toBe(ORBIT);
    expect(orbit?.events).toEqual([
      expect.objectContaining({
        kind: "dismantle",
        instanceId: "a",
        dropped: {
          span: expect.objectContaining({ activityHash: STRIKE }),
          at: START + 55_000,
        },
      }),
    ]);
    expect(
      strike?.events.map((event) =>
        event.kind === "drops" ? event.drops.length : event.kind,
      ),
    ).toEqual([1, 2]);
  });

  it("counts only what an activity earned, against its time", () => {
    const label = (span: Span) =>
      span.activityHash === STRIKE ? "Strike" : "Orbit";

    expect(earningsOf(SESSION, START, START + HOUR, GLIMMER, label)).toEqual([
      { label: "Strike", runs: 1, earned: 1_000, seconds: 1_200 },
    ]);
  });

  it("buckets earned and spent per hour over a short range", () => {
    const { daily, flows } = flowsOf(
      SESSION,
      START,
      START + 90 * MINUTE,
      GLIMMER,
    );

    expect(daily).toBe(false);
    expect(flows).toEqual([
      { start: START, earned: 1_000, spent: 1_500 },
      { start: START + HOUR, earned: 0, spent: 0 },
    ]);
  });

  it("splits a session across midnight", () => {
    const late = new Date(2026, 9, 18, 23, 30).getTime();
    const spans = spansOf([enter(STRIKE, late), enter(0, late + HOUR)]);
    const days = playDaysOf(spans, late, late + 2 * HOUR, () => false);

    expect(days.map((day) => [day.day, day.active])).toEqual([
      ["2026-10-18", 1_800],
      ["2026-10-19", 1_800],
    ]);
  });

  it("buckets tracker kills by interval, whatever the activity", () => {
    const kill = (instanceId: string, at: number, kills: number): Change => ({
      ...window(at),
      kind: "objective",
      instanceId,
      itemHash: 5,
      objectiveHash: 90275515,
      before: 100,
      after: 100 + kills,
    });
    const bars = killBarsOf(
      [
        ...SESSION,
        kill("w1", START + 1 * MINUTE, 3),
        kill("w2", START + 4 * MINUTE, 2),
        kill("w1", START + 21 * MINUTE, 4),
      ],
      START,
      START + HOUR,
      "all",
      5 * MINUTE,
      (instanceId) => instanceId === "w1",
    );

    expect(bars.map((bar) => [bar.start, bar.total])).toEqual([
      [START, 3],
      [START + 20 * MINUTE, 4],
    ]);
  });
});
