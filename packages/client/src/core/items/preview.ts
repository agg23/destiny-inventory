import type { DimItem } from "app/inventory/item-types";
import { createSignal, onCleanup } from "solid-js";

import { holdAnchor, releaseAnchor } from "../anchor.ts";
import type { ModeVerdict } from "./arrivals.ts";

export const HOVER_DELAY = 50;

interface Previewed {
  item: DimItem;
  cursorX: number | undefined;
  verdict: ModeVerdict | undefined;
  rollWarning: boolean;
  notes: string[];
  cost: CardCost | undefined;
}

export interface CardCost {
  icon: string | undefined;
  quantity: number;
}

/** Anchored hover card state; no delay opens at once */
export const createHoverCard = <T>(options: {
  delay?: number;
  reopen?: (shown: T, next: T) => boolean;
  anchor?: string;
}) => {
  const [shown, setShown] = createSignal<T | undefined>(undefined);

  let timer: number | undefined = undefined;

  const clear = () => {
    window.clearTimeout(timer);
    releaseAnchor(options.anchor);
    setShown(undefined);
  };

  const open = (value: T, element: HTMLElement) => {
    const show = () => {
      holdAnchor(element, clear, options.anchor);
      setShown(() => value);
    };
    const current = shown();

    if (
      options.delay === undefined ||
      (current !== undefined && !!options.reopen?.(current, value))
    ) {
      show();

      return;
    }

    window.clearTimeout(timer);
    timer = window.setTimeout(show, options.delay);
  };

  const dismiss = (owns: (shown: T) => boolean) => {
    window.clearTimeout(timer);

    const current = shown();

    if (current !== undefined && owns(current)) {
      releaseAnchor(options.anchor);
      setShown(undefined);
    }
  };

  return { shown, open, clear, dismiss };
};

const card = createHoverCard<Previewed>({
  delay: HOVER_DELAY,
  reopen: (shown, next) => shown.item.index === next.item.index,
});

export const previewed = card.shown;

/** Opens the item card once the hover delay passes, or moves the open one */
export const preview = (
  item: DimItem,
  element: HTMLElement,
  options: Partial<Omit<Previewed, "item">> = {},
) => {
  card.open(
    {
      item,
      cursorX: options.cursorX,
      verdict: options.verdict,
      rollWarning: options.rollWarning ?? false,
      notes: options.notes ?? [],
      cost: options.cost,
    },
    element,
  );
};

/** Closes the card regardless of which item holds it */
export const clear = card.clear;

/** Closes the card if this item still owns it */
export const dismiss = (item: DimItem) => {
  // A fake item shares its id with every other roll of the same hash
  card.dismiss((shown) => shown.item.index === item.index);
};

/** Hover handlers that open the item card at the cursor */
export const trackPreview = (
  item: () => DimItem | undefined,
  options: {
    rollWarning?: boolean;
    stopPropagation?: boolean;
    onShow?: () => void;
  } = {},
) => {
  const track = (event: MouseEvent & { currentTarget: HTMLElement }) => {
    if (options.stopPropagation) {
      event.stopPropagation();
    }

    const found = item();

    if (!found) {
      return;
    }

    options.onShow?.();
    preview(found, event.currentTarget, {
      cursorX: event.clientX,
      rollWarning: options.rollWarning,
    });
  };

  const leave = () => {
    const found = item();

    if (found) {
      dismiss(found);
    }
  };

  // Rows can unmount from under the pointer without a mouseleave
  onCleanup(leave);

  return { onMouseEnter: track, onMouseMove: track, onMouseLeave: leave };
};
