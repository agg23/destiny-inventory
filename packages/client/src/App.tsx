// @refresh reload
// Hot swapping App reruns load and keeps the old session alive
import type { DimStore } from "app/inventory/store-types";
import { useLocation, useNavigate } from "@solidjs/router";
import {
  createEffect,
  createSignal,
  on,
  onCleanup,
  Show,
  type JSX,
} from "solid-js";

import { GuestBanner } from "./components/header/GuestBanner.tsx";
import { Header } from "./components/header/Header.tsx";
import { HeaderActions } from "./components/header/HeaderActions.tsx";
import { HeaderSearch } from "./components/header/HeaderSearch.tsx";
import { HeaderStatus } from "./components/header/HeaderStatus.tsx";
import { PageNav } from "./components/header/PageNav.tsx";
import { HoverCards } from "./components/HoverCards.tsx";
import { Loading } from "./components/lib/Loading.tsx";
import { useNoteLeaveGuard } from "./components/NoteEditor.tsx";
import { SignIn } from "./components/SignIn.tsx";
import { TagConfirm } from "./components/TagConfirm.tsx";
import { Toasts } from "./components/Toasts.tsx";
import { createActiveCharacter } from "./core/app/activeCharacter.ts";
import { createEntrySearch } from "./core/app/entrySearch.ts";
import { createIconWarmup } from "./core/app/iconWarmup.ts";
import { createItemMoves } from "./core/app/itemMoves.ts";
import { createMatched } from "./core/app/matched.ts";
import { createProfileRefresh } from "./core/app/profileRefresh.ts";
import { createQuery } from "./core/app/query.ts";
import { createRuns } from "./core/app/runs.ts";
import { createSelection } from "./core/app/selection.ts";
import { createSession } from "./core/app/session.ts";
import { AppContext, type AppState } from "./core/app/state.ts";
import { messageOf } from "./core/error.ts";
import { acquired } from "./core/items/arrivals.ts";
import { syncNotes } from "./core/items/notes.ts";
import { clearPerk } from "./core/items/perkPreview.ts";
import { clear } from "./core/items/preview.ts";
import { syncTags } from "./core/items/tags.ts";
import { activeStore } from "./core/profile/active.ts";
import { defs } from "./core/profile/defs.ts";
import type { LoadResult } from "./core/profile/loadTypes.ts";
import { subscribeStores } from "./core/profile/moves.ts";
import { useUrl } from "./core/router.ts";
import { itemSearch } from "./core/search/search.ts";
import { settings } from "./core/settings.ts";
import { showToast } from "./core/toast.ts";
import { syncOrders } from "./core/todo/orders.ts";
import { tabHref, TABS, type Tab } from "./core/url.ts";
import { TrashWatch } from "./triage/shared/TrashWatch.tsx";

const RAILED: Tab[] = ["vault", "triage", "todo"];

export const App = (props: { primed?: LoadResult; children?: JSX.Element }) => {
  const url = useUrl();
  const location = useLocation();
  const navigate = useNavigate();
  const session = createSession(url, props.primed);
  const { active, setActive } = createActiveCharacter(url, session.current);
  const query = createQuery(url);

  useNoteLeaveGuard();

  createEffect(() => {
    if (session.authed()) {
      void syncTags();
      void syncNotes();
    }
  });

  createEffect(() =>
    document.documentElement.style.setProperty(
      "--tile",
      `${settings().tile}px`,
    ),
  );

  createEffect(() => {
    const loaded = session.current();

    if (loaded && !session.viewing()) {
      syncOrders(loaded.stores, loaded.orderRewards);
    }
  });

  createIconWarmup(session.current);

  const tab = (): Tab =>
    TABS.find((one) => location.pathname.startsWith(`/${one}`)) ?? "vault";

  // Vendors and orders need that account's own token
  createEffect(() => {
    if (session.viewing() && tab() === "todo") {
      navigate(tabHref("vault"), { replace: true });
    }
  });

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

  const [moved, setMoved] = createSignal<DimStore[] | undefined>(undefined);

  // The engine mutates its own stores, and it is never seeded with a guest
  const stores = () =>
    (session.viewing()
      ? session.current()?.stores
      : moved() ?? session.current()?.stores) ?? [];

  onCleanup(subscribeStores((next) => setMoved([...next])));

  const filtersItems = () => tab() === "vault" || tab() === "triage";

  const itemEngine = itemSearch(stores, defs);

  const entrySearch = createEntrySearch(session.current, stores, url, navigate);

  // Only item tabs run the item filter, so a stale ?q= cannot skew the counts on another tab
  const itemQuery = () => (filtersItems() ? query.typed() : "");
  const { matched, shown } = createMatched(
    stores,
    itemQuery,
    query.previewQuery,
  );

  const runs = createRuns(session.current, stores);
  const selection = createSelection(url, tab, stores, session.current);
  const moves = createItemMoves(session.viewing, () => refresh.refreshSoon());

  const refresh = createProfileRefresh({
    current: session.current,
    viewing: session.viewing,
    tab,
    busy: () =>
      Boolean(moves.moving()) ||
      Boolean(session.viewing()) ||
      session.awaitingLive(),
    refetchGuest: session.refetchGuest,
    setUpgraded: session.setUpgraded,
    setActive,
    syncNow: runs.syncNow,
    syncedAt: runs.syncedAt,
  });

  const state: AppState = {
    loaded: session.current,
    stores,
    active: () => activeStore(active(), stores()),
    playing: () => active().playing,
    matched,
    shown,
    query: query.typed,
    pinned: selection.pinned,
    selected: selection.selected,
    isSelected: (item) => selection.selectedSet().has(item.id),
    awaitingPins: selection.awaitingPins,
    feed: () => acquired(stores()),
    moving: moves.moving,
    runs: runs.runs,
    syncing: runs.syncing,
    syncError: runs.syncError,
    timings: runs.timings,
    onPin: selection.pin,
    onToggle: selection.toggle,
    onExtend: selection.extend,
    onSelectMany: selection.selectMany,
    onUnpin: selection.unpin,
    onClearSelection: selection.unpinAll,
    // The rival leads so the drop's column carries the deltas
    onCompare: (item, rival) => url.push({ pin: [rival.id, item.id] }),
    onMove: moves.onMove,
    onCollect: (items, target) =>
      void moves.moveMany(items, target, "Collecting"),
    onMoveMany: (items, target) => void moves.moveMany(items, target, "Moving"),
    onMoveAll: moves.moveMany,
    refresh: refresh.refreshAll,
    onCharacter: (store) => url.push({ character: store.id }),
    onQuery: query.onQuery,
  };

  return (
    <main on:click={{ handleEvent: selection.onBackground, capture: true }}>
      <Show when={!session.needsSignIn()} fallback={<SignIn />}>
        <Header>
          <Show when={session.viewing()}>
            <GuestBanner
              name={session.guestName()}
              onLeave={session.onLeave}
            />
          </Show>

          <div class="flex h-11 items-center gap-3 px-4">
            <PageNav tab={tab()} guest={!!session.viewing()} />

            <HeaderSearch
              url={url}
              tab={tab()}
              filtersItems={filtersItems()}
              query={query.typed()}
              loaded={session.current()}
              shown={shown()}
              engine={itemEngine}
              entries={entrySearch.entryMatches}
              onQuery={query.onQuery}
              onPreview={query.setPreviewQuery}
              onSet={entrySearch.openSet}
              onFocus={entrySearch.primeWeapons}
            />

            <HeaderStatus
              failingSince={refresh.failingSince()}
              refreshedAt={refresh.refreshedAt()}
              syncError={runs.syncError()}
              guestError={session.guestError()}
            />

            <HeaderActions
              stale={refresh.stale()}
              spinning={refresh.refreshing() || session.awaitingLive()}
              disabled={
                Boolean(moves.moving()) ||
                refresh.refreshing() ||
                session.awaitingLive()
              }
              refreshedAt={refresh.refreshedAt()}
              railed={RAILED.includes(tab())}
              onRefresh={() =>
                void refresh
                  .refreshAll()
                  .catch((e: unknown) => showToast(messageOf(e), "danger"))
              }
              onGuest={session.onGuest}
            />
          </div>
        </Header>

        <Show when={session.error()}>
          {(e) => <p class="p-4 text-destructive">{e().message}</p>}
        </Show>

        <Show when={session.loading() && !session.current()}>
          <Loading label="Loading inventory" />
        </Show>

        <div class="has-[[data-rail]:not([data-floating])]:mr-(--rail) has-[[data-rail][data-wide]:not([data-floating])]:mr-(--rail-compare)">
          <AppContext.Provider value={state}>
            <TrashWatch />
            {props.children}
          </AppContext.Provider>
        </div>

        <HoverCards
          pinned={selection.pinned()}
          records={session.current()?.records ?? {}}
        />
      </Show>

      <Toasts />
      <TagConfirm />
    </main>
  );
};
