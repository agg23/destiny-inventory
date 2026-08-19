import type {
  DestinyInventoryItemDefinition,
  DestinyPlugSetDefinition,
} from "bungie-api-ts/destiny2";

import { itemReferences, plugSetReferences } from "./references.ts";

export interface AsyncTables {
  items: (hashes: number[]) => Promise<DestinyInventoryItemDefinition[]>;
  plugSets: (hashes: number[]) => Promise<DestinyPlugSetDefinition[]>;
}

export interface Materialized {
  items: Record<number, DestinyInventoryItemDefinition>;
  plugSets: Record<number, DestinyPlugSetDefinition>;
}

// Pulls only the closure the profile reaches, so heap tracks the vault rather than the game
export const materializeClosure = async (
  owned: Iterable<number>,
  tables: AsyncTables,
): Promise<Materialized> => {
  const items: Record<number, DestinyInventoryItemDefinition> = {};
  const plugSets: Record<number, DestinyPlugSetDefinition> = {};

  const requestedItems = new Set<number>(owned);
  const requestedPlugSets = new Set<number>();

  let itemFrontier = [...requestedItems];
  let plugSetFrontier: number[] = [];

  while (itemFrontier.length > 0 || plugSetFrontier.length > 0) {
    const [fetchedItems, fetchedPlugSets] = await Promise.all([
      itemFrontier.length > 0
        ? tables.items(itemFrontier)
        : Promise.resolve([]),
      plugSetFrontier.length > 0
        ? tables.plugSets(plugSetFrontier)
        : Promise.resolve([]),
    ]);

    const nextItems: number[] = [];
    const nextPlugSets: number[] = [];

    const wantItem = (hash: number) => {
      if (!requestedItems.has(hash)) {
        requestedItems.add(hash);
        nextItems.push(hash);
      }
    };

    const wantPlugSet = (hash: number) => {
      if (!requestedPlugSets.has(hash)) {
        requestedPlugSets.add(hash);
        nextPlugSets.push(hash);
      }
    };

    for (const item of fetchedItems) {
      items[item.hash] = item;

      const references = itemReferences(item);

      for (const hash of references.items) {
        wantItem(hash);
      }

      for (const hash of references.plugSets) {
        wantPlugSet(hash);
      }
    }

    for (const plugSet of fetchedPlugSets) {
      plugSets[plugSet.hash] = plugSet;

      for (const hash of plugSetReferences(plugSet)) {
        wantItem(hash);
      }
    }

    itemFrontier = nextItems;
    plugSetFrontier = nextPlugSets;
  }

  return { items, plugSets };
};
