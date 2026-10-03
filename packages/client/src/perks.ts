import type { DimItem, DimPlug } from "app/inventory/item-types";
import type {
  DestinyEquipableItemSetDefinition,
  DestinyInventoryItemDefinition,
  DestinyObjectiveProgress,
} from "bungie-api-ts/destiny2";

import type { Catalyst } from "./collections.ts";
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

export interface CatalystLine {
  name: string | undefined;
  description: string;
}

export type CatalystState = "missing" | "obtained" | "complete";

export interface CatalystPlug {
  hash: number;
  name: string;
  icon: string | undefined;
  lines: CatalystLine[];
  stats: StatChange[];
  /** Account wide, from the catalyst triumph; undefined without one */
  state: CatalystState | undefined;
  objectives: DestinyObjectiveProgress[];
  /** In this copy's socket */
  inserted: boolean;
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

// DestinyItemType.Dummy
const DUMMY = 20;

// PlugCategoryHashes.Intrinsics
const INTRINSICS = 1744546145;

// SocketCategoryHashes.IntrinsicTraits
const INTRINSIC_TRAITS = 3956125808;

/** Frames and exotic perks */
export const isIntrinsicPlug = (plug: DimPlug | null | undefined): boolean =>
  plug?.plugDef.plug.plugCategoryHash === INTRINSICS;

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

export const benefits = (item: DimItem): Benefit[] => {
  const sockets = item.sockets;

  if (!sockets) {
    return [];
  }

  return sockets.categories.flatMap((category) => {
    if (
      COSMETICS.has(category.category.hash) ||
      category.category.hash === INTRINSIC_TRAITS
    ) {
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
          isIntrinsicPlug(plug) ||
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
export const setBonus = (item: DimItem): SetBonus | undefined =>
  item.setBonus ? setBonusOf(item.setBonus) : undefined;

export const setBonusOf = (
  set: DestinyEquipableItemSetDefinition,
): SetBonus | undefined => {
  const table = defs()?.SandboxPerk;

  if (!table) {
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

/** The plugged intrinsic perks in any socket category, leaving out the armor archetype */
export const intrinsics = (item: DimItem): Benefit[] => {
  const sockets = item.sockets;

  if (!sockets) {
    return [];
  }

  const traits = new Set(
    sockets.categories
      .filter((category) => category.category.hash === INTRINSIC_TRAITS)
      .flatMap((category) => category.socketIndexes),
  );

  return sockets.allSockets.flatMap((socket) => {
    const plug = socket.plugged;

    if (
      !plug ||
      isSocketEmpty(socket) ||
      isArmorArchetypePlug(plug) ||
      (!traits.has(socket.socketIndex) && !isIntrinsicPlug(plug))
    ) {
      return [];
    }

    const benefit = benefitFor(item, plug);

    return benefit ? [benefit] : [];
  });
};

const catalystLines = (
  plug: DestinyInventoryItemDefinition,
): CatalystLine[] => {
  const { name, description } = plug.displayProperties;
  const table = defs()?.SandboxPerk;

  const perks = (plug.perks ?? []).flatMap((perk) => {
    const found = table?.getOptional(perk.perkHash);

    if (
      perk.perkVisibility === HIDDEN ||
      !found?.isDisplayable ||
      !found.displayProperties.name
    ) {
      return [];
    }

    return [
      {
        name:
          found.displayProperties.name === name
            ? undefined
            : found.displayProperties.name,
        description: found.displayProperties.description,
      },
    ];
  });

  return perks.length > 0 ? perks : [{ name: undefined, description }];
};

/** Exotic catalysts and year one masterworks, leaving out legendary masterworks and trackers */
export const isCatalyst = (def: DestinyInventoryItemDefinition): boolean => {
  const category = def.plug?.plugCategoryIdentifier ?? "";

  return category === "catalysts" || category.endsWith("masterwork");
};

const stateOf = (
  account: Catalyst | undefined,
  objectives: DestinyObjectiveProgress[],
): CatalystState | undefined => {
  if (!account) {
    return undefined;
  }

  if (!account.unlocked) {
    return "missing";
  }

  if (
    account.complete ||
    (objectives.length > 0 &&
      objectives.every((objective) => objective.complete))
  ) {
    return "complete";
  }

  return "obtained";
};

/**
 * Every catalyst the weapon's catalyst socket takes. Year one exotics have two steps, the
 * catalyst and then a masterwork unlocked by kills; refit exotics offer several at once
 */
export const catalysts = (
  item: DimItem,
  account: Catalyst | undefined,
): CatalystPlug[] => {
  if (!item.isExotic) {
    return [];
  }

  const table = defs()?.InventoryItem;

  for (const socket of item.sockets?.allSockets ?? []) {
    const offered = [
      ...[...socket.plugOptions, ...(socket.plugSet?.plugs ?? [])].map(
        (plug) => ({ def: plug.plugDef, stats: changes(item, plug) }),
      ),
      // DIM skips this field beside a plug set
      ...(socket.socketDefinition.reusablePlugItems ?? []).flatMap((plug) => {
        const def = table?.getOptional(plug.plugItemHash);

        return def
          ? [
              {
                def,
                stats: (def.investmentStats ?? []).flatMap((stat) =>
                  stat.isConditionallyActive
                    ? []
                    : change(item, stat.statTypeHash, stat.value),
                ),
              },
            ]
          : [];
      }),
    ];

    if (!offered.some(({ def }) => isCatalyst(def))) {
      continue;
    }

    const seen = new Set<number>();
    const listed = offered.filter(({ def }) => {
      if (
        seen.has(def.hash) ||
        !isCatalyst(def) ||
        def.itemType === DUMMY ||
        def.plug?.plugCategoryHash === EMPTY_EXOTIC_MASTERWORK ||
        !def.displayProperties.name
      ) {
        return false;
      }

      seen.add(def.hash);

      return true;
    });

    const ownHashes = (def: DestinyInventoryItemDefinition): number[] =>
      def.objectives?.objectiveHashes ?? [];
    const claimed = new Set(listed.flatMap(({ def }) => ownHashes(def)));
    // Unclaimed ones are per copy insert or reshape steps, except on a lone catalyst
    const unclaimed =
      listed.length === 1
        ? (account?.objectives ?? []).filter(
            (objective) => !claimed.has(objective.objectiveHash),
          )
        : [];

    // Catalyst before the masterwork its kills unlock
    const ordered = [
      ...listed.filter(({ def }) => ownHashes(def).length === 0),
      ...listed.filter(({ def }) => ownHashes(def).length > 0),
    ];

    return ordered.map(({ def, stats }) => {
      const own = new Set(ownHashes(def));
      const objectives = [
        ...(account?.objectives ?? []).filter((objective) =>
          own.has(objective.objectiveHash),
        ),
        ...unclaimed,
      ];

      return {
        hash: def.hash,
        name: def.displayProperties.name,
        icon: def.displayProperties.hasIcon
          ? def.displayProperties.icon
          : undefined,
        lines: catalystLines(def),
        stats,
        state: stateOf(account, objectives),
        objectives,
        inserted: item.id !== "0" && socket.plugged?.plugDef.hash === def.hash,
      };
    });
  }

  return [];
};
