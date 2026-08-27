import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { For, Show } from "solid-js";

import { verdictFor, type Verdict } from "./arrivals.ts";
import { ItemIcon } from "./ItemIcon.tsx";
import { typeName } from "./ItemPanel.tsx";
import { dismiss, preview } from "./preview.ts";

interface Props {
  items: DimItem[];
  stores: DimStore[];
  onSelect: (item: DimItem) => void;
  onCompare: (item: DimItem, rival: DimItem) => void;
}

const WORDING: Record<Verdict["kind"], string> = {
  only: "Only instance",
  better: "Better perks",
  equal: "About the same",
  worse: "Worse perks",
  mixed: "Different strengths",
};

const RollVerdict = (props: { item: DimItem; stores: DimStore[] }) => (
  <Show when={verdictFor(props.item, props.stores)}>
    {(verdict) => (
      <span
        classList={{
          "text-success": verdict().kind === "better",
          "text-danger": verdict().kind === "worse",
        }}
      >
        {WORDING[verdict().kind]}
      </span>
    )}
  </Show>
);

export const Arrivals = (props: Props) => (
  <div class="arrivals overflow-hidden p-3">
    <h2 class="section-label mb-2">Recently acquired</h2>
    <Show
      when={props.items.length > 0}
      fallback={<p class="text-muted">Nothing acquired yet.</p>}
    >
      <ul class="menu-list">
        <For each={props.items}>
          {(item) => (
            <li>
              <button
                type="button"
                class="menu-item w-full text-left"
                onClick={() => {
                  const rival = verdictFor(item, props.stores)?.rival;

                  if (rival) {
                    props.onCompare(item, rival);
                  } else {
                    props.onSelect(item);
                  }
                }}
                onMouseEnter={(event) =>
                  preview(
                    item,
                    event.currentTarget,
                    undefined,
                    verdictFor(item, props.stores),
                  )
                }
                onMouseLeave={() => dismiss(item)}
              >
                <ItemIcon item={item} />
                <span class="min-w-0 flex-1">
                  <span class="block truncate">{item.name}</span>
                  <span class="menu-item-note block truncate">
                    {typeName(item)}
                    <Show when={item.power > 0}> · {item.power}</Show>
                  </span>
                  <span class="menu-item-note block truncate">
                    <RollVerdict item={item} stores={props.stores} />
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
