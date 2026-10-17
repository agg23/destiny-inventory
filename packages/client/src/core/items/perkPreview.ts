import type { DimItem, DimPlug } from "app/inventory/item-types";

import { createHoverCard, HOVER_DELAY } from "./preview.ts";

interface PreviewedPerk {
  item: DimItem;
  plug: DimPlug;
  beside: boolean;
}

const card = createHoverCard<PreviewedPerk>({
  delay: HOVER_DELAY,
  anchor: "--hovered-perk",
});

export const previewedPerk = card.shown;

export const previewPerk = (
  item: DimItem,
  plug: DimPlug,
  element: HTMLElement,
) => {
  card.open(
    { item, plug, beside: document.querySelector(".rail") === null },
    element,
  );
};

export const clearPerk = card.clear;

export const dismissPerk = (plug: DimPlug) => {
  card.dismiss((shown) => shown.plug === plug);
};
