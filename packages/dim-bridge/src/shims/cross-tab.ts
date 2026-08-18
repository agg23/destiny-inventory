import type { DimItem } from "app/inventory/item-types";

// The real module is a React hook over a BroadcastChannel. One tab is the whole story here
export const notifyOtherTabsItemMoved = (_item: DimItem, _targetStoreId: string): void => {};
