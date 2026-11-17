import type { DimStore } from "app/inventory/store-types";
import { Show } from "solid-js";

import { useApp } from "../../core/app/state.ts";
import { compareBlocked } from "../../core/items/compare.ts";
import { guest } from "../../core/profile/guest.ts";
import {
  bulkBlocked,
  defaultBulkTransfer,
  movableTo,
  otherStores,
  storeLabel,
} from "../../core/profile/moveTargets.ts";
import { plural } from "../../core/text.ts";
import { FavoriteControl } from "../card/FavoriteControl.tsx";
import { TagControl } from "../card/TagControl.tsx";
import { IconButton } from "../lib/IconButton.tsx";
import { SplitButton } from "../lib/SplitButton.tsx";
import { HEADING, LABEL } from "../lib/text.ts";
import { Button } from "../lib/zaidan/button.tsx";
import { X } from "../lib/zaidan/icons.tsx";
import { NameCounts } from "../NameCounts.tsx";

/** The rail for a selection of several items */
export const SelectionPanel = () => {
  const app = useApp();

  const moveTo = (target: DimStore) =>
    app.onMoveMany(
      movableTo(app.selected(), app.stores(), app.active(), target),
      target,
    );

  const reason = (target: DimStore) =>
    bulkBlocked(app.selected(), app.stores(), app.active(), target);

  const transferTo = () =>
    defaultBulkTransfer(app.selected(), app.stores(), app.active());

  return (
    <div class="flex min-h-0 flex-col gap-4 p-4">
      <div class="flex items-center gap-2">
        <h2 class={`${HEADING} mr-auto`}>
          {plural(app.selected().length, "item")}
        </h2>
        <IconButton
          type="button"
          size="icon-xs"
          label="Clear selection"
          onClick={app.onClearSelection}
        >
          <X />
        </IconButton>
      </div>

      <div class="flex items-center gap-2">
        <span class={`${LABEL} mr-auto`}>Tag</span>
        <FavoriteControl items={app.selected()} />
        <TagControl items={app.selected()} />
      </div>

      <Show when={!guest() && transferTo()}>
        {(target) => (
          <div class="flex flex-col gap-2">
            <SplitButton
              block
              size="sm"
              label={`Transfer to ${storeLabel(target())}`}
              disabled={!!app.moving() || !!reason(target())}
              title={reason(target())}
              onPrimary={() => moveTo(target())}
              choices={otherStores(app.stores(), target()).map((store) => ({
                id: store.id,
                label: storeLabel(store),
                reason: reason(store),
                onChoose: () => moveTo(store),
              }))}
            />
            <Show when={app.moving()}>
              {(status) => (
                <p class="text-xs text-muted-foreground">{status()}</p>
              )}
            </Show>
          </div>
        )}
      </Show>

      <div title={compareBlocked(app.selected())}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="w-full"
          disabled={!!compareBlocked(app.selected())}
          onClick={() => app.onCompare(app.selected())}
        >
          Compare all
        </Button>
      </div>

      <NameCounts
        items={app.selected()}
        class="-mx-4 min-h-0 overflow-y-auto border-t px-4 pt-3"
      />
    </div>
  );
};
