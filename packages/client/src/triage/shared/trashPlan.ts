import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { spaceLeftForItem } from "app/inventory/stores-helpers";
import { isClassCompatible } from "app/utils/item-utils";
import { BucketHashes } from "data/d2/generated-enums";

import { tagFor, type TagTarget } from "../../core/items/tags.ts";
import { plural } from "../../core/text.ts";

const TRASH_TAG = "junk";

export type TrashPhase = "evacuating" | "feeding" | "waiting" | "restoring";

export interface TrashRun {
  characterId: string;
  bucketHash: number;
  dry: boolean;
  phase: TrashPhase;
  holdback: string[];
  fed: TagTarget[];
  skipped: string[];
  dismantled: string[];
  interrupted: boolean;
}

export const isTrash = (item: DimItem): boolean => tagFor(item.id)?.id === TRASH_TAG;

/** Unequipped items sitting in one of a character's slots */
export const slotContents = (
  character: DimStore,
  bucketHash: number,
): DimItem[] =>
  character.items.filter(
    (item) => item.location.hash === bucketHash && !item.equipped,
  );

/** Trash for one slot that the character could dismantle, wherever it sits */
export const trashFor = (
  stores: DimStore[],
  character: DimStore,
  bucketHash: number,
): DimItem[] =>
  stores
    .flatMap((store) => store.items)
    .filter(
      (item) =>
        item.bucket.hash === bucketHash &&
        isTrash(item) &&
        !item.equipped &&
        item.location.hash !== BucketHashes.LostItems &&
        (item.owner === character.id || !item.notransfer) &&
        isClassCompatible(item.classType, character.classType),
    );

/** Trash still waiting to be moved in */
export const trashQueue = (
  held: TrashRun,
  stores: DimStore[],
  character: DimStore,
): DimItem[] => {
  const done = new Set([
    ...held.fed.map((one) => one.instanceId),
    ...held.skipped,
    ...held.dismantled,
  ]);

  return trashFor(stores, character, held.bucketHash).filter(
    (item) => item.owner !== character.id && !done.has(item.id),
  );
};

interface TrashPlan {
  holdback: DimItem[];
  trash: DimItem[];
  blocked: string | undefined;
}

/** What a run on the slot would move, and why it can't start */
export const planTrash = (
  stores: DimStore[],
  character: DimStore,
  bucketHash: number,
): TrashPlan => {
  const vault = stores.find((store) => store.isVault);
  const holdback = slotContents(character, bucketHash).filter(
    (item) => !isTrash(item),
  );
  let blocked: string | undefined = undefined;

  if (
    vault &&
    holdback.length > 0 &&
    spaceLeftForItem(vault, holdback[0]!, stores) < holdback.length
  ) {
    blocked = `The vault needs ${plural(holdback.length, "free slot")}`;
  }

  return {
    holdback,
    trash: trashFor(stores, character, bucketHash),
    blocked,
  };
};
