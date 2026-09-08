import { describe, expect, it } from "vitest";

import {
  absorb,
  EMPTY_LEDGER,
  expired,
  orderLedger,
  syncOrders,
  type Ledger,
  type Order,
} from "./orders.ts";

const NOW = Date.UTC(2026, 8, 7, 12);

const PAYOUT = 3829161419;

const order = (id: string, patch: Partial<Order> = {}): Order => ({
  id,
  character: "c1",
  hash: 3143993598,
  name: "Baned Baddies",
  description: "Defeat combatants with Foundry weapons",
  rarity: "Common",
  family: "Foundry Order",
  icon: "/icon.jpg",
  progress: 10_500,
  goal: 150_000,
  readout: "7%",
  complete: false,
  expiresAt: NOW + 86_400_000,
  rewards: [PAYOUT],
  ...patch,
});

describe("expired", () => {
  it("is true once the deadline has passed", () => {
    expect(expired(order("a", { expiresAt: NOW - 1 }), NOW)).toBe(true);
    expect(expired(order("a", { expiresAt: NOW + 1 }), NOW)).toBe(false);
  });

  it("is false for an order with no deadline", () => {
    expect(expired(order("a", { expiresAt: undefined }), NOW)).toBe(false);
  });
});

describe("absorb", () => {
  it("tracks what is in the bucket without logging anything", () => {
    const next = absorb(EMPTY_LEDGER, [order("a")], {}, NOW);

    expect(Object.keys(next.seen)).toEqual(["a"]);
    expect(next.log).toEqual([]);
  });

  it("stamps the moment an order first reads complete", () => {
    const first = absorb(EMPTY_LEDGER, [order("a")], {}, NOW);
    const done = absorb(
      first,
      [order("a", { complete: true })],
      {},
      NOW + 5_000,
    );

    expect(done.seen.a?.completedAt).toBe(NOW + 5_000);
  });

  it("keeps the original completion time across later refreshes", () => {
    let ledger: Ledger = absorb(
      EMPTY_LEDGER,
      [order("a", { complete: true })],
      {},
      NOW,
    );
    ledger = absorb(ledger, [order("a", { complete: true })], {}, NOW + 60_000);

    expect(ledger.seen.a?.completedAt).toBe(NOW);
  });

  it("logs a completed order once it leaves the bucket", () => {
    const done = absorb(
      EMPTY_LEDGER,
      [order("a", { complete: true })],
      {},
      NOW,
    );
    const claimed = absorb(done, [], {}, NOW + 30_000);

    expect(claimed.seen).toEqual({});
    expect(claimed.log).toEqual([
      {
        id: "a",
        hash: 3143993598,
        name: "Baned Baddies",
        family: "Foundry Order",
        completedAt: NOW,
        claimedAt: NOW + 30_000,
        rewards: [PAYOUT],
      },
    ]);
  });

  it("logs an order that vanished as its payout arrived", () => {
    const held = absorb(
      EMPTY_LEDGER,
      [order("a")],
      { c1: { [PAYOUT]: 2 } },
      NOW,
    );
    const paid = absorb(held, [], { c1: { [PAYOUT]: 3 } }, NOW + 30_000);

    expect(paid.log.map((one) => one.id)).toEqual(["a"]);
    expect(paid.log[0]?.completedAt).toBe(NOW + 30_000);
  });

  it("spends each payout on a single vanished order", () => {
    const held = absorb(
      EMPTY_LEDGER,
      [order("a"), order("b")],
      { c1: { [PAYOUT]: 0 } },
      NOW,
    );
    const paid = absorb(held, [], { c1: { [PAYOUT]: 1 } }, NOW + 30_000);

    expect(paid.log.map((one) => one.id)).toEqual(["a"]);
  });

  it("does not log against a payout another character earned", () => {
    const held = absorb(
      EMPTY_LEDGER,
      [order("a")],
      { c1: { [PAYOUT]: 0 }, c2: { [PAYOUT]: 0 } },
      NOW,
    );
    const paid = absorb(
      held,
      [],
      { c1: { [PAYOUT]: 0 }, c2: { [PAYOUT]: 1 } },
      NOW + 30_000,
    );

    expect(paid.log).toEqual([]);
  });

  it("takes a first payout count as a baseline, not as growth", () => {
    const held = absorb(EMPTY_LEDGER, [order("a")], {}, NOW);
    const paid = absorb(held, [], { c1: { [PAYOUT]: 4 } }, NOW + 30_000);

    expect(paid.log).toEqual([]);
  });

  it("does not log an order abandoned without finishing", () => {
    const seenOnce = absorb(EMPTY_LEDGER, [order("a")], {}, NOW);
    const gone = absorb(seenOnce, [], {}, NOW + 30_000);

    expect(gone.log).toEqual([]);
  });

  it("does not log an expired order that never completed", () => {
    const stale = order("a", { expiresAt: NOW - 1, progress: 0 });
    const gone = absorb(
      absorb(EMPTY_LEDGER, [stale], {}, NOW),
      [],
      {},
      NOW + 1_000,
    );

    expect(gone.log).toEqual([]);
  });

  it("logs newest first and leaves earlier entries alone", () => {
    let ledger = absorb(
      EMPTY_LEDGER,
      [order("a", { complete: true })],
      {},
      NOW,
    );
    ledger = absorb(ledger, [], {}, NOW + 1_000);
    ledger = absorb(
      ledger,
      [order("b", { complete: true, name: "Rapid Response" })],
      {},
      NOW + 2_000,
    );
    ledger = absorb(ledger, [], {}, NOW + 3_000);

    expect(ledger.log.map((one) => one.id)).toEqual(["b", "a"]);
  });

  it("survives a refresh that returns no orders at all", () => {
    expect(absorb(EMPTY_LEDGER, [], {}, NOW)).toEqual(EMPTY_LEDGER);
  });
});

describe("syncOrders", () => {
  it("ignores a profile that has not landed yet", () => {
    syncOrders([], {}, NOW);

    expect(orderLedger()).toEqual(EMPTY_LEDGER);
  });
});
