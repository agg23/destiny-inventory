import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { BucketHashes } from "data/d2/generated-enums";

import { LOOK_SLOTS, type LookSlot } from "@dvm/defs-core";

import { EMPTY_PIECE, type Pieces } from "./lookState.ts";

const SLOT_BY_BUCKET: Partial<Record<number, LookSlot>> = {
  [BucketHashes.Helmet]: "helmet",
  [BucketHashes.Gauntlets]: "arms",
  [BucketHashes.ChestArmor]: "chest",
  [BucketHashes.LegArmor]: "legs",
  [BucketHashes.ClassArmor]: "class",
};

// DestinyItemSubType
const SHADER = 20;
const ORNAMENT = 21;

const pluggedOf = (item: DimItem, subType: number): number | undefined =>
  item.sockets?.allSockets.find(
    (socket) => socket.plugged?.plugDef.itemSubType === subType,
  )?.plugged?.plugDef.hash;

/** What a character has equipped, hashes the viewer has no model for are dropped */
export const currentPieces = (
  store: DimStore,
  renderable: (hash: number | undefined) => boolean,
): Pieces => {
  const pieces = Object.fromEntries(
    LOOK_SLOTS.map((slot) => [slot, EMPTY_PIECE]),
  ) as Pieces;

  for (const item of store.items) {
    const slot = SLOT_BY_BUCKET[item.bucket.hash];

    if (!item.equipped || !slot) {
      continue;
    }

    const keep = (hash: number | undefined) =>
      renderable(hash) ? hash : undefined;

    pieces[slot] = {
      armorHash: keep(item.hash),
      ornamentHash: keep(pluggedOf(item, ORNAMENT)),
      shaderHash: keep(pluggedOf(item, SHADER)),
    };
  }

  return pieces;
};
