import type { SlimActivity } from "@dvm/defs-core";
import { activityName } from "@dvm/defs-core";

export const RAID_TYPE = 2043403989;
const DUNGEON_TYPE = 608898761;

// Bungie names both doors after the fireteam
export const VARIANT = /\s*[:-]\s*(Matchmade|Customize)\s*$/;

const TIERS = [
  "normal",
  "standard",
  "advanced",
  "expert",
  "master",
  "grandmaster",
];

export const tier = (name: string): number => {
  const found = TIERS.indexOf(
    name
      .slice(name.indexOf(":") + 1)
      .trim()
      .toLowerCase(),
  );

  return found === -1 ? TIERS.length : found;
};

// Raids and dungeons ship one activity per difficulty instead of one carrying a ladder
const LADDERED_TYPES = new Set([RAID_TYPE, DUNGEON_TYPE]);

export const laddered = (definition: SlimActivity): boolean =>
  definition.activityTypeHash !== undefined &&
  LADDERED_TYPES.has(definition.activityTypeHash);

export const baseName = (definition: SlimActivity): string =>
  laddered(definition)
    ? activityName(definition.name)
    : definition.name.replace(VARIANT, "");

// Grasp of Avarice gives its two doors their own destinations, and they share only the place
export const identity = (definition: SlimActivity): string => {
  const where = laddered(definition)
    ? definition.placeHash ?? definition.destinationHash ?? 0
    : definition.destinationHash ?? definition.placeHash ?? 0;

  return `${baseName(definition)}|${where}`;
};
