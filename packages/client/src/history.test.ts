import type { DestinyHistoricalStatsPeriodGroup } from "bungie-api-ts/destiny2";
import { describe, expect, it } from "vitest";

import {
  ago,
  bestTiming,
  bucketOf,
  byBucket,
  duration,
  NO_TIER,
  playedSeconds,
  project,
  runsByDay,
  sessions,
  span,
  summarize,
  syncTiers,
  timingsByHash,
  type HistoryRun,
} from "./history.ts";
import type { DefStore } from "./store.ts";

const MINUTE = 60 * 1000;

const run = (
  instanceId: string,
  startedAt: number,
  durationSeconds: number,
  extra: Partial<HistoryRun> = {},
): HistoryRun => ({
  instanceId,
  characterId: "c1",
  referenceId: 1,
  directorActivityHash: 9,
  mode: 3,
  startedAt,
  durationSeconds,
  playedSeconds: durationSeconds,
  completed: true,
  kills: 0,
  deaths: 0,
  assists: 0,
  score: 0,
  difficultyTier: undefined,
  ...extra,
});

const row = (
  instanceId: string,
  values: Record<string, number>,
): DestinyHistoricalStatsPeriodGroup =>
  ({
    period: "2026-08-19T21:14:00Z",
    activityDetails: {
      instanceId,
      referenceId: 42,
      directorActivityHash: 77,
      mode: 4,
    },
    values: Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, { basic: { value } }]),
    ),
  }) as unknown as DestinyHistoricalStatsPeriodGroup;

describe("history", () => {
  it("projects a run out of the untyped values bag", () => {
    const projected = project(
      "c1",
      row("500", {
        activityDurationSeconds: 2221,
        timePlayedSeconds: 2000,
        completed: 1,
        kills: 84,
        deaths: 2,
      }),
    );

    expect(projected).toMatchObject({
      instanceId: "500",
      characterId: "c1",
      referenceId: 42,
      directorActivityHash: 77,
      durationSeconds: 2221,
      playedSeconds: 2000,
      completed: true,
      kills: 84,
      deaths: 2,
    });
    expect(projected.startedAt).toBe(Date.parse("2026-08-19T21:14:00Z"));
  });

  it("reads a missing value as zero", () => {
    expect(project("c1", row("1", {})).kills).toBe(0);
  });

  it("takes the fastest time from completed runs only", () => {
    const summary = summarize([
      run("1", 1000, 600),
      run("2", 2000, 120, { completed: false }),
      run("3", 3000, 480),
    ]);

    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({
      runs: 3,
      completions: 2,
      lastRunAt: 3000,
      fastestSeconds: 480,
    });
  });

  it("has no fastest time until something is completed", () => {
    const summary = summarize([run("1", 1000, 600, { completed: false })]);

    expect(summary[0]?.fastestSeconds).toBeUndefined();
  });

  it("orders activities by when they were last run", () => {
    const summary = summarize([
      run("1", 5000, 60, { referenceId: 10 }),
      run("2", 9000, 60, { referenceId: 20 }),
    ]);

    expect(summary.map((one) => one.referenceId)).toEqual([20, 10]);
  });

  it("joins runs less than half an hour apart into one session", () => {
    const found = sessions([
      run("1", 0, 600),
      run("2", 20 * MINUTE, 600),
      run("3", 5 * 60 * MINUTE, 600),
    ]);

    expect(found).toHaveLength(2);
    expect(found[1]?.runs.map((one) => one.instanceId)).toEqual(["1", "2"]);
    expect(found[1]?.playedSeconds).toBe(1200);
  });

  it("returns sessions newest first", () => {
    const found = sessions([run("1", 0, 60), run("2", 5 * 60 * MINUTE, 60)]);

    expect(found.map((one) => one.runs[0]?.instanceId)).toEqual(["2", "1"]);
  });

  // Every nightfall mode parents to Strikes, and its rung shows as a difficulty
  it("folds all the nightfall modes into Strikes", () => {
    const ancestors = (mode: number) => (mode === 7 ? [] : [18, 7]);

    for (const mode of [16, 17, 46, 47]) {
      expect(bucketOf([mode, 7], { ancestors }).id).toBe("strike");
    }

    expect(bucketOf([3, 18, 7], { ancestors: () => [] }).id).toBe("strike");
  });

  it("falls through a crucible submode to Crucible by parent", () => {
    const ancestors = (mode: number) => (mode === 10 ? [5] : []);

    expect(bucketOf([10, 5], { ancestors }).id).toBe("crucible");
  });

  it("keeps Trials out of Crucible even though Crucible is its parent", () => {
    expect(bucketOf([84, 5], { ancestors: () => [5] }).id).toBe("trials");
  });

  it("reads Gambit through its aggregate parent", () => {
    expect(bucketOf([63, 64], { ancestors: () => [64] }).id).toBe("gambit");
  });

  it("drops retired content into Other", () => {
    expect(bucketOf([78, 7], { ancestors: () => [7] }).id).toBe("other");
  });

  it("rolls activities up into buckets with best score and fastest clear", () => {
    const modes: Record<number, number[]> = {
      10: [16, 18, 7],
      11: [3, 18, 7],
      20: [4, 7],
    };
    const groups = byBucket(
      [
        run("1", 1000, 900, { referenceId: 10, score: 120_000 }),
        run("2", 2000, 700, { referenceId: 10, score: 90_000, deaths: 2 }),
        run("3", 3000, 400, { referenceId: 11, completed: false }),
        run("4", 4000, 3000, { referenceId: 20, score: 5 }),
      ],
      {
        modesOf: (id: number) => modes[id] ?? [],
        ancestors: () => [],
        rungOf: () => undefined,
        labelOf: (one) => `A${one.referenceId}`,
      },
    );

    const strikes = groups.find((one) => one.bucket.id === "strike");
    const raid = groups.find((one) => one.bucket.id === "raid");

    expect(strikes).toMatchObject({
      runs: 3,
      cleared: 2,
      deathless: 1,
      bestScore: 120_000,
    });
    expect(strikes?.rows.find((row) => row.referenceId === 10)).toMatchObject({
      fastestSeconds: 700,
      bestScore: 120_000,
    });
    expect(
      strikes?.rows.find((row) => row.referenceId === 11)?.fastestSeconds,
    ).toBeUndefined();
    expect(raid).toMatchObject({ runs: 1, cleared: 1 });
  });

  it("orders buckets by the fixed list, not by time played", () => {
    const groups = byBucket(
      [
        run("1", 1000, 60, { referenceId: 10 }),
        run("2", 2000, 6000, { referenceId: 20 }),
      ],
      {
        modesOf: (id: number) => (id === 10 ? [3] : [4]),
        ancestors: () => [],
        rungOf: () => undefined,
        labelOf: (one) => `A${one.referenceId}`,
      },
    );

    expect(groups.map((one) => one.bucket.id)).toEqual(["raid", "strike"]);
  });

  // One Portal hash serves every rung, so a Grandmaster clear is its own record
  it("splits an activity into a row per difficulty", () => {
    const rungs: Record<string, string> = { "1": "Advanced", "2": "Master" };
    const groups = byBucket(
      [
        run("1", 1000, 900, { score: 10 }),
        run("2", 2000, 1800, { score: 90 }),
        run("3", 3000, 1700, { score: 80, difficultyTier: 9 }),
      ],
      {
        modesOf: () => [3],
        ancestors: () => [],
        rungOf: (one) => rungs[one.instanceId] ?? "Master",
        labelOf: () => "The Arms Dealer",
      },
    );

    const rows = groups[0]?.rows ?? [];

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => [row.difficulty, row.runs])).toEqual([
      ["Master", 2],
      ["Advanced", 1],
    ]);
    expect(
      rows.find((row) => row.difficulty === "Master")?.fastestSeconds,
    ).toBe(1700);
    expect(
      rows.find((row) => row.difficulty === "Advanced")?.fastestSeconds,
    ).toBe(900);
  });

  // Bungie reissues a hash per season, so one label spans years of the same content
  it("merges the seasonal hashes wearing one label", () => {
    const groups = byBucket(
      [
        run("1", 1000, 1600, { referenceId: 10 }),
        run("2", 9000, 1200, { referenceId: 11 }),
        run("3", 5000, 1400, { referenceId: 12 }),
      ],
      {
        modesOf: () => [3],
        ancestors: () => [],
        rungOf: () => "Master",
        labelOf: () => "Nightfall: The Ordeal",
      },
    );

    expect(groups[0]?.rows).toMatchObject([
      {
        label: "Nightfall: The Ordeal",
        difficulty: "Master",
        runs: 3,
        fastestSeconds: 1200,
        // The newest run's hash, so the row shows current art
        referenceId: 11,
        lastRunAt: 9000,
      },
    ]);
  });

  it("keeps an untiered activity as one row", () => {
    const groups = byBucket([run("1", 1000, 60), run("2", 2000, 60)], {
      modesOf: () => [3],
      ancestors: () => [],
      rungOf: () => undefined,
      labelOf: (one) => `A${one.referenceId}`,
    });

    expect(groups[0]?.rows).toMatchObject([{ runs: 2, difficulty: undefined }]);
  });

  // Rounding the minutes inside the hour produced "96h 60m"
  it("never spans sixty minutes into an hour", () => {
    expect(span(96 * 3600 + 3599)).toBe("97h 0m");
    expect(span(3599)).toBe("1h 0m");
    expect(span(0)).toBe("0m");
    expect(span(90 * 60)).toBe("1h 30m");
  });

  it("carries a run past an hour instead of counting minutes up", () => {
    expect(duration(4369)).toBe("1:12:49");
    expect(duration(2005)).toBe("33:25");
    expect(duration(9)).toBe("0:09");
  });

  it("reads a long absence in years", () => {
    const days = (count: number) => Date.now() - count * 24 * 60 * 60 * 1000;

    expect(ago(days(0))).toBe("today");
    expect(ago(days(1))).toBe("yesterday");
    expect(ago(days(30))).toBe("30 days ago");
    expect(ago(days(90))).toBe("3 months ago");
    expect(ago(days(2600))).toBe("7 years ago");
  });

  it("asks a report for the rung of a tiered run only", async () => {
    const stored: HistoryRun[][] = [];
    const store = {
      putAll: async (_: string, records: object[]) => {
        stored.push(records as HistoryRun[]);
      },
    } as unknown as DefStore;
    const asked: string[] = [];
    const tiers: Record<string, number> = { "1": 9, "3": 7 };

    await syncTiers(
      store,
      [
        run("1", 1000, 60, { referenceId: 10 }),
        run("2", 2000, 60, { referenceId: 20 }),
        run("3", 3000, 60, { referenceId: 10, difficultyTier: 4 }),
      ],
      (one) => one.referenceId === 10,
      async (instanceId) => {
        asked.push(instanceId);

        return tiers[instanceId];
      },
      () => undefined,
    );

    expect(asked).toEqual(["1"]);
    expect(stored.flat()).toMatchObject([
      { instanceId: "1", difficultyTier: 9 },
    ]);
  });

  // Asking again every session would cost a request a run forever
  it("remembers a run the report gave no rung for", async () => {
    const store = { putAll: async () => undefined } as unknown as DefStore;
    const seen: HistoryRun[] = [];

    await syncTiers(
      store,
      [run("1", 1000, 60)],
      () => true,
      async () => undefined,
      (fresh) => seen.push(...fresh),
    );

    expect(seen).toMatchObject([{ difficultyTier: NO_TIER }]);
  });

  it("leaves a run alone when its report cannot be reached", async () => {
    const store = { putAll: async () => undefined } as unknown as DefStore;
    const seen: HistoryRun[] = [];

    await syncTiers(
      store,
      [run("1", 1000, 60)],
      () => true,
      async () => {
        throw new Error("503");
      },
      (fresh) => seen.push(...fresh),
    );

    expect(seen).toEqual([]);
  });

  it("groups runs by local day", () => {
    const noon = new Date(2026, 7, 19, 12).getTime();
    const later = new Date(2026, 7, 19, 22).getTime();
    const next = new Date(2026, 7, 20, 1).getTime();

    const days = runsByDay([
      run("1", noon, 300),
      run("2", later, 600),
      run("3", next, 900),
    ]);

    expect([...days.keys()].sort()).toEqual(["2026-08-19", "2026-08-20"]);
    expect(playedSeconds(days.get("2026-08-19") ?? [])).toBe(900);
    expect(playedSeconds(days.get("2026-08-20") ?? [])).toBe(900);
  });

  // Best must never read as slower than average
  it("averages completed runs only", () => {
    const summary = summarize([
      run("1", 1000, 2005),
      run("2", 2000, 600, { completed: false }),
      run("3", 3000, 1545),
    ]);

    expect(summary[0]?.fastestSeconds).toBe(1545);
    expect(summary[0]?.averageSeconds).toBe(1775);
  });

  it("has no average until something is completed", () => {
    const summary = summarize([run("1", 1000, 800, { completed: false })]);

    expect(summary[0]?.averageSeconds).toBeUndefined();
  });

  it("times an activity under both of its hashes", () => {
    const timings = timingsByHash([
      run("1", 1000, 600, { referenceId: 10, directorActivityHash: 99 }),
    ]);

    expect(timings.get(10)?.fastestSeconds).toBe(600);
    expect(timings.get(99)?.fastestSeconds).toBe(600);
  });

  it("counts a run once when both hashes agree", () => {
    const timings = timingsByHash([
      run("1", 1000, 600, { referenceId: 10, directorActivityHash: 10 }),
    ]);

    expect(timings.get(10)?.runs).toBe(1);
  });

  it("merges an activity with its difficulty variants", () => {
    const timings = timingsByHash([
      run("1", 1000, 900, { referenceId: 10, directorActivityHash: 10 }),
      run("2", 5000, 1500, { referenceId: 20, directorActivityHash: 20 }),
    ]);

    expect(bestTiming(timings, [10, 20])).toMatchObject({
      runs: 2,
      lastRunAt: 5000,
      fastestSeconds: 900,
    });
  });

  it("has no timing for an activity never run", () => {
    expect(bestTiming(timingsByHash([]), [10])).toBeUndefined();
  });

  it("ignores incomplete runs when timing an activity", () => {
    const timings = timingsByHash([
      run("1", 1000, 60, { referenceId: 10, completed: false }),
      run("2", 2000, 900, { referenceId: 10 }),
    ]);

    expect(timings.get(10)).toMatchObject({
      runs: 2,
      fastestSeconds: 900,
      lastRunAt: 2000,
    });
  });
});
