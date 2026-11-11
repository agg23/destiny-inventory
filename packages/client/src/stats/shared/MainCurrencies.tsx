import type { DimItem } from "app/inventory/item-types";
import { For, Show } from "solid-js";

import { ItemTile } from "../../components/ItemTile.tsx";
import { Tile } from "../../components/Tile.tsx";
import { Delta } from "./Delta.tsx";

export interface MainCurrency {
  key: string;
  name: string;
  value: string;
  delta: number;
  item: DimItem | undefined;
  icon?: string;
  selected: boolean;
  onPick: () => void;
}

/** A currency's item tile, or a bare icon tile when no item is shipped */
export const CurrencyIcon = (props: {
  name: string;
  item: DimItem | undefined;
  icon: string | undefined;
  class: string;
}) => (
  <Show
    when={props.item}
    fallback={
      <Show when={props.icon}>
        {(icon) => (
          <Tile
            name={props.name}
            icon={icon()}
            overlay={undefined}
            rarity="Currency"
            classes={[props.class]}
            gearTier={0}
            corner={undefined}
            tagColor={undefined}
            favorite={false}
            icons={[]}
            tiers={() => undefined}
            badges={false}
          />
        )}
      </Show>
    }
  >
    {(item) => <ItemTile item={item()} class={props.class} badges={false} />}
  </Show>
);

/** The fixed currency row; picking one opens its graph */
export const MainCurrencies = (props: { currencies: MainCurrency[] }) => (
  <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 min-[145rem]:grid-cols-12">
    <For each={props.currencies}>
      {(currency) => (
        <button
          type="button"
          class="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left ring-1 ring-foreground/10 hover:bg-accent"
          classList={{ "bg-accent": currency.selected }}
          onClick={() => currency.onPick()}
        >
          <span class="size-8 shrink-0">
            <CurrencyIcon
              name={currency.name}
              item={currency.item}
              icon={currency.icon}
              class="nested size-8"
            />
          </span>
          <span class="flex min-w-0 flex-col">
            <span class="truncate text-xs text-muted-foreground">
              {currency.name}
            </span>
            <span class="flex flex-wrap items-baseline gap-x-1.5 tabular-nums">
              {currency.value}
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
