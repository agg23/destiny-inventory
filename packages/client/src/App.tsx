// @refresh reload
// Hot swapping App reruns load and keeps the old session alive
import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { spaceLeftForItem } from "app/inventory/stores-helpers";
import { A, useLocation, useNavigate } from "@solidjs/router";
import {
  createContext,
  createEffect,
  createMemo,
  createRenderEffect,
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
import { useNoteLeaveGuard } from "./NoteEditor.tsx";
import { syncNotes } from "./notes.ts";
import { syncTags } from "./tags.ts";
import { fetchCarnageReport, type Membership } from "./bungie.ts";
import { acquired } from "./arrivals.ts";
import {
  acquiredFor,
  catalystFor,
  catalystForItem,
  collections,
  copiesByKey,
  definedSession,
  ownershipOf,
  primeCollections,
  rankByName,
  type ArmorSet,
  type Entry,
  type EntryFacts,
} from "./collections.ts";
import { bySlot, setsOf } from "./collections/armorSets.ts";
import {
  collectionFilter,
  queryName,
  SEARCHES,
  setQuery,
} from "./collections/collectionSearch.ts";
import { comparable } from "./compare.ts";
import { defs } from "./defs.ts";
import { messageOf } from "./error.ts";
import {
  guestLabel,
  guestParam,
  readGuestParam,
  rememberedGuests,
  rememberGuest,
  sameMembership,
  setGuest,
  type Guest,
} from "./guest.ts";
import { GuestPicker } from "./GuestPicker.tsx";
import { HoverCard } from "./HoverCard.tsx";
import {
  guestHistory,
  storedRuns,
  syncHistory,
  syncTiers,
  timingsByHash,
  type HistoryRun,
} from "./history.ts";
import {
  load,
  loadGuest,
  NotSignedIn,
  refreshProfile,
  type LoadResult,
  type RefreshOutcome,
} from "./load.ts";
import { currentStores, moveItem, subscribeStores } from "./moves.ts";
import { vaultable } from "./moveTargets.ts";
import { syncOrders } from "./orders.ts";
import { plugIcons, tileIcons, warmIcons } from "./preload.ts";
import { clearPerk, previewedPerk } from "./perkPreview.ts";
import { PerkCard } from "./PerkCard.tsx";
import { clear, previewed } from "./preview.ts";
import { collapseRail, railCollapsed } from "./rail.ts";
import { startAutoRefresh } from "./refresh.ts";
import { useUrl } from "./router.ts";
import { SearchBar } from "./SearchBar.tsx";
import { itemFilter, itemSearch, primeSearch } from "./search.ts";
import { Settings } from "./Settings.tsx";
import { settings } from "./settings.ts";
import { showToast, Toasts } from "./toast.tsx";
import { TagConfirm } from "./TagConfirm.tsx";
import { TrashWatch } from "./triage/TrashWatch.tsx";
import { GuestGlyph } from "./ui/GuestGlyph.tsx";
import { Loading } from "./ui/Loading.tsx";
import { PanelGlyph } from "./ui/PanelGlyph.tsx";
import { RefreshGlyph } from "./ui/RefreshGlyph.tsx";
import { SearchField } from "./ui/SearchField.tsx";
import { SignOutGlyph } from "./ui/SignOutGlyph.tsx";
import { Button } from "./ui/zaidan/button.tsx";
import { Separator } from "./ui/zaidan/separator.tsx";
import {
  collectionsHref,
  entryHref,
  tabHref,
  TABS,
  type Kind,
  type Tab,
} from "./url.ts";

const PINS = 2;

const LABELS: Record<Tab, string> = {
  vault: "Vault",
  triage: "Triage",
  collections: "Collections",
  activities: "Activities",
  todo: "Todo",
  history: "History",
};

const KIND_SCOPES: Record<Kind, string> = {
  weapon: "Filter weapons",
  armor: "Filter armor",
};

const RAILED: Tab[] = ["vault", "triage", "todo"];

const PAGE_LINK = "inline-flex h-7 items-center rounded-md px-2.5";

const FILTER = "min-w-32 flex-1";

// Nova has no small Input; this is its 28px control size
const FILTER_INPUT = "h-7 py-0.5";

const SCOPES: Record<Tab, string> = {
  vault: "Filter items",
  triage: "Filter items",
  collections: "Filter weapons",
  activities: "Filter activities",
  todo: "Filter todos",
  history: "Filter runs",
};

/** The filtered items grouped the way the grid draws them, with the total across every store */
export interface Matched {
  byStore: Map<string, Map<number, DimItem[]>>;
  total: number;
}

// Most keystrokes narrow a query without changing what it matches. Don't do extra work
const sameMatched = (was: Matched, next: Matched): boolean => {
  if (was.total !== next.total || was.byStore.size !== next.byStore.size) {
    return false;
  }

  for (const [id, buckets] of next.byStore) {
    const before = was.byStore.get(id);

    if (before === undefined || before.size !== buckets.size) {
      return false;
    }

    for (const [hash, items] of buckets) {
      const held = before.get(hash);

      if (held === undefined || held.length !== items.length) {
        return false;
      }

      for (let at = 0; at < items.length; at += 1) {
        if (held[at] !== items[at]) {
          return false;
        }
      }
    }
  }

  return true;
};

export interface AppState {
  loaded: () => LoadResult | undefined;
  stores: () => DimStore[];
  active: () => DimStore | undefined;
  playing: () => string | undefined;
  matched: () => Matched;
  shown: () => number;
  query: () => string;
  pinned: () => DimItem[];
  selected: () => DimItem[];
  isSelected: (item: DimItem) => boolean;
  awaitingPins: () => boolean;
  feed: () => DimItem[];
  moving: () => string | undefined;
  runs: () => HistoryRun[];
  syncing: () => boolean;
  syncError: () => string | undefined;
  timings: () => ReturnType<typeof timingsByHash>;
  onPin: (item: DimItem) => void;
  onToggle: (item: DimItem) => void;
  onExtend: (item: DimItem, order: DimItem[]) => void;
  onSelectMany: (items: DimItem[]) => void;
  onUnpin: (item: DimItem) => void;
  onClearSelection: () => void;
  onCompare: (item: DimItem, rival: DimItem) => void;
  onMove: (item: DimItem, target: DimStore, equip: boolean) => void;
  onCollect: (items: DimItem[], target: DimStore) => void;
  onMoveMany: (items: DimItem[], target: DimStore) => void;
  /** Resolves with the items that moved */
  onMoveAll: (
    items: DimItem[],
    target: DimStore,
    verb: string,
    stop?: () => boolean,
  ) => Promise<DimItem[]>;
  refresh: () => Promise<void>;
  onCharacter: (store: DimStore) => void;
  onQuery: (query: string) => void;
}

const AppContext = createContext<AppState>();

export const useApp = (): AppState => useContext(AppContext)!;

// Keeps the last-run column from drifting while History is closed
const OFFSCREEN_RUNS = 2 * 60_000;

export const App = (props: { primed?: LoadResult; children?: JSX.Element }) => {
  const url = useUrl();
  const location = useLocation();
  const navigate = useNavigate();
  const [typed, setTyped] = createSignal(url.get("q"));
  const [weaponsAcquired, setWeaponsAcquired] = createSignal<
    Set<number> | undefined
  >(undefined);
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
  const [refreshing, setRefreshing] = createSignal(false);
  const [refreshedAt, setRefreshedAt] = createSignal<number | undefined>(
    undefined,
  );
  const [failingSince, setFailingSince] = createSignal<number | undefined>(
    undefined,
  );
  const character = () => url.get("character");
  const viewing = createMemo<Membership | undefined>((was) => {
    const next = readGuestParam(url.get("guest"));

    return sameMembership(was, next) ? was : next;
  });

  createRenderEffect(() => setGuest(viewing()));
  const [active, setActive] = createSignal<Active>(
    character() === undefined ? NOBODY : prefer(NOBODY, character() ?? ""),
  );
  const [runs, setRuns] = createSignal<HistoryRun[]>([]);
  let runsAt = 0;
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

  useNoteLeaveGuard();

  createEffect(() => {
    if (authed()) {
      void syncTags();
      void syncNotes();
    }
  });

  let head: HTMLElement | undefined = undefined;

  // The guest banner changes the header's height
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

  createEffect(() => {
    const who = current()?.session.guest;

    if (who) {
      rememberGuest(who);
    }
  });

  const onGuest = (who: Guest) => {
    rememberGuest(who);
    url.push({ guest: guestParam(who), character: undefined, pin: [] });
  };

  const onLeave = () => {
    url.push({ guest: undefined, character: undefined, pin: [] });
  };

  const guestName = () => {
    const who = viewing();

    if (!who) {
      return "";
    }

    const held = rememberedGuests().find((entry) => sameMembership(entry, who));

    if (held) {
      return guestLabel(held);
    }

    const loaded = current()?.session.guest;

    return loaded && sameMembership(loaded, who)
      ? guestLabel(loaded)
      : "Loading";
  };

  createEffect(() => {
    const loaded = current();

    if (loaded && !viewing()) {
      syncOrders(loaded.stores, loaded.orderRewards);
    }
  });

  let warmedTiles = false;

  createEffect(() => {
    const loaded = current();

    if (warmedTiles || !loaded) {
      return;
    }

    warmedTiles = true;

    const stop = warmIcons(tileIcons(loaded.items));

    onCleanup(stop);
  });

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

  createEffect(
    on(
      () => current()?.playing,
      (playing) => {
        const was = active();
        const next = observe(was, playing);
        setActive(next);

        if (was.override !== undefined && next.override === undefined) {
          url.replace({ character: undefined });
        }
      },
    ),
  );

  const error = () => result.error as Error | undefined;
  const owned = () => (error() ? undefined : upgraded() ?? result());

  const [guestResult, { refetch: refetchGuest }] = createResource(
    // A snapshot paint has no definitions to build a guest against
    () => (owned()?.session.support.size ? viewing() : undefined),
    (who) => loadGuest(owned()!, who),
  );

  const guestError = () => guestResult.error as Error | undefined;
  const current = () => (viewing() ? guestResult() : owned());
  const needsSignIn = () =>
    !authed() || expired() || error() instanceof NotSignedIn;

  const tab = (): Tab =>
    TABS.find((one) => location.pathname.startsWith(`/${one}`)) ?? "vault";

  // Vendors and orders need that account's own token
  createEffect(() => {
    if (viewing() && tab() === "todo") {
      navigate(tabHref("vault"), { replace: true });
    }
  });

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

  // The engine mutates its own stores, and it is never seeded with a guest
  const stores = () =>
    (viewing() ? current()?.stores : moved() ?? current()?.stores) ?? [];

  const filtersItems = () => tab() === "vault" || tab() === "triage";

  const itemEngine = itemSearch(stores, defs);

  const primeWeapons = () => {
    const session = definedSession(current()?.session);

    if (!session) {
      return;
    }

    primeCollections(session).catch((e: unknown) =>
      showToast(messageOf(e), "danger"),
    );
    acquiredFor(session)
      .then(setWeaponsAcquired)
      // Status terms just won't match
      .catch(() => undefined);
  };

  const entryMatches = (query: string): (Entry | ArmorSet)[] => {
    const built = collections();
    const name = queryName(query);

    if (!built || name.length < 2) {
      return [];
    }

    const copies = copiesByKey(stores());
    const records = current()?.records ?? {};
    const lastPlayedClass =
      stores().find((store) => store.current)?.classType ?? 0;
    const facts: EntryFacts = {
      ownership: (entry) =>
        ownershipOf(entry, copies.get(entry.key), weaponsAcquired()),
      catalyst: (entry) => catalystFor(entry, records),
    };
    const weaponTest = collectionFilter(built, "weapon", query, facts);
    const armorTest = collectionFilter(built, "armor", query, facts);
    const armor = built.armor.filter(armorTest);
    const playedSets = new Set(
      armor.flatMap((piece) =>
        piece.classType === lastPlayedClass && piece.setName !== undefined
          ? [piece.setName]
          : [],
      ),
    );

    const others = armor.filter(
      (piece) =>
        piece.classType !== lastPlayedClass &&
        (piece.setName === undefined || !playedSets.has(piece.setName)),
    );

    const ranked = [
      ...rankByName<Entry>(
        [
          ...built.weapons.filter(weaponTest),
          ...armor.filter((piece) => piece.classType === lastPlayedClass),
        ],
        name,
      ),
      ...rankByName<Entry>(others, name),
    ];
    const sets = setsOf(ranked);
    const collapsed = new Set<string>();

    return ranked.flatMap((entry): (Entry | ArmorSet)[] => {
      if (
        entry.kind !== "armor" ||
        entry.setKey === undefined ||
        entry.setName === undefined
      ) {
        return [entry];
      }

      const pieces = sets.get(entry.setKey) ?? [];

      if (pieces.length < 2) {
        return [entry];
      }

      if (collapsed.has(entry.setKey)) {
        return [];
      }

      collapsed.add(entry.setKey);

      return [
        {
          kind: "set",
          name: entry.setName,
          rarity: entry.rarity,
          icon: bySlot(pieces)[0]?.icon ?? entry.icon,
          classType: entry.classType,
        },
      ];
    });
  };

  const openSet = (set: ArmorSet) =>
    navigate(
      collectionsHref("/collections", {
        kind: "armor",
        layout: url.get("layout"),
        q: setQuery(set),
      }),
    );

  // Only item tabs run the item filter, so a stale ?q= cannot skew the counts on another tab
  const itemQuery = () => (filtersItems() ? typed() : "");

  createEffect(() => {
    const held = stores();
    const tables = defs();

    if (held.length > 0) {
      requestIdleCallback(() => primeSearch(held, tables));
    }
  });

  const filter = createMemo(() =>
    itemFilter(previewQuery() ?? itemQuery(), stores(), defs()),
  );

  const matched = createMemo<Matched>(
    () => {
      const test = filter();
      const byStore = new Map<string, Map<number, DimItem[]>>();
      let total = 0;

      for (const store of stores()) {
        const buckets = new Map<number, DimItem[]>();

        for (const item of store.items) {
          if (!test(item)) {
            continue;
          }

          const bucket = buckets.get(item.location.hash) ?? [];
          bucket.push(item);
          buckets.set(item.location.hash, bucket);

          if (vaultable(item)) {
            total += 1;
          }
        }

        byStore.set(store.id, buckets);
      }

      return { byStore, total };
    },
    { byStore: new Map(), total: 0 },
    { equals: sameMatched },
  );

  const shown = () => matched().total;

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

  onCleanup(subscribeStores((next) => setMoved([...next])));

  // Big selections stay out of the URL
  const [bulk, setBulk] = createSignal<string[]>([]);
  let anchor: string | undefined = undefined;

  createEffect(
    on(
      () => url.get("pin"),
      (ids) => {
        if (ids.length > 0) {
          setBulk([]);
        }
      },
      { defer: true },
    ),
  );

  // Tab links drop pins
  createEffect(on(tab, () => setBulk([]), { defer: true }));

  const selectedIds = createMemo(() =>
    bulk().length > 0 ? bulk() : url.get("pin"),
  );

  const selectedSet = createMemo(() => new Set(selectedIds()));

  const selected = createMemo(() => {
    const held = new Map(
      stores().flatMap((store) => store.items.map((one) => [one.id, one])),
    );

    return selectedIds().flatMap((id) => {
      const found = held.get(id);

      return found === undefined ? [] : [found];
    });
  });

  const pinned = createMemo(() => {
    const chosen = selected();
    const [first, second] = chosen;

    if (chosen.length === 1) {
      return chosen;
    }

    if (chosen.length === 2 && comparable(first!, second!)) {
      return chosen;
    }

    return [];
  });

  // The profile may not have loaded these items yet
  const awaitingPins = () =>
    url.get("pin").length > 0 && selected().length === 0 && !current();

  const select = (ids: string[]) => {
    if (ids.length > PINS) {
      setBulk(ids);

      if (url.get("pin").length > 0) {
        url.replace({ pin: [] });
      }

      return;
    }

    const was = url.get("pin");

    setBulk([]);

    if (was.length !== ids.length || was.some((id, at) => id !== ids[at])) {
      url.push({ pin: ids });
    }
  };

  const pin = (item: DimItem) => {
    const ids = selectedIds();

    anchor = item.id;
    select(ids.length === 1 && ids[0] === item.id ? [] : [item.id]);
  };

  // DIM gives every uninstanced item the id "0"
  const toggle = (item: DimItem) => {
    if (item.id === "0") {
      pin(item);

      return;
    }

    const ids = selectedIds();

    anchor = item.id;
    select(
      ids.includes(item.id)
        ? ids.filter((id) => id !== item.id)
        : [...ids, item.id],
    );
  };

  const extend = (item: DimItem, order: DimItem[]) => {
    const from = order.findIndex((one) => one.id === anchor);
    const to = order.findIndex((one) => one.id === item.id);

    if (from < 0 || to < 0 || item.id === "0") {
      toggle(item);

      return;
    }

    const ids = selectedIds();
    const span = order
      .slice(Math.min(from, to), Math.max(from, to) + 1)
      .map((one) => one.id)
      .filter((id) => id !== "0" && !ids.includes(id));

    select([...ids, ...span]);
  };

  const selectMany = (items: DimItem[]) => {
    anchor = undefined;
    select(items.flatMap((one) => (one.id === "0" ? [] : [one.id])));
  };

  const unpin = (item: DimItem) => {
    select(selectedIds().filter((id) => id !== item.id));
  };

  const unpinAll = () => {
    anchor = undefined;

    if (selectedIds().length > 0) {
      select([]);
    }
  };

  // Kobalte marks the Escape that closes a menu
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && !e.defaultPrevented) {
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

  const itemCount = () => {
    const loaded = current();

    if (!loaded || typed() === "") {
      return undefined;
    }

    const notes = [
      loaded.counts.hidden > 0 ? `${loaded.counts.hidden} hidden` : "",
      loaded.counts.skipped > 0 ? `${loaded.counts.skipped} skipped` : "",
    ].filter((note) => note !== "");

    return (
      <span title={notes.length > 0 ? notes.join(" · ") : undefined}>
        {shown()} of {loaded.items.filter(vaultable).length}
      </span>
    );
  };

  const panelLabel = () =>
    railCollapsed() ? "Show side panel" : "Hide side panel";

  const retryLoad = async (loaded: LoadResult): Promise<RefreshOutcome> => {
    const failure: { error?: unknown } = {};

    // A failed primed load hands the snapshot back instead of throwing
    const result = await load(
      setUpgraded,
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
    const loaded = current();

    if (!loaded) {
      return;
    }

    if (viewing()) {
      setRefreshing(true);

      try {
        await refetchGuest();
        setRefreshedAt(Date.now());
      } finally {
        setRefreshing(false);
      }

      return;
    }

    setRefreshing(true);

    try {
      // Only the snapshot is on screen after a failed live load
      const outcome =
        loaded.session.support.size === 0
          ? await retryLoad(loaded)
          : await refreshProfile(loaded);

      setFailingSince(undefined);
      setActive((was) => observe(was, outcome.playing));

      if (outcome.status === "manifest-changed") {
        setStale(true);

        return;
      }

      if (outcome.result) {
        setUpgraded(outcome.result);
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
    if (tab() === "history" || Date.now() - runsAt > OFFSCREEN_RUNS) {
      // We don't need to block on grabbing runs
      void syncNow();
    }

    await refresh();
  };

  const poller = startAutoRefresh({
    onRefresh: () =>
      refreshAll().catch((e: unknown) => console.warn("Refresh failed", e)),
    busy: () =>
      Boolean(moving()) ||
      Boolean(viewing()) ||
      (current()?.source === "cache" && !liveFailed()),
  });

  onCleanup(poller.stop);

  createEffect(
    on(
      tab,
      (which) => {
        if (which === "history") {
          poller.now();
        }
      },
      { defer: true },
    ),
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
    if (viewing()) {
      return;
    }

    setMoving(`${equip ? "Equipping" : "Moving"} ${item.name}`);

    moveItem(item, target, equip)
      .catch((e: unknown) => showToast(messageOf(e), "danger"))
      .finally(() => {
        setMoving(undefined);
        poller.now();
      });
  };

  // A full unique stack only takes what tops it off
  const pullAmount = (item: DimItem, target: DimStore): number => {
    if (!item.uniqueStack) {
      return item.amount;
    }

    const space = spaceLeftForItem(target, item, currentStores());

    return space > 0 ? Math.min(item.amount || 1, space) : item.amount;
  };

  const moveMany = async (
    items: DimItem[],
    target: DimStore,
    verb: string,
    stop?: () => boolean,
  ): Promise<DimItem[]> => {
    if (viewing() || moving() || items.length === 0) {
      return [];
    }

    const errors = new Set<string>();
    const moved: DimItem[] = [];
    let index = 0;

    for (const item of items) {
      if (stop?.()) {
        break;
      }

      index += 1;
      setMoving(`${verb} ${item.name} (${index} of ${items.length})`);

      try {
        await moveItem(item, target, false, pullAmount(item, target));
        moved.push(item);
      } catch (e: unknown) {
        const message = messageOf(e);

        if (!errors.has(message)) {
          errors.add(message);
          showToast(message, "danger");
        }
      }
    }

    setMoving(undefined);
    poller.now();

    return moved;
  };

  const state: AppState = {
    loaded: current,
    stores,
    active: () => activeStore(active(), stores()),
    playing: () => active().playing,
    matched,
    shown,
    query: typed,
    pinned,
    selected,
    isSelected: (item) => selectedSet().has(item.id),
    awaitingPins,
    feed,
    moving,
    runs,
    syncing,
    syncError,
    timings,
    onPin: pin,
    onToggle: toggle,
    onExtend: extend,
    onSelectMany: selectMany,
    onUnpin: unpin,
    onClearSelection: unpinAll,
    // The rival leads so the drop's column carries the deltas
    onCompare: (item, rival) => url.push({ pin: [rival.id, item.id] }),
    onMove,
    onCollect: (items, target) => void moveMany(items, target, "Collecting"),
    onMoveMany: (items, target) => void moveMany(items, target, "Moving"),
    onMoveAll: moveMany,
    refresh: refreshAll,
    onCharacter: (store) => url.push({ character: store.id }),
    onQuery,
  };

  return (
    <main on:click={{ handleEvent: onBackground, capture: true }}>
      <Show
        when={!needsSignIn()}
        fallback={
          <div class="flex max-w-[420px] flex-col items-start gap-3 px-6 py-12">
            <h1 class="text-2xl font-semibold">Vault</h1>
            <p class="text-muted-foreground">
              Sign in with your Bungie account to load your inventory.
            </p>
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
              {(message) => <p class="text-destructive">{message()}</p>}
            </Show>
          </div>
        }
      >
        <header
          class="sticky top-0 z-5 border-b bg-background"
          ref={(el) => (head = el)}
        >
          <Show when={viewing()}>
            <div class="flex h-10 items-center gap-3 border-b border-warning/40 bg-warning/15 px-4 text-warning">
              <span class="size-4.5">
                <GuestGlyph />
              </span>
              <span class="font-medium">{guestName()}</span>
              <span class="mr-auto text-warning/70">Read only</span>
              <Button
                size="sm"
                variant="outline"
                class="border-warning/40 text-warning hover:bg-warning/15 hover:text-warning"
                onClick={onLeave}
              >
                Leave
              </Button>
            </div>
          </Show>

          <div class="flex h-11 items-center gap-3 px-4">
            <nav class="flex shrink-0 items-center gap-1">
              <For each={TABS}>
                {(one) => (
                  <Show
                    when={one !== "todo" || !viewing()}
                    fallback={
                      <span
                        class={`${PAGE_LINK} cursor-default text-muted-foreground opacity-50`}
                        aria-disabled="true"
                      >
                        {LABELS[one]}
                      </span>
                    }
                  >
                    <A
                      href={tabHref(one)}
                      class={PAGE_LINK}
                      classList={{
                        "bg-muted text-foreground": tab() === one,
                        "text-muted-foreground hover:bg-muted/60 hover:text-foreground":
                          tab() !== one,
                      }}
                    >
                      {LABELS[one]}
                    </A>
                  </Show>
                )}
              </For>
            </nav>

            <Show
              when={filtersItems()}
              fallback={
                <Show
                  when={tab() === "collections"}
                  fallback={
                    <SearchField
                      wrapper={FILTER}
                      class={FILTER_INPUT}
                      placeholder={SCOPES[tab()]}
                      value={typed()}
                      onInput={(e) => onQuery(e.currentTarget.value)}
                      onClear={() => onQuery("")}
                    />
                  }
                >
                  <SearchBar
                    class={FILTER}
                    inputClass={FILTER_INPUT}
                    query={typed()}
                    placeholder={KIND_SCOPES[url.get("kind")]}
                    engine={SEARCHES[url.get("kind")]}
                    onQuery={onQuery}
                    entries={entryMatches}
                    onEntry={(entry) =>
                      entry.kind === "set"
                        ? openSet(entry)
                        : navigate(
                            entryHref(entry.newestItemHash, {
                              kind: entry.kind,
                              by: url.get("by"),
                              layout: url.get("layout"),
                              q: typed(),
                            }),
                          )
                    }
                    onSubmit={(query) => {
                      if (location.pathname.startsWith("/collections/")) {
                        navigate(
                          collectionsHref("/collections", {
                            kind: url.get("kind"),
                            by: url.get("by"),
                            layout: url.get("layout"),
                            q: query,
                          }),
                        );
                      }
                    }}
                    onFocus={primeWeapons}
                  />
                </Show>
              }
            >
              <SearchBar
                class={FILTER}
                inputClass={FILTER_INPUT}
                query={typed()}
                placeholder={SCOPES.vault}
                engine={itemEngine}
                trailing={itemCount()}
                onQuery={onQuery}
                onPreview={setPreviewQuery}
                entries={entryMatches}
                onEntry={(entry) =>
                  entry.kind === "set"
                    ? openSet(entry)
                    : navigate(
                        entryHref(entry.newestItemHash, { kind: entry.kind }),
                      )
                }
                onFocus={primeWeapons}
              />
            </Show>

            <Show
              when={
                failingSince() !== undefined ||
                syncError() !== undefined ||
                guestError() !== undefined
              }
            >
              <span class="flex min-w-0 shrink items-center gap-3 truncate">
                <Show when={failingSince()}>
                  {(since) => (
                    <span class="truncate text-warning">
                      Refresh failing since {clock(since())}
                      <Show when={refreshedAt()}>
                        {(at) => <> · data from {clock(at())}</>}
                      </Show>
                    </span>
                  )}
                </Show>

                <Show when={syncError()}>
                  {(message) => (
                    <span class="truncate text-destructive" title={message()}>
                      {message()}
                    </span>
                  )}
                </Show>

                <Show when={guestError()}>
                  {(e) => (
                    <span class="truncate text-destructive" title={e().message}>
                      {e().message}
                    </span>
                  )}
                </Show>
              </span>
            </Show>

            <div class="flex shrink-0 items-center gap-1 text-muted-foreground">
              <Show when={stale()}>
                <Button
                  size="sm"
                  variant="outline"
                  class="mr-2"
                  onClick={() => globalThis.location.reload()}
                >
                  New manifest - reload
                </Button>
              </Show>
              <Button
                variant="ghost"
                size="icon-sm"
                classList={{
                  "[&_svg]:animate-spin":
                    refreshing() ||
                    (current()?.source === "cache" && !liveFailed()),
                }}
                title={refreshLabel()}
                aria-label={refreshLabel()}
                disabled={
                  Boolean(moving()) ||
                  refreshing() ||
                  (current()?.source === "cache" && !liveFailed())
                }
                onClick={() =>
                  void refreshAll().catch((e: unknown) =>
                    showToast(messageOf(e), "danger"),
                  )
                }
              >
                <RefreshGlyph />
              </Button>
              <Show when={RAILED.includes(tab())}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={panelLabel()}
                  aria-label={panelLabel()}
                  onClick={() => collapseRail(!railCollapsed())}
                >
                  <PanelGlyph slashed={!railCollapsed()} />
                </Button>
              </Show>
              <GuestPicker onChoose={onGuest} />
              <Settings />
              <Separator orientation="vertical" class="mx-1 h-4" />
              <Button
                variant="ghost"
                size="icon-sm"
                title="Sign out"
                aria-label="Sign out"
                onClick={() => {
                  signOut();
                  globalThis.location.reload();
                }}
              >
                <SignOutGlyph />
              </Button>
            </div>
          </div>
        </header>

        <Show when={error()}>
          {(e) => <p class="p-4 text-destructive">{e().message}</p>}
        </Show>

        <Show when={(result.loading || guestResult.loading) && !current()}>
          <Loading label="Loading inventory" />
        </Show>

        <div class="has-[[data-rail]:not([data-floating])]:mr-(--rail) has-[[data-rail][data-wide]:not([data-floating])]:mr-(--rail-compare)">
          <AppContext.Provider value={state}>
            <TrashWatch app={state} />
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
              rollWarning={card().rollWarning}
              notes={card().notes}
              cost={card().cost}
              catalyst={catalystForItem(
                card().item.hash,
                current()?.records ?? {},
              )}
            />
          )}
        </Show>

        <Show when={previewedPerk()}>
          {(card) => (
            <PerkCard
              item={card().item}
              plug={card().plug}
              beside={card().beside}
            />
          )}
        </Show>
      </Show>

      <Toasts />
      <TagConfirm />
    </main>
  );
};
