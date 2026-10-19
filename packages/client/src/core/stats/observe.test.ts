import type { DestinyProfileResponse } from "bungie-api-ts/destiny2";
import { describe, expect, it } from "vitest";

import { diff, observe as observeWith, snapshotOf } from "./observe.ts";

const GLIMMER = 3159615086;
const CORE = 3853748946;
const WEAPON = 1234;
const KILLS = 90275515;
const STRIKE = 10;
const KINETIC = 1498876634;
const SEASON_RANK = 3642754928;
const CHARACTER_XP = 3298204156;

interface Shape {
  minted: string;
  glimmer: number;
  cores: number;
  kills: number;
  drops: string[];
  activity: number;
  started: string;
  xp: number;
}

const progressions = (xp: number) => ({
  progressions: {
    [SEASON_RANK]: { progressionHash: SEASON_RANK, currentProgress: xp },
    [CHARACTER_XP]: { progressionHash: CHARACTER_XP, currentProgress: xp },
  },
});

const profile = (shape: Shape): DestinyProfileResponse =>
  ({
    responseMintedTimestamp: shape.minted,
    profileInventory: {
      data: {
        items: [
          { itemHash: CORE, quantity: shape.cores, bucketHash: 1 },
          ...shape.drops.map((id) => ({
            itemHash: 99,
            itemInstanceId: id,
            quantity: 1,
            bucketHash: 2,
          })),
        ],
      },
    },
    profileCurrencies: {
      data: { items: [{ itemHash: GLIMMER, quantity: shape.glimmer }] },
    },
    characterEquipment: {
      data: {
        c1: {
          items: [
            {
              itemHash: WEAPON,
              itemInstanceId: "w1",
              quantity: 1,
              bucketHash: KINETIC,
            },
          ],
        },
      },
    },
    itemComponents: {
      instances: { data: { d1: { primaryStat: { value: 550 } } } },
      sockets: { data: { d1: { sockets: [{ plugHash: 77 }] } } },
      plugObjectives: {
        data: {
          w1: {
            objectivesPerPlug: {
              1: [{ objectiveHash: KILLS, progress: shape.kills }],
            },
          },
        },
      },
    },
    characters: {
      data: { c1: { light: 400, dateLastPlayed: shape.minted } },
    },
    characterProgressions: {
      data: { c1: progressions(shape.xp), c2: progressions(shape.xp) },
    },
    characterActivities: {
      data: {
        c1: {
          currentActivityHash: shape.activity,
          currentActivityModeHash: 0,
          dateActivityStarted: shape.started,
        },
      },
    },
  }) as unknown as DestinyProfileResponse;

const BEFORE: Shape = {
  minted: "2026-10-18T12:00:00Z",
  glimmer: 1_000,
  cores: 5,
  kills: 100,
  drops: [],
  activity: STRIKE,
  started: "2026-10-18T11:50:00Z",
  xp: 44_000_000,
};

const observe = (response: DestinyProfileResponse) =>
  observeWith(response, (hash) => hash === SEASON_RANK);

describe("profile diff", () => {
  it("logs drops, currencies, materials, kills, and XP in one mint window", () => {
    const was = observe(profile(BEFORE));
    const now = observe(
      profile({
        ...BEFORE,
        minted: "2026-10-18T12:00:15Z",
        glimmer: 1_250,
        cores: 4,
        kills: 112,
        drops: ["d1"],
        xp: 44_002_500,
      }),
    );

    const changes = diff(was, now);
    const window = {
      from: Date.parse(BEFORE.minted),
      at: Date.parse("2026-10-18T12:00:15Z"),
    };

    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ...window,
          kind: "item",
          instanceId: "d1",
          added: true,
        }),
        expect.objectContaining({
          kind: "currency",
          itemHash: GLIMMER,
          before: 1_000,
          after: 1_250,
        }),
        expect.objectContaining({
          kind: "stack",
          itemHash: CORE,
          before: 5,
          after: 4,
        }),
        expect.objectContaining({
          kind: "objective",
          instanceId: "w1",
          itemHash: WEAPON,
          objectiveHash: KILLS,
          before: 100,
          after: 112,
        }),
        {
          ...window,
          kind: "progression",
          progressionHash: SEASON_RANK,
          before: 44_000_000,
          after: 44_002_500,
        },
      ]),
    );
    // XP once for the account, not once per character
    expect(changes).toHaveLength(5);
  });

  it("logs a new activity and leaving the game", () => {
    const was = observe(profile(BEFORE));
    const next = observe(
      profile({
        ...BEFORE,
        minted: "2026-10-18T12:00:15Z",
        activity: 20,
        started: "2026-10-18T12:00:05Z",
      }),
    );
    const gone = observe(
      profile({ ...BEFORE, minted: "2026-10-18T12:01:00Z", activity: 0 }),
    );

    expect(diff(was, next)).toEqual([
      expect.objectContaining({
        kind: "activity",
        activityHash: 20,
        startedAt: Date.parse("2026-10-18T12:00:05Z"),
      }),
    ]);
    expect(diff(next, gone)).toEqual([
      expect.objectContaining({
        kind: "activity",
        activityHash: 0,
        startedAt: Date.parse("2026-10-18T12:01:00Z"),
      }),
    ]);
  });

  it("logs nothing for an identical profile", () => {
    const was = observe(profile(BEFORE));
    const now = observe(profile({ ...BEFORE, minted: "2026-10-18T12:00:15Z" }));

    expect(diff(was, now)).toEqual([]);
  });

  it("snapshots a drop's instance components for a rebuild later", () => {
    const snapshot = snapshotOf(profile({ ...BEFORE, drops: ["d1"] }), "d1", undefined);

    expect(snapshot).toEqual({
      item: expect.objectContaining({ itemInstanceId: "d1", itemHash: 99 }),
      components: {
        instances: { primaryStat: { value: 550 } },
        sockets: { sockets: [{ plugHash: 77 }] },
      },
    });
  });
});
