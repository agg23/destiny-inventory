import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import { Activities } from "./Activities.tsx";
import { activeStore, NOBODY, observe, prefer, type Active } from "./active.ts";
import { activityTables } from "./activityTables.ts";
import { accessToken, beginLogin, signedIn, signOut } from "./auth.ts";
import { fetchCarnageReport } from "./bungie.ts";
import { acquired } from "./arrivals.ts";
import { comparable } from "./compare.ts";
import { Arrivals } from "./Arrivals.tsx";
import { Compare } from "./Compare.tsx";
import { History } from "./history/History.tsx";
import {
  storedRuns,
  syncHistory,
  syncTiers,
  timingsByHash,
  type HistoryRun,
} from "./history.ts";
import { HoverCard } from "./HoverCard.tsx";
import { Inventory } from "./Inventory.tsx";
import { load, NotSignedIn, refreshProfile, type LoadResult } from "./load.ts";
import { moveItem, subscribeStores } from "./moves.ts";
import { plugIcons, warmIcons } from "./preload.ts";
import { startAutoRefresh } from "./refresh.ts";

const HOVER_DELAY = 120;
const PINS = 2;

type Tab = "vault" | "activities" | "history";

const TABS: { id: Tab; label: string }[] = [
  { id: "vault", label: "Vault" },
  { id: "activities", label: "Activities" },
  { id: "history", label: "History" },
];

interface Hovered {
  item: DimItem;
  anchor: DOMRect;
}

export const App = () => {
  const [query, setQuery] = createSignal("");
  const [upgraded, setUpgraded] = createSignal<LoadResult | undefined>(
    undefined,
  );
  const [authError, setAuthError] = createSignal<string | undefined>(undefined);
  const [pinned, setPinned] = createSignal<DimItem[]>([]);
  const [hovered, setHovered] = createSignal<Hovered | undefined>(undefined);
  const [moved, setMoved] = createSignal<DimStore[] | undefined>(undefined);
  const [moving, setMoving] = createSignal<string | undefined>(undefined);
  const [moveError, setMoveError] = createSignal<string | undefined>(undefined);
  const [stale, setStale] = createSignal(false);
  const [refreshedAt, setRefreshedAt] = createSignal<number | undefined>(
    undefined,
  );
  const [active, setActive] = createSignal<Active>(NOBODY);
  const [tab, setTab] = createSignal<Tab>("vault");
  const [runs, setRuns] = createSignal<HistoryRun[]>([]);
  const [syncing, setSyncing] = createSignal(false);
  const [syncError, setSyncError] = createSignal<string | undefined>(undefined);

  // Reading an errored resource rethrows
  const [authed] = createSignal(signedIn());
  const [result] = createResource(
    () => authed() || undefined,
    () => load(setUpgraded),
  );

  let head: HTMLElement | undefined = undefined;

  const measureHead = () => {
    if (head) {
      document.documentElement.style.setProperty(
        "--header-h",
        `${head.offsetHeight}px`,
      );
    }
  };

  onMount(measureHead);

  createEffect(() => {
    current();
    failures();
    measureHead();
  });
  window.addEventListener("resize", measureHead);
  onCleanup(() => window.removeEventListener("resize", measureHead));

  const feed = () => acquired(stores());

  let warmed = false;

  // Perk icons come from a different host
  createEffect(() => {
    const loaded = current();

    if (warmed || !loaded || loaded.tier !== "detail") {
      return;
    }

    warmed = true;

    let stop: (() => void) | undefined = undefined;

    const idle = requestIdleCallback(() => {
      stop = warmIcons(plugIcons(loaded.items));
    });

    onCleanup(() => {
      cancelIdleCallback(idle);
      stop?.();
    });
  });

  createEffect(() => setActive((was) => observe(was, current()?.playing)));

  const error = () => result.error as Error | undefined;
  const current = () => (error() ? undefined : upgraded() ?? result());
  const needsSignIn = () => !authed() || error() instanceof NotSignedIn;

  const failures = () => {
    const loaded = current();
    const groups = [
      ...(loaded?.skipped ?? []).map((group) => ({
        ...group,
        kind: "skipped",
      })),
      ...(loaded?.degraded ?? []).map((group) => ({
        ...group,
        kind: "degraded",
      })),
    ];

    return groups.length > 0 ? groups : undefined;
  };

  const matches = (item: DimItem) => {
    const needle = query().trim().toLowerCase();

    return (
      !needle ||
      item.name.toLowerCase().includes(needle) ||
      item.typeName.toLowerCase().includes(needle)
    );
  };

  const shown = () =>
    stores().reduce(
      (total, store) => total + store.items.filter(matches).length,
      0,
    );

  // The engine mutates its own stores
  const stores = () => moved() ?? current()?.stores ?? [];

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
    setSyncing(true);

    try {
      setRuns(await storedRuns(session.store));

      const token = await accessToken();

      if (!token) {
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
      setSyncError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncing(false);
    }
  };

  let syncStarted = false;

  createEffect(() => {
    const loaded = current();

    if (syncStarted || !loaded || characterIds().length === 0) {
      return;
    }

    syncStarted = true;
    void syncRuns(loaded.session);
  });

  const timings = createMemo(() => timingsByHash(runs()));

  onCleanup(subscribeStores((next) => setMoved([...next])));

  let hoverTimer: number | undefined = undefined;

  const onHover = (item: DimItem, anchor: DOMRect) => {
    window.clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(
      () => setHovered({ item, anchor }),
      HOVER_DELAY,
    );
  };

  const onLeave = (item: DimItem) => {
    window.clearTimeout(hoverTimer);

    if (hovered()?.item.id === item.id) {
      setHovered(undefined);
    }
  };

  const pin = (item: DimItem) =>
    setPinned((was) => {
      if (was.some((already) => already.id === item.id)) {
        return was.filter((already) => already.id !== item.id);
      }

      const [reference] = was;

      if (reference && !comparable(reference, item)) {
        return [item];
      }

      if (was.length < PINS) {
        return [...was, item];
      }

      return [...was.slice(0, PINS - 1), item];
    });

  const against = () => {
    const [reference] = pinned();
    const item = hovered()?.item;

    if (!reference || !item || reference.id === item.id) {
      return undefined;
    }

    return comparable(reference, item) ? reference : undefined;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setPinned([]);
    }
  };

  const onBackground = (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    if (!target.closest(".item-tile, .rail, [data-menu], header")) {
      setPinned([]);
    }
  };

  window.addEventListener("keydown", onKeyDown);
  onCleanup(() => window.removeEventListener("keydown", onKeyDown));

  const refresh = async () => {
    const session = current()?.session;

    if (!session) {
      return;
    }

    const outcome = await refreshProfile(session);

    setActive((was) => observe(was, outcome.playing));

    if (outcome.status === "manifest-changed") {
      setStale(true);

      return;
    }

    setRefreshedAt(Date.now());
  };

  onCleanup(
    startAutoRefresh({
      onRefresh: () =>
        refresh().catch((e: unknown) => console.warn("Refresh failed", e)),
      busy: () => Boolean(moving()),
    }),
  );

  const onMove = (item: DimItem, target: DimStore, equip: boolean) => {
    setMoveError(undefined);
    setMoving(`${equip ? "Equipping" : "Moving"} ${item.name}`);

    moveItem(item, target, equip)
      // The engine hands back a new item object
      .then((result) =>
        setPinned((was) =>
          was.map((already) => (already.id === item.id ? result : already)),
        ),
      )
      .catch((e: unknown) =>
        setMoveError(e instanceof Error ? e.message : String(e)),
      )
      .finally(() => setMoving(undefined));
  };

  return (
    <main on:click={{ handleEvent: onBackground, capture: true }}>
      <Show
        when={!needsSignIn()}
        fallback={
          <div class="max-w-[420px] px-6 py-12">
            <h1 class="spaced-header">Vault</h1>
            <p>Sign in with your Bungie account to load your inventory.</p>
            <button
              class="button large"
              onClick={() => {
                setAuthError(undefined);
                beginLogin().catch((e: unknown) =>
                  setAuthError(e instanceof Error ? e.message : String(e)),
                );
              }}
            >
              Sign in with Bungie
            </button>
            <Show when={authError()}>
              {(message) => <p class="pt-3 text-danger">{message()}</p>}
            </Show>
          </div>
        }
      >
        <header ref={(el) => (head = el)}>
          <nav class="nav-tabs basis-full">
            <For each={TABS}>
              {(one) => (
                <button
                  type="button"
                  class="nav-tab"
                  classList={{ active: tab() === one.id }}
                  aria-pressed={tab() === one.id}
                  onClick={() => {
                    // The tile unmounts without a mouseleave
                    setHovered(undefined);
                    setTab(one.id);
                  }}
                >
                  {one.label}
                </button>
              )}
            </For>
          </nav>
          <div class="button-row basis-full">
            <input
              class="text-input inline"
              type="search"
              placeholder="Filter"
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
            />
            <button
              class="button small"
              disabled={Boolean(moving())}
              onClick={() => void refresh()}
            >
              Refresh
            </button>
            <button
              class="button small ghost"
              onClick={() => {
                signOut();
                location.reload();
              }}
            >
              Sign out
            </button>
            <Show when={stale()}>
              <span class="text-warning">New manifest available.</span>
              <button
                class="button small gold"
                onClick={() => location.reload()}
              >
                Reload
              </button>
            </Show>
          </div>
          <Show when={current()}>
            {(loaded) => (
              <div class="mt-2 text-sm tabular-nums text-dim">
                {shown()} of {loaded().items.length} items ·{" "}
                {loaded().stores.length} stores · tier {loaded().tier} · paint{" "}
                {Math.round(result()?.timings.total ?? 0)}ms · profile{" "}
                {Math.round(loaded().timings.profile)}ms · defs{" "}
                {Math.round(loaded().timings.defs)}ms · build{" "}
                {Math.round(loaded().timings.items)}ms
                <Show when={upgraded()}>
                  {(done) => (
                    <> · complete {Math.round(done().timings.total)}ms</>
                  )}
                </Show>
                <Show when={loaded().counts.hidden > 0}>
                  {" "}
                  · {loaded().counts.hidden} hidden
                </Show>
                <Show when={loaded().counts.skipped > 0}>
                  {" "}
                  · {loaded().counts.skipped} skipped
                </Show>
                <Show when={refreshedAt()}>
                  {(at) => (
                    <> · refreshed {new Date(at()).toLocaleTimeString()}</>
                  )}
                </Show>
              </div>
            )}
          </Show>
          <Show when={failures()}>
            {(groups) => (
              <div class="mt-1.5 text-sm tabular-nums text-warning">
                <For each={groups()}>
                  {(group) => (
                    <div>
                      {group.count} × {group.kind}: {group.reason}
                    </div>
                  )}
                </For>
              </div>
            )}
          </Show>
        </header>

        <Show when={error()}>
          {(e) => <p class="p-3 text-danger">{e().message}</p>}
        </Show>

        <Show when={result.loading}>
          <p class="p-3 text-muted">Loading</p>
        </Show>

        <Show
          when={tab() === "vault"}
          fallback={
            <div class="body solo">
              <Show
                when={tab() === "activities"}
                fallback={
                  <History
                    session={current()?.session}
                    runs={runs()}
                    syncing={syncing()}
                    syncError={syncError()}
                    query={query()}
                  />
                }
              >
                <Activities
                  activities={current()?.activities ?? {}}
                  variables={current()?.variables ?? {}}
                  character={activeStore(active(), stores())?.id}
                  power={activeStore(active(), stores())?.powerLevel}
                  timings={timings()}
                  query={query()}
                />
              </Show>
            </div>
          }
        >
          <div class="body">
            <Show when={current()}>
              {(loaded) => (
                <Inventory
                  stores={stores()}
                  buckets={loaded().buckets}
                  matches={matches}
                  active={activeStore(active(), stores())}
                  pinned={pinned()}
                  onSelectStore={(store) =>
                    setActive((was) => prefer(was, store.id))
                  }
                  onSelect={pin}
                  onHover={onHover}
                  onLeave={onLeave}
                />
              )}
            </Show>

            <aside class="rail" classList={{ comparing: pinned().length > 1 }}>
              <Show
                when={pinned().length > 0}
                fallback={
                  <Arrivals items={feed()} stores={stores()} onSelect={pin} />
                }
              >
                <Compare
                  items={pinned()}
                  stores={stores()}
                  active={activeStore(active(), stores())}
                  onMove={onMove}
                  onPrefer={(target) =>
                    setActive((was) => prefer(was, target.id))
                  }
                  onUnpin={pin}
                  moving={moving()}
                  moveError={moveError()}
                />
              </Show>
            </aside>
          </div>
        </Show>

        <Show when={hovered()}>
          {(card) => (
            <HoverCard
              item={card().item}
              against={against()}
              anchor={card().anchor}
            />
          )}
        </Show>
      </Show>
    </main>
  );
};
