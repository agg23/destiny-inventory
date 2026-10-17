import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { potentialSpaceLeftForItem } from "app/inventory/stores-helpers";
import { BucketHashes } from "data/d2/generated-enums";
import { createMemo, Show } from "solid-js";

import { Button } from "../../components/lib/zaidan/button.tsx";
import { unmovable } from "../../core/items/compare.ts";

interface Props {
  character: DimStore | undefined;
  stores: DimStore[];
  moving: string | undefined;
  onCollect: (items: DimItem[], target: DimStore) => void;
}

export const CollectAll = (props: Props) => {
  const collectible = createMemo(() => {
    const character = props.character;

    if (!character) {
      return undefined;
    }

    const eligible = character.items.filter(
      (item) =>
        item.location.hash === BucketHashes.LostItems &&
        !unmovable(item) &&
        item.canPullFromPostmaster,
    );

    const items = eligible.filter((item) => {
      const space = potentialSpaceLeftForItem(character, item, props.stores);

      return space.guaranteed > 0 || space.couldMakeSpace;
    });

    return { character, items, empty: eligible.length === 0 };
  });

  return (
    <Show when={collectible()}>
      {(found) => (
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={!!props.moving || found().items.length === 0}
          title={
            found().items.length > 0
              ? undefined
              : found().empty
                ? "Nothing to pull"
                : "Cannot pull available items"
          }
          onClick={() => props.onCollect(found().items, found().character)}
        >
          Collect all ({found().items.length})
        </Button>
      )}
    </Show>
  );
};
