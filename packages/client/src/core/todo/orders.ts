import type { DimItem } from "app/inventory/item-types";
import { getValueStyle } from "app/inventory/store/objectives";
import type { DimStore } from "app/inventory/store-types";
import { DestinyUnlockValueUIStyle } from "bungie-api-ts/destiny2";
import { BucketHashes } from "data/d2/generated-enums";
import { pick } from "es-toolkit";
import { createSignal, untrack } from "solid-js";

import { defs } from "../profile/defs.ts";
import type { OrderRewards } from "../profile/loadTypes.ts";
import { readStored, writeStored } from "../storage.ts";
import { objectiveTotals, payoutsByReward } from "./challenges.ts";

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

const TRACKED_FIELDS = [
  "character",
  "hash",
  "name",
  "family",
  "progress",
  "goal",
  "complete",
  "expiresAt",
  "rewards",
] as const;

interface Tracked extends Pick<Order, (typeof TRACKED_FIELDS)[number]> {
  completedAt: number | undefined;
}

export interface Claimed
  extends Pick<Order, "id" | "hash" | "name" | "family" | "rewards"> {
  completedAt: number;
  claimedAt: number;
}

export interface Ledger {
  seen: Record<string, Tracked>;
  payouts: OrderRewards;
  log: Claimed[];
}

export const EMPTY_LEDGER: Ledger = { seen: {}, payouts: {}, log: [] };

// Raw values are internal points (90500/250000)
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
  const { progress, goal } = objectiveTotals(steps);

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
    expiresAt: item.pursuit?.expiration?.expirationDate?.getTime(),
    rewards: (item.pursuit?.rewards ?? []).map((reward) => reward.itemHash),
  };
};

const readOrders = (stores: DimStore[]): Order[] =>
  stores.flatMap((store) =>
    store.items
      .filter((item) => item.location.hash === BucketHashes.Orders)
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
  ...pick(order, TRACKED_FIELDS),
  completedAt: order.complete ? was?.completedAt ?? now : undefined,
});

// A missing stored count isn't growth from zero
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

// Refreshes rarely catch an order sitting complete, payout gains count too
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

const loadLedger = (): Ledger => {
  const held = readStored(LEDGER) as Partial<Ledger> | undefined;

  if (!held) {
    return EMPTY_LEDGER;
  }

  return {
    seen: held.seen ?? {},
    payouts: held.payouts ?? {},
    log: held.log ?? [],
  };
};

const saveLedger = (ledger: Ledger) => {
  writeStored(LEDGER, ledger);
};

const [held, setHeld] = createSignal<Ledger>(loadLedger());

export const orderLedger = held;

/** Folds the live bucket into the stored ledger, safe on every refresh */
export const syncOrders = (
  stores: DimStore[],
  rewards: OrderRewards,
  now = Date.now(),
) => {
  const payouts = payoutsByReward(rewards);

  // Profile not landed yet, or a snapshot boot without counters
  if (stores.length === 0 || Object.keys(payouts).length === 0) {
    return;
  }

  // Avoids the effect depending on its own write
  const next = absorb(untrack(held), readOrders(stores), payouts, now);

  setHeld(next);
  saveLedger(next);
};
