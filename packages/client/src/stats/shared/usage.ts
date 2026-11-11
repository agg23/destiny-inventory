import type { DimItem } from "app/inventory/item-types";
import { killTrackerObjectivesByHash } from "app/search/d2-known-values";
import type { DestinyHistoricalWeaponStats } from "bungie-api-ts/destiny2";

import { entryForHash } from "../../core/collections/collections.ts";
import { isCollected } from "../../core/collections/ownership.ts";
import type { Collections, Entry } from "../../core/collections/types.ts";
import type { UsageSort } from "../../core/url.ts";

export interface WeaponUsage {
  entry: Entry;
  pve: number | undefined;
  pvp: number | undefined;
  total: number;
}

// Gambit trackers count with PvE
const trackerKills = (item: DimItem): { pve: number; pvp: number } => {
  const byObjective = new Map<number, number>();

  for (const socket of item.sockets?.allSockets ?? []) {
    for (const plug of [socket.plugged, ...socket.plugOptions]) {
      for (const objective of plug?.plugObjectives ?? []) {
        if (
          killTrackerObjectivesByHash[objective.objectiveHash] !== undefined
        ) {
          byObjective.set(objective.objectiveHash, objective.progress ?? 0);
        }
      }
    }
  }

  let pve = 0;
  let pvp = 0;

  for (const [objectiveHash, kills] of byObjective) {
    if (killTrackerObjectivesByHash[objectiveHash] === "pvp") {
      pvp += kills;
    } else {
      pve += kills;
    }
  }

  return { pve, pvp };
};

/** Exotics from lifetime history, legendaries from the trackers on held copies */
export const weaponUsageOf = (
  index: Collections,
  copies: Map<string, DimItem[]>,
  acquired: Set<number> | undefined,
  history: DestinyHistoricalWeaponStats[],
): { exotics: WeaponUsage[]; legendaries: WeaponUsage[] } => {
  const lifetime = new Map<string, number>();

  for (const weapon of history) {
    const entry = entryForHash(index, weapon.referenceId);

    if (!entry) {
      continue;
    }

    lifetime.set(
      entry.key,
      (lifetime.get(entry.key) ?? 0) +
        (weapon.values["uniqueWeaponKills"]?.basic.value ?? 0),
    );
  }

  const exotics: WeaponUsage[] = [];
  const legendaries: WeaponUsage[] = [];

  for (const entry of index.weapons) {
    const held = copies.get(entry.key) ?? [];

    if (
      entry.rarity === "Exotic" &&
      (held.length > 0 || (!!acquired && isCollected(entry, acquired)))
    ) {
      exotics.push({
        entry,
        pve: undefined,
        pvp: undefined,
        total: lifetime.get(entry.key) ?? 0,
      });
    } else if (entry.rarity === "Legendary" && held.length > 0) {
      const kills = held.map(trackerKills);
      const pve = kills.reduce((total, one) => total + one.pve, 0);
      const pvp = kills.reduce((total, one) => total + one.pvp, 0);

      legendaries.push({ entry, pve, pvp, total: pve + pvp });
    }
  }

  return { exotics, legendaries };
};

export const sortUsage = (
  rows: WeaponUsage[],
  order: UsageSort,
): WeaponUsage[] => {
  const byName = (a: WeaponUsage, b: WeaponUsage): number =>
    a.entry.name.localeCompare(b.entry.name);

  switch (order) {
    case "fewest":
      return rows.toSorted((a, b) => a.total - b.total || byName(a, b));
    case "most":
      return rows.toSorted((a, b) => b.total - a.total || byName(a, b));
    case "name":
      return rows.toSorted(byName);
  }
};
