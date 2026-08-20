import type { SlimActivity } from "@dvm/defs-core";
import type { DestinyActivity } from "bungie-api-ts/destiny2";
import { describe, expect, it } from "vitest";

import {
  barred,
  categorize,
  matching,
  readable,
  totalDrops,
  type ActivityTables,
  type Category,
  type Realm,
} from "./activities.ts";

const flat = (realms: Realm[]): Category[] =>
  realms.flatMap((realm) => realm.categories);

const sections = (
  entries: Parameters<typeof categorize>[0],
  tables: ActivityTables,
  recall?: Parameters<typeof categorize>[2],
): Category[] => flat(categorize(entries, tables, recall));

const found = (realms: Realm[], query: string): Category[] =>
  flat(matching(realms, query));

const RAIDS = 1;
const CRUCIBLE = 2;

const definition = (over: Partial<SlimActivity>): SlimActivity => ({
  hash: 0,
  name: "Vault of Glass",
  description: "",
  icon: undefined,
  pgcrImage: undefined,
  activityTypeHash: 100,
  destinationHash: undefined,
  isPlaylist: false,
  isPvP: false,
  isMatchmade: false,
  maxPlayers: 6,
  placeHash: undefined,
  modeType: undefined,
  difficultyHash: undefined,
  leaderRequirements: [],
  fireteamRequirements: [],
  ...over,
});

const tables: ActivityTables = {
  activities: {
    10: definition({ hash: 10, isMatchmade: true }),
    11: definition({ hash: 11, name: "Control", activityTypeHash: 101 }),
    12: definition({ hash: 12, name: "Warlord's Ruin" }),
    13: definition({ hash: 13, name: "" }),
    20: definition({
      hash: 20,
      name: "The Coil: Matchmade",
      isMatchmade: true,
    }),
    21: definition({ hash: 21, name: "The Coil: Customize" }),
    30: definition({ hash: 30, name: "Crota's End" }),
    31: definition({ hash: 31, name: "Last Wish" }),
    32: definition({ hash: 32, name: "King's Fall" }),
  },
  modifiers: {
    900: { hash: 900, name: "Champion Foes", description: "", icon: undefined },
    901: { hash: 901, name: "", description: "", icon: undefined },
  },
  types: {
    100: { hash: 100, name: "Raid", icon: undefined },
    101: { hash: 101, name: "The Crucible", icon: undefined },
  },
  nodes: {
    [RAIDS]: { hash: RAIDS, name: "Raids", icon: undefined, children: [4] },
    4: { hash: 4, name: "Nested", icon: undefined, children: [] },
    [CRUCIBLE]: {
      hash: CRUCIBLE,
      name: "Crucible Ops",
      icon: undefined,
      children: [],
    },
  },
  challenges: { 950: { hash: 950, name: "Weekly Raid Challenge" } },
  difficulties: {
    960: {
      hash: 960,
      tiers: [
        { name: "Normal", level: 31, power: undefined },
        { name: "Master", level: 40, power: 300 },
      ],
    },
    961: {
      hash: 961,
      tiers: [
        { name: "Master", level: 40, power: 300 },
        { name: "Grandmaster", level: 45, power: 400 },
      ],
    },
  },
  destinations: { 700: { hash: 700, name: "The Dreaming City" } },
  places: { 800: { hash: 800, name: "Earth" } },
  rewards: {
    600: { hash: 600, name: "Raid Gear", icon: undefined },
    601: { hash: 601, name: "Deepsight Weapon", icon: undefined },
    602: { hash: 602, name: "", icon: undefined },
    603: { hash: 603, name: "Eutechnology Cover", icon: "/cover.png" },
  },
  sets: {
    50: {
      hash: 50,
      activityHashes: [10, 20, 21, 30, 31, 32],
      activityGraphHashes: [4],
    },
    51: { hash: 51, activityHashes: [11], activityGraphHashes: [CRUCIBLE] },
  },
};

const gate = (hash: number) => ({
  visibilityUnlockExpression: { steps: [{ valueHash: hash }] },
});

const drops = (quantity: number, hash = 7000) => [
  {
    rewardItems: [
      {
        uiStyle: "extra_engram",
        itemQuantity: { itemHash: 500, quantity },
        ...gate(hash),
      },
    ],
  },
];

const focus = (hash = 8000, itemHash = 603) => [
  {
    rewardItems: [
      {
        uiStyle: "daily_grind_guaranteed",
        itemQuantity: { itemHash, quantity: 1 },
        ...gate(hash),
      },
    ],
  },
];

const entry = (over: Partial<DestinyActivity>): DestinyActivity =>
  ({
    activityHash: 10,
    isVisible: true,
    isCompleted: false,
    isFocusedActivity: false,
    modifierHashes: [],
    visibleRewards: [],
    ...over,
  }) as DestinyActivity;

describe("categorize", () => {
  it("walks a nested node up to its root category", () => {
    const [category] = sections([entry({})], tables);

    expect(category?.name).toBe("Raids");
  });

  it("files an activity no set claims under Elsewhere", () => {
    const [category] = sections([entry({ activityHash: 12 })], tables);

    expect(category?.name).toBe("Elsewhere");
  });

  it("folds a root with no name of its own into Elsewhere", () => {
    const nameless: ActivityTables = {
      ...tables,
      nodes: {
        ...tables.nodes,
        5: { hash: 5, name: "", icon: undefined, children: [] },
      },
      destinations: { 700: { hash: 700, name: "The Dreaming City" } },
      places: { 800: { hash: 800, name: "Earth" } },
      rewards: {
        600: { hash: 600, name: "Raid Gear", icon: undefined },
        601: { hash: 601, name: "Deepsight Weapon", icon: undefined },
        602: { hash: 602, name: "", icon: undefined },
      },
      sets: {
        ...tables.sets,
        52: { hash: 52, activityHashes: [12], activityGraphHashes: [5] },
      },
    };

    const categories = sections(
      [entry({}), entry({ activityHash: 12 })],
      nameless,
    );

    expect(categories.map((one) => one.name).sort()).toEqual([
      "Elsewhere",
      "Raids",
    ]);
  });

  it("drops entries the game hides and definitions with no name", () => {
    expect(
      sections(
        [entry({ isVisible: false }), entry({ activityHash: 13 })],
        tables,
      ),
    ).toEqual([]);
  });

  // "Excision: Grandmaster" ships with no mode
  it("drops every activity type Bungie files as Story", () => {
    const story = (hash: number) => ({
      ...tables,
      activities: {
        ...tables.activities,
        10: definition({ hash: 10, activityTypeHash: hash }),
      },
    });

    for (const hash of [1686739444, 1299744814, 2694988718, 1838596016]) {
      expect(sections([entry({})], story(hash))).toEqual([]);
    }
  });

  // The Portal files standalone strikes under World
  it("lifts a strike out of World into its own section", () => {
    const world: ActivityTables = {
      ...tables,
      activities: {
        ...tables.activities,
        10: definition({ hash: 10, activityTypeHash: 3547475498 }),
      },
      nodes: {
        ...tables.nodes,
        3803311165: {
          hash: 3803311165,
          name: "World",
          icon: undefined,
          children: [],
        },
      },
      sets: {
        53: {
          hash: 53,
          activityHashes: [10],
          activityGraphHashes: [3803311165],
        },
      },
    };

    expect(sections([entry({})], world).map((one) => one.name)).toEqual([
      "Strikes (Other)",
    ]);
  });
});

describe("realms", () => {
  it("keeps the director's order rather than sorting on rewards", () => {
    const realms = categorize(
      [
        entry({}),
        entry({ activityHash: 11, visibleRewards: drops(2) as never }),
      ],
      {
        ...tables,
        nodes: {
          ...tables.nodes,
          1851422462: {
            hash: 1851422462,
            name: "Raids",
            icon: undefined,
            children: [],
          },
          1246572235: {
            hash: 1246572235,
            name: "Crucible Ops",
            icon: undefined,
            children: [],
          },
        },
        sets: {
          54: {
            hash: 54,
            activityHashes: [10],
            activityGraphHashes: [1851422462],
          },
          55: {
            hash: 55,
            activityHashes: [11],
            activityGraphHashes: [1246572235],
          },
        },
      },
    );

    expect(realms.map((one) => [one.name, one.bonusDrops])).toEqual([
      ["PvP", 2],
      ["Raids and Dungeons", 0],
    ]);
  });

  it("gathers whatever no realm claims at the end", () => {
    expect(categorize([entry({})], tables).map((one) => one.name)).toEqual([
      "Elsewhere",
    ]);
  });
});

// Same unlock hashes means one reward, two doors
describe("folding variants onto a shared drop flag", () => {
  const coil = () => [
    entry({
      activityHash: 20,
      recommendedLight: 350,
      visibleRewards: drops(3) as never,
    }),
    entry({
      activityHash: 21,
      recommendedLight: 330,
      visibleRewards: drops(3) as never,
    }),
  ];

  it("collapses them into one row named after the activity", () => {
    const [category] = sections(coil(), tables);

    expect(category?.entries).toHaveLength(1);
    expect(category?.entries[0]?.name).toBe("The Coil");
  });

  it("counts the shared engrams once rather than twice", () => {
    const [category] = sections(coil(), tables);

    expect(category?.entries[0]?.bonusDrops).toBe(3);
    expect(category?.bonusDrops).toBe(3);
  });

  it("reads matchmaking as optional when one door matchmakes and the other does not", () => {
    const [category] = sections(coil(), tables);

    expect(category?.entries[0]?.matchmaking).toBe("optional");
  });

  it("reads matchmaking as required when every door matchmakes", () => {
    const [category] = sections(
      [entry({ visibleRewards: drops(1) as never })],
      tables,
    );

    expect(category?.entries[0]?.matchmaking).toBe("required");
  });

  it("reads matchmaking as none when no door matchmakes", () => {
    const [category] = sections(
      [entry({ activityHash: 21, visibleRewards: drops(1) as never })],
      tables,
    );

    expect(category?.entries[0]?.matchmaking).toBe("none");
  });

  it("spans the power of every variant", () => {
    const [category] = sections(coil(), tables);

    expect([
      category?.entries[0]?.power,
      category?.entries[0]?.topPower,
    ]).toEqual([330, 350]);
  });

  // Bungie's isCompleted survives the weekly reset
  it("ignores the completion flag, which does not track the week", () => {
    const [one, two] = coil();
    const [category] = sections([{ ...one!, isCompleted: true }, two!], tables);

    expect(category?.entries[0]?.bonusDrops).toBe(3);
  });

  it("keeps both variants reachable on the folded row", () => {
    const [category] = sections(coil(), tables);

    expect(category?.entries[0]?.variants.map((one) => one.name)).toEqual([
      "The Coil: Matchmade",
      "The Coil: Customize",
    ]);
  });

  it("keeps distinct flags apart", () => {
    const [category] = sections(
      [
        entry({ activityHash: 20, visibleRewards: drops(3, 111) as never }),
        entry({ activityHash: 21, visibleRewards: drops(3, 222) as never }),
      ],
      tables,
    );

    expect(category?.entries).toHaveLength(2);
    expect(category?.bonusDrops).toBe(6);
  });

  it("leaves activities promising nothing standing on their own", () => {
    const [category] = sections(
      [entry({ activityHash: 30 }), entry({ activityHash: 31 })],
      tables,
    );

    expect(category?.entries).toHaveLength(2);
  });

  // The Portal lists a strike twice, playlist and director
  it("folds a reward-less duplicate of the same activity into one row", () => {
    const [category] = sections(
      [
        entry({ activityHash: 30, visibleRewards: drops(2) as never }),
        entry({ activityHash: 30 }),
      ],
      tables,
    );

    expect(category?.entries).toHaveLength(1);
    expect(category?.entries[0]?.bonusDrops).toBe(2);
  });

  it("merges the modifiers of every variant, dropping the nameless", () => {
    const [category] = sections(
      [
        entry({
          activityHash: 20,
          modifierHashes: [900, 901],
          visibleRewards: drops(1) as never,
        }),
        entry({
          activityHash: 21,
          modifierHashes: [900],
          visibleRewards: drops(1) as never,
        }),
      ],
      tables,
    );

    expect(category?.entries[0]?.modifiers.map((one) => one.name)).toEqual([
      "Champion Foes",
    ]);
  });
});

// Raids and dungeons ship loot with no uiStyle
describe("loot the week still owes", () => {
  const loot = (quantity: number, hash = 600) => [
    {
      rewardItems: [
        { uiStyle: "", itemQuantity: { itemHash: hash, quantity } },
      ],
    },
  ];

  it("reads an unstyled reward with something left on it", () => {
    const [category] = sections(
      [entry({ visibleRewards: loot(1) as never })],
      tables,
    );

    expect(category?.entries[0]?.bonus).toEqual([
      { name: "Raid Gear", icon: undefined, quantity: 1 },
    ]);
  });

  it("ignores one already spent", () => {
    const [category] = sections(
      [entry({ visibleRewards: loot(0) as never })],
      tables,
    );

    expect(category?.entries[0]?.bonus).toEqual([]);
  });

  it("ignores a reward it cannot name", () => {
    const [category] = sections(
      [entry({ visibleRewards: loot(1, 602) as never })],
      tables,
    );

    expect(category?.entries[0]?.bonus).toEqual([]);
  });

  it("counts the sections holding bonus rewards", () => {
    const [category] = sections(
      [entry({ visibleRewards: loot(1) as never })],
      tables,
    );

    expect(category?.bonus).toBe(1);
  });

  it("ranks bonus rewards below the bonus focus and above the spotlight", () => {
    const [category] = sections(
      [
        entry({ activityHash: 30, isFocusedActivity: true }),
        entry({ activityHash: 31, visibleRewards: loot(1) as never }),
        entry({ activityHash: 32, visibleRewards: focus() as never }),
      ],
      tables,
    );

    expect(
      category?.entries.map((one) => [
        Boolean(one.focus),
        one.bonus.length,
        one.focused,
      ]),
    ).toEqual([
      [true, 0, false],
      [false, 1, false],
      [false, 0, true],
    ]);
  });
});

describe("location", () => {
  it("prefers the destination", () => {
    const placed: ActivityTables = {
      ...tables,
      activities: {
        ...tables.activities,
        10: definition({
          hash: 10,
          isMatchmade: true,
          destinationHash: 700,
          placeHash: 800,
        }),
      },
    };

    const [category] = sections([entry({})], placed);

    expect(category?.entries[0]?.location).toBe("The Dreaming City");
  });

  it("falls back to the place when there is no destination", () => {
    const placed: ActivityTables = {
      ...tables,
      activities: {
        ...tables.activities,
        10: definition({ hash: 10, isMatchmade: true, placeHash: 800 }),
      },
    };

    const [category] = sections([entry({})], placed);

    expect(category?.entries[0]?.location).toBe("Earth");
  });

  it("drops a destination that only repeats the activity type", () => {
    const same: ActivityTables = {
      ...tables,
      activities: {
        ...tables.activities,
        10: definition({ hash: 10, isMatchmade: true, destinationHash: 701 }),
      },
      destinations: {
        ...tables.destinations,
        701: { hash: 701, name: "Raid" },
      },
    };

    const [category] = sections([entry({})], same);

    expect(category?.entries[0]?.location).toBeUndefined();
  });

  it("leaves it undefined when neither resolves", () => {
    const [category] = sections([entry({})], tables);

    expect(category?.entries[0]?.location).toBeUndefined();
  });
});

describe("the campaign", () => {
  it("is dropped entirely rather than listed", () => {
    const story: ActivityTables = {
      ...tables,
      nodes: {
        ...tables.nodes,
        230424: { hash: 230424, name: "unused", icon: undefined, children: [] },
      },
      sets: {
        ...tables.sets,
        53: {
          hash: 53,
          activityHashes: [12],
          activityGraphHashes: [230721469],
        },
      },
    };

    // 230724421 is the Portal's Campaign root
    const dropped: ActivityTables = {
      ...story,
      nodes: {
        ...story.nodes,
        230724421: {
          hash: 230724421,
          name: "Campaign",
          icon: undefined,
          children: [],
        },
      },
      sets: {
        ...tables.sets,
        53: {
          hash: 53,
          activityHashes: [12],
          activityGraphHashes: [230724421],
        },
      },
    };

    expect(sections([entry({ activityHash: 12 })], dropped)).toEqual([]);
    expect(
      sections([entry({}), entry({ activityHash: 12 })], dropped),
    ).toHaveLength(1);
  });
});

// Checked against what the game prints
describe("the game's own vocabulary", () => {
  it("counts bonus drops rather than engrams", () => {
    const [category] = sections(
      [entry({ activityHash: 20, visibleRewards: drops(3) as never })],
      tables,
    );

    expect(category?.entries[0]?.bonusDrops).toBe(3);
  });

  it("names the piece the focus is on", () => {
    const [category] = sections(
      [entry({ visibleRewards: focus() as never })],
      tables,
    );

    expect(category?.entries[0]?.focus).toEqual({
      name: "Eutechnology Cover",
      icon: "/cover.png",
      quantity: 1,
    });
  });

  it("carries both when an activity offers both", () => {
    const both = [...(drops(3) as never[]), ...(focus() as never[])] as never;

    const [category] = sections([entry({ visibleRewards: both })], tables);
    const [only] = category?.entries ?? [];

    expect([only?.bonusDrops, only?.focus?.name]).toEqual([
      3,
      "Eutechnology Cover",
    ]);
  });

  it("leaves the focus undefined when it cannot name the piece", () => {
    const [category] = sections(
      [entry({ visibleRewards: focus(8000, 602) as never })],
      tables,
    );

    expect(category?.entries[0]?.focus).toBeUndefined();
  });

  it("finds an activity by the piece it is focused on", () => {
    const realms = categorize(
      [entry({ visibleRewards: focus() as never })],
      tables,
    );

    expect(found(realms, "eutechnology")).toHaveLength(1);
  });
});

// Observed 2026-08-18: Quickplay: Master read 1
describe("what the bonus count actually means", () => {
  it("reports what is left, which the expression threshold agrees with", () => {
    const capped = [
      {
        rewardItems: [
          {
            uiStyle: "extra_engram",
            itemQuantity: { itemHash: 500, quantity: 3 },
            visibilityUnlockExpression: {
              steps: [
                { stepOperator: 10, valueHash: 7000 },
                { stepOperator: 11, value: 3 },
                { stepOperator: 8, value: -1 },
              ],
            },
          },
        ],
      },
    ];

    const [category] = sections(
      [entry({ visibleRewards: capped as never })],
      tables,
    );

    expect(category?.entries[0]?.bonusDrops).toBe(3);
  });
});

// Bungie empties visibleRewards when you spend
describe("remembering what a spent week held", () => {
  const memory = { flag: "7000", bonusDrops: 3, focus: undefined, bonus: [] };

  it("reports what was taken once the payload empties", () => {
    const [category] = sections(
      [entry({ visibleRewards: [] })],
      tables,
      () => memory,
    );
    const row = category?.entries[0];

    expect([row?.bonusDrops, row?.dropsTaken]).toEqual([0, 3]);
  });

  it("counts only the difference when some are left", () => {
    const [category] = sections(
      [entry({ visibleRewards: drops(1) as never })],
      tables,
      () => memory,
    );

    expect(category?.entries[0]?.dropsTaken).toBe(2);
  });

  it("claims nothing taken when the live payload is the fullest seen", () => {
    const [category] = sections(
      [entry({ visibleRewards: drops(3) as never })],
      tables,
      () => memory,
    );

    expect(category?.entries[0]?.dropsTaken).toBe(0);
  });

  it("surfaces the focus and the loot the payload dropped", () => {
    const held = {
      ...memory,
      focus: { name: "Eutechnology Cover", icon: undefined, quantity: 1 },
      bonus: [{ name: "Raid Gear", icon: undefined, quantity: 1 }],
    };

    const [category] = sections(
      [entry({ visibleRewards: [] })],
      tables,
      () => held,
    );
    const row = category?.entries[0];

    expect([row?.spentFocus?.name, row?.spentBonus[0]?.name]).toEqual([
      "Eutechnology Cover",
      "Raid Gear",
    ]);
  });

  it("keeps a live reward out of the spent slots", () => {
    const held = {
      ...memory,
      focus: { name: "Eutechnology Cover", icon: undefined, quantity: 1 },
    };

    const [category] = sections(
      [entry({ visibleRewards: focus() as never })],
      tables,
      () => held,
    );

    expect(category?.entries[0]?.spentFocus).toBeUndefined();
  });

  it("holds a folded row together after its flag has gone", () => {
    const [category] = sections(
      [
        entry({ activityHash: 20, visibleRewards: [] }),
        entry({ activityHash: 21, visibleRewards: [] }),
      ],
      tables,
      () => memory,
    );

    expect(category?.entries).toHaveLength(1);
    expect(category?.entries[0]?.variants).toHaveLength(2);
  });
});

describe("rank", () => {
  it("sorts bonus drops above the focus, and that above the spotlight", () => {
    const [category] = sections(
      [
        entry({ activityHash: 30, isFocusedActivity: true }),
        entry({ activityHash: 31, visibleRewards: focus() as never }),
        entry({ activityHash: 32, visibleRewards: drops(3) as never }),
      ],
      tables,
    );

    expect(
      category?.entries.map((one) => [
        one.bonusDrops,
        Boolean(one.focus),
        one.focused,
      ]),
    ).toEqual([
      [3, false, false],
      [0, true, false],
      [0, false, true],
    ]);
  });

  it("floats the category holding the most engrams", () => {
    const categories = sections(
      [
        entry({}),
        entry({ activityHash: 11, visibleRewards: drops(2) as never }),
      ],
      tables,
    );

    expect(categories.map((one) => one.name)).toEqual([
      "Crucible Ops",
      "Raids",
    ]);
  });
});

describe("matching", () => {
  const realms = () =>
    categorize(
      [
        entry({
          activityHash: 20,
          visibleRewards: drops(3) as never,
          modifierHashes: [900],
        }),
        entry({ activityHash: 21, visibleRewards: drops(3) as never }),
        entry({ activityHash: 11, visibleRewards: drops(2, 999) as never }),
      ],
      tables,
    );

  it("returns everything for a blank query", () => {
    expect(found(realms(), "  ")).toHaveLength(2);
  });

  it("finds by the folded name", () => {
    expect(found(realms(), "coil").map((one) => one.name)).toEqual(["Raids"]);
  });

  it("finds by a variant name the folded row no longer shows", () => {
    expect(found(realms(), "customize")).toHaveLength(1);
  });

  it("finds by location and by bonus rewards", () => {
    const placed = categorize(
      [
        entry({
          visibleRewards: [
            {
              rewardItems: [
                { uiStyle: "", itemQuantity: { itemHash: 600, quantity: 1 } },
              ],
            },
          ] as never,
        }),
      ],
      {
        ...tables,
        activities: {
          ...tables.activities,
          10: definition({ hash: 10, isMatchmade: true, destinationHash: 700 }),
        },
      },
    );

    expect(found(placed, "dreaming")).toHaveLength(1);
    expect(found(placed, "raid gear")).toHaveLength(1);
  });

  it("finds by activity type and by modifier", () => {
    expect(found(realms(), "crucible")[0]?.name).toBe("Crucible Ops");
    expect(found(realms(), "champion")[0]?.name).toBe("Raids");
  });

  it("recounts the engrams of what survived the filter", () => {
    expect(totalDrops(matching(realms(), "coil"))).toBe(3);
  });

  it("drops a category with no hits rather than leaving it empty", () => {
    expect(matching(realms(), "nothing here")).toEqual([]);
  });
});

describe("ordering", () => {
  const ladder: ActivityTables = {
    ...tables,
    activities: {
      ...tables.activities,
      40: definition({ hash: 40, name: "Quickplay: Master" }),
      41: definition({ hash: 41, name: "Quickplay: Normal" }),
      42: definition({ hash: 42, name: "Quickplay: Grandmaster" }),
    },
    sets: {
      ...tables.sets,
      53: { hash: 53, activityHashes: [40, 41, 42], activityGraphHashes: [4] },
    },
  };

  it("puts Quickplay at the front of its section, in tier order", () => {
    const [category] = sections(
      [
        entry({ activityHash: 30, visibleRewards: drops(3) as never }),
        entry({ activityHash: 40 }),
        entry({ activityHash: 41 }),
        entry({ activityHash: 42 }),
      ],
      ladder,
    );

    expect(category?.entries.map((one) => one.name)).toEqual([
      "Quickplay: Normal",
      "Quickplay: Master",
      "Quickplay: Grandmaster",
      "Crota's End",
    ]);
  });
});

describe("challenges", () => {
  const challenge = (progress: number, complete = false) =>
    [
      {
        objective: {
          objectiveHash: 950,
          progress,
          completionValue: 3,
          complete,
        },
      },
    ] as never;

  it("names a challenge rather than counting it", () => {
    const [category] = sections([entry({ challenges: challenge(1) })], tables);

    expect(category?.entries[0]?.challenges).toEqual([
      { name: "Weekly Raid Challenge", progress: 1, goal: 3, complete: false },
    ]);
  });

  it("keeps the furthest along copy when two doors carry the same one", () => {
    const [category] = sections(
      [
        entry({ activityHash: 20, challenges: challenge(1) }),
        entry({ activityHash: 21, challenges: challenge(2) }),
      ],
      tables,
    );

    expect(category?.entries[0]?.challenges[0]?.progress).toBe(2);
  });

  it("ignores a challenge whose objective did not ship", () => {
    const [category] = sections(
      [
        entry({
          challenges: [
            { objective: { objectiveHash: 999, progress: 0 } },
          ] as never,
        }),
      ],
      tables,
    );

    expect(category?.entries[0]?.challenges).toEqual([]);
  });
});

describe("difficulties", () => {
  const laddered: ActivityTables = {
    ...tables,
    activities: {
      ...tables.activities,
      20: definition({
        hash: 20,
        name: "The Coil: Matchmade",
        isMatchmade: true,
        difficultyHash: 961,
      }),
      21: definition({
        hash: 21,
        name: "The Coil: Customize",
        difficultyHash: 960,
      }),
    },
  };

  it("gathers every rung the doors offer between them, in level order", () => {
    const [category] = sections(
      [entry({ activityHash: 20 }), entry({ activityHash: 21 })],
      laddered,
    );

    expect(category?.entries[0]?.difficulties).toEqual([
      { name: "Normal", level: 31, power: undefined },
      { name: "Master", level: 40, power: 300 },
      { name: "Grandmaster", level: 45, power: 400 },
    ]);
  });

  it("has none for an activity with no ladder of its own", () => {
    const [category] = sections([entry({})], tables);

    expect(category?.entries[0]?.difficulties).toEqual([]);
  });
});

describe("locked", () => {
  const gated: ActivityTables = {
    ...tables,
    activities: {
      ...tables.activities,
      10: definition({
        hash: 10,
        isMatchmade: true,
        leaderRequirements: ["Requires Destiny 2: Renegades"],
        fireteamRequirements: [
          "",
          "This activity is currently disabled.",
          "All fireteam members must be at or above {var:198} Power.",
        ],
      }),
    },
  };

  it("names only the requirements this character fails", () => {
    const [category] = sections(
      [
        entry({
          leaderRequirementFailureIndices: [0],
          fireteamRequirementFailureIndices: [1],
        }),
      ],
      gated,
    );

    expect(category?.entries[0]?.locked).toEqual([
      "Requires Destiny 2: Renegades",
      "This activity is currently disabled.",
    ]);
  });

  it("drops the condition the game has no words for, and keeps the rest", () => {
    const [category] = sections(
      [entry({ fireteamRequirementFailureIndices: [0, 2] })],
      gated,
    );

    expect(category?.entries[0]?.locked).toEqual([
      "All fireteam members must be at or above {var:198} Power.",
    ]);
  });
});

describe("difficulty floors", () => {
  it("bars a rung whose floor the character has not reached", () => {
    const grandmaster = { name: "Grandmaster", level: 45, power: 400 };

    expect(barred(grandmaster, 399)).toBe(true);
    expect(barred(grandmaster, 400)).toBe(false);
    expect(barred({ name: "Normal", level: 31, power: undefined }, 1)).toBe(
      false,
    );
  });
});

describe("readable", () => {
  it("puts the number back into a string Bungie left a hole in", () => {
    expect(
      readable("{var:21}% bonus to outgoing Solar damage.", { 21: 25 }),
    ).toBe("25% bonus to outgoing Solar damage.");
  });

  it("leaves a placeholder it has no value for alone", () => {
    expect(readable("Reach {var:99} Power.", {})).toBe("Reach {var:99} Power.");
  });

  it("drops an inline icon and keeps the word it stood for", () => {
    expect(
      readable("You will face [Arc] Arc and [Void] Void shields.", {}),
    ).toBe("You will face Arc and Void shields.");
  });
});
