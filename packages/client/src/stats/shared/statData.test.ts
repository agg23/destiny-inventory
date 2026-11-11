import { describe, expect, it } from "vitest";

import { spansOf, type Span } from "../../core/stats/attribute.ts";
import type { Change } from "../../core/stats/types.ts";
import { HOUR, MINUTE } from "../../core/time.ts";
import {
  activityDigestsOf,
  earningsOf,
  flowsOf,
  killBarsOf,
  levelMarksOf,
  levelOf,
  restateReadings,
  playDaysOf,
  runningTotalOf,
  type FlowSource,
} from "./statData.ts";

const START = new Date(2026, 9, 18, 10, 0).getTime();
const STRIKE = 10;
const ORBIT = 82913930;
const GLIMMER = 3159615086;
const STEP = 15_000;
const OLD_PASS = 4095505052;
const NEW_PASS = 3642754928;
const PRESTIGE = 276883584;

const GLIMMER_SOURCE: FlowSource = { kind: "item", itemHash: GLIMMER };
const XP_SOURCE: Extract<FlowSource, { kind: "xp" }> = {
  kind: "xp",
  progressionHashes: new Set([OLD_PASS, NEW_PASS]),
};

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

const progression = (
  progressionHash: number,
  at: number,
  before: number,
  after: number,
): Change => ({
  ...window(at),
  kind: "progression",
  progressionHash,
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

    expect(
      earningsOf(SESSION, START, START + HOUR, GLIMMER_SOURCE, label),
    ).toEqual([{ label: "Strike", runs: 1, earned: 1_000, seconds: 1_200 }]);
  });

  it("buckets earned and spent per hour over a short range", () => {
    const { daily, flows } = flowsOf(
      SESSION,
      START,
      START + 90 * MINUTE,
      GLIMMER_SOURCE,
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

  it("sums XP across reward passes, netting a stale dip", () => {
    const changes = [
      ...SESSION,
      progression(OLD_PASS, START + 2 * MINUTE, 500, 800),
      progression(PRESTIGE, START + 2 * MINUTE, 100, 400),
      progression(NEW_PASS, START + 10 * MINUTE, 0, 1_000),
      progression(NEW_PASS, START + 30 * MINUTE, 1_000, 900),
      progression(NEW_PASS, START + 31 * MINUTE, 900, 1_000),
      progression(NEW_PASS, START + 70 * MINUTE, 1_000, 1_500),
    ];
    const to = START + 90 * MINUTE;
    const { flows } = flowsOf(changes, START, to, XP_SOURCE);
    const total = runningTotalOf(changes, START, to, XP_SOURCE);

    expect(flows.map((flow) => [flow.start, flow.earned - flow.spent])).toEqual(
      [
        [START, 1_300],
        [START + HOUR, 500],
      ],
    );
    expect(total.now).toBe(1_800);
    expect(total.points.at(-1)).toEqual([to, 1_800]);
  });

  it("leans XP into the activity that just ended", () => {
    const label = (span: Span) =>
      span.activityHash === STRIKE ? "Strike" : "Orbit";
    const changes = [
      ...SESSION,
      progression(NEW_PASS, START + 20 * MINUTE + 20_000, 0, 5_000),
    ];

    expect(earningsOf(changes, START, START + HOUR, XP_SOURCE, label)).toEqual([
      { label: "Strike", runs: 1, earned: 5_000, seconds: 1_200 },
    ]);
  });

  it("walks progression steps, repeating the last", () => {
    const steps = [0, 100, 100].map((progressTotal) => ({ progressTotal }));

    expect(levelOf(steps, true, 0)).toEqual({ level: 1, progress: 0 });
    expect(levelOf(steps, true, 250)).toEqual({ level: 3, progress: 50 });
    expect(levelOf(steps, true, 1_050)).toEqual({ level: 11, progress: 50 });
    expect(levelOf(steps, false, 1_050)).toEqual({ level: 3, progress: 850 });
  });

  it("marks level ups, skipping a new pass starting over", () => {
    const levelAt = (_hash: number, progress: number) =>
      Math.floor(progress / 1_000);
    const changes = [
      progression(OLD_PASS, START + MINUTE, 900, 1_100),
      progression(NEW_PASS, START + 2 * MINUTE, 0, 500),
      progression(NEW_PASS, START + 3 * MINUTE, 500, 3_200),
      progression(NEW_PASS, START + 4 * MINUTE, 3_200, 2_900),
      progression(NEW_PASS, START + 5 * MINUTE, 2_900, 3_200),
      progression(PRESTIGE, START + 6 * MINUTE, 900, 1_100),
    ];

    expect(
      levelMarksOf(
        changes,
        START,
        START + HOUR,
        XP_SOURCE.progressionHashes,
        levelAt,
      ),
    ).toEqual([
      { at: START + MINUTE, first: 1, level: 1 },
      { at: START + 3 * MINUTE, first: 1, level: 3 },
    ]);
  });

  it("drops XP a stale recorder logged twice", () => {
    const changes = restateReadings([
      progression(NEW_PASS, START + 10 * MINUTE, 1_000, 1_500),
      progression(NEW_PASS, START + 40 * MINUTE, 1_000, 2_000),
      progression(NEW_PASS, START + 20 * MINUTE, 1_500, 1_800),
    ]);
    const total = runningTotalOf(changes, START, START + HOUR, XP_SOURCE);

    expect(total.now).toBe(1_000);
  });

  it("drops currency a stale recorder logged twice, keeping spends", () => {
    const changes = restateReadings([
      glimmer(START + 10 * MINUTE, 1_000, 2_000),
      glimmer(START + 20 * MINUTE, 2_000, 1_500),
      glimmer(START + 40 * MINUTE, 1_000, 1_700),
    ]);
    const { flows } = flowsOf(changes, START, START + HOUR, GLIMMER_SOURCE);

    expect(flows[0]).toEqual({ start: START, earned: 1_200, spent: 500 });
  });
});
