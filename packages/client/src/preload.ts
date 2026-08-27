import type { DimItem } from "app/inventory/item-types";

import { BUNGIE } from "./bungie.ts";

const LANES = 6;

const collect = (
  items: DimItem[],
  gather: (item: DimItem, take: (icon: string | undefined) => void) => void,
): string[] => {
  const icons = new Set<string>();

  const take = (icon: string | undefined) => {
    if (icon) {
      icons.add(`${BUNGIE}${icon}`);
    }
  };

  for (const item of items) {
    gather(item, take);
  }

  return [...icons];
};

export const tileIcons = (items: DimItem[]): string[] =>
  collect(items, (item, take) => {
    take(item.element?.displayProperties.icon);
    take(item.breakerType?.displayProperties.icon);
  });

export const plugIcons = (items: DimItem[]): string[] =>
  collect(items, (item, take) => {
    for (const socket of item.sockets?.allSockets ?? []) {
      take(socket.plugged?.plugDef.displayProperties.icon);

      for (const plug of socket.plugOptions) {
        take(plug.plugDef.displayProperties.icon);
      }
    }
  });

// Decoding is the browser's problem; this wants the bytes local
export const warmIcons = (urls: string[]): (() => void) => {
  let next = 0;
  let stopped = false;

  const lane = () => {
    const url = stopped ? undefined : urls[next];

    if (url === undefined) {
      return;
    }

    next += 1;

    const image = new Image();
    image.onload = lane;
    image.onerror = lane;
    image.src = url;
  };

  for (let i = 0; i < LANES; i += 1) {
    lane();
  }

  return () => {
    stopped = true;
  };
};
