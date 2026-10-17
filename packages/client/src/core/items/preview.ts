import type { DimItem } from "app/inventory/item-types";
import { createSignal } from "solid-js";

import { holdAnchor, releaseAnchor } from "../../components/lib/anchor.ts";
import type { ModeVerdict } from "./arrivals.ts";

export const HOVER_DELAY = 50;

export interface Previewed {
  item: DimItem;
  cursorX: number | undefined;
  /** The roll verdict, when the card came from the arrivals rail */
  verdict: ModeVerdict | undefined;
  /** Warns that a definition item may not match the roll that was used */
  rollWarning: boolean;
  /** Short status lines, like collection state on a collections card */
  notes: string[];
  /** Vendor price, for stock shown as tiles */
  cost: CardCost | undefined;
}

export interface CardCost {
  icon: string | undefined;
  quantity: number;
}

const [shown, setShown] = createSignal<Previewed | undefined>(undefined);

let timer: number | undefined = undefined;

export const previewed = shown;

/** Opens the item card once the hover delay passes, or moves the open one */
export const preview = (
  item: DimItem,
  element: HTMLElement,
  options: Partial<Omit<Previewed, "item">> = {},
) => {
  const open = () => {
    holdAnchor(element, clear);
    setShown({
      item,
      cursorX: options.cursorX,
      verdict: options.verdict,
      rollWarning: options.rollWarning ?? false,
      notes: options.notes ?? [],
      cost: options.cost,
    });
  };

  if (shown()?.item.index === item.index) {
    open();

    return;
  }

  window.clearTimeout(timer);
  timer = window.setTimeout(open, HOVER_DELAY);
};

/** Closes the card whatever it holds, for a source that left without a mouseleave */
export const clear = () => {
  window.clearTimeout(timer);
  releaseAnchor();
  setShown(undefined);
};

/** Closes the card if this item still owns it */
export const dismiss = (item: DimItem) => {
  window.clearTimeout(timer);

  // A fake item shares its id with every other roll of the same hash
  if (shown()?.item.index === item.index) {
    releaseAnchor();
    setShown(undefined);
  }
};
