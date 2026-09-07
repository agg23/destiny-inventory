import type { DimItem } from "app/inventory/item-types";
import { getValueStyle } from "app/inventory/store/objectives";
import type { DimStore } from "app/inventory/store-types";
import { DestinyUnlockValueUIStyle } from "bungie-api-ts/destiny2";
import { createSignal, untrack } from "solid-js";

import { defs } from "./defs.ts";

export const ORDERS_BUCKET = 635141261;

const LEDGER = "dvm.orders";

const LOG_CAP = 500;

export interface Order {
  id: string;
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
  log: Claimed[];
}

export const EMPTY_LEDGER: Ledger = { seen: {}, log: [] };

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

const orderOf = (item: DimItem): Order => {
  const steps = item.objectives ?? [];
  const progress = steps.reduce((sum, step) => sum + (step.progress ?? 0), 0);
  const goal = steps.reduce((sum, step) => sum + step.completionValue, 0);
  const expires = item.pursuit?.expiration?.expirationDate;

  return {
    id: item.id,
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
      .map(orderOf),
  );

export const expired = (order: Order, now: number): boolean =>
  order.expiresAt !== undefined && order.expiresAt <= now;

/** Orders still on the clock, soonest deadline first */
export const activeOrders = (stores: DimStore[], now: number): Order[] =>
  readOrders(stores)
    .filter((order) => !expired(order, now))
    .sort((a, b) => (a.expiresAt ?? Infinity) - (b.expiresAt ?? Infinity));

const track = (order: Order, was: Tracked | undefined, now: number): Tracked => ({
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

/**
 * Folds the current bucket into the ledger, logging orders that left it while complete.
 * An order claimed while the app is closed is missed - the bucket is the only witness.
 */
export const absorb = (
  ledger: Ledger,
  orders: Order[],
  now: number,
): Ledger => {
  const seen: Record<string, Tracked> = {};

  for (const order of orders) {
    seen[order.id] = track(order, ledger.seen[order.id], now);
  }

  const held = new Set(orders.map((order) => order.id));
  const claimed: Claimed[] = [];

  for (const [id, was] of Object.entries(ledger.seen)) {
    if (held.has(id) || !was.complete || was.completedAt === undefined) {
      continue;
    }

    claimed.push({
      id,
      hash: was.hash,
      name: was.name,
      family: was.family,
      completedAt: was.completedAt,
      claimedAt: now,
      rewards: was.rewards,
    });
  }

  if (claimed.length === 0) {
    return { seen, log: ledger.log };
  }

  const log = [...claimed, ...ledger.log]
    .sort((a, b) => b.claimedAt - a.claimedAt)
    .slice(0, LOG_CAP);

  return { seen, log };
};

export const loadLedger = (): Ledger => {
  const raw = localStorage.getItem(LEDGER);

  if (!raw) {
    return EMPTY_LEDGER;
  }

  try {
    const held = JSON.parse(raw) as Partial<Ledger>;

    return { seen: held.seen ?? {}, log: held.log ?? [] };
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
export const syncOrders = (stores: DimStore[], now = Date.now()) => {
  if (stores.length === 0) {
    return;
  }

  // Reading the ledger we are about to write would make an effect depend on itself
  const next = absorb(untrack(held), readOrders(stores), now);

  setHeld(next);
  saveLedger(next);
};
