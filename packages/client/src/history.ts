import type { DestinyHistoricalStatsPeriodGroup } from "bungie-api-ts/destiny2";

import { fetchActivityHistory, type Membership } from "./bungie.ts";
import { PROGRESS, RUNS, type DefStore } from "./store.ts";

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
  // Only a report knows, and only for a Portal run, so it arrives after the run does
  difficultyTier: number | undefined;
}

export interface CharacterProgress {
  characterId: string;
  complete: boolean;
  syncedAt: number;
}

const value = (row: DestinyHistoricalStatsPeriodGroup, key: string): number =>
  row.values[key]?.basic.value ?? 0;

export const project = (
  characterId: string,
  row: DestinyHistoricalStatsPeriodGroup,
): HistoryRun => ({
  instanceId: row.activityDetails.instanceId,
  characterId,
  referenceId: row.activityDetails.referenceId,
  directorActivityHash: row.activityDetails.directorActivityHash,
  mode: row.activityDetails.mode,
  startedAt: Date.parse(row.period),
  durationSeconds: value(row, "activityDurationSeconds"),
  playedSeconds: value(row, "timePlayedSeconds"),
  completed: value(row, "completed") === 1,
  kills: value(row, "kills"),
  deaths: value(row, "deaths"),
  assists: value(row, "assists"),
  score: value(row, "score"),
  difficultyTier: undefined,
});

/** Pages a character's history until known() hits or the pages run out */
export const walkHistory = async (
  membership: Membership,
  characterId: string,
  accessToken: string,
  known: (run: HistoryRun) => boolean,
  onPage: (runs: HistoryRun[]) => Promise<void>,
): Promise<void> => {
  let page = 0;

  for (;;) {
    const rows = await fetchActivityHistory(
      membership,
      characterId,
      page,
      accessToken,
    );

    if (rows.length === 0) {
      return;
    }

    const runs = rows.map((row) => project(characterId, row));
    const stop = runs.findIndex(known);

    await onPage(stop === -1 ? runs : runs.slice(0, stop));

    if (stop !== -1) {
      return;
    }

    page += 1;
  }
};

export const storedRuns = (store: DefStore): Promise<HistoryRun[]> =>
  store.getAll<HistoryRun>(RUNS);

// TODO: Resume an interrupted backfill instead of restarting it from page 0
export const syncHistory = async (
  store: DefStore,
  membership: Membership,
  characterIds: string[],
  accessToken: string,
  onRuns: (runs: HistoryRun[]) => void,
): Promise<void> => {
  const seen = new Set((await storedRuns(store)).map((run) => run.instanceId));

  for (const characterId of characterIds) {
    const progress = await store.getOne<CharacterProgress>(
      PROGRESS,
      characterId,
    );

    const known = (run: HistoryRun): boolean =>
      Boolean(progress?.complete) && seen.has(run.instanceId);

    await walkHistory(
      membership,
      characterId,
      accessToken,
      known,
      async (runs) => {
        const fresh = runs.filter((run) => !seen.has(run.instanceId));

        if (fresh.length === 0) {
          return;
        }

        for (const run of fresh) {
          seen.add(run.instanceId);
        }

        await store.putAll(RUNS, fresh);
        onRuns(fresh);
      },
    );

    await store.putAll(PROGRESS, [
      { characterId, complete: true, syncedAt: Date.now() },
    ]);
  }
};

// Standing in for a tier Bungie declines to name, so we ask for it only once
export const NO_TIER = -1;

const TIER_BATCH = 8;

/**
 * Fills in the rung of a Portal run, which serves every difficulty from one
 * activity hash and so names none of them. Bounded to the runs tiered() claims,
 * since a report costs a request each.
 */
export const syncTiers = async (
  store: DefStore,
  runs: HistoryRun[],
  tiered: (run: HistoryRun) => boolean,
  fetchTier: (instanceId: string) => Promise<number | undefined>,
  onRuns: (runs: HistoryRun[]) => void,
): Promise<void> => {
  const wanted = runs.filter(
    (run) => run.difficultyTier === undefined && tiered(run),
  );

  for (let at = 0; at < wanted.length; at += TIER_BATCH) {
    const batch = wanted.slice(at, at + TIER_BATCH);
    const found = await Promise.all(
      batch.map(async (run) => {
        try {
          return {
            ...run,
            difficultyTier: (await fetchTier(run.instanceId)) ?? NO_TIER,
          };
        } catch {
          // One unreachable report should not sink the batch; the next sync retries it
          return undefined;
        }
      }),
    );

    const kept = found.filter((run) => run !== undefined);

    if (kept.length === 0) {
      continue;
    }

    await store.putAll(RUNS, kept);
    onRuns(kept);
  }
};

export interface ActivitySummary {
  referenceId: number;
  runs: number;
  completions: number;
  lastRunAt: number;
  fastestSeconds: number | undefined;
  averageSeconds: number | undefined;
  deaths: number;
}

export const summarize = (runs: HistoryRun[]): ActivitySummary[] => {
  const grouped = new Map<number, HistoryRun[]>();

  for (const run of runs) {
    const held = grouped.get(run.referenceId);

    if (held) {
      held.push(run);

      continue;
    }

    grouped.set(run.referenceId, [run]);
  }

  const summaries: ActivitySummary[] = [];

  for (const [referenceId, group] of grouped) {
    const times = group
      .filter((run) => run.completed)
      .map((run) => run.durationSeconds);

    summaries.push({
      referenceId,
      runs: group.length,
      completions: times.length,
      lastRunAt: Math.max(...group.map((run) => run.startedAt)),
      fastestSeconds: times.length > 0 ? Math.min(...times) : undefined,
      averageSeconds:
        times.length > 0
          ? times.reduce((total, one) => total + one, 0) / times.length
          : undefined,
      deaths: group.reduce((total, run) => total + run.deaths, 0),
    });
  }

  return summaries.sort((a, b) => b.lastRunAt - a.lastRunAt);
};

const SESSION_GAP_MS = 30 * 60 * 1000;

export interface PlaySession {
  startedAt: number;
  endedAt: number;
  playedSeconds: number;
  runs: HistoryRun[];
}

export const sessions = (runs: HistoryRun[]): PlaySession[] => {
  const ordered = [...runs].sort((a, b) => a.startedAt - b.startedAt);
  const found: PlaySession[] = [];

  for (const run of ordered) {
    const ends = run.startedAt + run.durationSeconds * 1000;
    const open = found[found.length - 1];

    if (open && run.startedAt - open.endedAt <= SESSION_GAP_MS) {
      open.endedAt = Math.max(open.endedAt, ends);
      open.playedSeconds += run.playedSeconds;
      open.runs.push(run);

      continue;
    }

    found.push({
      startedAt: run.startedAt,
      endedAt: ends,
      playedSeconds: run.playedSeconds,
      runs: [run],
    });
  }

  return found.reverse();
};

export const localDay = (at: number): string => {
  const date = new Date(at);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
};

export const runsByDay = (runs: HistoryRun[]): Map<string, HistoryRun[]> => {
  const days = new Map<string, HistoryRun[]>();

  for (const run of runs) {
    const day = localDay(run.startedAt);
    const held = days.get(day);

    if (held) {
      held.push(run);

      continue;
    }

    days.set(day, [run]);
  }

  return days;
};

export const playedSeconds = (runs: HistoryRun[]): number =>
  runs.reduce((total, run) => total + run.playedSeconds, 0);

export interface ActivityTiming {
  lastRunAt: number;
  fastestSeconds: number | undefined;
  runs: number;
}

/** Keyed under both hashes, since a playlist run reports them differently */
export const timingsByHash = (
  runs: HistoryRun[],
): Map<number, ActivityTiming> => {
  const timings = new Map<number, ActivityTiming>();

  const fold = (hash: number, run: HistoryRun) => {
    const held = timings.get(hash);

    if (!held) {
      timings.set(hash, {
        lastRunAt: run.startedAt,
        fastestSeconds: run.completed ? run.durationSeconds : undefined,
        runs: 1,
      });

      return;
    }

    held.runs += 1;
    held.lastRunAt = Math.max(held.lastRunAt, run.startedAt);

    if (run.completed) {
      held.fastestSeconds =
        held.fastestSeconds === undefined
          ? run.durationSeconds
          : Math.min(held.fastestSeconds, run.durationSeconds);
    }
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

    merged.runs += found.runs;
    merged.lastRunAt = Math.max(merged.lastRunAt, found.lastRunAt);

    if (found.fastestSeconds !== undefined) {
      merged.fastestSeconds =
        merged.fastestSeconds === undefined
          ? found.fastestSeconds
          : Math.min(merged.fastestSeconds, found.fastestSeconds);
    }
  }

  return merged;
};

export interface ActivityRow {
  label: string;
  // The newest hash wearing this label, for the art and the definition
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

/**
 * Fixed buckets in priority order, each naming only the modes it owns outright.
 * Everything below one of these reaches it by walking parent modes, so Trials
 * lands in Trials while Control and Rumble fall through to Crucible. Every
 * flavor of nightfall parents to Strikes, and its rung shows as a difficulty.
 */
export const BUCKETS: Bucket[] = [
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

export interface BucketLookup {
  modesOf: (referenceId: number) => number[];
  // Nearest first, not including the mode itself
  ancestors: (mode: number) => number[];
  rungOf: (run: HistoryRun) => string | undefined;
  labelOf: (run: HistoryRun) => string;
}

const owner = (mode: number): Bucket | undefined =>
  BUCKETS.find((bucket) => bucket.modes.includes(mode));

/** Walks each reported mode, then its parents, and takes the first bucket that claims one */
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

  row.fastestSeconds =
    row.fastestSeconds === undefined
      ? run.durationSeconds
      : Math.min(row.fastestSeconds, run.durationSeconds);
};

export const byBucket = (
  runs: HistoryRun[],
  lookup: BucketLookup,
): BucketGroup[] => {
  const buckets = new Map<string, Map<string, ActivityRow>>();

  for (const run of runs) {
    const reported = lookup.modesOf(run.referenceId);
    // 325 activities ship no modes, so the run's own mode is the only clue
    const bucket = bucketOf(
      reported.length > 0 ? reported : [run.mode],
      lookup,
    );
    const difficulty = lookup.rungOf(run);
    const label = lookup.labelOf(run);
    /**
     * A Portal hash serves every rung and Bungie reissues a hash per season, so
     * the label and the rung together name the thing you actually did.
     */
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
        runs: all.reduce((total, row) => total + row.runs, 0),
        cleared: all.reduce((total, row) => total + row.cleared, 0),
        deathless: all.reduce((total, row) => total + row.deathless, 0),
        bestScore: Math.max(...all.map((row) => row.bestScore), 0),
        playedSeconds: all.reduce((total, row) => total + row.playedSeconds, 0),
        rows: all,
      },
    ];
  });
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const span = (seconds: number): string => {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);

  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
};

const pad = (value: number): string => String(value).padStart(2, "0");

/** Clock time for one run, which can outlast an hour on a raid */
export const duration = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const hours = Math.floor(minutes / 60);

  return hours > 0
    ? `${hours}:${pad(minutes % 60)}:${pad(total % 60)}`
    : `${minutes}:${pad(total % 60)}`;
};

export const ago = (at: number): string => {
  const days = Math.floor((Date.now() - at) / DAY_MS);

  if (days <= 0) {
    return "today";
  }

  if (days === 1) {
    return "yesterday";
  }

  if (days < 60) {
    return `${days} days ago`;
  }

  if (days < 365) {
    const months = Math.floor(days / 30);

    return months === 1 ? "a month ago" : `${months} months ago`;
  }

  const years = Math.floor(days / 365);

  return years === 1 ? "a year ago" : `${years} years ago`;
};
