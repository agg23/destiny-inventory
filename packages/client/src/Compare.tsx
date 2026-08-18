import type { DimItem, DimStat } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { createMemo, createSignal, For, Show } from "solid-js";

import { best, delta } from "./compare.ts";
import {
  Archetype,
  Benefits,
  BUNGIE,
  Moves,
  Perks,
  SetBonus,
  StatDelta,
  TOTAL,
  typeName,
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

// Stat labels are shared down one column, so a row means the same thing across both items
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

  // Two items halve the column, so the name takes the row above the icon rather than
  // sharing it
  const compact = () => props.items.length > 1;

  const columns = () =>
    `var(--compare-labels) repeat(${props.items.length}, minmax(0, 1fr))`;

  // Rows that belong to an item rather than to a stat start under that item. A lone item has
  // nothing to line up against, so it takes the label column too instead of leaving it empty
  const start = (column: number) => {
    if (column > 0) {
      return "auto";
    }

    return compact() ? "2" : "1 / 3";
  };

  return (
    <Show when={props.items.length > 0}>
      <aside class="compare">
        <div
          class="compare-grid"
          style={{ "grid-template-columns": columns() }}
        >
          <For each={props.items}>
            {(item, column) => (
              <div
                class="compare-head"
                style={{ "grid-column": start(column()) }}
              >
                <img
                  src={`${BUNGIE}${item.icon}`}
                  alt=""
                  width="40"
                  height="40"
                />
                <div>
                  <div class="name">{item.name}</div>
                  <div class="meta">
                    {typeName(item)}
                    <Show when={item.power > 0}> · {item.power}</Show>
                  </div>
                </div>
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
                class="moves-cell"
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
                            <span
                              class="stat-value"
                              classList={{
                                best: own().value === best(row.values),
                              }}
                            >
                              {own().value}
                            </span>
                            {/* The left item is the one the comparison is against, so it
                              carries no delta of its own */}
                            <Show when={column() > 0} fallback={<span />}>
                              <StatDelta delta={delta(own(), row.values[0])} />
                            </Show>
                            <Show when={own().bar} fallback={<span />}>
                              <span class="stat-bar">
                                <span
                                  style={{
                                    width: `${
                                      Math.min(
                                        1,
                                        Math.abs(own().value) /
                                          own().maximumValue,
                                      ) * 100
                                    }%`,
                                  }}
                                />
                              </span>
                            </Show>
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
                class="compare-perks"
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
                class="compare-detail"
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
