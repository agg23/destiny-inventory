import type { DimItem } from "app/inventory/item-types";
import { createMemo, For, Show } from "solid-js";

import { ItemMenu } from "../../components/ItemMenu.tsx";
import { ItemTile } from "../../components/ItemTile.tsx";
import { HEADING, LABEL, TILE_GRID } from "../../components/lib/text.ts";
import { Button } from "../../components/lib/zaidan/button.tsx";
import { useApp } from "../../core/app/state.ts";
import { CATEGORIES } from "./triage.ts";
import type { Selection } from "./triageSelection.ts";

interface Slot {
  hash: number;
  name: string;
  items: DimItem[];
}

interface Group {
  category: string;
  slots: Slot[];
}

interface Props {
  items: DimItem[];
  pool: DimItem[];
  selection: Selection;
  onTag: (item: DimItem, tagId: string | undefined) => void;
}

export const TriageFeed = (props: Props) => {
  const app = useApp();

  const grouped = createMemo<Group[]>(() => {
    const byBucket = new Map<number, DimItem[]>();

    for (const item of props.items) {
      const held = byBucket.get(item.bucket.hash);

      if (held) {
        held.push(item);
        continue;
      }

      byBucket.set(item.bucket.hash, [item]);
    }

    const table = app.loaded()?.buckets;
    const groups: Group[] = [];

    for (const category of CATEGORIES) {
      const slots: Slot[] = [];

      for (const bucket of table?.byCategory[category] ?? []) {
        const items = byBucket.get(bucket.hash);

        if (!items) {
          continue;
        }

        slots.push({ hash: bucket.hash, name: bucket.name, items });
      }

      if (slots.length > 0) {
        groups.push({ category, slots });
      }
    }

    return groups;
  });

  // Shift ranges use display order
  const ordered = createMemo(() =>
    grouped().flatMap((group) => group.slots.flatMap((slot) => slot.items)),
  );

  return (
    <ItemMenu
      find={(index) => props.pool.find((one) => one.index === index)}
      onTag={props.onTag}
    >
      <div class="px-4 pb-4">
        <Show
          when={grouped().length > 0}
          fallback={
            <p class="py-3 text-muted-foreground">
              Nothing left to triage under this filter.
            </p>
          }
        >
          <For each={grouped()}>
            {(group) => (
              <section>
                <h2 class={`${HEADING} mt-4 mb-1.5`}>{group.category}</h2>
                <For each={group.slots}>
                  {(slot) => (
                    <div class="border-t py-1">
                      <h3 class={`${LABEL} mb-1 flex h-6 items-center gap-2`}>
                        {slot.name}
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() =>
                            props.selection.setMany(
                              slot.items,
                              !props.selection.holds(slot.items),
                            )
                          }
                        >
                          {props.selection.holds(slot.items)
                            ? "Deselect"
                            : "Select all"}
                        </Button>
                      </h3>
                      <div class={`triage-grid ${TILE_GRID}`}>
                        <For each={slot.items}>
                          {(item) => (
                            <ItemTile
                              item={item}
                              selected={props.selection.picked().has(item.id)}
                              highlight
                              class={
                                app.pinned().some((one) => one.id === item.id)
                                  ? "pinned"
                                  : undefined
                              }
                              onSelect={(one, event) =>
                                props.selection.onTile(one, event, ordered())
                              }
                            />
                          )}
                        </For>
                      </div>
                    </div>
                  )}
                </For>
              </section>
            )}
          </For>
        </Show>
      </div>
    </ItemMenu>
  );
};
