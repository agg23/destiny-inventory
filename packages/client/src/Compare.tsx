import type { DimItem, DimStat } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { createMemo, createSignal, For, Show } from "solid-js";

import { recency } from "./arrivals.ts";
import { best, TOTAL } from "./compare.ts";
import {
  Benefits,
  ItemDetails,
  ItemHead,
  Moves,
} from "./ItemPanel.tsx";
import { shortStat } from "./statNames.ts";
import { IconButton } from "./ui/Button.tsx";

interface Props {
  items: DimItem[];
  stores: DimStore[];
  active: DimStore | undefined;
  onMove: (item: DimItem, target: DimStore, equip: boolean) => void;
  onPrefer: (target: DimStore) => void;
  onUnpin: (item: DimItem) => void;
  moving: string | undefined;
}

interface Row {
  hash: number;
  name: string;
  values: (DimStat | undefined)[];
}

export const Compare = (props: Props) => {
  const [allPerks, setAllPerks] = createSignal(false);

  const rows = createMemo<Row[]>(() => {
    const order = new Map<number, DimStat>();

    for (const item of props.items) {
      for (const stat of item.stats ?? []) {
        if (!order.has(stat.statHash)) {
          order.set(stat.statHash, stat);
        }
      }
    }

    return [...order.values()]
      .sort((a, b) => a.sort - b.sort)
      .map((stat) => ({
        hash: stat.statHash,
        name: shortStat(stat.displayProperties.name),
        values: props.items.map(
          (item) => item.stats?.find((own) => own.statHash === stat.statHash),
        ),
      }));
  });

  const compact = () => props.items.length > 1;

  // Copies of the same weapon are otherwise indistinguishable in the heads
  const ages = (): (string | undefined)[] => {
    const [a, b] = props.items;

    if (!a || !b || props.items.length !== 2 || a.hash !== b.hash) {
      return props.items.map(() => undefined);
    }

    return recency(a) > recency(b) ? ["Newer", "Older"] : ["Older", "Newer"];
  };

  const columns = () =>
    `var(--compare-labels) repeat(${props.items.length}, minmax(0, 1fr))`;

  // Every section is placed by row, so the column has to be explicit too
  const start = (column: number) =>
    compact() ? String(column + 2) : "1 / 3";

  return (
    <Show when={props.items.length > 0}>
      <aside class="item-tooltip compare overflow-y-auto p-4 [scrollbar-gutter:stable]">
        <div
          class="stat-list compare-grid grid items-center content-start"
          style={{ "grid-template-columns": columns() }}
        >
          <For each={props.items}>
            {(item, column) => (
              <div
                class="compare-head relative self-stretch pb-1.5"
                style={{ "grid-column": start(column()), "grid-row": "1" }}
              >
                <Show when={ages()[column()]}>
                  {/* Lives in the panel's top padding, costing no height */}
                  {(age) => (
                    <span class="absolute bottom-full left-0 pb-0.5 text-xs uppercase tracking-caps text-dim">
                      {age()}
                    </span>
                  )}
                </Show>
                <ItemHead item={item} compact />
                <IconButton
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  place="absolute"
                  class="top-[10px] right-[10px] size-6 min-w-0 p-0"
                  label={`Unpin ${item.name}`}
                  onClick={() => props.onUnpin(item)}
                >
                  ✕
                </IconButton>
              </div>
            )}
          </For>

          <For each={rows()}>
            {(row, index) => (
              <div
                class="stat-name"
                classList={{ total: row.hash === TOTAL }}
                style={{ "grid-column": "1", "grid-row": String(4 + index()) }}
              >
                {row.name}
              </div>
            )}
          </For>

          <For each={props.items}>
            {(item, column) => (
              <ItemDetails
                item={item}
                allPerks={allPerks()}
                onToggleAllPerks={() => setAllPerks((was) => !was)}
                place={{
                  column: start(column()),
                  statColumn: String(column() + 2),
                  comparing: compact(),
                  stats: rows().map((row) => ({
                    hash: row.hash,
                    total: row.hash === TOTAL,
                    best: best(row.values),
                    against: column() > 0 ? row.values[0] : undefined,
                  })),
                }}
                lead={
                  <Moves
                    compact={compact()}
                    item={item}
                    stores={props.stores}
                    active={props.active}
                    onMove={(target, equip) => props.onMove(item, target, equip)}
                    onPrefer={props.onPrefer}
                    moving={props.moving}
                  />
                }
                trail={<Benefits item={item} />}
              />
            )}
          </For>

        </div>
      </aside>
    </Show>
  );
};
