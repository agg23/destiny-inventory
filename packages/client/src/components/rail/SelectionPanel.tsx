import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { Show } from "solid-js";

import { guest } from "../../core/profile/guest.ts";
import {
  defaultBulkTransfer,
  movableTo,
  storeLabel,
} from "../../core/profile/moveTargets.ts";
import { plural } from "../../history/shared/runFormat.ts";
import { TagControl } from "../card/TagControl.tsx";
import { SplitButton } from "../lib/SplitButton.tsx";
import { HEADING, LABEL } from "../lib/text.ts";
import { Button } from "../lib/zaidan/button.tsx";
import { X } from "../lib/zaidan/icons.tsx";
import { NameCounts } from "../NameCounts.tsx";

interface Props {
  items: DimItem[];
  stores: DimStore[];
  active: DimStore | undefined;
  moving: string | undefined;
  onMoveMany: (items: DimItem[], target: DimStore) => void;
  onClear: () => void;
}

/** The rail for a selection that Compare cannot show */
export const SelectionPanel = (props: Props) => {
  const movable = (target: DimStore) =>
    movableTo(props.items, props.stores, props.active, target);

  const reason = (target: DimStore) =>
    movable(target).length === 0 ? "Nothing to move" : undefined;

  const transferTo = () =>
    defaultBulkTransfer(props.items, props.stores, props.active);

  return (
    <div class="flex min-h-0 flex-col gap-4 p-4">
      <div class="flex items-center gap-2">
        <h2 class={`${HEADING} mr-auto`}>
          {plural(props.items.length, "item")}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Clear selection"
          title="Clear selection"
          onClick={props.onClear}
        >
          <X />
        </Button>
      </div>

      <div class="flex items-center gap-2">
        <span class={`${LABEL} mr-auto`}>Tag</span>
        <TagControl items={props.items} />
      </div>

      <Show when={!guest() && transferTo()}>
        {(target) => (
          <div class="flex flex-col gap-2">
            <SplitButton
              block
              size="sm"
              label={`Transfer to ${storeLabel(target())}`}
              disabled={!!props.moving || !!reason(target())}
              title={reason(target())}
              onPrimary={() => props.onMoveMany(movable(target()), target())}
              choices={props.stores
                .filter((store) => store.id !== target().id)
                .map((store) => ({
                  id: store.id,
                  label: storeLabel(store),
                  reason: reason(store),
                  onChoose: () => props.onMoveMany(movable(store), store),
                }))}
            />
            <Show when={props.moving}>
              {(status) => (
                <p class="text-xs text-muted-foreground">{status()}</p>
              )}
            </Show>
          </div>
        )}
      </Show>

      <NameCounts
        items={props.items}
        class="-mx-4 min-h-0 overflow-y-auto border-t px-4 pt-3"
      />
    </div>
  );
};
