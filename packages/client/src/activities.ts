import type {
  GearTier,
  SlimActivity,
  SlimActivitySet,
  SlimActivityType,
  SlimChallenge,
  SlimDifficulty,
  SlimGraphNode,
  SlimModifier,
  SlimPlace,
  SlimMode,
  SlimReward,
  SlimSkull,
  SlimTier,
} from "@dvm/defs-core";
import { activityName, DIFFICULTIES } from "@dvm/defs-core";
import type { DestinyActivity } from "bungie-api-ts/destiny2";

import { BUNGIE } from "./bungie.ts";

export interface ActivityTables {
  activities: Record<number, SlimActivity>;
  modifiers: Record<number, SlimModifier>;
  types: Record<number, SlimActivityType>;
  nodes: Record<number, SlimGraphNode>;
  sets: Record<number, SlimActivitySet>;
  destinations: Record<number, SlimPlace>;
  places: Record<number, SlimPlace>;
  rewards: Record<number, SlimReward>;
  challenges: Record<number, SlimChallenge>;
  difficulties: Record<number, SlimDifficulty>;
  skulls: Record<number, SlimSkull>;
  modes: Record<number, SlimMode>;
}

// Bungie's quantity is a flag, not a tally
export interface Loot {
  hash: number;
  name: string;
  icon: string | undefined;
  quantity: number;
}

export interface Challenge {
  name: string;
  progress: number;
  goal: number;
  complete: boolean;
}

export type Matchmaking = "required" | "optional" | "none";

export interface GearDrop {
  base: GearTier;
  top: GearTier;
}

export interface Variant {
  hash: number;
  name: string;
  difficulty: string | undefined;
  power: number | undefined;
  matchmade: boolean;
  gearTier: GearTier | undefined;
}

export interface Recalled {
  flag: string;
  bonusDrops: number;
  focus: Loot | undefined;
  bonus: Loot[];
}

export type Recall = (activityHash: number) => Recalled | undefined;

export interface Available {
  key: string;
  hash: number;
  name: string;
  description: string;
  pgcrImage: string | undefined;
  typeName: string | undefined;
  power: number | undefined;
  topPower: number | undefined;
  location: string | undefined;
  focused: boolean;
  bonus: Loot[];
  bonusDrops: number;
  focus: Loot | undefined;
  matchmaking: Matchmaking;
  challenges: Challenge[];
  // Bungie drops consumed rewards from the payload
  dropsTaken: number;
  spentFocus: Loot | undefined;
  spentBonus: Loot[];
  variants: Variant[];
  gear: GearDrop | undefined;
  modifiers: SlimModifier[];
  difficulties: SlimTier[];
  locked: string[];
}

export interface Category {
  hash: number;
  name: string;
  icon: string | undefined;
  entries: Available[];
  bonusDrops: number;
  bonus: number;
}

export interface Realm {
  name: string;
  categories: Category[];
  bonusDrops: number;
  bonus: number;
}

// Bungie's uiStyle names predate the words on screen
const BONUS_DROP = "extra_engram";

export const BONUS_DROP_ITEM = 3956025454;
const FOCUS = "daily_grind_guaranteed";

const OTHER = 0;
const OTHER_NAME = "Elsewhere";

// Raids and Dungeons each ship twice
const CAMPAIGN = 230724421;
const FIRETEAM_OPS = 4038998327;
const PINNACLE_OPS = 2042336100;
const SOLO_OPS = 1204273545;
const ARENA_OPS = 2699534027;
const CRUCIBLE_OPS = 1246572235;
const GAMBIT_OPS = 3034241322;
const RAIDS = 1851422462;
const RAIDS_ALT = 3797775812;
const DUNGEONS = 837763036;
const DUNGEONS_ALT = 274240080;
const PANTHEON = 2112123535;
const WORLD = 3803311165;

const STRIKES_OTHER = -1;

const NAMES = new Map([[STRIKES_OTHER, "Strikes (Other)"]]);

const REALMS: { name: string; sections: number[] }[] = [
  {
    name: "Vanguard",
    sections: [FIRETEAM_OPS, PINNACLE_OPS, SOLO_OPS, ARENA_OPS, STRIKES_OTHER],
  },
  { name: "PvP", sections: [CRUCIBLE_OPS, GAMBIT_OPS] },
  {
    name: "Raids and Dungeons",
    sections: [RAIDS, RAIDS_ALT, DUNGEONS, DUNGEONS_ALT, PANTHEON],
  },
  { name: "World", sections: [WORLD] },
];

const ELSEWHERE = "Elsewhere";

const REALM_OF = new Map(
  REALMS.flatMap(({ name, sections }) =>
    sections.map((hash): [number, string] => [hash, name]),
  ),
);

// DestinyActivityModeType Story and Social carry no loot
const DROPPED_MODES = new Set([2, 40]);

const BY_MODE = new Map([
  [3, FIRETEAM_OPS],
  [18, FIRETEAM_OPS],
  [46, FIRETEAM_OPS],
  [5, CRUCIBLE_OPS],
  [63, GAMBIT_OPS],
  [64, GAMBIT_OPS],
  [4, RAIDS],
  [82, DUNGEONS],
  [6, WORLD],
  [93, WORLD],
]);

const DROPPED_TYPES = new Set([1838596016, 1686739444, 1299744814, 2694988718]);

const STRIKE_TYPES = new Set([3547475498, 4110605575]);

const RAID_TYPE = 2043403989;
const DUNGEON_TYPE = 608898761;

const BY_TYPE = new Map([[RAID_TYPE, RAIDS]]);

// Bungie names both doors after the fireteam
const VARIANT = /\s*[:-]\s*(Matchmade|Customize)\s*$/;

interface ArtIndex {
  exact: Map<string, SlimActivity[]>;
  named: Map<string, SlimActivity[]>;
}

const ART_INDEX = new WeakMap<ActivityTables, ArtIndex>();

const push = (
  into: Map<string, SlimActivity[]>,
  key: string,
  one: SlimActivity,
) => {
  const found = into.get(key);

  if (found) {
    found.push(one);
  } else {
    into.set(key, [one]);
  }
};

const artIndex = (tables: ActivityTables): ArtIndex => {
  const held = ART_INDEX.get(tables);

  if (held) {
    return held;
  }

  const built: ArtIndex = { exact: new Map(), named: new Map() };

  for (const definition of Object.values(tables.activities)) {
    if (!definition.pgcrImage) {
      continue;
    }

    push(built.exact, identity(definition), definition);
    push(built.named, definition.name.replace(VARIANT, ""), definition);
  }

  ART_INDEX.set(tables, built);

  return built;
};

// "Master Conquest: Derealize" is the same mission as "Derealize", one prefix deeper
const tail = (name: string): string => {
  const parts = name.split(": ");

  return parts[parts.length - 1]!;
};

/** Resolves art for one activity, reaching for twins Bungie gave art the profile never lists */
export const activityArt = (
  definition: SlimActivity,
  tables: ActivityTables,
  group: SlimActivity[] = [],
): string | undefined => {
  const index = artIndex(tables);
  const bare = definition.name.replace(VARIANT, "");
  const where = definition.destinationHash ?? definition.placeHash ?? 0;
  const arted = [
    definition,
    ...group,
    ...(index.exact.get(identity(definition)) ?? []),
    ...(index.named.get(bare) ?? []),
    ...(index.exact.get(`${tail(bare)}|${where}`) ?? []),
    ...(index.named.get(tail(bare)) ?? []),
  ].filter((one) => one.pgcrImage);

  return (
    arted.find((one) => one.modeType === definition.modeType)?.pgcrImage ??
    arted[0]?.pgcrImage
  );
};

const backdrop = (
  group: { definition: SlimActivity }[],
  tables: ActivityTables,
): string | undefined =>
  activityArt(
    group[0]!.definition,
    tables,
    group.map(({ definition }) => definition),
  );

// 55 Portal activities carry no art anywhere in the manifest, so the tile falls back to a wash
const WASH: Record<string, string> = {
  "The Crucible": "#7a2320, #31161a",
  "Trials of Osiris": "#8a6a1f, #2b2418",
  "Lighthouse Simulation": "#8a6a1f, #2b2418",
  Nightfall: "#8a5410, #2c2015",
  "Vanguard Op": "#1f4f77, #16212c",
  Raid: "#6d4f12, #28211a",
  Gambit: "#3f6b1c, #1b2716",
  "Seasonal Arena": "#1d5f5c, #16262a",
  "Exotic Mission": "#5a4a7a, #221f2c",
  Mission: "#33475c, #1a2029",
  Story: "#33475c, #1a2029",
  "Solo Ops": "#2c5566, #182227",
  Crawl: "#573a5e, #241a29",
  Explore: "#3f5a35, #1d2419",
  Social: "#6b563a, #262019",
  "Sparrow Racing League": "#7a3a5a, #2a1a24",
};

const NEUTRAL_WASH = "#3a3d42, #1e2024";

/** A background-image value for an activity tile, either its art or a wash keyed to its type */
export const tileArt = (
  image: string | undefined,
  typeName: string | undefined,
): string =>
  image
    ? `url(${BUNGIE}${image})`
    : `linear-gradient(150deg, ${WASH[typeName ?? ""] ?? NEUTRAL_WASH})`;

// bungie-api-ts 5.10.0 does not model the unlock expression
interface Gated {
  visibilityUnlockExpression?: { steps?: { valueHash?: number }[] };
}

const flag = (entry: DestinyActivity): string => {
  const hashes = new Set<string>();

  for (const group of entry.visibleRewards ?? []) {
    for (const item of group.rewardItems) {
      const gate = (item as Gated).visibilityUnlockExpression;

      for (const step of gate?.steps ?? []) {
        if (step.valueHash) {
          hashes.add(String(step.valueHash));
        }
      }
    }
  }

  return [...hashes].sort().join(".");
};

// Quantity zero is how Bungie omits a reward
const loot = (entry: DestinyActivity, tables: ActivityTables): Loot[] => {
  const found = new Map<string, Loot>();

  for (const group of entry.visibleRewards ?? []) {
    for (const item of group.rewardItems) {
      const { itemHash, quantity } = item.itemQuantity;
      const named = tables.rewards[itemHash];

      if (item.uiStyle || quantity < 1 || !named?.name) {
        continue;
      }

      const already = found.get(named.name);

      if (already) {
        already.quantity += quantity;
      } else {
        found.set(named.name, {
          hash: itemHash,
          name: named.name,
          icon: named.icon,
          quantity,
        });
      }
    }
  }

  return [...found.values()];
};

// The tier lives on the reward item's type line, and the quantity flag says nothing about it
const gearOf = (
  entry: DestinyActivity,
  tables: ActivityTables,
): GearTier | undefined => {
  let found: GearTier | undefined = undefined;

  for (const group of entry.visibleRewards ?? []) {
    for (const item of group.rewardItems) {
      const tier = tables.rewards[item.itemQuantity.itemHash]?.gearTier;

      if (!tier) {
        continue;
      }

      found = found
        ? {
            low: Math.min(found.low, tier.low),
            high: Math.max(found.high, tier.high),
          }
        : tier;
    }
  }

  return found;
};

const reward = (entry: DestinyActivity, style: string): number => {
  let total = 0;

  for (const group of entry.visibleRewards ?? []) {
    for (const item of group.rewardItems) {
      if (item.uiStyle === style) {
        total += item.itemQuantity.quantity;
      }
    }
  }

  return total;
};

const focusOf = (
  entry: DestinyActivity,
  tables: ActivityTables,
): Loot | undefined => {
  for (const group of entry.visibleRewards ?? []) {
    for (const item of group.rewardItems) {
      const named = tables.rewards[item.itemQuantity.itemHash];

      if (item.uiStyle === FOCUS && named?.name) {
        return {
          hash: item.itemQuantity.itemHash,
          name: named.name,
          icon: named.icon,
          quantity: item.itemQuantity.quantity,
        };
      }
    }
  }

  return undefined;
};

interface Tree {
  byActivity: Map<number, number>;
  tops: SlimGraphNode[];
}

const roots = (tables: ActivityTables): Tree => {
  const parent = new Map<number, number>();

  for (const node of Object.values(tables.nodes)) {
    for (const child of node.children) {
      parent.set(child, node.hash);
    }
  }

  const rootOf = (hash: number): number => {
    const seen = new Set<number>();
    let at = hash;

    while (!seen.has(at)) {
      seen.add(at);

      const up = parent.get(at);

      if (up === undefined) {
        return at;
      }

      at = up;
    }

    return at;
  };

  const byActivity = new Map<number, number>();

  for (const set of Object.values(tables.sets)) {
    const [node] = set.activityGraphHashes;

    if (node === undefined) {
      continue;
    }

    const root = rootOf(node);

    for (const activity of set.activityHashes) {
      if (!byActivity.has(activity)) {
        byActivity.set(activity, root);
      }
    }
  }

  const tops = Object.values(tables.nodes).filter(
    (node) => node.name && !parent.has(node.hash),
  );

  return { byActivity, tops };
};

// Avoids "The Crucible in The Crucible"
const place = (
  definition: SlimActivity,
  tables: ActivityTables,
  type: string | undefined,
): string | undefined => {
  const found =
    tables.destinations[definition.destinationHash ?? 0]?.name ||
    tables.places[definition.placeHash ?? 0]?.name;

  return found && found !== type ? found : undefined;
};

const TIERS = [
  "normal",
  "standard",
  "advanced",
  "expert",
  "master",
  "grandmaster",
];

const QUICKPLAY = /^Quickplay\b/;

const tier = (name: string): number => {
  const found = TIERS.indexOf(
    name
      .slice(name.indexOf(":") + 1)
      .trim()
      .toLowerCase(),
  );

  return found === -1 ? TIERS.length : found;
};

const rank = (a: Available, b: Available): number => {
  const quick = Number(QUICKPLAY.test(b.name)) - Number(QUICKPLAY.test(a.name));

  if (quick !== 0) {
    return quick;
  }

  if (QUICKPLAY.test(a.name)) {
    return tier(a.name) - tier(b.name);
  }

  return (
    b.bonusDrops - a.bonusDrops ||
    Number(Boolean(b.focus)) - Number(Boolean(a.focus)) ||
    Number(b.bonus.length > 0) - Number(a.bonus.length > 0) ||
    Number(b.focused) - Number(a.focused) ||
    (b.topPower ?? 0) - (a.topPower ?? 0) ||
    a.name.localeCompare(b.name)
  );
};

export const barred = (tier: SlimTier, power: number | undefined): boolean =>
  tier.power !== undefined && (power === undefined || power < tier.power);

const VARIABLE = /\{var:(\d+)\}/g;

// "[Arc] Arc damage": the icon token is droppable
const SYMBOL = /\[[^\]]+\]\s*/g;

// Bungie ships the numbers in the profile, not the string
export const readable = (
  text: string,
  values: Record<number, number>,
): string =>
  text
    .replace(VARIABLE, (whole, hash) => String(values[Number(hash)] ?? whole))
    .replace(SYMBOL, "");

// Profile returns indices of the failed labels
const refused = (entry: DestinyActivity, definition: SlimActivity): string[] =>
  [
    ...(entry.leaderRequirementFailureIndices ?? []).map(
      (at) => definition.leaderRequirements[at],
    ),
    ...(entry.fireteamRequirementFailureIndices ?? []).map(
      (at) => definition.fireteamRequirements[at],
    ),
  ].flatMap((label) => (label ? [label] : []));

const fold = (
  group: { entry: DestinyActivity; definition: SlimActivity }[],
  key: string,
  tables: ActivityTables,
  recall: Recall,
): Available => {
  const first = group[0]!;
  const powers = group
    .map(({ entry }) => entry.recommendedLight)
    .flatMap((power) => (power ? [power] : []));

  const matchmade = group.filter(({ definition }) => definition.isMatchmade);

  const matchmaking: Matchmaking =
    matchmade.length === 0
      ? "none"
      : matchmade.length === group.length
      ? "required"
      : "optional";

  const type =
    first.definition.activityTypeHash === undefined
      ? undefined
      : tables.types[first.definition.activityTypeHash]?.name;

  const drops = Math.max(
    ...group.map(({ entry }) => reward(entry, BONUS_DROP)),
  );
  const focus = group.map(({ entry }) => focusOf(entry, tables)).find(Boolean);
  const bonus =
    group
      .map(({ entry }) => loot(entry, tables))
      .find((one) => one.length > 0) ?? [];

  const before = group
    .map(({ entry }) => recall(entry.activityHash))
    .filter((one) => one !== undefined);

  const wasDrops = Math.max(drops, ...before.map((one) => one.bonusDrops));

  // Bungie ships some modifiers twice under one name
  const modifiers = new Map<string, SlimModifier>();

  for (const { entry } of group) {
    for (const hash of entry.modifierHashes ?? []) {
      const modifier = tables.modifiers[hash];

      if (!modifier?.name) {
        continue;
      }

      const held = modifiers.get(modifier.name);

      if (held && held.description.length >= modifier.description.length) {
        continue;
      }

      modifiers.set(modifier.name, modifier);
    }
  }

  const challenged = new Map<number, Challenge>();

  for (const { entry } of group) {
    for (const { objective } of entry.challenges ?? []) {
      const named = tables.challenges[objective.objectiveHash]?.name;
      const held = challenged.get(objective.objectiveHash);
      const done = objective.progress ?? 0;

      if (!named || (held && held.progress >= done)) {
        continue;
      }

      challenged.set(objective.objectiveHash, {
        name: named,
        progress: done,
        goal: objective.completionValue,
        complete: objective.complete,
      });
    }
  }

  const tiers = new Map<string, SlimTier>();

  for (const { definition } of group) {
    for (const tier of tables.difficulties[definition.difficultyHash ?? 0]
      ?.tiers ?? []) {
      if (!tiers.has(tier.name)) {
        tiers.set(tier.name, tier);
      }
    }
  }

  const locked = new Set(
    group.flatMap(({ entry, definition }) => refused(entry, definition)),
  );

  const variants = group.map(({ entry, definition }) => ({
    hash: entry.activityHash,
    name: definition.name,
    difficulty: definition.difficulty,
    power: entry.recommendedLight,
    matchmade: definition.isMatchmade,
    gearTier: gearOf(entry, tables),
  }));

  const tiered = variants
    .flatMap((one) =>
      one.gearTier
        ? [
            {
              rung: DIFFICULTIES.indexOf(one.difficulty ?? ""),
              tier: one.gearTier,
            },
          ]
        : [],
    )
    .sort((a, b) => a.rung - b.rung);

  const easiest = tiered[0];
  const hardest = tiered[tiered.length - 1];

  const gear =
    easiest && hardest ? { base: easiest.tier, top: hardest.tier } : undefined;

  return {
    key,
    hash: first.entry.activityHash,
    // Shared: "The Coil: Matchmade" and "The Coil: Customize"
    name: baseName(first.definition),
    description: first.definition.description,
    pgcrImage: backdrop(group, tables),
    typeName: type,
    power: powers.length > 0 ? Math.min(...powers) : undefined,
    topPower: powers.length > 0 ? Math.max(...powers) : undefined,
    location: place(first.definition, tables, type),
    focused: group.some(({ entry }) => entry.isFocusedActivity),
    bonus,
    bonusDrops: drops,
    focus,
    dropsTaken: wasDrops - drops,
    spentFocus: focus
      ? undefined
      : before.map((one) => one.focus).find(Boolean),
    spentBonus:
      bonus.length > 0
        ? []
        : before.map((one) => one.bonus).find((one) => one.length > 0) ?? [],
    matchmaking,
    challenges: [...challenged.values()],
    variants,
    gear,
    modifiers: [...modifiers.values()],
    difficulties: [...tiers.values()].sort((a, b) => a.level - b.level),
    locked: [...locked],
  };
};

const section = (
  definition: SlimActivity,
  tree: Tree,
  tables: ActivityTables,
): number | undefined => {
  if (
    (definition.activityTypeHash !== undefined &&
      DROPPED_TYPES.has(definition.activityTypeHash)) ||
    (definition.modeType !== undefined &&
      DROPPED_MODES.has(definition.modeType))
  ) {
    return undefined;
  }

  const claimed = tree.byActivity.get(definition.hash);

  if (claimed === CAMPAIGN) {
    return undefined;
  }

  if (claimed !== undefined && tables.nodes[claimed]?.name) {
    return claimed;
  }

  // "Fireteam Ops (Epic)" and "Solo Ops" name themselves
  const named = tree.tops.find((node) => definition.name.startsWith(node.name));

  if (named) {
    return named.hash;
  }

  // Mode alone misfiles Arena and Solo Quickplay
  const from = tables.destinations[definition.destinationHash ?? 0]?.name;
  const belongs = from
    ? tree.tops.find((node) => node.name === from)
    : undefined;

  if (belongs) {
    return belongs.hash;
  }

  const byMode =
    definition.modeType === undefined
      ? undefined
      : BY_MODE.get(definition.modeType);

  const byType =
    definition.activityTypeHash === undefined
      ? undefined
      : BY_TYPE.get(definition.activityTypeHash);

  return byMode ?? byType ?? OTHER;
};

const placed = (definition: SlimActivity, root: number): number =>
  root === WORLD &&
  definition.activityTypeHash !== undefined &&
  STRIKE_TYPES.has(definition.activityTypeHash)
    ? STRIKES_OTHER
    : root;

// Raids and dungeons ship one activity per difficulty instead of one carrying a ladder
const LADDERED_TYPES = new Set([RAID_TYPE, DUNGEON_TYPE]);

const laddered = (definition: SlimActivity): boolean =>
  definition.activityTypeHash !== undefined &&
  LADDERED_TYPES.has(definition.activityTypeHash);

const baseName = (definition: SlimActivity): string =>
  laddered(definition)
    ? activityName(definition.name)
    : definition.name.replace(VARIANT, "");

// Grasp of Avarice gives its two doors their own destinations, and they share only the place
const identity = (definition: SlimActivity): string => {
  const where = laddered(definition)
    ? definition.placeHash ?? definition.destinationHash ?? 0
    : definition.destinationHash ?? definition.placeHash ?? 0;

  return `${baseName(definition)}|${where}`;
};

const home = (
  group: { definition: SlimActivity }[],
  tree: Tree,
  tables: ActivityTables,
): number => {
  const found = group.flatMap(({ definition }) => {
    const root = section(definition, tree, tables);

    return root === undefined ? [] : [placed(definition, root)];
  });

  return (
    found.find(
      (root) => root !== WORLD && root !== STRIKES_OTHER && root !== OTHER,
    ) ??
    found[0] ??
    OTHER
  );
};

export const categorize = (
  entries: DestinyActivity[],
  tables: ActivityTables,
  recall: Recall = () => undefined,
): Realm[] => {
  const tree = roots(tables);
  const groups = new Map<
    string,
    { entry: DestinyActivity; definition: SlimActivity }[]
  >();

  const kept: { entry: DestinyActivity; definition: SlimActivity }[] = [];

  for (const entry of entries) {
    const definition = tables.activities[entry.activityHash];

    if (
      entry.isVisible === false ||
      !definition?.name ||
      section(definition, tree, tables) === undefined
    ) {
      continue;
    }

    kept.push({ entry, definition });
  }

  const offers = (one: (typeof kept)[number]): boolean =>
    reward(one.entry, BONUS_DROP) > 0 ||
    Boolean(focusOf(one.entry, tables)) ||
    loot(one.entry, tables).length > 0;

  const gate = (one: (typeof kept)[number]): string =>
    offers(one)
      ? flag(one.entry) || recall(one.entry.activityHash)?.flag || ""
      : "";

  for (const one of kept.filter((held) => gate(held))) {
    const key = `${identity(one.definition)}|${gate(one)}`;
    groups.set(key, [...(groups.get(key) ?? []), one]);
  }

  for (const one of kept.filter((held) => !gate(held))) {
    const mine = identity(one.definition);
    const joined = [...groups.keys()].find(
      (key) => key.slice(0, key.lastIndexOf("|")) === mine,
    );

    const key = joined ?? mine;
    groups.set(key, [...(groups.get(key) ?? []), one]);
  }

  const buckets = new Map<
    number,
    { entry: DestinyActivity; definition: SlimActivity }[][]
  >();

  for (const group of groups.values()) {
    const root = home(group, tree, tables);
    const held = buckets.get(root) ?? [];
    buckets.set(root, held);
    held.push(group);
  }

  const categories = [...buckets.entries()]
    .map(([hash, held]) => {
      const node = tables.nodes[hash];
      const entries = held
        .map((group) =>
          fold(group, identity(group[0]!.definition), tables, recall),
        )
        .sort(rank);

      return {
        hash,
        name: NAMES.get(hash) || node?.name || OTHER_NAME,
        icon: node?.icon,
        entries,
        bonusDrops: entries.reduce((total, one) => total + one.bonusDrops, 0),
        bonus: entries.filter((one) => one.bonus.length > 0).length,
      };
    })
    .sort(
      (a, b) =>
        b.bonusDrops - a.bonusDrops ||
        b.entries.length - a.entries.length ||
        a.name.localeCompare(b.name),
    );

  return gather(categories);
};

const gather = (categories: Category[]): Realm[] => {
  const held = new Map<string, Category[]>();

  for (const category of categories) {
    const name = REALM_OF.get(category.hash) ?? ELSEWHERE;
    const bucket = held.get(name) ?? [];
    held.set(name, bucket);
    bucket.push(category);
  }

  const order = [...REALMS.map((realm) => realm.name), ELSEWHERE];

  return order.flatMap((name) => {
    const found = held.get(name);

    if (!found) {
      return [];
    }

    return [
      {
        name,
        categories: found,
        bonusDrops: found.reduce((total, one) => total + one.bonusDrops, 0),
        bonus: found.reduce((total, one) => total + one.bonus, 0),
      },
    ];
  });
};

export const seen = (
  entries: DestinyActivity[],
  tables: ActivityTables,
): Record<number, Recalled> => {
  const rows: Record<number, Recalled> = {};

  for (const entry of entries) {
    if (entry.isVisible === false) {
      continue;
    }

    rows[entry.activityHash] = {
      flag: flag(entry),
      bonusDrops: reward(entry, BONUS_DROP),
      focus: focusOf(entry, tables),
      bonus: loot(entry, tables),
    };
  }

  return rows;
};

export const totalDrops = (realms: Realm[]): number =>
  realms.reduce((total, realm) => total + realm.bonusDrops, 0);

export const matching = (realms: Realm[], query: string): Realm[] => {
  const needle = query.trim().toLowerCase();

  if (!needle) {
    return realms;
  }

  const hit = (entry: Available): boolean =>
    entry.name.toLowerCase().includes(needle) ||
    Boolean(entry.typeName?.toLowerCase().includes(needle)) ||
    Boolean(entry.location?.toLowerCase().includes(needle)) ||
    entry.bonus.some((one) => one.name.toLowerCase().includes(needle)) ||
    Boolean(entry.focus?.name.toLowerCase().includes(needle)) ||
    entry.variants.some((one) => one.name.toLowerCase().includes(needle)) ||
    entry.modifiers.some((one) => one.name.toLowerCase().includes(needle));

  return realms.flatMap((realm) => {
    const categories = realm.categories.flatMap((category) => {
      const entries = category.entries.filter(hit);

      if (entries.length === 0) {
        return [];
      }

      return [
        {
          ...category,
          entries,
          bonusDrops: entries.reduce((total, one) => total + one.bonusDrops, 0),
          bonus: entries.filter((one) => one.bonus.length > 0).length,
        },
      ];
    });

    if (categories.length === 0) {
      return [];
    }

    return [
      {
        ...realm,
        categories,
        bonusDrops: categories.reduce(
          (total, one) => total + one.bonusDrops,
          0,
        ),
        bonus: categories.reduce((total, one) => total + one.bonus, 0),
      },
    ];
  });
};
