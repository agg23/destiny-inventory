import type { DimItem } from "app/inventory/item-types";

// Enough to keep the pipe busy without crowding the requests the visible grid is making
const LANES = 6;

const BUNGIE = "https://www.bungie.net";

// What a panel paints without being asked: the roll itself and its column. The full rollable
// pool behind "Show all" is thousands of icons more and waits to be asked for
export const plugIcons = (items: DimItem[]): string[] => {
  const icons = new Set<string>();

  const take = (icon: string | undefined) => {
    if (icon) {
      icons.add(`${BUNGIE}${icon}`);
    }
  };

  for (const item of items) {
    for (const socket of item.sockets?.allSockets ?? []) {
      take(socket.plugged?.plugDef.displayProperties.icon);

      for (const plug of socket.plugOptions) {
        take(plug.plugDef.displayProperties.icon);
      }
    }
  }

  return [...icons];
};

// Warms the HTTP cache so a panel paints its perks rather than filling them in afterwards.
// Decoding is the browser's problem; this only needs the bytes to be local
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
