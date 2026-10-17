import type { DimStore } from "app/inventory/store-types";
import type { DestinyVendorsResponse } from "bungie-api-ts/destiny2";
import { BucketHashes } from "data/d2/generated-enums";

import type { LoadResult } from "./profile/loadTypes.ts";
import { DAY, HOUR } from "./time.ts";
import { orderPayouts, seasonalChallenges } from "./todo/challenges.ts";
import { activeOrders } from "./todo/orders.ts";
import { nextDailyReset, nextWeeklyReset } from "./todo/reset.ts";
import { priorityOffers, rankResets, readVendors } from "./todo/vendors.ts";
import type { VendorItems } from "./todo/vendorTypes.ts";
import type { Tab } from "./url.ts";

export type Priority = "urgent" | "shown" | "hidden";

export const CATEGORIES = ["postmaster", "orders", "vendors"] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Notice {
  key: string;
  category: Category;
  name: string;
  detail: string;
  count: number | undefined;
  endsAt: number | undefined;
  /** How long before endsAt this turns urgent */
  warning: number | undefined;
  /** Something is lost right now if this is ignored, like a full postmaster */
  pressing: boolean;
  /** Worth showing on its own, the rest only matter once urgent */
  actionable: boolean;
  tab: Tab;
}

export type Shown = Notice & { priority: Priority };

/** Urgent loses something if ignored, ready is something you could do, rest is nothing */
export type Tone = "urgent" | "ready" | "rest";

export interface Summary {
  category: Category;
  tone: Tone;
  /** How many separate things are urgent, like a full postmaster and full engrams */
  count: number | undefined;
  tab: Tab;
  notices: Shown[];
}

const POSTMASTER_SIZE = 21;

// Same margin as DIM's postmasterAlmostFull, some activities drop 6 at once
const POSTMASTER_MARGIN = 6;

const COMMON_PAYOUT_UNLOCK = 2299106475;

// Orders turn themselves in, so only a valuable one running out matters
const ORDER_WARNINGS: Record<string, number> = {
  Exotic: DAY,
  Legendary: 6 * HOUR,
};

const TABS: Record<Category, Tab> = {
  postmaster: "vault",
  orders: "todo",
  vendors: "todo",
};

const notice = (
  fields: Pick<Notice, "key" | "category" | "name" | "detail" | "tab"> &
    Partial<Notice>,
): Notice => ({
  count: undefined,
  endsAt: undefined,
  warning: undefined,
  pressing: false,
  actionable: false,
  ...fields,
});

export const priorityOf = (one: Notice, now: number): Priority => {
  const ending =
    one.endsAt !== undefined &&
    one.warning !== undefined &&
    one.endsAt - now < one.warning;

  if (one.pressing || ending) {
    return "urgent";
  }

  return one.actionable ? "shown" : "hidden";
};

const RANK: Record<Priority, number> = { urgent: 0, shown: 1, hidden: 2 };

/** Every notice with its priority, urgent first, then soonest deadline */
export const rankNotices = (notices: Notice[], now: number): Shown[] =>
  notices
    .map((one) => ({ ...one, priority: priorityOf(one, now) }))
    .sort(
      (a, b) =>
        RANK[a.priority] - RANK[b.priority] ||
        (a.endsAt ?? Infinity) - (b.endsAt ?? Infinity),
    );

const urgentCount = (notices: Shown[]): number | undefined => {
  const urgent = notices.filter((one) => one.priority === "urgent").length;

  return urgent > 0 ? urgent : undefined;
};

const summarize = (category: Category, notices: Shown[]): Summary => ({
  category,
  tone: notices.some((one) => one.priority === "urgent")
    ? "urgent"
    : notices.some((one) => one.priority === "shown")
      ? "ready"
      : "rest",
  count: urgentCount(notices),
  tab: TABS[category],
  notices,
});

/** One fixed summary per category */
export const summaries = (ranked: Shown[]): Summary[] =>
  CATEGORIES.map((category) =>
    summarize(
      category,
      ranked.filter((one) => one.category === category),
    ),
  );

export const profileNotices = (
  store: DimStore,
  loaded: LoadResult,
  now: number,
): Notice[] => {
  const notices: Notice[] = [];
  const inBucket = (hash: number) =>
    store.items.filter((item) => item.location.hash === hash);

  const lost = inBucket(BucketHashes.LostItems);

  if (lost.length > 0) {
    notices.push(
      notice({
        key: "postmaster",
        category: "postmaster",
        name: "Postmaster",
        detail: `${lost.length} of ${POSTMASTER_SIZE}`,
        count: lost.length,
        pressing: POSTMASTER_SIZE - lost.length < POSTMASTER_MARGIN,
        actionable: true,
        tab: "vault",
      }),
    );
  }

  const engrams = inBucket(BucketHashes.Engrams);
  const engramCapacity = engrams[0]?.location.capacity ?? 10;

  // Overflow goes to the postmaster
  if (engrams.length >= engramCapacity) {
    notices.push(
      notice({
        key: "engrams",
        category: "postmaster",
        name: "Engrams",
        detail: "Engrams full",
        count: engrams.length,
        pressing: true,
        tab: "vault",
      }),
    );
  }

  for (const payout of orderPayouts(loaded.orderRewards, store.id)) {
    if (payout.waiting > 0) {
      notices.push(
        notice({
          key: `payout-${payout.itemHash}`,
          category: "orders",
          name: payout.name,
          detail: `Collect ${payout.waiting}`,
          count: payout.waiting,
          actionable: true,
          tab: "todo",
        }),
      );
    }
  }

  for (const group of seasonalChallenges(loaded.records, store.id)) {
    const claimable = group.challenges.filter(
      (challenge) => challenge.complete && !challenge.redeemed,
    ).length;

    if (claimable > 0) {
      notices.push(
        notice({
          key: `challenges-${group.period}`,
          category: "orders",
          name:
            group.period === "daily" ? "Daily challenges" : "Weekly challenges",
          detail: `Claim ${claimable}`,
          count: claimable,
          endsAt:
            group.period === "daily"
              ? nextDailyReset(now)
              : nextWeeklyReset(now),
          actionable: true,
          tab: "todo",
        }),
      );
    }
  }

  for (const order of activeOrders([store], now)) {
    if (!order.complete) {
      notices.push(
        notice({
          key: `order-${order.id}`,
          category: "orders",
          name: order.name,
          detail: order.rarity,
          endsAt: order.expiresAt,
          warning: ORDER_WARNINGS[order.rarity],
          tab: "todo",
        }),
      );
    }
  }

  return notices;
};

export const vendorNotices = (
  response: DestinyVendorsResponse,
  items: VendorItems,
  store: DimStore,
  variables: Record<number, number>,
  now: number,
): Notice[] => {
  const notices: Notice[] = [];

  for (const rank of rankResets(response)) {
    if (rank.rank >= rank.cap) {
      notices.push(
        notice({
          key: `rank-${rank.vendor}`,
          category: "vendors",
          name: rank.name,
          detail: "Reset rank",
          // Reputation past the cap is wasted until the reset
          pressing: true,
          actionable: true,
          tab: "todo",
        }),
      );
    }
  }

  for (const vendor of readVendors(
    response,
    items,
    variables,
    store.items,
    [],
  )) {
    const left = vendor.slots.reduce((sum, slot) => sum + slot.remaining, 0);

    // Unclaimed weekly allowances are gone at the reset
    if (left > 0) {
      notices.push(
        notice({
          key: `claims-${vendor.hash}`,
          category: "vendors",
          name: vendor.name,
          detail: `Claim ${left}`,
          count: left,
          endsAt: vendor.refreshesAt ?? nextWeeklyReset(now),
          warning: DAY,
          actionable: true,
          tab: "todo",
        }),
      );
    }
  }

  for (const offer of priorityOffers(response, items)) {
    if (offer.available) {
      notices.push(
        notice({
          key: `priority-${offer.itemHash}`,
          category: "vendors",
          name: offer.name,
          detail: offer.vendor,
          actionable: true,
          tab: "todo",
        }),
      );
    }
  }

  return notices;
};

// TODO: Prototype only. Every category lit at once
export const demoNotices = (store: DimStore, now: number): Notice[] => {
  const [payout] = orderPayouts(
    { [store.id]: { [COMMON_PAYOUT_UNLOCK]: 3 } },
    store.id,
  );
  const [order] = activeOrders([store], now);

  return [
    notice({
      key: "postmaster",
      category: "postmaster",
      name: "Postmaster",
      detail: `19 of ${POSTMASTER_SIZE}`,
      count: 19,
      pressing: true,
      actionable: true,
      tab: "vault",
    }),
    notice({
      key: "payout",
      category: "orders",
      name: payout?.name ?? "Common Payout",
      detail: "Collect 3",
      count: 3,
      actionable: true,
      tab: "todo",
    }),
    notice({
      key: "order",
      category: "orders",
      name: order?.name ?? "Heavy Lift",
      detail: "Exotic",
      endsAt: now + 5 * HOUR,
      warning: DAY,
      tab: "todo",
    }),
    notice({
      key: "claims",
      category: "vendors",
      name: "Zavala",
      detail: "Claim 3",
      count: 3,
      endsAt: nextWeeklyReset(now),
      warning: DAY,
      actionable: true,
      tab: "todo",
    }),
    notice({
      key: "rank-banshee",
      category: "vendors",
      name: "Banshee-44",
      detail: "Reset rank",
      pressing: true,
      actionable: true,
      tab: "todo",
    }),
  ];
};
