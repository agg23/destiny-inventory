import type { DestinyProfileResponse } from "bungie-api-ts/destiny2";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DefStore } from "../profile/store.ts";
import type { Chunk, Observed } from "./types.ts";

const served: { pages: unknown[][]; pulls: string[] } = { pages: [], pulls: [] };

vi.mock("../api/auth.ts", () => ({
  callService: async (path: string) => {
    if (!path.includes("?since=")) {
      return new Response(JSON.stringify({ now: Date.now() }));
    }

    served.pulls.push(path);
    const chunks = served.pages.shift() ?? [];

    return new Response(
      JSON.stringify({ chunks, more: served.pages.length > 0 }),
    );
  },
}));

const { bucketOf, changesBetween, recordProfile, startStats, SYNC_INTERVAL } =
  await import("./log.ts");

const GLIMMER = 3159615086;
const SILVER = 3147280338;
const START = Date.parse("2026-10-18T17:00:00Z");

const memoryStore = (): DefStore => {
  const profile = new Map<string, unknown>();
  const chunks = new Map<string, Chunk>();
  const keyOf = (membershipId: string, startsAt: number) =>
    `${membershipId}/${startsAt}`;

  return {
    getOne: async <T>(_store: string, key: string) => profile.get(key) as T,
    putOne: async (_store, key, value) => {
      profile.set(key, structuredClone(value));
    },
    putAll: async (_store, records) => {
      for (const record of records as Chunk[]) {
        chunks.set(
          keyOf(record.membershipId, record.startsAt),
          structuredClone(record),
        );
      }
    },
    getRange: async <T>(
      _store: string,
      lower: IDBValidKey,
      upper: IDBValidKey,
    ) => {
      const [membershipId, from] = lower as [string, number];
      const to = (upper as [string, number])[1];

      return [...chunks.values()]
        .filter(
          (chunk) =>
            chunk.membershipId === membershipId &&
            chunk.startsAt >= from &&
            chunk.startsAt <= to,
        )
        .sort((a, b) => a.startsAt - b.startsAt) as T[];
    },
  } as DefStore;
};

const profile = (
  minted: number,
  glimmer: number,
  silver: number | undefined = undefined,
): DestinyProfileResponse =>
  ({
    responseMintedTimestamp: new Date(minted).toISOString(),
    profileCurrencies: {
      data: {
        items: [
          { itemHash: GLIMMER, quantity: glimmer },
          ...(silver === undefined
            ? []
            : [{ itemHash: SILVER, quantity: silver }]),
        ],
      },
    },
  }) as unknown as DestinyProfileResponse;

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("stats log", () => {
  beforeEach(() => {
    served.pages = [];
    served.pulls = [];
    localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    vi.setSystemTime(START + 60_000);
    vi.stubGlobal("navigator", {
      locks: {
        request: (_name: string, grant: () => Promise<void>) => grant(),
      },
    });
    vi.stubGlobal("window", {
      setInterval: globalThis.setInterval,
      clearInterval: globalThis.clearInterval,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("logs each change once when the recorder restarts mid bucket", async () => {
    const store = memoryStore();

    const first = startStats(store, "m");
    await settle();
    await recordProfile("m", profile(START + 10_000, 1_000));
    await recordProfile("m", profile(START + 25_000, 1_100));
    first();

    // A tab picking up the lock must diff against what the last one saw
    startStats(store, "m");
    await settle();
    await recordProfile("m", profile(START + 25_000, 1_100));
    await recordProfile("m", profile(START + 40_000, 1_300));

    const changes = await changesBetween(store, "m", START, START + 60_000);
    const chunks = await store.getRange<Chunk>(
      "statChunks",
      ["m", 0],
      ["m", Number.MAX_SAFE_INTEGER],
    );

    expect(
      changes.map((change) => [change.at, "after" in change && change.after]),
    ).toEqual([
      [START + 25_000, 1_100],
      [START + 40_000, 1_300],
    ]);
    expect(chunks.map((chunk) => chunk.startsAt)).toEqual([bucketOf(START)]);
  });

  it("holds Silver at its last balance while out of game", async () => {
    const store = memoryStore();

    startStats(store, "m");
    await settle();
    await recordProfile("m", profile(START + 10_000, 1_000, 500));
    await recordProfile("m", profile(START + 25_000, 1_100));
    await recordProfile("m", profile(START + 40_000, 1_100, 500));

    const changes = await changesBetween(store, "m", START, START + 60_000);
    const observed = await store.getOne<Observed>("profile", "observed/m");

    expect(
      changes.map((change) => "itemHash" in change && change.itemHash),
    ).toEqual([GLIMMER]);
    expect(observed?.currencies[SILVER]).toBe(500);
  });

  it("takes one recorder's copy of a closed bucket and never the open one", async () => {
    const store = memoryStore();
    const remote = (startsAt: number) => ({
      startsAt,
      endsAt: startsAt + SYNC_INTERVAL,
      body: JSON.stringify([
        { kind: "currency", itemHash: GLIMMER, before: 1_000, after: 1_100 },
        { kind: "currency", itemHash: GLIMMER, before: 1_100, after: 1_200 },
      ]),
      updatedAt: START,
    });

    startStats(store, "m");
    await settle();
    await recordProfile("m", profile(START + 10_000, 1_000));
    await recordProfile("m", profile(START + 25_000, 1_100));

    // The sync below runs one bucket later, while START + SYNC_INTERVAL is open
    served.pages = [[remote(START), remote(START + SYNC_INTERVAL)]];
    await vi.advanceTimersByTimeAsync(SYNC_INTERVAL);
    await settle();

    const chunks = await store.getRange<Chunk>(
      "statChunks",
      ["m", 0],
      ["m", Number.MAX_SAFE_INTEGER],
    );

    expect(
      chunks.map((chunk) => [chunk.startsAt, chunk.changes.length]),
    ).toEqual([[START, 2]]);
  });
  it("pulls page after page from where the last one ended", async () => {
    const store = memoryStore();
    const remote = (startsAt: number, updatedAt: number) => ({
      startsAt,
      endsAt: startsAt + SYNC_INTERVAL,
      body: JSON.stringify([
        { kind: "currency", itemHash: GLIMMER, before: 1_000, after: 1_100 },
      ]),
      updatedAt,
    });

    served.pages = [
      [remote(START - 2 * SYNC_INTERVAL, 5)],
      [remote(START - SYNC_INTERVAL, 5)],
    ];
    startStats(store, "m");
    await settle();
    await settle();

    const chunks = await store.getRange<Chunk>(
      "statChunks",
      ["m", 0],
      ["m", Number.MAX_SAFE_INTEGER],
    );

    expect(served.pulls).toEqual([
      "/api/stats?since=0&after=0",
      `/api/stats?since=5&after=${START - 2 * SYNC_INTERVAL}`,
    ]);
    expect(chunks.map((chunk) => chunk.startsAt)).toEqual([
      START - 2 * SYNC_INTERVAL,
      START - SYNC_INTERVAL,
    ]);
  });
});
