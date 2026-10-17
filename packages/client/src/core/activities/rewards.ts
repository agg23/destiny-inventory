import type { GearTier } from "@dvm/defs-core";
import type { DestinyActivity } from "bungie-api-ts/destiny2";

import type { ActivityTables, Loot } from "./types.ts";

// Bungie's uiStyle names predate the words on screen
export const BONUS_DROP = "extra_engram";

export const BONUS_DROP_ITEM = 3956025454;
const FOCUS = "daily_grind_guaranteed";

// bungie-api-ts 5.10.0 does not model the unlock expression
interface Gated {
  visibilityUnlockExpression?: { steps?: { valueHash?: number }[] };
}

export const flag = (entry: DestinyActivity): string => {
  const hashes = new Set<string>();

  for (const group of entry.visibleRewards ?? []) {
    for (const item of group.rewardItems) {
      const gate = (item as Gated).visibilityUnlockExpression;

      for (const step of gate?.steps ?? []) {
        if (step.valueHash) {
          hashes.add(String(step.valueHash));
        }
      }
    }
  }

  return [...hashes].sort().join(".");
};

// Quantity zero is how Bungie omits a reward
export const loot = (entry: DestinyActivity, tables: ActivityTables): Loot[] => {
  const found = new Map<string, Loot>();

  for (const group of entry.visibleRewards ?? []) {
    for (const item of group.rewardItems) {
      const { itemHash, quantity } = item.itemQuantity;
      const named = tables.rewards[itemHash];

      if (item.uiStyle || quantity < 1 || !named?.name) {
        continue;
      }

      const already = found.get(named.name);

      if (already) {
        already.quantity += quantity;
      } else {
        found.set(named.name, {
          hash: itemHash,
          name: named.name,
          icon: named.icon,
          quantity,
        });
      }
    }
  }

  return [...found.values()];
};

// The tier lives on the reward item's type line, and the quantity flag says nothing about it
export const gearOf = (
  entry: DestinyActivity,
  tables: ActivityTables,
): GearTier | undefined => {
  let found: GearTier | undefined = undefined;

  for (const group of entry.visibleRewards ?? []) {
    for (const item of group.rewardItems) {
      const tier = tables.rewards[item.itemQuantity.itemHash]?.gearTier;

      if (!tier) {
        continue;
      }

      found = found
        ? {
            low: Math.min(found.low, tier.low),
            high: Math.max(found.high, tier.high),
          }
        : tier;
    }
  }

  return found;
};

export const reward = (entry: DestinyActivity, style: string): number => {
  let total = 0;

  for (const group of entry.visibleRewards ?? []) {
    for (const item of group.rewardItems) {
      if (item.uiStyle === style) {
        total += item.itemQuantity.quantity;
      }
    }
  }

  return total;
};

export const focusOf = (
  entry: DestinyActivity,
  tables: ActivityTables,
): Loot | undefined => {
  for (const group of entry.visibleRewards ?? []) {
    for (const item of group.rewardItems) {
      const named = tables.rewards[item.itemQuantity.itemHash];

      if (item.uiStyle === FOCUS && named?.name) {
        return {
          hash: item.itemQuantity.itemHash,
          name: named.name,
          icon: named.icon,
          quantity: item.itemQuantity.quantity,
        };
      }
    }
  }

  return undefined;
};
