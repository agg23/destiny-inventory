import { createMemo, For, Show, type JSX } from "solid-js";

import {
  ARMOR_SLOTS,
  setless,
  setsOf,
} from "../../core/collections/armorSets.ts";
import type { Entry } from "../../core/collections/collections.ts";
import { SetCard } from "./SetCard.tsx";
import { SlotRows } from "./SlotRows.tsx";

/** Exotics in slot rows, then a card per set */
export const ArmorBlock = (props: {
  entries: Entry[];
  count: (entries: Entry[]) => string;
  tile: (entry: Entry) => JSX.Element;
}) => {
  const sets = createMemo(() => setsOf(props.entries));

  return (
    <>
      <SlotRows
        slots={ARMOR_SLOTS}
        entries={setless(props.entries)}
        tile={props.tile}
      />
      <Show when={sets().size > 0}>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(calc(var(--tile)*5+1rem),1fr))] gap-x-4 gap-y-2 border-t py-1">
          <For each={[...sets().keys()]}>
            {(setKey) => {
              const pieces = () => sets().get(setKey) ?? [];

              return (
                <SetCard
                  pieces={pieces()}
                  count={props.count(pieces())}
                  tile={props.tile}
                />
              );
            }}
          </For>
        </div>
      </Show>
    </>
  );
};
