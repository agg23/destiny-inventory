import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import {
  createEffect,
  createResource,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import { activeStore, NOBODY, observe, prefer, type Active } from "./active.ts";
import { beginLogin, signedIn, signOut } from "./auth.ts";
import { acquired } from "./arrivals.ts";
import { comparable } from "./compare.ts";
import { Arrivals } from "./Arrivals.tsx";
import { Compare } from "./Compare.tsx";
import { HoverCard } from "./HoverCard.tsx";
import { Inventory } from "./Inventory.tsx";
import { load, NotSignedIn, refreshProfile, type LoadResult } from "./load.ts";
import { moveItem, subscribeStores } from "./moves.ts";
import { plugIcons, warmIcons } from "./preload.ts";
import { startAutoRefresh } from "./refresh.ts";

const HOVER_DELAY = 120;
const PINS = 2;

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

  // Gate the fetcher on a token, since reading an errored resource rethrows
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

  // Reads what the header renders so a grown header remeasures
  createEffect(() => {
    current();
    failures();
    measureHead();
  });
  window.addEventListener("resize", measureHead);
  onCleanup(() => window.removeEventListener("resize", measureHead));

  const feed = () => acquired(stores());

  let warmed = false;

  // Perk icons come from a different host than the grid's, so a panel opened cold spends its
  // first moment blank. Warmed once the full definitions have landed, after first paint
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

  // Skipped items never rendered; degraded ones did, with something missing
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

  // The engine mutates its own stores, so after a move they outrank the load
  const stores = () => moved() ?? current()?.stores ?? [];

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

  // A third pin replaces the second, so the left stays a fixed reference
  const pin = (item: DimItem) =>
    setPinned((was) => {
      if (was.some((already) => already.id === item.id)) {
        return was.filter((already) => already.id !== item.id);
      }

      const [reference] = was;

      // Armor and a weapon share no stats, so a mismatched pick starts over instead
      if (reference && !comparable(reference, item)) {
        return [item];
      }

      if (was.length < PINS) {
        return [...was, item];
      }

      return [...was.slice(0, PINS - 1), item];
    });

  // Hovering while something is pinned is the same question the compare panel answers
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

    if (!target.closest(".item, .compare, [data-menu], header")) {
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
      // The engine hands back a new item object, so the pin has to follow it
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
            <Show when={authError()}>
              {(message) => <p class="error">{message()}</p>}
            </Show>
          </div>
        }
      >
        <header ref={(el) => (head = el)}>
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

        <div class="body">
          <Show when={current()}>
            {(loaded) => (
              <Inventory
                stores={stores()}
                buckets={loaded().buckets}
                matches={matches}
                active={activeStore(active(), stores())}
                pinned={pinned()}
                comparing={pinned().length > 1}
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
