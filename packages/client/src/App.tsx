import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { spaceLeftForItem } from "app/inventory/stores-helpers";
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
import { chrome } from "./chrome.tsx";
import { comparable } from "./compare.ts";
import { defs } from "./defs.ts";
import { messageOf } from "./error.ts";
import { HoverCard } from "./HoverCard.tsx";
import {
  storedRuns,
  syncHistory,
  syncTiers,
  timingsByHash,
  type HistoryRun,
} from "./history.ts";
import { load, NotSignedIn, refreshProfile, type LoadResult } from "./load.ts";
import { currentStores, moveItem, subscribeStores } from "./moves.ts";
import { plugIcons, warmIcons } from "./preload.ts";
import { clearPerk, previewedPerk } from "./perkPreview.ts";
import { PerkCard } from "./PerkCard.tsx";
import { clear, previewed } from "./preview.ts";
import { collapseRail, railCollapsed } from "./rail.ts";
import { startAutoRefresh } from "./refresh.ts";
import { useUrl } from "./router.ts";
import { SearchBar } from "./SearchBar.tsx";
import { itemFilter } from "./search.ts";
import { Settings } from "./Settings.tsx";
import { settings } from "./settings.ts";
import { showToast, Toasts } from "./toast.tsx";
import { Button } from "./ui/Button.tsx";
import { PanelGlyph } from "./ui/PanelGlyph.tsx";
import { RefreshGlyph } from "./ui/RefreshGlyph.tsx";
import { TabButton } from "./ui/TabButton.tsx";
import { tabHref, TABS, type Tab } from "./url.ts";

const PINS = 2;

const LABELS: Record<Tab, string> = {
  vault: "Vault",
  activities: "Activities",
  history: "History",
};

const SCOPES: Record<Tab, string> = {
  vault: "Filter items",
  activities: "Filter activities",
  history: "Filter runs",
};

export interface AppState {
  loaded: () => LoadResult | undefined;
  stores: () => DimStore[];
  active: () => DimStore | undefined;
  matches: (item: DimItem) => boolean;
  shown: () => number;
  query: () => string;
  pinned: () => DimItem[];
  awaitingPins: () => boolean;
  feed: () => DimItem[];
  moving: () => string | undefined;
  runs: () => HistoryRun[];
  syncing: () => boolean;
  syncError: () => string | undefined;
  timings: () => ReturnType<typeof timingsByHash>;
  onPin: (item: DimItem, additive?: boolean) => void;
  onUnpin: (item: DimItem) => void;
  onCompare: (item: DimItem, rival: DimItem) => void;
  onMove: (item: DimItem, target: DimStore, equip: boolean) => void;
  onCollect: (items: DimItem[], target: DimStore) => void;
  onCharacter: (store: DimStore) => void;
}

const AppContext = createContext<AppState>();

export const useApp = (): AppState => useContext(AppContext)!;

export const App = (props: { primed?: LoadResult; children?: JSX.Element }) => {
  const url = useUrl();
  const location = useLocation();
  const navigate = useNavigate();
  const [typed, setTyped] = createSignal(url.get("q"));
  const [previewQuery, setPreviewQuery] = createSignal<string | undefined>(
    undefined,
  );
  const [upgraded, setUpgraded] = createSignal<LoadResult | undefined>(
    undefined,
  );
  const [authError, setAuthError] = createSignal<string | undefined>(undefined);
  const [moved, setMoved] = createSignal<DimStore[] | undefined>(undefined);
  const [moving, setMoving] = createSignal<string | undefined>(undefined);
  const [stale, setStale] = createSignal(false);
  const [detail, setDetail] = createSignal(false);
  const [refreshing, setRefreshing] = createSignal(false);
  const [refreshedAt, setRefreshedAt] = createSignal<number | undefined>(
    undefined,
  );
  const [failingSince, setFailingSince] = createSignal<number | undefined>(
    undefined,
  );
  const character = () => url.get("character");
  const [active, setActive] = createSignal<Active>(
    character() === undefined ? NOBODY : prefer(NOBODY, character() ?? ""),
  );
  const [runs, setRuns] = createSignal<HistoryRun[]>([]);
  const [syncing, setSyncing] = createSignal(false);
  const [syncError, setSyncError] = createSignal<string | undefined>(undefined);
  const [liveFailed, setLiveFailed] = createSignal(false);
  const [expired, setExpired] = createSignal(false);

  const onLiveError = (e: unknown) => {
    if (e instanceof NotSignedIn) {
      setExpired(true);

      return;
    }

    setLiveFailed(true);
    showToast(messageOf(e), "danger");
  };

  // Reading an errored resource rethrows
  const [authed] = createSignal(signedIn());
  const [result] = createResource(
    () => authed() || undefined,
    () => load(setUpgraded, onLiveError, props.primed),
    { initialValue: props.primed },
  );

  let head: HTMLElement | undefined = undefined;

  // The slotted subtabs grow after their page's data lands
  onMount(() => {
    if (!head) {
      return;
    }

    const measure = () =>
      document.documentElement.style.setProperty(
        "--header-h",
        `${head?.offsetHeight ?? 0}px`,
      );

    measure();

    const observer = new ResizeObserver(measure);

    observer.observe(head);

    onCleanup(() => observer.disconnect());
  });

  createEffect(() =>
    document.documentElement.style.setProperty(
      "--tile",
      `${settings().tile}px`,
    ),
  );

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
  const needsSignIn = () =>
    !authed() || expired() || error() instanceof NotSignedIn;

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
      () => {
        clear();
        clearPerk();
      },
      { defer: true },
    ),
  );

  const shown = () =>
    stores().reduce(
      (total, store) => total + store.items.filter(matches).length,
      0,
    );

  // The engine mutates its own stores
  const stores = () => moved() ?? current()?.stores ?? [];

  // Only the vault runs the item filter, so a stale ?q= cannot skew the counts on another tab
  const vaultQuery = () => (tab() === "vault" ? typed() : "");

  const filter = createMemo(() =>
    itemFilter(previewQuery() ?? vaultQuery(), stores(), defs()),
  );

  const matches = (item: DimItem) => !!filter()(item);

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
      setSyncError(messageOf(e));
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

  const pin = (item: DimItem, additive = false) => {
    const was = pinned();
    const ids = was.map((one) => one.id);

    if (!additive) {
      url.push({
        pin: ids.length === 1 && ids[0] === item.id ? [] : [item.id],
      });

      return;
    }

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

  const unpin = (item: DimItem) => {
    url.push({ pin: url.get("pin").filter((id) => id !== item.id) });
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

  const clock = (at: number) => new Date(at).toLocaleTimeString();

  const refreshLabel = () => {
    const at = refreshedAt();

    return at === undefined ? "Refresh" : `Refresh · last at ${clock(at)}`;
  };

  const panelLabel = () =>
    railCollapsed() ? "Show side panel" : "Hide side panel";

  const refresh = async () => {
    const session = current()?.session;

    if (!session) {
      return;
    }

    setRefreshing(true);

    try {
      const outcome = await refreshProfile(session);

      setFailingSince(undefined);
      setActive((was) => observe(was, outcome.playing));

      if (outcome.status === "manifest-changed") {
        setStale(true);

        return;
      }

      setRefreshedAt(Date.now());
    } catch (e: unknown) {
      setFailingSince((was) => was ?? Date.now());

      throw e;
    } finally {
      setRefreshing(false);
    }
  };

  onCleanup(
    startAutoRefresh({
      onRefresh: () =>
        refresh().catch((e: unknown) => console.warn("Refresh failed", e)),
      busy: () => Boolean(moving()) || current()?.source === "cache",
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
    setMoving(`${equip ? "Equipping" : "Moving"} ${item.name}`);

    moveItem(item, target, equip)
      .catch((e: unknown) => showToast(messageOf(e), "danger"))
      .finally(() => setMoving(undefined));
  };

  // A full unique stack only takes what tops it off
  const pullAmount = (item: DimItem, target: DimStore): number => {
    if (!item.uniqueStack) {
      return item.amount;
    }

    const space = spaceLeftForItem(target, item, currentStores());

    return space > 0 ? Math.min(item.amount || 1, space) : item.amount;
  };

  const onCollect = (items: DimItem[], target: DimStore) => {
    if (moving() || items.length === 0) {
      return;
    }

    void (async () => {
      const errors = new Set<string>();
      let index = 0;

      for (const item of items) {
        index += 1;
        setMoving(`Collecting ${item.name} (${index} of ${items.length})`);

        try {
          await moveItem(item, target, false, pullAmount(item, target));
        } catch (e: unknown) {
          const message = messageOf(e);

          if (!errors.has(message)) {
            errors.add(message);
            showToast(message, "danger");
          }
        }
      }

      setMoving(undefined);
    })();
  };

  const state: AppState = {
    loaded: current,
    stores,
    active: () => activeStore(active(), stores()),
    matches,
    shown,
    query: typed,
    pinned,
    awaitingPins,
    feed,
    moving,
    runs,
    syncing,
    syncError,
    timings,
    onPin: pin,
    onUnpin: unpin,
    // The rival leads so the drop's column carries the deltas
    onCompare: (item, rival) => url.push({ pin: [rival.id, item.id] }),
    onMove,
    onCollect,
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
            <Button
              size="lg"
              onClick={() => {
                setAuthError(undefined);
                beginLogin().catch((e: unknown) => setAuthError(messageOf(e)));
              }}
            >
              Sign in with Bungie
            </Button>
            <Show when={authError()}>
              {(message) => <p class="pt-3 text-danger">{message()}</p>}
            </Show>
          </div>
        }
      >
        <header class="app-header" ref={(el) => (head = el)}>
          <div class="header-bar">
            <nav class="nav-tabs">
              <For each={TABS}>
                {(one) => (
                  <TabButton
                    active={tab() === one}
                    onClick={() => navigate(tabHref(one))}
                  >
                    {LABELS[one]}
                  </TabButton>
                )}
              </For>
            </nav>

            <Show
              when={tab() === "vault"}
              fallback={
                <input
                  class="text-input inline header-filter"
                  type="search"
                  placeholder={SCOPES[tab()]}
                  value={typed()}
                  onInput={(e) => onQuery(e.currentTarget.value)}
                />
              }
            >
              <SearchBar
                query={typed()}
                placeholder={SCOPES.vault}
                stores={stores()}
                onQuery={onQuery}
                onPreview={setPreviewQuery}
              />
            </Show>

            <div class="header-session">
              <Show when={stale()}>
                <Button
                  size="xs"
                  variant="light"
                  onClick={() => globalThis.location.reload()}
                >
                  New manifest - reload
                </Button>
              </Show>
              <button
                type="button"
                class="header-action"
                classList={{
                  busy:
                    refreshing() ||
                    (current()?.source === "cache" && !liveFailed()),
                }}
                title={refreshLabel()}
                aria-label={refreshLabel()}
                disabled={
                  Boolean(moving()) ||
                  refreshing() ||
                  current()?.source === "cache"
                }
                onClick={() =>
                  void refresh().catch((e: unknown) =>
                    showToast(messageOf(e), "danger"),
                  )
                }
              >
                <RefreshGlyph />
              </button>
              <Show when={tab() === "vault"}>
                <button
                  type="button"
                  class="header-action"
                  title={panelLabel()}
                  aria-label={panelLabel()}
                  onClick={() => collapseRail(!railCollapsed())}
                >
                  <PanelGlyph slashed={!railCollapsed()} />
                </button>
              </Show>
              <Settings />
              <span class="header-rule" aria-hidden="true" />
              <Button
                size="xs"
                variant="ghost"
                onClick={() => {
                  signOut();
                  globalThis.location.reload();
                }}
              >
                Sign out
              </Button>
            </div>
          </div>

          <div class="header-tools">
            <div class="header-tools-start">{chrome()?.tabs}</div>
            <div class="header-tools-end">{chrome()?.tools}</div>
          </div>

          <div class="header-status">
            {chrome()?.status}

            <Show when={syncing()}>
              <span>Syncing history…</span>
            </Show>

            <Show when={failures()}>
              {(groups) => (
                <For each={groups()}>
                  {(group) => (
                    <span class="text-warning">
                      {group.count} × {group.kind}: {group.reason}
                    </span>
                  )}
                </For>
              )}
            </Show>

            <Show when={failingSince()}>
              {(since) => (
                <span class="text-warning">
                  Refresh failing since {clock(since())}
                  <Show when={refreshedAt()}>
                    {(at) => <> · data from {clock(at())}</>}
                  </Show>
                </span>
              )}
            </Show>

            <Show when={syncError()}>
              {(message) => <span class="text-danger">{message()}</span>}
            </Show>

            <Show when={current()}>
              {(loaded) => (
                <>
                  <button
                    type="button"
                    class="status-toggle"
                    aria-expanded={detail()}
                    title="Load timings"
                    onClick={() => setDetail(!detail())}
                  >
                    {loaded().stores.length} stores · tier {loaded().tier}
                  </button>
                  <Show when={detail()}>
                    <span>
                      paint {Math.round(result()?.timings.total ?? 0)}ms ·
                      profile {Math.round(loaded().timings.profile)}ms · defs{" "}
                      {Math.round(loaded().timings.defs)}ms · build{" "}
                      {Math.round(loaded().timings.items)}ms
                      <Show when={upgraded()}>
                        {(done) => (
                          <> · complete {Math.round(done().timings.total)}ms</>
                        )}
                      </Show>
                    </span>
                  </Show>
                </>
              )}
            </Show>
          </div>
        </header>

        <Show when={error()}>
          {(e) => <p class="p-3 text-danger">{e().message}</p>}
        </Show>

        <Show when={result.loading && !current()}>
          <div class="loading">
            <span class="spinner" aria-hidden="true" />
            <p class="text-muted">Loading inventory</p>
          </div>
        </Show>

        <div class="body">
          <AppContext.Provider value={state}>
            {props.children}
          </AppContext.Provider>
        </div>

        <Show when={previewed()}>
          {(card) => (
            <HoverCard
              item={card().item}
              against={against()}
              verdict={card().verdict}
              cursorX={card().cursorX}
            />
          )}
        </Show>

        <Show when={previewedPerk()}>
          {(card) => <PerkCard item={card().item} plug={card().plug} />}
        </Show>
      </Show>

      <Toasts />
    </main>
  );
};
