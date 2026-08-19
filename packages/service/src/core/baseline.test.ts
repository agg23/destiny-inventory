import { describe, expect, it } from "vitest";

import {
  capture,
  dayStart,
  readBaseline,
  refresh,
  weekStart,
  type Store,
} from "./baseline.ts";

const at = (iso: string) => new Date(iso);

const memory = (): Store & { held: Record<string, string> } => {
  const held: Record<string, string> = {};

  return {
    held,
    get: async (key) => held[key] ?? null,
    put: async (key, value) => {
      held[key] = value;
    },
  };
};

describe("reset windows", () => {
  // Adam's own reset, which bounds every bonus drop his profile reports
  it("anchors the week on Tuesday at 17:00 UTC", () => {
    expect(weekStart(at("2026-08-19T03:33:35Z"))).toBe(
      "2026-08-18T17:00:00.000Z",
    );
  });

  it("keeps Tuesday before the hour on the week that is ending", () => {
    expect(weekStart(at("2026-08-18T16:59:00Z"))).toBe(
      "2026-08-11T17:00:00.000Z",
    );
    expect(weekStart(at("2026-08-18T17:00:00Z"))).toBe(
      "2026-08-18T17:00:00.000Z",
    );
  });

  it("holds one answer all week and turns over on the next Tuesday", () => {
    const week = weekStart(at("2026-08-18T17:00:00Z"));

    for (const day of ["19", "20", "23", "24"]) {
      expect(weekStart(at(`2026-08-${day}T12:00:00Z`))).toBe(week);
    }

    expect(weekStart(at("2026-08-25T17:00:00Z"))).not.toBe(week);
  });

  it("rolls the day at the same hour", () => {
    expect(dayStart(at("2026-08-20T16:59:00Z"))).toBe(
      "2026-08-19T17:00:00.000Z",
    );
    expect(dayStart(at("2026-08-20T17:01:00Z"))).toBe(
      "2026-08-20T17:00:00.000Z",
    );
  });
});

const profile = (rewards: unknown) => ({
  Response: {
    characterActivities: {
      data: {
        a: {
          availableActivities: [
            { activityHash: 10, isVisible: true, visibleRewards: rewards },
          ],
        },
      },
    },
  },
});

const serve = (body: unknown) => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body))) as typeof fetch;
};

const drops = [
  {
    rewardItems: [
      { uiStyle: "extra_engram", itemQuantity: { itemHash: 500, quantity: 3 } },
    ],
  },
];

describe("capture", () => {
  it("reduces the live payload to style, item and quantity", async () => {
    serve(profile(drops));

    const held = await capture(
      "key",
      { membershipType: 3, membershipId: "1" },
      at("2026-08-19T17:05:00Z"),
    );

    expect(held.rows[10]).toEqual([
      { style: "extra_engram", itemHash: 500, quantity: 3 },
    ]);
    expect(held.week).toBe("2026-08-18T17:00:00.000Z");
  });

  it("keeps the fullest payload when a character has already played", async () => {
    serve({
      Response: {
        characterActivities: {
          data: {
            spent: {
              availableActivities: [
                { activityHash: 10, isVisible: true, visibleRewards: [] },
              ],
            },
            fresh: {
              availableActivities: [
                { activityHash: 10, isVisible: true, visibleRewards: drops },
              ],
            },
          },
        },
      },
    });

    const held = await capture(
      "key",
      { membershipType: 3, membershipId: "1" },
      at("2026-08-19T17:05:00Z"),
    );

    expect(held.rows[10]).toHaveLength(1);
  });

  it("refuses a profile that returned nothing rather than storing an empty week", async () => {
    serve({ ErrorCode: 5 });

    await expect(
      capture("key", { membershipType: 3, membershipId: "1" }, new Date()),
    ).rejects.toThrow(/no character activities/);
  });
});

describe("refresh", () => {
  it("captures once and then leaves the week alone", async () => {
    serve(profile(drops));
    const store = memory();
    const now = at("2026-08-19T17:05:00Z");

    await refresh(store, "key", { membershipType: 3, membershipId: "1" }, now);
    const first = store.held.baseline;

    serve(profile([]));
    await refresh(store, "key", { membershipType: 3, membershipId: "1" }, now);

    expect(store.held.baseline).toBe(first);
  });

  it("recaptures once the week has turned over", async () => {
    serve(profile(drops));
    const store = memory();

    await refresh(
      store,
      "key",
      { membershipType: 3, membershipId: "1" },
      at("2026-08-19T17:05:00Z"),
    );

    expect(
      await readBaseline(store, at("2026-08-26T17:05:00Z")),
    ).toBeUndefined();
  });
});
