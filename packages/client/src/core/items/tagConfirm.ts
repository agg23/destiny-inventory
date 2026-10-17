import type { DimItem } from "app/inventory/item-types";
import { createSignal } from "solid-js";

import { setOnlyTagMany, tagDefs, tagFor } from "./tags.ts";

const CONFIRM_OVER = 8;

export interface Request {
  items: DimItem[];
  tagId: string | undefined;
}

export interface Replaced {
  label: string;
  color: string;
  count: number;
}

const [pending, setPending] = createSignal<Request | undefined>(undefined);

/** The tag write waiting on the confirm */
export const pendingTag = pending;

export const dismissTag = () => setPending(undefined);

export const applyTag = (request: Request) =>
  setOnlyTagMany(
    request.items.map((one) => ({ instanceId: one.id, itemHash: one.hash })),
    request.tagId,
  );

/** Tags the write would overwrite, counted per tag */
export const replacedBy = (request: Request): Replaced[] => {
  const counts = new Map<string, number>();

  for (const item of request.items) {
    const was = tagFor(item.id);

    if (was && was.id !== request.tagId) {
      counts.set(was.id, (counts.get(was.id) ?? 0) + 1);
    }
  }

  return tagDefs().flatMap((def) => {
    const count = counts.get(def.id);

    return count === undefined
      ? []
      : [{ label: def.label, color: def.color, count }];
  });
};

/** Tags the items, asking first when the write is big or replaces other tags */
export const requestTag = (items: DimItem[], tagId: string | undefined) => {
  const request = { items, tagId };

  if (
    items.length > CONFIRM_OVER ||
    (items.length > 1 && replacedBy(request).length > 0)
  ) {
    setPending(request);

    return;
  }

  applyTag(request);
};
