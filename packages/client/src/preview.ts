import type { DimItem } from "app/inventory/item-types";
import { createSignal } from "solid-js";

const HOVER_DELAY = 120;

export interface Previewed {
  item: DimItem;
  anchor: DOMRect;
}

const [shown, setShown] = createSignal<Previewed | undefined>(undefined);

let timer: number | undefined = undefined;

export const previewed = shown;

/** A point the card can hang off, for a target too wide to anchor to */
export const cursorAnchor = (event: MouseEvent): DOMRect =>
  new DOMRect(event.clientX, event.clientY, 0, 0);

/** Opens the item card once the hover delay passes, or moves the open one */
export const preview = (item: DimItem, anchor: DOMRect) => {
  if (shown()?.item.index === item.index) {
    setShown({ item, anchor });

    return;
  }

  window.clearTimeout(timer);
  timer = window.setTimeout(() => setShown({ item, anchor }), HOVER_DELAY);
};

/** Closes the card whatever it holds, for a source that left without a mouseleave */
export const clear = () => {
  window.clearTimeout(timer);
  setShown(undefined);
};

/** Closes the card if this item still owns it */
export const dismiss = (item: DimItem) => {
  window.clearTimeout(timer);

  // A fake item shares its id with every other roll of the same hash
  if (shown()?.item.index === item.index) {
    setShown(undefined);
  }
};
