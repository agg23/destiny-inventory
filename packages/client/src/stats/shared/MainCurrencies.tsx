import type { DimItem } from "app/inventory/item-types";
import { For, Show } from "solid-js";

import { ItemTile } from "../../components/ItemTile.tsx";
import { Delta } from "./Delta.tsx";

export interface MainCurrency {
  itemHash: number;
  name: string;
  now: number;
  delta: number;
  item: DimItem | undefined;
}

/** The fixed currency row; picking one opens its graph */
export const MainCurrencies = (props: {
  currencies: MainCurrency[];
  selected: number | undefined;
  onPick: (itemHash: number) => void;
}) => (
  <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-5 min-[1720px]:grid-cols-10">
    <For each={props.currencies}>
      {(currency) => (
        <button
          type="button"
          class="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left ring-1 ring-foreground/10 hover:bg-accent"
          classList={{ "bg-accent": props.selected === currency.itemHash }}
          onClick={() => props.onPick(currency.itemHash)}
        >
          <span class="size-8 shrink-0">
            <Show when={currency.item}>
              {(item) => (
                <ItemTile item={item()} class="nested size-8" badges={false} />
              )}
            </Show>
          </span>
          <span class="flex min-w-0 flex-col">
            <span class="truncate text-xs text-muted-foreground">
              {currency.name}
            </span>
            <span class="flex items-baseline gap-1.5 tabular-nums">
              {currency.now.toLocaleString()}
              <Show when={currency.delta !== 0}>
                <Delta value={currency.delta} />
              </Show>
            </span>
          </span>
        </button>
      )}
    </For>
  </div>
);
