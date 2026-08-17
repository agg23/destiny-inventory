import type {
  DestinyInventoryItemDefinition,
  DestinyPlugSetDefinition,
} from "bungie-api-ts/destiny2";

import { itemReferences, plugSetReferences } from "./references.ts";

export interface Tables {
  items: Record<number, DestinyInventoryItemDefinition>;
  plugSets: Record<number, DestinyPlugSetDefinition>;
}

export interface Closure {
  items: Set<number>;
  plugSets: Set<number>;
  missing: { table: string; hash: number }[];
}

export const resolveClosure = (owned: Iterable<number>, tables: Tables): Closure => {
  const items = new Set<number>();
  const plugSets = new Set<number>();
  const missing: { table: string; hash: number }[] = [];

  const itemQueue: number[] = [];
  const plugSetQueue: number[] = [];

  for (const hash of owned) {
    if (!items.has(hash)) {
      items.add(hash);
      itemQueue.push(hash);
    }
  }

  while (itemQueue.length > 0 || plugSetQueue.length > 0) {
    while (itemQueue.length > 0) {
      const hash = itemQueue.pop()!;
      const item = tables.items[hash];

      if (!item) {
        missing.push({ table: "InventoryItem", hash });
        continue;
      }

      const refs = itemReferences(item);

      for (const ref of refs.items) {
        if (!items.has(ref)) {
          items.add(ref);
          itemQueue.push(ref);
        }
      }

      for (const ref of refs.plugSets) {
        if (!plugSets.has(ref)) {
          plugSets.add(ref);
          plugSetQueue.push(ref);
        }
      }
    }

    while (plugSetQueue.length > 0) {
      const hash = plugSetQueue.pop()!;
      const plugSet = tables.plugSets[hash];

      if (!plugSet) {
        missing.push({ table: "PlugSet", hash });
        continue;
      }

      for (const ref of plugSetReferences(plugSet)) {
        if (!items.has(ref)) {
          items.add(ref);
          itemQueue.push(ref);
        }
      }
    }
  }

  return { items, plugSets, missing };
};

export interface Dangling {
  table: string;
  hash: number;
}

// Must pass before anything renders
export const validate = (owned: Iterable<number>, tables: Tables): Dangling[] => {
  const dangling: Dangling[] = [];
  const closure = resolveClosure(owned, tables);

  for (const { table, hash } of closure.missing) {
    dangling.push({ table, hash });
  }

  return dangling;
};
