import type { DimItem, DimStat } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { createMemo, For, Show } from "solid-js";

import { BUNGIE, Moves, Perks } from "./ItemPanel.tsx";

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

/**
 * Pinned items side by side. The stat labels are shared down one column so a row means the
 * same thing across both, which is the whole point: two loose cards make the eye hunt for the
 * matching line. Perks sit underneath per item, since there is nothing to align them by.
 */
export const Compare = (props: Props) => {
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
        name: stat.displayProperties.name,
        values: props.items.map(
          (item) => item.stats?.find((own) => own.statHash === stat.statHash),
        ),
      }));
  });

  const best = (row: Row) => {
    const numbers = row.values
      .filter((stat) => stat !== undefined)
      .map((stat) => stat.value);
    const top = Math.max(...numbers);

    return numbers.length > 1 && numbers.some((value) => value !== top)
      ? top
      : undefined;
  };

  const columns = () =>
    `minmax(0, 1fr) repeat(${props.items.length}, minmax(0, 1.2fr))`;

  return (
    <Show when={props.items.length > 0}>
      <aside class="compare" style={{ "grid-template-columns": columns() }}>
        <div />
        <For each={props.items}>
          {(item) => (
            <div class="compare-head">
              <img
                src={`${BUNGIE}${item.icon}`}
                alt=""
                width="40"
                height="40"
              />
              <div>
                <div class="name">{item.name}</div>
                <div class="meta">
                  {item.typeName}
                  <Show when={item.power > 0}> · {item.power}</Show>
                </div>
              </div>
              <button
                type="button"
                class="unpin"
                aria-label={`Unpin ${item.name}`}
                onClick={() => props.onUnpin(item)}
              >
                ✕
              </button>
            </div>
          )}
        </For>

        <div />
        <For each={props.items}>
          {(item) => (
            <Moves
              item={item}
              stores={props.stores}
              active={props.active}
              onMove={(target, equip) => props.onMove(item, target, equip)}
              onPrefer={props.onPrefer}
              moving={props.moving}
              moveError={props.moveError}
            />
          )}
        </For>

        <For each={rows()}>
          {(row) => (
            <>
              <div class="stat-name">{row.name}</div>
              <For each={row.values}>
                {(stat) => (
                  <div class="compare-stat">
                    <Show when={stat} fallback={<span class="dash">·</span>}>
                      {(own) => (
                        <>
                          <span
                            class="stat-value"
                            classList={{ best: own().value === best(row) }}
                          >
                            {own().value}
                          </span>
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

        <div class="stat-name">Perks</div>
        <For each={props.items}>
          {(item) => (
            <div class="compare-perks">
              <Perks item={item} />
            </div>
          )}
        </For>
      </aside>
    </Show>
  );
};
