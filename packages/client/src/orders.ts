import type { DimItem } from "app/inventory/item-types";
import { getValueStyle } from "app/inventory/store/objectives";
import type { DimStore } from "app/inventory/store-types";
import { DestinyUnlockValueUIStyle } from "bungie-api-ts/destiny2";
import { createSignal, untrack } from "solid-js";

import { payoutsByReward } from "./challenges.ts";
import { defs } from "./defs.ts";
import type { OrderRewards } from "./load.ts";

export const ORDERS_BUCKET = 635141261;

const LEDGER = "dvm.orders";

const LOG_CAP = 500;

export interface Order {
  id: string;
  character: string;
  hash: number;
  name: string;
  description: string;
  family: string;
  rarity: string;
  icon: string;
  progress: number;
  goal: number;
  readout: string;
  complete: boolean;
  expiresAt: number | undefined;
  rewards: number[];
}

export interface Tracked {
  character: string;
  hash: number;
  name: string;
  family: string;
  progress: number;
  goal: number;
  complete: boolean;
  completedAt: number | undefined;
  expiresAt: number | undefined;
  rewards: number[];
}

export interface Claimed {
  id: string;
  hash: number;
  name: string;
  family: string;
  completedAt: number;
  claimedAt: number;
  rewards: number[];
}

export interface Ledger {
  seen: Record<string, Tracked>;
  payouts: OrderRewards;
  log: Claimed[];
}

export const EMPTY_LEDGER: Ledger = { seen: {}, payouts: {}, log: [] };

// Orders count internal points, so the raw 90500/250000 is not what the game shows
const readoutOf = (item: DimItem, progress: number, goal: number): string => {
  const [first] = item.objectives ?? [];

  if (!first || goal === 0) {
    return "";
  }

  const style = getValueStyle(
    defs()?.Objective.getOptional(first.objectiveHash),
    progress,
    goal,
  );

  if (style === DestinyUnlockValueUIStyle.Percentage) {
    return `${Math.floor((progress / goal) * 100)}%`;
  }

  return `${progress.toLocaleString()} / ${goal.toLocaleString()}`;
};

const orderOf = (item: DimItem, character: string): Order => {
  const steps = item.objectives ?? [];
  const progress = steps.reduce((sum, step) => sum + (step.progress ?? 0), 0);
  const goal = steps.reduce((sum, step) => sum + step.completionValue, 0);
  const expires = item.pursuit?.expiration?.expirationDate;

  return {
    id: item.id,
    character,
    hash: item.hash,
    name: item.name,
    description: item.description,
    family: item.typeName,
    rarity: item.rarity,
    icon: item.icon,
    progress,
    goal,
    readout: readoutOf(item, progress, goal),
    complete: steps.length > 0 && steps.every((step) => step.complete),
    expiresAt: expires === undefined ? undefined : expires.getTime(),
    rewards: (item.pursuit?.rewards ?? []).map((reward) => reward.itemHash),
  };
};

export const readOrders = (stores: DimStore[]): Order[] =>
  stores.flatMap((store) =>
    store.items
      .filter((item) => item.location.hash === ORDERS_BUCKET)
      .map((item) => orderOf(item, store.id)),
  );

export const expired = (order: Order, now: number): boolean =>
  order.expiresAt !== undefined && order.expiresAt <= now;

/** Orders still on the clock, soonest deadline first */
export const activeOrders = (stores: DimStore[], now: number): Order[] =>
  readOrders(stores)
    .filter((order) => !expired(order, now))
    .sort((a, b) => (a.expiresAt ?? Infinity) - (b.expiresAt ?? Infinity));

const track = (
  order: Order,
  was: Tracked | undefined,
  now: number,
): Tracked => ({
  character: order.character,
  hash: order.hash,
  name: order.name,
  family: order.family,
  progress: order.progress,
  goal: order.goal,
  complete: order.complete,
  completedAt: order.complete ? was?.completedAt ?? now : undefined,
  expiresAt: order.expiresAt,
  rewards: order.rewards,
});

// No stored count is no baseline, not growth from zero
const growth = (before: OrderRewards, after: OrderRewards): OrderRewards => {
  const rows: OrderRewards = {};

  for (const [character, counts] of Object.entries(after)) {
    const was = before[character];

    if (was === undefined) {
      continue;
    }

    const row: Record<number, number> = {};

    for (const [hash, waiting] of Object.entries(counts)) {
      row[Number(hash)] = Math.max(0, waiting - (was[Number(hash)] ?? 0));
    }

    rows[character] = row;
  }

  return rows;
};

const spend = (gained: OrderRewards, was: Tracked): boolean => {
  const row = gained[was.character];

  if (row === undefined) {
    return false;
  }

  for (const hash of was.rewards) {
    const waiting = row[hash] ?? 0;

    if (waiting > 0) {
      row[hash] = waiting - 1;

      return true;
    }
  }

  return false;
};

/**
 * Folds the current bucket into the ledger, logging orders that left it after completing.
 * A refresh rarely catches one sitting complete. A payout gained since the last fold is
 * the same proof.
 */
export const absorb = (
  ledger: Ledger,
  orders: Order[],
  payouts: OrderRewards,
  now: number,
): Ledger => {
  const seen: Record<string, Tracked> = {};

  for (const order of orders) {
    seen[order.id] = track(order, ledger.seen[order.id], now);
  }

  const held = new Set(orders.map((order) => order.id));
  const gained = growth(ledger.payouts, payouts);
  const claimed: Claimed[] = [];

  for (const [id, was] of Object.entries(ledger.seen)) {
    if (held.has(id)) {
      continue;
    }

    const paid = spend(gained, was);

    if (!was.complete && !paid) {
      continue;
    }

    claimed.push({
      id,
      hash: was.hash,
      name: was.name,
      family: was.family,
      completedAt: was.completedAt ?? now,
      claimedAt: now,
      rewards: was.rewards,
    });
  }

  if (claimed.length === 0) {
    return { seen, payouts, log: ledger.log };
  }

  const log = [...claimed, ...ledger.log]
    .sort((a, b) => b.claimedAt - a.claimedAt)
    .slice(0, LOG_CAP);

  return { seen, payouts, log };
};

export const loadLedger = (): Ledger => {
  const raw = localStorage.getItem(LEDGER);

  if (!raw) {
    return EMPTY_LEDGER;
  }

  try {
    const held = JSON.parse(raw) as Partial<Ledger>;

    return {
      seen: held.seen ?? {},
      payouts: held.payouts ?? {},
      log: held.log ?? [],
    };
  } catch {
    return EMPTY_LEDGER;
  }
};

export const saveLedger = (ledger: Ledger) => {
  localStorage.setItem(LEDGER, JSON.stringify(ledger));
};

const [held, setHeld] = createSignal<Ledger>(loadLedger());

export const orderLedger = held;

/**
 * Folds the live bucket into the stored ledger. Safe to call on every refresh.
 * Empty stores mean the profile has not landed, and absorbing that would log
 * every complete order as claimed.
 */
export const syncOrders = (
  stores: DimStore[],
  rewards: OrderRewards,
  now = Date.now(),
) => {
  const payouts = payoutsByReward(rewards);

  // A boot from snapshot has the bucket but not the counters
  if (stores.length === 0 || Object.keys(payouts).length === 0) {
    return;
  }

  // Reading the ledger we are about to write would make an effect depend on itself
  const next = absorb(untrack(held), readOrders(stores), payouts, now);

  setHeld(next);
  saveLedger(next);
};
