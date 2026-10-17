import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { spaceLeftForItem } from "app/inventory/stores-helpers";
import { createSignal } from "solid-js";

import type { Membership } from "../api/bungie.ts";
import { messageOf } from "../error.ts";
import { currentStores, moveItem } from "../profile/moves.ts";
import { showToast } from "../toast.ts";

// A full unique stack only takes what tops it off
const pullAmount = (item: DimItem, target: DimStore): number => {
  if (!item.uniqueStack) {
    return item.amount;
  }

  const space = spaceLeftForItem(target, item, currentStores());

  return space > 0 ? Math.min(item.amount || 1, space) : item.amount;
};

export const createItemMoves = (
  viewing: () => Membership | undefined,
  afterMove: () => void,
) => {
  const [moving, setMoving] = createSignal<string | undefined>(undefined);

  const onMove = (item: DimItem, target: DimStore, equip: boolean) => {
    if (viewing()) {
      return;
    }

    setMoving(`${equip ? "Equipping" : "Moving"} ${item.name}`);

    moveItem(item, target, equip)
      .catch((e: unknown) => showToast(messageOf(e), "danger"))
      .finally(() => {
        setMoving(undefined);
        afterMove();
      });
  };

  const moveMany = async (
    items: DimItem[],
    target: DimStore,
    verb: string,
    stop?: () => boolean,
  ): Promise<DimItem[]> => {
    if (viewing() || moving() || items.length === 0) {
      return [];
    }

    const errors = new Set<string>();
    const moved: DimItem[] = [];
    let index = 0;

    for (const item of items) {
      if (stop?.()) {
        break;
      }

      index += 1;
      setMoving(`${verb} ${item.name} (${index} of ${items.length})`);

      try {
        await moveItem(item, target, false, pullAmount(item, target));
        moved.push(item);
      } catch (e: unknown) {
        const message = messageOf(e);

        if (!errors.has(message)) {
          errors.add(message);
          showToast(message, "danger");
        }
      }
    }

    setMoving(undefined);
    afterMove();

    return moved;
  };

  return { moving, onMove, moveMany };
};
