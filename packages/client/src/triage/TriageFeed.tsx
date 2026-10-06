import type { DimItem } from "app/inventory/item-types";
import { createMemo, For, Show } from "solid-js";

import { useApp } from "../App.tsx";
import { ItemIcon } from "../ItemIcon.tsx";
import { ItemMenu, menued } from "../ItemMenu.tsx";
import { previewed } from "../preview.ts";
import { CATEGORIES } from "../triage.ts";
import type { Selection } from "./triageSelection.ts";
import { Button } from "../ui/Button.tsx";

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

  // Shift ranges follow what the eye sees, not the sort
  const ordered = createMemo(() =>
    grouped().flatMap((group) => group.slots.flatMap((slot) => slot.items)),
  );

  const tileState = (item: DimItem): string =>
    [
      previewed()?.item.index === item.index ? "hovered" : "",
      menued(item) ? "menued" : "",
      app.pinned().some((one) => one.id === item.id) ? "pinned" : "",
    ]
      .filter((part) => part.length > 0)
      .join(" ");

  return (
    <ItemMenu
      find={(index) => props.pool.find((one) => one.index === index)}
      onTag={props.onTag}
    >
      <div class="triage p-3">
        <Show
          when={grouped().length > 0}
          fallback={
            <p class="p-3 text-muted">
              Nothing left to triage under this filter.
            </p>
          }
        >
          <For each={grouped()}>
            {(group) => (
              <section>
                <h2 class="section-label mt-4 mb-1.5">{group.category}</h2>
                <For each={group.slots}>
                  {(slot) => (
                    <div class="triage-slot">
                      <h3 class="bucket-label">
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
                      <div class="item-grid wide triage-grid">
                        <For each={slot.items}>
                          {(item) => (
                            <ItemIcon
                              item={item}
                              selected={props.selection.picked().has(item.id)}
                              class={tileState(item)}
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
