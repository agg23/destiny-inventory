import { createEffect, onCleanup } from "solid-js";

import { onIdle } from "../idle.ts";
import type { LoadResult } from "../profile/loadTypes.ts";
import { plugIcons, tileIcons, warmIcons } from "../profile/preload.ts";

export const createIconWarmup = (current: () => LoadResult | undefined) => {
  let warmedTiles = false;

  createEffect(() => {
    const loaded = current();

    if (warmedTiles || !loaded) {
      return;
    }

    warmedTiles = true;

    const stop = warmIcons(tileIcons(loaded.items));

    onCleanup(stop);
  });

  let warmed = false;

  // Perk icons come from a different host
  createEffect(() => {
    const loaded = current();

    if (warmed || !loaded || loaded.tier !== "detail") {
      return;
    }

    warmed = true;

    let stop: (() => void) | undefined = undefined;

    const cancelIdle = onIdle(() => {
      stop = warmIcons(plugIcons(loaded.items));
    });

    onCleanup(() => {
      cancelIdle();
      stop?.();
    });
  });
};
