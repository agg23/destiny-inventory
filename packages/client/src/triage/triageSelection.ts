import type { DimItem } from "app/inventory/item-types";
import { createMemo, createSignal } from "solid-js";

export interface Selection {
  picked: () => ReadonlySet<string>;
  items: () => DimItem[];
  clear: () => void;
  toggle: (item: DimItem) => void;
  extend: (item: DimItem, order: DimItem[]) => void;
  setMany: (items: DimItem[], on: boolean) => void;
  holds: (items: DimItem[]) => boolean;
  onTile: (item: DimItem, event: MouseEvent, order: DimItem[]) => void;
}

export const createSelection = (
  all: () => DimItem[],
  onChange: () => void,
): Selection => {
  const [picked, setPicked] = createSignal<ReadonlySet<string>>(new Set());
  const [anchor, setAnchor] = createSignal<string | undefined>(undefined);

  // Resolved against every item, not the feed - tagging hides rows and the selection stands
  const items = createMemo(() => {
    const held = picked();

    return all().filter((item) => held.has(item.id));
  });

  const clear = () => {
    setAnchor(undefined);
    setPicked(new Set<string>());
    onChange();
  };

  const toggle = (item: DimItem) => {
    setPicked((was) => {
      const next = new Set(was);

      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }

      return next;
    });

    setAnchor(item.id);
    onChange();
  };

  const extend = (item: DimItem, order: DimItem[]) => {
    const from = order.findIndex((one) => one.id === anchor());
    const to = order.findIndex((one) => one.id === item.id);

    if (from < 0 || to < 0) {
      toggle(item);

      return;
    }

    const span = order.slice(Math.min(from, to), Math.max(from, to) + 1);

    setPicked((was) => new Set([...was, ...span.map((one) => one.id)]));
    onChange();
  };

  const setMany = (chosen: DimItem[], on: boolean) => {
    setPicked((was) => {
      const next = new Set(was);

      for (const item of chosen) {
        if (on) {
          next.add(item.id);
        } else {
          next.delete(item.id);
        }
      }

      return next;
    });

    onChange();
  };

  return {
    picked,
    items,
    clear,
    toggle,
    extend,
    setMany,
    holds: (chosen) => chosen.every((one) => picked().has(one.id)),
    onTile: (item, event, order) => {
      if (event.shiftKey && anchor() !== undefined) {
        extend(item, order);

        return;
      }

      toggle(item);
    },
  };
};
