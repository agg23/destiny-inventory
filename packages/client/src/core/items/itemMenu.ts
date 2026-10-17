import type { DimItem } from "app/inventory/item-types";
import { createSignal } from "solid-js";

export const [menuFor, setMenuFor] = createSignal<DimItem | undefined>(
  undefined,
);
export const [menuOpen, setMenuOpen] = createSignal(false);

/** True while this item's context menu is open */
export const menued = (item: DimItem) =>
  menuOpen() && menuFor()?.index === item.index;
