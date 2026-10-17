import type { DimItem } from "app/inventory/item-types";

// In-game loadouts unsupported
export const isInInGameLoadoutForSelector = () => (_item: DimItem, _ownerId: string) => false;

// Only used as a type by the item filter context
export interface LoadoutsByItem {
  [itemId: string]: undefined;
}
