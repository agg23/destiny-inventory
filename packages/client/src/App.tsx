import type { DimItem } from "app/inventory/item-types";
import { createMemo, createResource, createSignal, For, Show } from "solid-js";

import { beginLogin, signedIn, signOut } from "./auth.ts";
import { load, NotSignedIn, type LoadResult } from "./load.ts";

const BUNGIE = "https://www.bungie.net";

const Tile = (props: { item: DimItem }) => (
  <div class="tile">
    <img src={`${BUNGIE}${props.item.icon}`} loading="lazy" alt="" width="48" height="48" />
    <div class="label">
      <div class="name">{props.item.name}</div>
      <div class="meta">
        {props.item.typeName}
        <Show when={props.item.power}> · {props.item.power}</Show>
      </div>
    </div>
  </div>
);

export const App = () => {
  const [query, setQuery] = createSignal("");
  const [upgraded, setUpgraded] = createSignal<LoadResult | undefined>(undefined);
  const [authError, setAuthError] = createSignal<string | undefined>(undefined);

  // Gate the fetcher on a token, since reading an errored resource rethrows
  const [authed] = createSignal(signedIn());
  const [result] = createResource(
    () => authed() || undefined,
    () => load(setUpgraded),
  );

  const error = () => result.error as Error | undefined;

  const skipped = () => {
    const groups = current()?.skipped;

    return groups && groups.length > 0 ? groups : undefined;
  };
  const current = () => (error() ? undefined : (upgraded() ?? result()));
  const needsSignIn = () => !authed() || error() instanceof NotSignedIn;

  const filtered = createMemo(() => {
    const items = current()?.items ?? [];
    const needle = query().trim().toLowerCase();

    if (!needle) {
      return items;
    }

    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(needle) ||
        item.typeName.toLowerCase().includes(needle),
    );
  });

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
          <button
            onClick={() => {
              signOut();
              location.reload();
            }}
          >
            Sign out
          </button>
          <Show when={current()}>
            {(loaded) => (
              <div class="timings">
                {filtered().length} of {loaded().items.length} items · tier {loaded().tier} ·
                paint {Math.round(result()?.timings.total ?? 0)}ms · profile{" "}
                {Math.round(loaded().timings.profile)}ms · defs{" "}
                {Math.round(loaded().timings.defs)}ms · build{" "}
                {Math.round(loaded().timings.items)}ms
                <Show when={upgraded()}>
                  {(done) => <> · complete {Math.round(done().timings.total)}ms</>}
                </Show>
                <Show when={loaded().counts.hidden > 0}>
                  {" "}
                  · {loaded().counts.hidden} hidden
                </Show>
                <Show when={loaded().counts.skipped > 0}>
                  {" "}
                  · {loaded().counts.skipped} skipped
                </Show>
              </div>
            )}
          </Show>
          <Show when={skipped()}>
            {(groups) => (
              <div class="skipped">
                <For each={groups()}>
                  {(group) => (
                    <div>
                      {group.count} × {group.reason} (e.g. {group.examples.join(", ")})
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

        <div class="grid">
          <For each={filtered()}>{(item) => <Tile item={item} />}</For>
        </div>
      </Show>
    </main>
  );
};
