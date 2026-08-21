import type { DimItem, DimStat } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { createMemo, createSignal, For, Show } from "solid-js";

import { best, TOTAL } from "./compare.ts";
import {
  Archetype,
  Benefits,
  ItemHead,
  ItemPower,
  Moves,
  Perks,
  SetBonus,
  StatBar,
  StatValue,
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
  moveError: string | undefined;
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

  const columns = () =>
    `var(--compare-labels) repeat(${props.items.length}, minmax(0, 1fr))`;

  const start = (column: number) => {
    if (column > 0) {
      return "auto";
    }

    return compact() ? "2" : "1 / 3";
  };

  return (
    <Show when={props.items.length > 0}>
      <aside class="item-tooltip compare overflow-y-auto p-4 [scrollbar-gutter:stable]">
        <div
          class="stat-list compare-grid grid items-center content-start gap-1.5 gap-x-4"
          style={{ "grid-template-columns": columns() }}
        >
          <For each={props.items}>
            {(item, column) => (
              <div
                class="compare-head relative self-stretch pb-3"
                style={{ "grid-column": start(column()) }}
              >
                <ItemHead item={item} compact />
                <IconButton
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  place="absolute"
                  class="right-0 top-0"
                  label={`Unpin ${item.name}`}
                  onClick={() => props.onUnpin(item)}
                >
                  ✕
                </IconButton>
              </div>
            )}
          </For>

          <For each={props.items}>
            {(item, column) => (
              <div
                class="min-w-0 self-start"
                style={{ "grid-column": start(column()) }}
              >
                <Moves
                  compact={compact()}
                  item={item}
                  stores={props.stores}
                  active={props.active}
                  onMove={(target, equip) => props.onMove(item, target, equip)}
                  onPrefer={props.onPrefer}
                  moving={props.moving}
                  moveError={props.moveError}
                />
              </div>
            )}
          </For>

          <For each={props.items}>
            {(item, column) => (
              <div style={{ "grid-column": start(column()) }}>
                <ItemPower item={item} />
                <Archetype item={item} />
              </div>
            )}
          </For>

          <For each={rows()}>
            {(row) => (
              <>
                <div
                  class="stat-name"
                  classList={{ total: row.hash === TOTAL }}
                >
                  {row.name}
                </div>
                <For each={row.values}>
                  {(stat, column) => (
                    <div
                      class="compare-stat"
                      classList={{ total: row.hash === TOTAL }}
                    >
                      <Show when={stat} fallback={<span class="dash">·</span>}>
                        {(own) => (
                          <>
                            <StatBar stat={own()} />
                            <StatValue
                              stat={own()}
                              against={column() > 0 ? row.values[0] : undefined}
                              comparing={compact()}
                              best={own().value === best(row.values)}
                            />
                          </>
                        )}
                      </Show>
                    </div>
                  )}
                </For>
              </>
            )}
          </For>

          <For each={props.items}>
            {(item, column) => (
              <div
                class="min-w-0 self-start"
                style={{ "grid-column": start(column()) }}
              >
                <Perks
                  item={item}
                  all={allPerks()}
                  onToggleAll={() => setAllPerks((was) => !was)}
                />
              </div>
            )}
          </For>

          <For each={props.items}>
            {(item, column) => (
              <section
                class="min-w-0 self-start pt-6"
                style={{ "grid-column": start(column()) }}
              >
                <SetBonus item={item} />
                <Benefits item={item} />
              </section>
            )}
          </For>
        </div>
      </aside>
    </Show>
  );
};
