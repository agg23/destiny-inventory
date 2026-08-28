import type { DimItem, DimPlug } from "app/inventory/item-types";
import {
  getArmorArchetype,
  getSocketsByIndexes,
  isArmorArchetypePlug,
  isEnhancedPerk,
  isSocketEmpty,
} from "app/utils/socket-utils";

import { defs } from "./defs.ts";

export interface StatChange {
  name: string;
  value: number;
  better: boolean;
}

export interface Benefit {
  name: string;
  icon: string | undefined;
  enhanced: boolean;
  intrinsic: boolean;
  description: string;
  stats: StatChange[];
}

export interface Archetype {
  name: string;
  description: string;
  icon: string | undefined;
}

export interface SetPerk {
  hash: number;
  name: string;
  description: string;
  icon: string | undefined;
  requiredSetCount: number;
}

export interface SetBonus {
  name: string;
  perks: SetPerk[];
}

const COSMETICS = new Set([2048875504, 1926152773]);

// DIM keeps the catalyst slot out of isSocketEmpty
const EMPTY_EXOTIC_MASTERWORK = 1915962497;

// ItemPerkVisibility.Hidden
const HIDDEN = 2;

// PlugCategoryHashes.Intrinsics
const INTRINSICS = 1744546145;

const change = (item: DimItem, hash: number, value: number): StatChange[] => {
  const own = item.stats?.find((stat) => stat.statHash === hash);

  if (!own || value === 0) {
    return [];
  }

  return [
    {
      name: own.displayProperties.name,
      value,
      better: own.smallerIsBetter ? value < 0 : value > 0,
    },
  ];
};

const changes = (item: DimItem, plug: DimPlug): StatChange[] =>
  Object.entries(plug.stats ?? {}).flatMap(([hash, stat]) =>
    change(item, Number(hash), stat.value),
  );

// Some mods write their stat change as the whole description
const restates = (description: string, stats: StatChange[]): boolean =>
  stats.some((stat) => {
    const written = `${stat.value > 0 ? "+" : "-"}${Math.abs(stat.value)} ${
      stat.name
    }`;

    return [written, `${written} ▲`, `${written} ▼`].includes(description);
  });

// Armor mods put their effect on sandbox perks
const describe = (plug: DimPlug): string => {
  const own = plug.plugDef.displayProperties.description;
  const table = defs()?.SandboxPerk;

  if (own || !table) {
    return own;
  }

  return plug.plugDef.perks
    .filter((perk) => perk.perkVisibility !== HIDDEN)
    .flatMap((perk) => {
      const found = table.getOptional(perk.perkHash);
      const description = found?.displayProperties.description;

      return description ? [description] : [];
    })
    .join("\n\n");
};

/** One perk or mod as the panels write it, whether or not it carries anything worth showing */
export const benefitFor = (
  item: DimItem,
  plug: DimPlug,
): Benefit | undefined => {
  const { icon, hasIcon, name } = plug.plugDef.displayProperties;

  // The archetype's stats hang off a second, nameless plug
  if (!name) {
    return undefined;
  }

  const stats = changes(item, plug);
  const written = describe(plug);

  return {
    name,
    icon: hasIcon ? icon : undefined,
    enhanced: isEnhancedPerk(plug.plugDef),
    intrinsic: plug.plugDef.plug.plugCategoryHash === INTRINSICS,
    description: restates(written, stats) ? "" : written,
    stats,
  };
};

// The game prints the intrinsic first
export const benefits = (item: DimItem): Benefit[] => {
  const sockets = item.sockets;

  if (!sockets) {
    return [];
  }

  return sockets.categories.flatMap((category) => {
    if (COSMETICS.has(category.category.hash)) {
      return [];
    }

    return getSocketsByIndexes(sockets, category.socketIndexes).flatMap(
      (socket) => {
        const plug = socket.plugged;

        if (!plug) {
          return [];
        }

        if (
          isSocketEmpty(socket) ||
          isArmorArchetypePlug(plug) ||
          plug.plugDef.plug.plugCategoryIdentifier.includes("trackers") ||
          plug.plugDef.plug.plugCategoryHash === EMPTY_EXOTIC_MASTERWORK
        ) {
          return [];
        }

        const benefit = benefitFor(item, plug);

        if (!benefit || (!benefit.description && benefit.stats.length === 0)) {
          return [];
        }

        return [benefit];
      },
    );
  });
};

// The numbers live on the sandbox perks
export const setBonus = (item: DimItem): SetBonus | undefined => {
  const set = item.setBonus;
  const table = defs()?.SandboxPerk;

  if (!set || !table) {
    return undefined;
  }

  const perks = set.setPerks
    .flatMap((perk) => {
      const found = table.getOptional(perk.sandboxPerkHash);

      if (!found) {
        return [];
      }

      const { displayProperties } = found;

      return [
        {
          hash: found.hash,
          name: displayProperties.name,
          description: displayProperties.description,
          icon: displayProperties.hasIcon ? displayProperties.icon : undefined,
          requiredSetCount: perk.requiredSetCount,
        },
      ];
    })
    .sort((a, b) => a.requiredSetCount - b.requiredSetCount);

  if (perks.length === 0) {
    return undefined;
  }

  return { name: set.displayProperties.name, perks };
};

export const archetype = (item: DimItem): Archetype | undefined => {
  const found = getArmorArchetype(item);

  if (!found) {
    return undefined;
  }

  const { name, description, icon, hasIcon } = found.displayProperties;

  return { name, description, icon: hasIcon ? icon : undefined };
};
