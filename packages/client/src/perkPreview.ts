import type { DimItem, DimPlug } from "app/inventory/item-types";
import { createSignal } from "solid-js";

import { HOVER_DELAY } from "./preview.ts";
import { holdAnchor, releaseAnchor } from "./ui/anchor.ts";

const ANCHOR = "--hovered-perk";

export interface PreviewedPerk {
  item: DimItem;
  plug: DimPlug;
}

const [shown, setShown] = createSignal<PreviewedPerk | undefined>(undefined);

let timer: number | undefined = undefined;

export const previewedPerk = shown;

export const previewPerk = (
  item: DimItem,
  plug: DimPlug,
  element: HTMLElement,
) => {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    holdAnchor(element, clearPerk, ANCHOR);
    setShown({ item, plug });
  }, HOVER_DELAY);
};

export const clearPerk = () => {
  window.clearTimeout(timer);
  releaseAnchor(ANCHOR);
  setShown(undefined);
};

export const dismissPerk = (plug: DimPlug) => {
  window.clearTimeout(timer);

  if (shown()?.plug === plug) {
    releaseAnchor(ANCHOR);
    setShown(undefined);
  }
};
