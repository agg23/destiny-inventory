import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { useLocation, useNavigate } from "@solidjs/router";
import {
  createContext,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  on,
  onCleanup,
  onMount,
  Show,
  useContext,
  type JSX,
} from "solid-js";

import { activeStore, NOBODY, observe, prefer, type Active } from "./active.ts";
import { activityTables } from "./activityTables.ts";
import { accessToken, beginLogin, signedIn, signOut } from "./auth.ts";
import { fetchCarnageReport } from "./bungie.ts";
import { acquired } from "./arrivals.ts";
import { comparable } from "./compare.ts";
import { HoverCard } from "./HoverCard.tsx";
import {
  storedRuns,
  syncHistory,
  syncTiers,
  timingsByHash,
  type HistoryRun,
} from "./history.ts";
import { load, NotSignedIn, refreshProfile, type LoadResult } from "./load.ts";
import { moveItem, subscribeStores } from "./moves.ts";
import { plugIcons, warmIcons } from "./preload.ts";
import { clear, previewed } from "./preview.ts";
import { startAutoRefresh } from "./refresh.ts";
import { useUrl } from "./router.ts";
import { tabHref, TABS, type Tab } from "./url.ts";

const PINS = 2;

const LABELS: Record<Tab, string> = {
  vault: "Vault",
  activities: "Activities",
  history: "History",
};

export interface AppState {
  loaded: () => LoadResult | undefined;
  stores: () => DimStore[];
  active: () => DimStore | undefined;
  matches: (item: DimItem) => boolean;
  query: () => string;
  pinned: () => DimItem[];
  awaitingPins: () => boolean;
  feed: () => DimItem[];
  moving: () => string | undefined;
  moveError: () => string | undefined;
  runs: () => HistoryRun[];
  syncing: () => boolean;
  syncError: () => string | undefined;
  timings: () => ReturnType<typeof timingsByHash>;
  onPin: (item: DimItem) => void;
  onMove: (item: DimItem, target: DimStore, equip: boolean) => void;
  onCharacter: (store: DimStore) => void;
}

const AppContext = createContext<AppState>();

export const useApp = (): AppState => useContext(AppContext)!;

export const App = (props: { children?: JSX.Element }) => {
  const url = useUrl();
  const location = useLocation();
  const navigate = useNavigate();
  const [typed, setTyped] = createSignal(url.get("q"));
  const [upgraded, setUpgraded] = createSignal<LoadResult | undefined>(
    undefined,
  );
  const [authError, setAuthError] = createSignal<string | undefined>(undefined);
  const [moved, setMoved] = createSignal<DimStore[] | undefined>(undefined);
  const [moving, setMoving] = createSignal<string | undefined>(undefined);
  const [moveError, setMoveError] = createSignal<string | undefined>(undefined);
  const [stale, setStale] = createSignal(false);
  const [refreshedAt, setRefreshedAt] = createSignal<number | undefined>(
    undefined,
  );
  const character = () => url.get("character");
  const [active, setActive] = createSignal<Active>(
    character() === undefined ? NOBODY : prefer(NOBODY, character() ?? ""),
  );
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

  createEffect(() => {
    const next = setActive((was) => observe(was, current()?.playing));

    if (next.override === undefined && character() !== undefined) {
      url.replace({ character: undefined });
    }
  });

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

  const tab = (): Tab =>
    TABS.find((one) => location.pathname.startsWith(`/${one}`)) ?? "vault";

  const onQuery = (value: string) => {
    setTyped(value);
    url.type({ q: value });
  };

  createEffect(
    on(
      () => url.get("q"),
      (fromUrl) => setTyped(fromUrl),
      { defer: true },
    ),
  );

  createEffect(
    on(
      character,
      (id) =>
        setActive((was) =>
          id === undefined ? { ...was, override: undefined } : prefer(was, id),
        ),
      { defer: true },
    ),
  );

  // Navigating away can unmount the hovered element without a mouseleave
  createEffect(
    on(
      () => `${location.pathname}${location.search}`,
      () => clear(),
      { defer: true },
    ),
  );

  const matches = (item: DimItem) => {
    const needle = typed().trim().toLowerCase();

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

  const pinned = createMemo(() => {
    const held = new Map(
      stores().flatMap((store) => store.items.map((one) => [one.id, one])),
    );

    return url.get("pin").flatMap((id) => {
      const found = held.get(id);

      return found === undefined ? [] : [found];
    });
  });

  // The profile may not have loaded these items yet
  const awaitingPins = () =>
    url.get("pin").length > 0 && pinned().length === 0 && !current();

  const pin = (item: DimItem) => {
    const was = pinned();
    const ids = was.map((one) => one.id);

    if (ids.includes(item.id)) {
      url.push({ pin: ids.filter((id) => id !== item.id) });

      return;
    }

    const [reference] = was;

    if (reference && !comparable(reference, item)) {
      url.push({ pin: [item.id] });

      return;
    }

    url.push({ pin: [...ids.slice(0, PINS - 1), item.id].slice(-PINS) });
  };

  const unpinAll = () => {
    if (url.get("pin").length > 0) {
      url.push({ pin: [] });
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      clear();
      unpinAll();
    }
  };

  const onBackground = (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    if (!target.closest(".item-tile, .rail, [data-menu], header")) {
      unpinAll();
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

  const against = () => {
    const [reference] = pinned();
    const item = previewed()?.item;

    if (!reference || !item || reference.id === item.id) {
      return undefined;
    }

    return comparable(reference, item) ? reference : undefined;
  };

  const onMove = (item: DimItem, target: DimStore, equip: boolean) => {
    setMoveError(undefined);
    setMoving(`${equip ? "Equipping" : "Moving"} ${item.name}`);

    moveItem(item, target, equip)
      .catch((e: unknown) =>
        setMoveError(e instanceof Error ? e.message : String(e)),
      )
      .finally(() => setMoving(undefined));
  };

  const state: AppState = {
    loaded: current,
    stores,
    active: () => activeStore(active(), stores()),
    matches,
    query: typed,
    pinned,
    awaitingPins,
    feed,
    moving,
    moveError,
    runs,
    syncing,
    syncError,
    timings,
    onPin: pin,
    onMove,
    onCharacter: (store) => url.push({ character: store.id }),
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
                  classList={{ active: tab() === one }}
                  aria-pressed={tab() === one}
                  onClick={() => navigate(tabHref(one, typed()))}
                >
                  {LABELS[one]}
                </button>
              )}
            </For>
          </nav>
          <div class="button-row basis-full">
            <input
              class="text-input inline"
              type="search"
              placeholder="Filter"
              value={typed()}
              onInput={(e) => onQuery(e.currentTarget.value)}
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
                globalThis.location.reload();
              }}
            >
              Sign out
            </button>
            <Show when={stale()}>
              <span class="text-warning">New manifest available.</span>
              <button
                class="button small gold"
                onClick={() => globalThis.location.reload()}
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

        <div class="body" classList={{ solo: tab() !== "vault" }}>
          <AppContext.Provider value={state}>
            {props.children}
          </AppContext.Provider>
        </div>

        <Show when={previewed()}>
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
