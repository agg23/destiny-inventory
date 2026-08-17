import type { DimItem } from "app/inventory/item-types";
import { createMemo, createResource, createSignal, For, Show } from "solid-js";

import { load } from "./load.ts";

const BUNGIE = "https://www.bungie.net";

const params = new URLSearchParams(location.search);
const MEMBERSHIP_TYPE = Number(params.get("type") ?? 3);
const MEMBERSHIP_ID = params.get("id") ?? "4611686018468466126";

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
  const [result] = createResource(() => load(MEMBERSHIP_TYPE, MEMBERSHIP_ID));

  const filtered = createMemo(() => {
    const items = result()?.items ?? [];
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
      <header>
        <input
          type="search"
          placeholder="Filter"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        <Show when={result()}>
          {(loaded) => (
            <div class="timings">
              {filtered().length} of {loaded().items.length} items ·{" "}
              {Math.round(loaded().timings.total)}ms total · transfer{" "}
              {Math.round(loaded().timings.transfer)}ms · read{" "}
              {Math.round(loaded().timings.read)}ms · defs{" "}
              {Math.round(loaded().timings.defs)}ms · build{" "}
              {Math.round(loaded().timings.items)}ms · {loaded().counts.fetched} defs fetched,{" "}
              {loaded().counts.cached} cached
            </div>
          )}
        </Show>
      </header>

      <Show when={result.error as Error | undefined}>
        {(error) => <p class="error">{error().message}</p>}
      </Show>

      <Show when={result.loading}>
        <p>Loading</p>
      </Show>

      <div class="grid">
        <For each={filtered()}>{(item) => <Tile item={item} />}</For>
      </div>
    </main>
  );
};
