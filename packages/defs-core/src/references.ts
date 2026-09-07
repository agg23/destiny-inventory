import type {
  DestinyInventoryItemDefinition,
  DestinyPlugSetDefinition,
} from "bungie-api-ts/destiny2";

export interface ItemReferences {
  items: number[];
  plugSets: number[];
}

export const itemReferences = (
  item: DestinyInventoryItemDefinition,
): ItemReferences => {
  const items: number[] = [];
  const plugSets: number[] = [];

  for (const socket of item.sockets?.socketEntries ?? []) {
    if (socket.singleInitialItemHash) {
      items.push(socket.singleInitialItemHash);
    }

    for (const plug of socket.reusablePlugItems ?? []) {
      items.push(plug.plugItemHash);
    }

    if (socket.reusablePlugSetHash) {
      plugSets.push(socket.reusablePlugSetHash);
    }

    if (socket.randomizedPlugSetHash) {
      plugSets.push(socket.randomizedPlugSetHash);
    }
  }

  for (const socket of item.sockets?.intrinsicSockets ?? []) {
    items.push(socket.plugItemHash);
  }

  if (item.summaryItemHash) {
    items.push(item.summaryItemHash);
  }

  // DIM names a pursuit after its questline, and no profile ever mentions that item
  if (item.objectives?.questlineItemHash) {
    items.push(item.objectives.questlineItemHash);
  }

  return { items, plugSets };
};

export const plugSetReferences = (
  plugSet: DestinyPlugSetDefinition,
): number[] => plugSet.reusablePlugItems.map((plug) => plug.plugItemHash);
