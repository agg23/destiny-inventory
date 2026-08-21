import type { Baseline as Captured, Reward } from "@dvm/service";

import type { Recalled } from "./activities.ts";

// A live profile deletes a taken reward outright
const ENDPOINT = "/api/baseline";

// The service answers { rows: {} } when nothing is captured
type Served = Partial<Captured>;

export interface Baseline {
  week: string | undefined;
  capturedAt: string | undefined;
  rows: Record<number, Recalled>;
}

const BONUS_DROP = "extra_engram";
const FOCUS = "daily_grind_guaranteed";

export interface Names {
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
      focus ??= {
        name: found.name,
        icon: found.icon,
        quantity: reward.quantity,
      };
      continue;
    }

    if (!reward.style && reward.quantity > 0) {
      bonus.push({
        name: found.name,
        icon: found.icon,
        quantity: reward.quantity,
      });
    }
  }

  // A baseline row is matched by activity, not drop flag
  return { flag: "", bonusDrops, focus, bonus };
};

export const fetchBaseline = async (named: Names): Promise<Baseline> => {
  const empty: Baseline = { week: undefined, capturedAt: undefined, rows: {} };

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
};
