import type { DimItem } from "app/inventory/item-types";

// In-game loadouts are not supported, so nothing is ever pinned to one
export const isInInGameLoadoutForSelector = () => (_item: DimItem, _ownerId: string) => false;
