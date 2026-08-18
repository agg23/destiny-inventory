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

// Ornaments and shaders change how a piece looks and nothing about what it does
const COSMETICS = new Set([2048875504, 1926152773]);

// DIM keeps the empty catalyst slot out of isSocketEmpty because it is still a real socket
const EMPTY_EXOTIC_MASTERWORK = 1915962497;

// ItemPerkVisibility.Hidden
const HIDDEN = 2;

const change = (item: DimItem, hash: number, value: number): StatChange[] => {
  // The item's own list is already what the game displays, which keeps mod energy costs out
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

// Some mods write their stat change out as their whole description, which the row above
// already says. Bungie's own arrow suffixes are part of the string
const restates = (description: string, stats: StatChange[]): boolean =>
  stats.some((stat) => {
    const written = `${stat.value > 0 ? "+" : "-"}${Math.abs(stat.value)} ${
      stat.name
    }`;

    return [written, `${written} ▲`, `${written} ▼`].includes(description);
  });

// Armor mods leave the description empty and put what they do on their sandbox perks instead
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

// What the game prints in the tooltip: the intrinsic first, then whatever is plugged after it
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

        // The archetype is the piece's own identity rather than something plugged into it
        if (
          isSocketEmpty(socket) ||
          isArmorArchetypePlug(plug) ||
          plug.plugDef.plug.plugCategoryIdentifier.includes("trackers") ||
          plug.plugDef.plug.plugCategoryHash === EMPTY_EXOTIC_MASTERWORK
        ) {
          return [];
        }

        const stats = changes(item, plug);
        const written = describe(plug);
        const description = restates(written, stats) ? "" : written;

        if (!description && stats.length === 0) {
          return [];
        }

        const { icon, hasIcon, name } = plug.plugDef.displayProperties;

        // The archetype's stats hang off a second, nameless plug, which reads as loose numbers
        if (!name) {
          return [];
        }

        return [
          {
            name,
            icon: hasIcon ? icon : undefined,
            enhanced: isEnhancedPerk(plug.plugDef),
            description,
            stats,
          },
        ];
      },
    );
  });
};

// The item carries the set it belongs to; the numbers live on the sandbox perks it points at
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

// Armor's archetype is what the piece is, not something plugged into it, so it reads next to
// the stats it sets rather than down among the mods
export const archetype = (item: DimItem): Archetype | undefined => {
  const found = getArmorArchetype(item);

  if (!found) {
    return undefined;
  }

  const { name, description, icon, hasIcon } = found.displayProperties;

  return { name, description, icon: hasIcon ? icon : undefined };
};
