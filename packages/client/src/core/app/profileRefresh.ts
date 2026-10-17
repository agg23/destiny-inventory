import {
  createEffect,
  createSignal,
  on,
  onCleanup,
  type Setter,
} from "solid-js";

import type { Membership } from "../api/bungie.ts";
import { definedSession } from "../collections/collections.ts";
import { observe, type Active } from "../profile/active.ts";
import { load } from "../profile/load.ts";
import type { LoadResult, RefreshOutcome } from "../profile/loadTypes.ts";
import { startAutoRefresh } from "../profile/refresh.ts";
import { refreshProfile } from "../profile/refreshProfile.ts";
import { MINUTE } from "../time.ts";
import type { Tab } from "../url.ts";

// Keeps the last-run column from drifting while History is closed
const OFFSCREEN_RUNS = 2 * MINUTE;

interface Sources {
  current: () => LoadResult | undefined;
  viewing: () => Membership | undefined;
  tab: () => Tab;
  busy: () => boolean;
  refetchGuest: () => unknown;
  setUpgraded: Setter<LoadResult | undefined>;
  setActive: Setter<Active>;
  syncNow: () => Promise<void>;
  syncedAt: () => number;
}

export const createProfileRefresh = (sources: Sources) => {
  const [stale, setStale] = createSignal(false);
  const [refreshing, setRefreshing] = createSignal(false);
  const [refreshedAt, setRefreshedAt] = createSignal<number | undefined>(
    undefined,
  );
  const [failingSince, setFailingSince] = createSignal<number | undefined>(
    undefined,
  );

  const retryLoad = async (loaded: LoadResult): Promise<RefreshOutcome> => {
    const failure: { error?: unknown } = {};

    // A failed primed load returns the snapshot without throwing
    const result = await load(
      sources.setUpgraded,
      (e) => {
        failure.error = e;
      },
      loaded,
    );

    if ("error" in failure) {
      throw failure.error;
    }

    return { status: "updated", playing: result.playing, result };
  };

  const refresh = async () => {
    const loaded = sources.current();

    if (!loaded) {
      return;
    }

    if (sources.viewing()) {
      setRefreshing(true);

      try {
        await sources.refetchGuest();
        setRefreshedAt(Date.now());
      } finally {
        setRefreshing(false);
      }

      return;
    }

    setRefreshing(true);

    try {
      // Only the snapshot is on screen after a failed live load
      const outcome = definedSession(loaded.session)
        ? await refreshProfile(loaded)
        : await retryLoad(loaded);

      setFailingSince(undefined);
      sources.setActive((was) => observe(was, outcome.playing));

      if (outcome.status === "manifest-changed") {
        setStale(true);

        return;
      }

      if (outcome.result) {
        sources.setUpgraded(outcome.result);
      }

      setRefreshedAt(Date.now());
    } catch (e: unknown) {
      setFailingSince((was) => was ?? Date.now());

      throw e;
    } finally {
      setRefreshing(false);
    }
  };

  const refreshAll = async () => {
    if (
      sources.tab() === "history" ||
      Date.now() - sources.syncedAt() > OFFSCREEN_RUNS
    ) {
      // We don't need to block on grabbing runs
      void sources.syncNow();
    }

    await refresh();
  };

  const poller = startAutoRefresh({
    onRefresh: () =>
      refreshAll().catch((e: unknown) => console.warn("Refresh failed", e)),
    busy: sources.busy,
  });

  onCleanup(poller.stop);

  createEffect(
    on(
      sources.tab,
      (which) => {
        if (which === "history") {
          poller.now();
        }
      },
      { defer: true },
    ),
  );

  return {
    stale,
    refreshing,
    refreshedAt,
    failingSince,
    refreshAll,
    refreshSoon: () => poller.now(),
  };
};
