import type { DestinyHistoricalStatsPeriodGroup } from "bungie-api-ts/destiny2";

import { fetchActivityHistory, type Membership } from "../api/bungie.ts";
import { PROGRESS, RUNS, type DefStore } from "../profile/store.ts";
import { value, type HistoryRun } from "./history.ts";

export interface CharacterProgress {
  characterId: string;
  complete: boolean;
  syncedAt: number;
}

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

/** Most recent page per character, held in memory for a profile that is not ours */
export const guestHistory = async (
  membership: Membership,
  characterIds: string[],
  accessToken: string,
  onRuns: (runs: HistoryRun[]) => void,
): Promise<void> => {
  for (const characterId of characterIds) {
    const rows = await fetchActivityHistory(
      membership,
      characterId,
      0,
      accessToken,
    );

    onRuns(rows.map((row) => project(characterId, row)));
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
