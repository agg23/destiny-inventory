import type { Loadout } from "@destinyitemmanager/dim-api-types";

import { defs } from "../../core/profile/defs.ts";

export const CLASS_NAMES: Record<number, string> = {
  0: "Titan",
  1: "Hunter",
  2: "Warlock",
};

// AssumeArmorMasterwork is a const enum
const MASTERWORK_NAMES: Record<number, string> = {
  1: "None",
  2: "Legendary",
  3: "All",
  4: "All, with exotic artifice",
};

// DIM's stand-ins for "no exotic" and "any exotic"
const EXOTIC_NAMES: Record<number, string> = {
  [-1]: "None",
  [-2]: "Any",
};

// Edge of Fate stats run to 200; older loadouts saved tiers up to 10
const MAX_STAT = 200;
const MAX_TIER = 10;

const onOff = (value: boolean | undefined): string | undefined =>
  value === undefined ? undefined : value ? "On" : "Off";

const statRange = (min: number, max: number | undefined): string => {
  if (max === undefined) {
    return min > 0 ? `${min}+` : "Any";
  }

  if (min === max) {
    return `${min}`;
  }

  return `${min} to ${max}`;
};

/** Stat targets, set bonuses and options a loadout saved, as label and value */
export const facts = (loadout: Loadout): [string, string][] => {
  const parameters = loadout.parameters ?? {};
  const table = defs();

  const stats = (parameters.statConstraints ?? []).map(
    (constraint): [string, string] => {
      const name =
        table?.Stat.getOptional(constraint.statHash)?.displayProperties.name ??
        `Stat ${constraint.statHash}`;
      const tiered =
        constraint.minStat === undefined && constraint.maxStat === undefined;
      const min = tiered
        ? (constraint.minTier ?? 0) * 10
        : (constraint.minStat ?? 0);
      const max = tiered
        ? (constraint.maxTier ?? MAX_TIER) * 10
        : (constraint.maxStat ?? MAX_STAT);
      const ceiling = tiered ? MAX_TIER * 10 : MAX_STAT;

      return [name, statRange(min, max < ceiling ? max : undefined)];
    },
  );

  const sets = Object.entries(parameters.setBonuses ?? {}).flatMap(
    ([hash, count]): [string, string][] => {
      if (!count) {
        return [];
      }

      const name =
        table?.EquipableItemSet.getOptional(Number(hash))?.displayProperties
          .name ?? `Set ${hash}`;

      return [[name, `${count} pieces`]];
    },
  );

  const options: [string, string | undefined][] = [
    [
      "Exotic",
      parameters.exoticArmorHash === undefined
        ? undefined
        : EXOTIC_NAMES[parameters.exoticArmorHash],
    ],
    [
      "Assumed masterwork",
      parameters.assumeArmorMasterwork === undefined
        ? undefined
        : MASTERWORK_NAMES[parameters.assumeArmorMasterwork],
    ],
    ["Auto stat mods", onOff(parameters.autoStatMods)],
    ["Font bonuses", onOff(parameters.includeRuntimeStatBenefits)],
    ["Clear weapons", parameters.clearWeapons ? "On" : undefined],
    ["Clear armor", parameters.clearArmor ? "On" : undefined],
    ["Clear mods", parameters.clearMods ? "On" : undefined],
    ["Armor filter", parameters.query || undefined],
  ];

  return [
    ...stats,
    ...sets,
    ...options.flatMap(([label, value]): [string, string][] =>
      value === undefined ? [] : [[label, value]],
    ),
  ];
};

/** Like "Warlock Shadebinder" */
export const classAndSubclass = (
  classType: number,
  subclass: string | undefined,
): string =>
  [CLASS_NAMES[classType], subclass].filter((part) => !!part).join(" ");
