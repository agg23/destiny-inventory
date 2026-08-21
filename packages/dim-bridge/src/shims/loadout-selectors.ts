import type { DimItem } from "app/inventory/item-types";

// In-game loadouts are not supported, so nothing is ever pinned to one
export const isInInGameLoadoutForSelector = () => (_item: DimItem, _ownerId: string) => false;

// Reached in type position by the item filter context, which never has loadouts to put in it
export interface LoadoutsByItem {
  [itemId: string]: undefined;
}
