import type { DimItem, DimStat } from "app/inventory/item-types";
import { createMemo, createSignal, For, Show } from "solid-js";

import { recency } from "../core/items/arrivals.ts";
import { best, TOTAL } from "../core/items/compare.ts";
import { shortStat } from "../core/items/statNames.ts";
import { ItemDetails } from "./card/ItemDetails.tsx";
import { ItemHead } from "./card/ItemHead.tsx";
import { Moves } from "./card/Moves.tsx";
import { Benefits } from "./card/PerkDetails.tsx";
import { STAT_NAME, TOTAL_ROW } from "./card/Stats.tsx";
import { Checkbox } from "./lib/Checkbox.tsx";
import { Button } from "./lib/zaidan/button.tsx";
import { X } from "./lib/zaidan/icons.tsx";
import { NoteEditor, SharedNote } from "./NoteEditor.tsx";

interface Props {
  items: DimItem[];
  onUnpin?: (item: DimItem) => void;
  kept?: (item: DimItem) => boolean;
  onKeep?: (item: DimItem, keep: boolean) => void;
  minColumn?: string;
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

  const ages = (): (string | undefined)[] => {
    const [a, b] = props.items;

    if (!a || !b || props.items.length !== 2 || a.hash !== b.hash) {
      return props.items.map(() => undefined);
    }

    return recency(a) > recency(b) ? ["Newer", "Older"] : ["Older", "Newer"];
  };

  const columns = () =>
    `var(--compare-labels) repeat(${props.items.length}, minmax(${
      props.minColumn ?? "0"
    }, 1fr))`;

  // Row-placed sections need an explicit column
  const start = (column: number) =>
    compact() ? String(column + 2) : "1 / 3";

  return (
    <Show when={props.items.length > 0}>
      <aside class="item-tooltip w-full max-w-none overflow-auto p-4 [scrollbar-gutter:stable]">
        <div
          class="grid content-start items-center gap-x-2.5 gap-y-1"
          style={{ "grid-template-columns": columns() }}
        >
          <For each={props.items}>
            {(item, column) => (
              <div
                class="relative self-stretch pb-1.5"
                style={{ "grid-column": start(column()), "grid-row": "1" }}
              >
                <Show when={ages()[column()]}>
                  {(age) => (
                    <span class="absolute bottom-full left-0 pb-0.5 text-xs text-muted-foreground">
                      {age()}
                    </span>
                  )}
                </Show>
                <ItemHead item={item} compact taggable links />
                <Show when={props.onUnpin}>
                  {(onUnpin) => (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      class="absolute top-2 right-2 text-white/75 hover:bg-black/30 hover:text-white"
                      aria-label={`Unpin ${item.name}`}
                      onClick={() => onUnpin()(item)}
                    >
                      <X />
                    </Button>
                  )}
                </Show>
                <Show when={props.onKeep}>
                  {(onKeep) => (
                    <Checkbox
                      class="mt-2"
                      checked={props.kept?.(item) ?? false}
                      onChange={(checked) => onKeep()(item, checked)}
                    >
                      Keep this one
                    </Checkbox>
                  )}
                </Show>
              </div>
            )}
          </For>

          <For each={rows()}>
            {(row, index) => (
              <div
                class={STAT_NAME}
                classList={{ [TOTAL_ROW]: row.hash === TOTAL }}
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
                lead={<Moves compact={compact()} item={item} />}
                trail={
                  <>
                    <Benefits item={item} />
                    <div class="flex flex-col gap-3 pt-4">
                      <SharedNote item={item} />
                      <Show when={item.id !== "0"}>
                        <NoteEditor
                          target={{
                            kind: "instance",
                            targetId: item.id,
                            itemHash: item.hash,
                          }}
                        />
                      </Show>
                    </div>
                  </>
                }
              />
            )}
          </For>

        </div>
      </aside>
    </Show>
  );
};
