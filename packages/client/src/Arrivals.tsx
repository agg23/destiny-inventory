import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { For, Show } from "solid-js";

import { powerDelta } from "./arrivals.ts";
import { BUNGIE } from "./ItemPanel.tsx";

interface Props {
  items: DimItem[];
  stores: DimStore[];
  onSelect: (item: DimItem) => void;
}

const Delta = (props: { item: DimItem; stores: DimStore[] }) => (
  <Show when={powerDelta(props.item, props.stores)}>
    {(delta) => (
      <span classList={{ up: delta() > 0, down: delta() < 0 }}>
        {delta() > 0 ? "+" : ""}
        {delta()} vs best
      </span>
    )}
  </Show>
);

export const Arrivals = (props: Props) => (
  <div class="arrivals">
    <h2>Recently acquired</h2>
    <Show
      when={props.items.length > 0}
      fallback={
        <p class="meta">Nothing new. Everything here has been marked seen.</p>
      }
    >
      <For each={props.items}>
        {(item) => (
          <button
            type="button"
            class="arrival"
            onClick={() => props.onSelect(item)}
          >
            <img src={`${BUNGIE}${item.icon}`} alt="" width="32" height="32" />
            <div>
              <div class="name">{item.name}</div>
              <div class="meta">
                {item.typeName}
                <Show when={item.power > 0}> · {item.power}</Show>
              </div>
              <div class="meta">
                <Delta item={item} stores={props.stores} />
              </div>
            </div>
          </button>
        )}
      </For>
    </Show>
  </div>
);
