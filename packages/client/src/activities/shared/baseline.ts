import type { Baseline as Captured, Reward } from "@dvm/service";

import { activityTables } from "../../core/activities/activityTables.ts";
import { BONUS_DROP, FOCUS, toLoot } from "../../core/activities/rewards.ts";
import type { Recalled } from "../../core/activities/types.ts";
import { cached } from "../../core/api/cache.ts";

// A live profile deletes a taken reward outright
const ENDPOINT = "/api/baseline";

type Served = Partial<Captured>;

export interface Baseline {
  week: string | undefined;
  capturedAt: string | undefined;
  rows: Record<number, Recalled>;
}

interface Names {
  (itemHash: number): { name: string; icon: string | undefined } | undefined;
}

const recall = (rewards: Reward[], named: Names): Recalled => {
  let bonusDrops = 0;
  let focus: Recalled["focus"] = undefined;
  const bonus: Recalled["bonus"] = [];

  for (const reward of rewards) {
    const found = named(reward.itemHash);

    if (reward.style === BONUS_DROP) {
      bonusDrops += reward.quantity;
      continue;
    }

    if (!found?.name) {
      continue;
    }

    if (reward.style === FOCUS) {
      focus ??= toLoot(reward.itemHash, found, reward.quantity);
      continue;
    }

    if (!reward.style && reward.quantity > 0) {
      bonus.push(toLoot(reward.itemHash, found, reward.quantity));
    }
  }

  // A baseline row is matched by activity, not drop flag
  return { flag: "", bonusDrops, focus, bonus };
};

// The capture only changes at weekly reset
export const baseline = cached(async (): Promise<Baseline> => {
  const empty: Baseline = { week: undefined, capturedAt: undefined, rows: {} };
  const tables = await activityTables();
  const named: Names = (hash) => tables.rewards[hash];

  try {
    const response = await fetch(ENDPOINT);

    if (!response.ok) {
      return empty;
    }

    const body = (await response.json()) as Served;
    const rows: Record<number, Recalled> = {};

    for (const [hash, rewards] of Object.entries(body.rows ?? {})) {
      rows[Number(hash)] = recall(rewards, named);
    }

    return { week: body.week, capturedAt: body.capturedAt, rows };
  } catch {
    return empty;
  }
});
