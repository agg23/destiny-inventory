import type {
  DestinyActivityDefinition,
  DestinyActivityDifficultyTierCollectionDefinition,
  DestinyDestinationDefinition,
  DestinyInventoryItemDefinition,
  DestinyPlaceDefinition,
  DestinyActivityModeDefinition,
  DestinyActivityModifierDefinition,
  DestinyActivityTypeDefinition,
  DestinyFireteamFinderActivityGraphDefinition,
  DestinyFireteamFinderActivitySetDefinition,
  DestinyObjectiveDefinition,
  DestinyVendorDefinition,
} from "bungie-api-ts/destiny2";

export interface SlimActivity {
  hash: number;
  name: string;
  description: string;
  icon: string | undefined;
  pgcrImage: string | undefined;
  activityTypeHash: number | undefined;
  destinationHash: number | undefined;
  modeTypes: number[];
  difficulty: string | undefined;
  isPlaylist: boolean;
  isPvP: boolean;
  isMatchmade: boolean;
  maxPlayers: number | undefined;
  placeHash: number | undefined;
  modeType: number | undefined;
  difficultyHash: number | undefined;
  // Kept as two lists because the profile returns the failures as indices into each of them
  leaderRequirements: string[];
  fireteamRequirements: string[];
}

export interface SlimTier {
  // A report's difficultyTier indexes Bungie's unsorted list
  index: number;
  name: string;
  level: number;
  power: number | undefined;
}

export interface SlimDifficulty {
  hash: number;
  tiers: SlimTier[];
}

export interface SlimPlace {
  hash: number;
  name: string;
}

export interface GearTier {
  low: number;
  high: number;
}

export interface SlimReward {
  hash: number;
  name: string;
  icon: string | undefined;
  gearTier: GearTier | undefined;
}

export interface SlimModifier {
  hash: number;
  name: string;
  description: string;
  icon: string | undefined;
}

export interface SlimActivityType {
  hash: number;
  name: string;
  icon: string | undefined;
}

export interface SlimGraphNode {
  hash: number;
  name: string;
  icon: string | undefined;
  children: number[];
}

export interface SlimChallenge {
  hash: number;
  name: string;
}

export interface SlimActivitySet {
  hash: number;
  activityHashes: number[];
  activityGraphHashes: number[];
}

const named = (display: {
  hasIcon: boolean;
  icon?: string;
}): string | undefined => (display.hasIcon ? display.icon : undefined);

// 707 activities point at Bungie's grey placeholder and 10 at an unfilled strike template
const PLACEHOLDERS = ["placeholder", "template_strike"];

const art = (image: string | undefined): string | undefined =>
  image && !PLACEHOLDERS.some((one) => image.includes(one)) ? image : undefined;

// Empty labels stay in place so the profile's failure indices still line up
const labels = (found: { displayString: string }[] | undefined): string[] =>
  (found ?? []).map((label) => label.displayString);

export const slimActivity = (
  activity: DestinyActivityDefinition,
): SlimActivity => ({
  hash: activity.hash,
  name: activity.displayProperties.name,
  description: activity.displayProperties.description,
  icon: named(activity.displayProperties),
  pgcrImage: art(activity.pgcrImage),
  activityTypeHash: activity.activityTypeHash,
  destinationHash: activity.destinationHash,
  placeHash: activity.placeHash,
  modeType: activity.directActivityModeType,
  modeTypes: activity.activityModeTypes ?? [],
  difficulty: difficultyOf(activity.displayProperties.name),
  isPlaylist: activity.isPlaylist,
  isPvP: activity.isPvP,
  isMatchmade: Boolean(activity.matchmaking?.isMatchmade),
  maxPlayers: activity.matchmaking?.maxPlayers,
  difficultyHash: activity.difficultyTierCollectionHash,
  leaderRequirements: labels(activity.requirements?.leaderRequirementLabels),
  fireteamRequirements: labels(
    activity.requirements?.fireteamRequirementLabels,
  ),
});

// DestinyActivityDifficultyTierType.Training, the tutorial ladder rather than a choice
const TRAINING = 1;

export const slimDifficulty = (
  collection: DestinyActivityDifficultyTierCollectionDefinition,
): SlimDifficulty => ({
  hash: collection.hash,
  tiers: collection.difficultyTiers
    .map((tier, index) => ({ tier, index }))
    .filter(
      ({ tier }) =>
        tier.tierType !== TRAINING && tier.displayProperties.name.length > 0,
    )
    .toSorted((a, b) => a.tier.tierRank - b.tier.tierRank)
    .map(({ tier, index }) => ({
      index,
      name: tier.displayProperties.name,
      level: tier.activityLevel,
      power:
        tier.minimumFireteamLeaderPower > 0
          ? tier.minimumFireteamLeaderPower
          : undefined,
    })),
});

/**
 * Ordered difficulty tiers in the Bungie API
 */
const LADDER: { name: string; pattern: RegExp }[] = [
  // Anchored, or "Standard Matchmaking" reads as a rung
  { name: "Standard", pattern: /\bstandard$/i },
  { name: "Normal", pattern: /\bnormal\b/i },
  { name: "Adept", pattern: /\badept\b/i },
  { name: "Hero", pattern: /\bhero\b|\(heroic\)/i },
  { name: "Advanced", pattern: /\badvanced\b/i },
  { name: "Expert", pattern: /\bexpert\b/i },
  { name: "Legend", pattern: /\blegend(ary)?\b/i },
  { name: "Prestige", pattern: /\bprestige\b/i },
  { name: "Master", pattern: /\bmaster\b/i },
  { name: "Grandmaster", pattern: /\bgrandmaster\b/i },
  { name: "Ultimate", pattern: /\bultimate\b/i },
];

export const DIFFICULTIES = LADDER.map((rung) => rung.name);

/** Reads the hardest rung a name claims: "Salvage Legend: Master" is Master */
export const difficultyOf = (name: string): string | undefined => {
  for (let at = LADDER.length - 1; at >= 0; at -= 1) {
    const rung = LADDER[at];

    if (rung?.pattern.test(name)) {
      return rung.name;
    }
  }

  return undefined;
};

const LABELS = new Set(
  [...DIFFICULTIES, "Legendary", "Heroic", "Customize"].map((one) =>
    one.toLowerCase(),
  ),
);

const TRAILING = /\s*\(([^)]*)\)\s*$/;

/** Reads "Nightfall: The Ordeal: Legend" back as "Nightfall: The Ordeal" */
export const activityName = (name: string): string => {
  const kept = name
    .replace(TRAILING, (whole, inside: string) =>
      LABELS.has(inside.toLowerCase()) ? "" : whole,
    )
    .split(": ")
    .filter((part) => !LABELS.has(part.toLowerCase()));

  return kept.length > 0 ? kept.join(": ") : name;
};

export const slimModifier = (
  modifier: DestinyActivityModifierDefinition,
): SlimModifier => ({
  hash: modifier.hash,
  name: modifier.displayProperties.name,
  description: modifier.displayProperties.description,
  icon: named(modifier.displayProperties),
});

export interface SlimMode {
  hash: number;
  modeType: number;
  name: string;
  isAggregate: boolean;
  parentHashes: number[];
}

export const slimMode = (mode: DestinyActivityModeDefinition): SlimMode => ({
  hash: mode.hash,
  modeType: mode.modeType,
  name: mode.displayProperties.name,
  isAggregate: mode.isAggregateMode,
  parentHashes: mode.parentHashes ?? [],
});

export interface SlimSkull {
  hash: number;
  name: string;
  description: string;
}

interface SelectableSkullCollection {
  selectableActivitySkulls?: {
    activitySkull?: {
      skullIdentifierHash: number;
      displayProperties: { name: string; description: string };
    };
  }[];
}

/** Flattens the collections into one table keyed the way a PGCR reports skulls */
export const skullTable = (
  collections: Record<string, unknown>,
): Record<number, SlimSkull> => {
  const table: Record<number, SlimSkull> = {};

  for (const collection of Object.values(collections)) {
    const rows =
      (collection as SelectableSkullCollection).selectableActivitySkulls ?? [];

    for (const row of rows) {
      const skull = row.activitySkull;

      if (!skull || !skull.displayProperties.name) {
        continue;
      }

      table[skull.skullIdentifierHash] = {
        hash: skull.skullIdentifierHash,
        name: skull.displayProperties.name,
        description: skull.displayProperties.description,
      };
    }
  }

  return table;
};

export const slimActivityType = (
  type: DestinyActivityTypeDefinition,
): SlimActivityType => ({
  hash: type.hash,
  name: type.displayProperties.name,
  icon: named(type.displayProperties),
});

// Only the tree shape and labels survive; the rest serves an in-game browser we are not rebuilding
export const slimGraphNode = (
  node: DestinyFireteamFinderActivityGraphDefinition,
): SlimGraphNode => ({
  hash: node.hash,
  name: node.displayProperties.name,
  icon: named(node.displayProperties),
  children: node.children ?? [],
});

// Sets exist here only to say which Portal node an activity hangs under
export const slimActivitySet = (
  set: DestinyFireteamFinderActivitySetDefinition,
): SlimActivitySet => ({
  hash: set.hash,
  activityHashes: set.activityHashes ?? [],
  activityGraphHashes: set.activityGraphHashes ?? [],
});

// Activities are missing one or the other often enough to want both zoom levels
export const slimPlace = (
  place: DestinyDestinationDefinition | DestinyPlaceDefinition,
): SlimPlace => ({
  hash: place.hash,
  name: place.displayProperties.name,
});

// "Gear Tier 3", or "Gear Tier 1-5" on the engrams that roll a spread
const GEAR_TIER = /^Gear Tier (\d+)(?:-(\d+))?$/;

const gearTier = (label: string | undefined): GearTier | undefined => {
  const found = GEAR_TIER.exec(label ?? "");

  if (!found) {
    return undefined;
  }

  const low = Number(found[1]);
  const high = found[2] === undefined ? low : Number(found[2]);

  return { low, high };
};

export interface SlimVendor {
  hash: number;
  displayProperties: {
    name: string;
    subtitle: string;
    icon: string | undefined;
  };
  failureStrings: string[];
  acceptedItems: DestinyVendorDefinition["acceptedItems"];
  displayCategories: { index: number; identifier: string; name: string }[];
}

/** Enough of a vendor to name it and read its refusal reasons; stock is live-only */
export const slimVendor = (item: DestinyVendorDefinition): SlimVendor => ({
  hash: item.hash,
  displayProperties: {
    name: item.displayProperties.name,
    subtitle: item.displayProperties.subtitle,
    icon: named(item.displayProperties),
  },
  failureStrings: item.failureStrings ?? [],
  acceptedItems: item.acceptedItems ?? [],
  displayCategories: (item.displayCategories ?? []).map((category) => ({
    index: category.index,
    identifier: category.identifier,
    name: category.displayProperties?.name ?? "",
  })),
});

export const slimReward = (
  item: DestinyInventoryItemDefinition,
): SlimReward => ({
  hash: item.hash,
  name: item.displayProperties.name,
  icon: named(item.displayProperties),
  gearTier: gearTier(item.itemTypeDisplayName),
});

// The playlist challenges open with their own progress, which the count on the card repeats
const COUNTED = /^\(\d+\/\d+\)\s*/;

// Only a third of objectives are named, and progressDescription degenerates to "Activities"
export const slimChallenge = (
  objective: DestinyObjectiveDefinition,
): SlimChallenge => ({
  hash: objective.hash,
  name:
    objective.displayProperties.name ||
    objective.displayProperties.description.replace(COUNTED, "") ||
    objective.progressDescription,
});
