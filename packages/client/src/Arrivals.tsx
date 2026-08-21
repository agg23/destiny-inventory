import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { For, Show } from "solid-js";

import { powerDelta } from "./arrivals.ts";
import { BUNGIE, typeName } from "./ItemPanel.tsx";
import { dismiss, preview } from "./preview.ts";

interface Props {
  items: DimItem[];
  stores: DimStore[];
  onSelect: (item: DimItem) => void;
}

const Delta = (props: { item: DimItem; stores: DimStore[] }) => (
  <Show when={powerDelta(props.item, props.stores)}>
    {(delta) => (
      <span
        classList={{ "text-success": delta() > 0, "text-danger": delta() < 0 }}
      >
        {delta() > 0 ? "+" : ""}
        {delta()} vs best
      </span>
    )}
  </Show>
);

export const Arrivals = (props: Props) => (
  <div class="arrivals overflow-hidden p-3">
    <h2 class="section-label mb-2">Recently acquired</h2>
    <Show
      when={props.items.length > 0}
      fallback={
        <p class="text-muted">
          Nothing new. Everything here has been marked seen.
        </p>
      }
    >
      <ul class="menu-list">
        <For each={props.items}>
          {(item) => (
            <li>
              <button
                type="button"
                class="menu-item w-full text-left"
                onClick={() => props.onSelect(item)}
                onMouseEnter={(event) =>
                  preview(item, event.currentTarget.getBoundingClientRect())
                }
                onMouseLeave={() => dismiss(item)}
              >
                <span class={`item-tile small ${item.rarity.toLowerCase()}`}>
                  <img src={`${BUNGIE}${item.icon}`} loading="lazy" alt="" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate">{item.name}</span>
                  <span class="menu-item-note block truncate">
                    {typeName(item)}
                    <Show when={item.power > 0}> · {item.power}</Show>
                  </span>
                  <span class="menu-item-note block">
                    <Delta item={item} stores={props.stores} />
                  </span>
                </span>
              </button>
            </li>
          )}
        </For>
      </ul>
    </Show>
  </div>
);
