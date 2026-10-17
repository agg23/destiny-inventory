import type {
  DestinyActivity,
  DestinyActivityRewardItem,
} from "bungie-api-ts/destiny2";
import { sumBy } from "es-toolkit";

import type { GearTier } from "@dvm/defs-core";

import type { ActivityTables, Loot } from "./types.ts";

// Old uiStyle name, the game now says bonus drop
export const BONUS_DROP = "extra_engram";

export const BONUS_DROP_ITEM = 3956025454;
export const FOCUS = "daily_grind_guaranteed";

// bungie-api-ts 5.10.0 does not model the unlock expression
interface Gated {
  visibilityUnlockExpression?: { steps?: { valueHash?: number }[] };
}

const rewardItems = (entry: DestinyActivity): DestinyActivityRewardItem[] =>
  (entry.visibleRewards ?? []).flatMap((group) => group.rewardItems);

export const toLoot = (
  hash: number,
  named: { name: string; icon: string | undefined },
  quantity: number,
): Loot => ({ hash, name: named.name, icon: named.icon, quantity });

export const flag = (entry: DestinyActivity): string => {
  const hashes = new Set<string>();

  for (const item of rewardItems(entry)) {
    const gate = (item as Gated).visibilityUnlockExpression;

    for (const step of gate?.steps ?? []) {
      if (step.valueHash) {
        hashes.add(String(step.valueHash));
      }
    }
  }

  return [...hashes].sort().join(".");
};

// Quantity zero is how Bungie omits a reward
export const loot = (entry: DestinyActivity, tables: ActivityTables): Loot[] => {
  const found = new Map<string, Loot>();

  for (const item of rewardItems(entry)) {
    const { itemHash, quantity } = item.itemQuantity;
    const named = tables.rewards[itemHash];

    if (item.uiStyle || quantity < 1 || !named?.name) {
      continue;
    }

    const already = found.get(named.name);

    if (already) {
      already.quantity += quantity;
    } else {
      found.set(named.name, toLoot(itemHash, named, quantity));
    }
  }

  return [...found.values()];
};

// The tier is on the reward item's type line
export const gearOf = (
  entry: DestinyActivity,
  tables: ActivityTables,
): GearTier | undefined => {
  let found: GearTier | undefined = undefined;

  for (const item of rewardItems(entry)) {
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

  return found;
};

export const reward = (entry: DestinyActivity, style: string): number =>
  sumBy(
    rewardItems(entry).filter((item) => item.uiStyle === style),
    (item) => item.itemQuantity.quantity,
  );

export const focusOf = (
  entry: DestinyActivity,
  tables: ActivityTables,
): Loot | undefined => {
  for (const item of rewardItems(entry)) {
    const { itemHash, quantity } = item.itemQuantity;
    const named = tables.rewards[itemHash];

    if (item.uiStyle === FOCUS && named?.name) {
      return toLoot(itemHash, named, quantity);
    }
  }

  return undefined;
};
