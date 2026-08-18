import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { createEffect, createResource, createSignal, For, onCleanup, Show } from "solid-js";

import { activeStore, NOBODY, observe, prefer, type Active } from "./active.ts";
import { beginLogin, signedIn, signOut } from "./auth.ts";
import { Inventory } from "./Inventory.tsx";
import { ItemDetail } from "./ItemDetail.tsx";
import { load, NotSignedIn, refreshProfile, type LoadResult } from "./load.ts";
import { moveItem, subscribeStores } from "./moves.ts";
import { startAutoRefresh } from "./refresh.ts";

export const App = () => {
  const [query, setQuery] = createSignal("");
  const [upgraded, setUpgraded] = createSignal<LoadResult | undefined>(undefined);
  const [authError, setAuthError] = createSignal<string | undefined>(undefined);
  const [selected, setSelected] = createSignal<DimItem | undefined>(undefined);
  const [moved, setMoved] = createSignal<DimStore[] | undefined>(undefined);
  const [moving, setMoving] = createSignal<string | undefined>(undefined);
  const [moveError, setMoveError] = createSignal<string | undefined>(undefined);
  const [stale, setStale] = createSignal(false);
  const [refreshedAt, setRefreshedAt] = createSignal<number | undefined>(undefined);
  const [active, setActive] = createSignal<Active>(NOBODY);

  // Gate the fetcher on a token, since reading an errored resource rethrows
  const [authed] = createSignal(signedIn());
  const [result] = createResource(
    () => authed() || undefined,
    () => load(setUpgraded),
  );

  // The load reports who the game had in hand, the same as every refresh after it
  createEffect(() => setActive((was) => observe(was, current()?.playing)));

  const error = () => result.error as Error | undefined;
  const current = () => (error() ? undefined : (upgraded() ?? result()));
  const needsSignIn = () => !authed() || error() instanceof NotSignedIn;

  // Skipped items never rendered; degraded ones did, with something missing
  const failures = () => {
    const loaded = current();
    const groups = [
      ...(loaded?.skipped ?? []).map((group) => ({ ...group, kind: "skipped" })),
      ...(loaded?.degraded ?? []).map((group) => ({ ...group, kind: "degraded" })),
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

  const shown = () => stores().reduce((total, store) => total + store.items.filter(matches).length, 0);

  // The engine mutates its own state as it moves, so afterwards it is the truth, not the load
  const stores = () => moved() ?? current()?.stores ?? [];

  onCleanup(subscribeStores((next) => setMoved([...next])));

  // Refreshing rebuilds every store, so it has to wait for a move rather than race it
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
      onRefresh: () => refresh().catch((e: unknown) => console.warn("Refresh failed", e)),
      busy: () => Boolean(moving()),
    }),
  );

  const onMove = (item: DimItem, target: DimStore, equip: boolean) => {
    setMoveError(undefined);
    setMoving(`${equip ? "Equipping" : "Moving"} ${item.name}`);

    moveItem(item, target, equip)
      .then((result) => setSelected(result))
      // A failed move still moves things: the engine may have made space before it gave up
      .catch((e: unknown) => setMoveError(e instanceof Error ? e.message : String(e)))
      .finally(() => setMoving(undefined));
  };

  return (
    <main>
      <Show
        when={!needsSignIn()}
        fallback={
          <div class="signin">
            <h1>Vault</h1>
            <p>Sign in with your Bungie account to load your inventory.</p>
            <button
              onClick={() => {
                setAuthError(undefined);
                beginLogin().catch((e: unknown) =>
                  setAuthError(e instanceof Error ? e.message : String(e)),
                );
              }}
            >
              Sign in with Bungie
            </button>
            <Show when={authError()}>{(message) => <p class="error">{message()}</p>}</Show>
          </div>
        }
      >
        <header>
          <input
            type="search"
            placeholder="Filter"
            value={query()}
            onInput={(e) => setQuery(e.currentTarget.value)}
          />
          <button disabled={Boolean(moving())} onClick={() => void refresh()}>
            Refresh
          </button>
          <button
            onClick={() => {
              signOut();
              location.reload();
            }}
          >
            Sign out
          </button>
          <Show when={stale()}>
            <span class="banner">
              New manifest available.{" "}
              <button onClick={() => location.reload()}>Reload</button>
            </span>
          </Show>
          <Show when={current()}>
            {(loaded) => (
              <div class="timings">
                {shown()} of {loaded().items.length} items · {loaded().stores.length} stores · tier{" "}
                {loaded().tier} · paint {Math.round(result()?.timings.total ?? 0)}ms · profile{" "}
                {Math.round(loaded().timings.profile)}ms · defs{" "}
                {Math.round(loaded().timings.defs)}ms · build{" "}
                {Math.round(loaded().timings.items)}ms
                <Show when={upgraded()}>
                  {(done) => <> · complete {Math.round(done().timings.total)}ms</>}
                </Show>
                <Show when={loaded().counts.hidden > 0}> · {loaded().counts.hidden} hidden</Show>
                <Show when={loaded().counts.skipped > 0}> · {loaded().counts.skipped} skipped</Show>
                <Show when={refreshedAt()}>
                  {(at) => <> · refreshed {new Date(at()).toLocaleTimeString()}</>}
                </Show>
              </div>
            )}
          </Show>
          <Show when={failures()}>
            {(groups) => (
              <div class="skipped">
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

        <Show when={error()}>{(e) => <p class="error">{e().message}</p>}</Show>

        <Show when={result.loading}>
          <p class="error">Loading</p>
        </Show>

        <Show when={current()}>
          {(loaded) => (
            <Inventory
              stores={stores()}
              buckets={loaded().buckets}
              matches={matches}
              selected={selected()}
              onSelect={(item) => setSelected(selected()?.id === item.id ? undefined : item)}
            />
          )}
        </Show>

        <Show when={selected()}>
          {(item) => (
            <ItemDetail
              item={item()}
              stores={stores()}
              active={activeStore(active(), stores())}
              onPrefer={(target) => setActive((was) => prefer(was, target.id))}
              moving={moving()}
              moveError={moveError()}
              onMove={(target, equip) => onMove(item(), target, equip)}
              onClose={() => setSelected(undefined)}
            />
          )}
        </Show>
      </Show>
    </main>
  );
};
