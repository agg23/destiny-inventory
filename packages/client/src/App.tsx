import type { DimItem } from "app/inventory/item-types";
import { createResource, createSignal, For, Show } from "solid-js";

import { beginLogin, signedIn, signOut } from "./auth.ts";
import { Inventory } from "./Inventory.tsx";
import { ItemDetail } from "./ItemDetail.tsx";
import { load, NotSignedIn, type LoadResult } from "./load.ts";

export const App = () => {
  const [query, setQuery] = createSignal("");
  const [upgraded, setUpgraded] = createSignal<LoadResult | undefined>(undefined);
  const [authError, setAuthError] = createSignal<string | undefined>(undefined);
  const [selected, setSelected] = createSignal<DimItem | undefined>(undefined);

  // Gate the fetcher on a token, since reading an errored resource rethrows
  const [authed] = createSignal(signedIn());
  const [result] = createResource(
    () => authed() || undefined,
    () => load(setUpgraded),
  );

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

  const shown = () => current()?.items.filter(matches).length ?? 0;

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
              stores={loaded().stores}
              buckets={loaded().buckets}
              matches={matches}
              selected={selected()}
              onSelect={(item) => setSelected(selected()?.id === item.id ? undefined : item)}
            />
          )}
        </Show>

        <Show when={selected()}>
          {(item) => <ItemDetail item={item()} onClose={() => setSelected(undefined)} />}
        </Show>
      </Show>
    </main>
  );
};
