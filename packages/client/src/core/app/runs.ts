import type { DimStore } from "app/inventory/store-types";
import { createEffect, createMemo, createSignal } from "solid-js";

import { activityTables } from "../activities/activityTables.ts";
import { timingsByHash, type HistoryRun } from "../activities/history.ts";
import {
  guestHistory,
  storedRuns,
  syncHistory,
  syncTiers,
} from "../activities/historySync.ts";
import { accessToken } from "../api/auth.ts";
import { fetchCarnageReport } from "../api/bungie.ts";
import { messageOf } from "../error.ts";
import type { LoadResult } from "../profile/loadTypes.ts";

export const createRuns = (
  current: () => LoadResult | undefined,
  stores: () => DimStore[],
) => {
  const [runs, setRuns] = createSignal<HistoryRun[]>([]);
  let runsAt = 0;
  const [syncing, setSyncing] = createSignal(false);
  const [syncError, setSyncError] = createSignal<string | undefined>(undefined);

  const characterIds = () =>
    stores()
      .filter((store) => !store.isVault)
      .map((store) => store.id);

  const absorb = (was: HistoryRun[], next: HistoryRun[]): HistoryRun[] => {
    const byId = new Map(was.map((run) => [run.instanceId, run]));

    for (const run of next) {
      byId.set(run.instanceId, run);
    }

    return [...byId.values()];
  };

  const syncRuns = async (session: LoadResult["session"]) => {
    runsAt = Date.now();
    setSyncing(true);

    try {
      if (!session.guest && runs().length === 0) {
        setRuns(await storedRuns(session.store));
      }

      const token = await accessToken();

      if (!token) {
        return;
      }

      if (session.guest) {
        await guestHistory(
          session.membership,
          characterIds(),
          token,
          (fresh) => setRuns((was) => absorb(was, fresh)),
        );

        return;
      }

      await syncHistory(
        session.store,
        session.membership,
        characterIds(),
        token,
        (fresh) => setRuns((was) => absorb(was, fresh)),
      );

      const tables = await activityTables();

      await syncTiers(
        session.store,
        runs(),
        (run) =>
          tables.activities[run.referenceId]?.difficultyHash !== undefined,
        async (instanceId) =>
          (await fetchCarnageReport(instanceId, token)).activityDifficultyTier,
        (fresh) => setRuns((was) => absorb(was, fresh)),
      );
    } catch (e: unknown) {
      setSyncError(messageOf(e));
    } finally {
      setSyncing(false);
    }
  };

  let syncedFor: string | undefined = undefined;

  createEffect(() => {
    const loaded = current();

    if (!loaded || characterIds().length === 0) {
      return;
    }

    const who = loaded.session.membership.membershipId;

    if (syncedFor === who) {
      return;
    }

    syncedFor = who;
    setRuns([]);
    void syncRuns(loaded.session);
  });

  const syncNow = (): Promise<void> => {
    const loaded = current();

    if (syncing() || !loaded || characterIds().length === 0) {
      return Promise.resolve();
    }

    return syncRuns(loaded.session);
  };

  const timings = createMemo(() => timingsByHash(runs()));

  return {
    runs,
    syncing,
    syncError,
    timings,
    syncNow,
    syncedAt: () => runsAt,
  };
};
