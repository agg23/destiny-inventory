import type {
  DestinyActivityDefinition,
  DestinyActivityDifficultyTierCollectionDefinition,
  DestinyDestinationDefinition,
  DestinyInventoryItemDefinition,
  DestinyPlaceDefinition,
  DestinyActivityModifierDefinition,
  DestinyActivityTypeDefinition,
  DestinyFireteamFinderActivityGraphDefinition,
  DestinyFireteamFinderActivitySetDefinition,
  DestinyObjectiveDefinition,
} from "bungie-api-ts/destiny2";

export interface SlimActivity {
  hash: number;
  name: string;
  description: string;
  icon: string | undefined;
  pgcrImage: string | undefined;
  activityTypeHash: number | undefined;
  destinationHash: number | undefined;
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
  name: string;
  level: number;
  // The launch floor, the only requirement Bungie states as a number rather than prose
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

export interface SlimReward {
  hash: number;
  name: string;
  icon: string | undefined;
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

// 707 activities point at Bungie's grey placeholder, which is worse than showing nothing
const PLACEHOLDER = "placeholder";

const art = (image: string | undefined): string | undefined =>
  image && !image.includes(PLACEHOLDER) ? image : undefined;

// A playlist carries no art of its own, so the tile borrows from its first entry or its mode
export interface ArtSource {
  playlist: (hash: number) => string | undefined;
  mode: (hash: number) => string | undefined;
}

const backdrop = (
  activity: DestinyActivityDefinition,
  source: ArtSource,
): string | undefined => {
  const own = art(activity.pgcrImage);

  if (own) {
    return own;
  }

  const [first] = activity.playlistItems ?? [];
  const borrowed = first ? source.playlist(first.activityHash) : undefined;

  return (
    borrowed ??
    (activity.directActivityModeHash === undefined
      ? undefined
      : source.mode(activity.directActivityModeHash))
  );
};

// Empty labels stay in place so the profile's failure indices still line up
const labels = (found: { displayString: string }[] | undefined): string[] =>
  (found ?? []).map((label) => label.displayString);

export const slimActivity = (
  activity: DestinyActivityDefinition,
  source: ArtSource,
): SlimActivity => ({
  hash: activity.hash,
  name: activity.displayProperties.name,
  description: activity.displayProperties.description,
  icon: named(activity.displayProperties),
  pgcrImage: backdrop(activity, source),
  activityTypeHash: activity.activityTypeHash,
  destinationHash: activity.destinationHash,
  placeHash: activity.placeHash,
  modeType: activity.directActivityModeType,
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
    .filter((tier) => tier.tierType !== TRAINING && tier.displayProperties.name)
    .toSorted((a, b) => a.tierRank - b.tierRank)
    .map((tier) => ({
      name: tier.displayProperties.name,
      level: tier.activityLevel,
      power:
        tier.minimumFireteamLeaderPower > 0
          ? tier.minimumFireteamLeaderPower
          : undefined,
    })),
});

export const slimModifier = (
  modifier: DestinyActivityModifierDefinition,
): SlimModifier => ({
  hash: modifier.hash,
  name: modifier.displayProperties.name,
  description: modifier.displayProperties.description,
  icon: named(modifier.displayProperties),
});

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

// The 542 reward items are a rounding error next to shipping the item table twice
export const slimReward = (
  item: DestinyInventoryItemDefinition,
): SlimReward => ({
  hash: item.hash,
  name: item.displayProperties.name,
  icon: named(item.displayProperties),
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
