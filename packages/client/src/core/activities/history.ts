import type { DestinyHistoricalStatsPeriodGroup } from "bungie-api-ts/destiny2";
import { groupBy, sumBy } from "es-toolkit";

export interface HistoryRun {
  instanceId: string;
  characterId: string;
  referenceId: number;
  directorActivityHash: number;
  mode: number;
  startedAt: number;
  durationSeconds: number;
  playedSeconds: number;
  completed: boolean;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  // Only in the PGCR, and only for Portal runs
  difficultyTier: number | undefined;
}

export const value = (
  row: DestinyHistoricalStatsPeriodGroup,
  key: string,
): number => row.values[key]?.basic.value ?? 0;

export const localDay = (at: number): string => {
  const date = new Date(at);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
};

export const runsByDay = (runs: HistoryRun[]): Map<string, HistoryRun[]> =>
  new Map(Object.entries(groupBy(runs, (run) => localDay(run.startedAt))));

export const playedSeconds = (runs: HistoryRun[]): number =>
  sumBy(runs, (run) => run.playedSeconds);

export interface ActivityTiming {
  lastRun: HistoryRun;
  fastestSeconds: number | undefined;
  runs: number;
}

const fastest = (
  one: number | undefined,
  other: number | undefined,
): number | undefined => {
  if (one === undefined) {
    return other;
  }

  if (other === undefined) {
    return one;
  }

  return Math.min(one, other);
};

const mergeTiming = (into: ActivityTiming, from: ActivityTiming) => {
  into.runs += from.runs;

  if (from.lastRun.startedAt > into.lastRun.startedAt) {
    into.lastRun = from.lastRun;
  }

  into.fastestSeconds = fastest(into.fastestSeconds, from.fastestSeconds);
};

/** Keyed under both hashes, they differ for playlist runs */
export const timingsByHash = (
  runs: HistoryRun[],
): Map<number, ActivityTiming> => {
  const timings = new Map<number, ActivityTiming>();

  const fold = (hash: number, run: HistoryRun) => {
    const timing: ActivityTiming = {
      lastRun: run,
      fastestSeconds: run.completed ? run.durationSeconds : undefined,
      runs: 1,
    };
    const held = timings.get(hash);

    if (!held) {
      timings.set(hash, timing);

      return;
    }

    mergeTiming(held, timing);
  };

  for (const run of runs) {
    fold(run.referenceId, run);

    if (run.directorActivityHash !== run.referenceId) {
      fold(run.directorActivityHash, run);
    }
  }

  return timings;
};

/** Merges the timings of an activity and its difficulty variants */
export const bestTiming = (
  timings: Map<number, ActivityTiming>,
  hashes: number[],
): ActivityTiming | undefined => {
  let merged: ActivityTiming | undefined = undefined;

  for (const hash of hashes) {
    const found = timings.get(hash);

    if (!found) {
      continue;
    }

    if (!merged) {
      merged = { ...found };

      continue;
    }

    mergeTiming(merged, found);
  }

  return merged;
};

export interface ActivityRow {
  label: string;
  referenceId: number;
  difficulty: string | undefined;
  runs: number;
  cleared: number;
  deathless: number;
  bestScore: number;
  fastestSeconds: number | undefined;
  lastRunAt: number;
  playedSeconds: number;
}

export interface Bucket {
  id: string;
  name: string;
  modes: number[];
}

const BUCKETS: Bucket[] = [
  { id: "raid", name: "Raids", modes: [4] },
  { id: "dungeon", name: "Dungeons", modes: [82] },
  { id: "strike", name: "Strikes", modes: [3, 18] },
  { id: "trials", name: "Trials", modes: [39, 84] },
  { id: "ironbanner", name: "Iron Banner", modes: [19] },
  { id: "crucible", name: "Crucible", modes: [5] },
  { id: "gambit", name: "Gambit", modes: [63, 64, 75] },
  { id: "lostsector", name: "Lost Sectors", modes: [87] },
  { id: "campaign", name: "Campaign", modes: [2, 58] },
  { id: "patrol", name: "Patrol", modes: [6, 93] },
];

export const OTHER: Bucket = { id: "other", name: "Other", modes: [] };

export interface BucketGroup {
  bucket: Bucket;
  runs: number;
  cleared: number;
  deathless: number;
  bestScore: number;
  playedSeconds: number;
  rows: ActivityRow[];
}

interface BucketLookup {
  modesOf: (referenceId: number) => number[];
  ancestors: (mode: number) => number[];
  rungOf: (run: HistoryRun) => string | undefined;
  labelOf: (run: HistoryRun) => string;
}

const owner = (mode: number): Bucket | undefined =>
  BUCKETS.find((bucket) => bucket.modes.includes(mode));

export const bucketOf = (
  modeTypes: number[],
  lookup: Pick<BucketLookup, "ancestors">,
): Bucket => {
  for (const mode of modeTypes) {
    for (const step of [mode, ...lookup.ancestors(mode)]) {
      const found = owner(step);

      if (found) {
        return found;
      }
    }
  }

  return OTHER;
};

const fold = (row: ActivityRow, run: HistoryRun) => {
  row.runs += 1;
  row.playedSeconds += run.playedSeconds;
  row.bestScore = Math.max(row.bestScore, run.score);

  if (run.startedAt >= row.lastRunAt) {
    row.lastRunAt = run.startedAt;
    row.referenceId = run.referenceId;
  }

  if (!run.completed) {
    return;
  }

  row.cleared += 1;

  if (run.deaths === 0) {
    row.deathless += 1;
  }

  row.fastestSeconds = fastest(row.fastestSeconds, run.durationSeconds);
};

export const byBucket = (
  runs: HistoryRun[],
  lookup: BucketLookup,
): BucketGroup[] => {
  const buckets = new Map<string, Map<string, ActivityRow>>();

  for (const run of runs) {
    const reported = lookup.modesOf(run.referenceId);
    // 325 activities ship no modes
    const bucket = bucketOf(
      reported.length > 0 ? reported : [run.mode],
      lookup,
    );
    const difficulty = lookup.rungOf(run);
    const label = lookup.labelOf(run);
    // Portal hashes serve every rung, and Bungie reissues hashes per season
    const key = `${label}\u0000${difficulty ?? ""}`;
    const rows = buckets.get(bucket.id) ?? new Map<string, ActivityRow>();
    const row = rows.get(key) ?? {
      label,
      referenceId: run.referenceId,
      difficulty,
      runs: 0,
      cleared: 0,
      deathless: 0,
      bestScore: 0,
      fastestSeconds: undefined,
      lastRunAt: 0,
      playedSeconds: 0,
    };

    fold(row, run);
    rows.set(key, row);
    buckets.set(bucket.id, rows);
  }

  const order = [...BUCKETS, OTHER];

  return order.flatMap((bucket) => {
    const rows = buckets.get(bucket.id);

    if (!rows) {
      return [];
    }

    const all = [...rows.values()].sort((a, b) => b.lastRunAt - a.lastRunAt);

    return [
      {
        bucket,
        runs: sumBy(all, (row) => row.runs),
        cleared: sumBy(all, (row) => row.cleared),
        deathless: sumBy(all, (row) => row.deathless),
        bestScore: Math.max(...all.map((row) => row.bestScore), 0),
        playedSeconds: sumBy(all, (row) => row.playedSeconds),
        rows: all,
      },
    ];
  });
};

