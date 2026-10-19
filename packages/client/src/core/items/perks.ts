import type {
  DimItem,
  DimPlug,
  PluggableInventoryItemDefinition,
} from "app/inventory/item-types";
import {
  getArmorArchetype,
  getSocketsByIndexes,
  isArmorArchetypePlug,
  isEnhancedPerk,
  isSocketEmpty,
} from "app/utils/socket-utils";
import {
  DestinyItemType,
  ItemPerkVisibility,
  type DestinyDisplayPropertiesDefinition,
  type DestinyEquipableItemSetDefinition,
  type DestinyInventoryItemDefinition,
  type DestinyObjectiveProgress,
  type DestinySandboxPerkDefinition,
} from "bungie-api-ts/destiny2";
import {
  PlugCategoryHashes,
  SocketCategoryHashes,
} from "data/d2/generated-enums";

import type { CATALYSTS } from "../collections/terms.ts";
import type { Catalyst } from "../collections/types.ts";
import { defs } from "../profile/defs.ts";
import { deltaOf, type Delta } from "./compare.ts";

export interface StatChange extends Delta {
  name: string;
}

interface Benefit {
  plug: DimPlug;
  name: string;
  icon: string | undefined;
  enhanced: boolean;
  intrinsic: boolean;
  description: string;
  stats: StatChange[];
}

interface CatalystLine {
  name: string | undefined;
  description: string;
}

export type CatalystState = (typeof CATALYSTS)[number];

interface CatalystPlug {
  hash: number;
  plug: DimPlug;
  name: string;
  icon: string | undefined;
  lines: CatalystLine[];
  stats: StatChange[];
  state: CatalystState | undefined;
  objectives: DestinyObjectiveProgress[];
  inserted: boolean;
}

export interface Archetype {
  name: string;
  description: string;
  icon: string | undefined;
}

interface SetPerk {
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

/** Frames and exotic perks */
export const isIntrinsicPlug = (plug: DimPlug | null | undefined): boolean =>
  plug?.plugDef.plug.plugCategoryHash === PlugCategoryHashes.Intrinsics;

/** The icon, undefined when the def has none */
export const iconOf = (
  display: DestinyDisplayPropertiesDefinition,
): string | undefined => (display.hasIcon ? display.icon : undefined);

/** Sandbox perks a plug shows, in plug order */
export const visibleSandboxPerks = (
  plug: DestinyInventoryItemDefinition,
): DestinySandboxPerkDefinition[] =>
  (plug.perks ?? []).flatMap((perk) => {
    const found =
      perk.perkVisibility === ItemPerkVisibility.Hidden
        ? undefined
        : defs()?.SandboxPerk.getOptional(perk.perkHash);

    return found ? [found] : [];
  });

const change = (item: DimItem, hash: number, value: number): StatChange[] => {
  const own = item.stats?.find((stat) => stat.statHash === hash);

  if (!own || value === 0) {
    return [];
  }

  return [{ name: own.displayProperties.name, ...deltaOf(own, value) }];
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

  if (own) {
    return own;
  }

  return visibleSandboxPerks(plug.plugDef)
    .flatMap((found) => {
      const description = found.displayProperties.description;

      return description ? [description] : [];
    })
    .join("\n\n");
};

/** Panel entry for a perk or mod, undefined for nameless plugs */
export const benefitFor = (
  item: DimItem,
  plug: DimPlug,
): Benefit | undefined => {
  const { name } = plug.plugDef.displayProperties;

  // The archetype's stats hang off a second, nameless plug
  if (!name) {
    return undefined;
  }

  const stats = changes(item, plug);
  const written = describe(plug);

  return {
    plug,
    name,
    icon: iconOf(plug.plugDef.displayProperties),
    enhanced: isEnhancedPerk(plug.plugDef),
    intrinsic: isIntrinsicPlug(plug),
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
      category.category.hash === SocketCategoryHashes.IntrinsicTraits
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
          // DIM keeps the catalyst slot out of isSocketEmpty
          plug.plugDef.plug.plugCategoryHash ===
            PlugCategoryHashes.V400EmptyExoticMasterwork
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
          icon: iconOf(displayProperties),
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

  const { name, description } = found.displayProperties;

  return { name, description, icon: iconOf(found.displayProperties) };
};

/** Plugged intrinsic perks from any socket category, minus the armor archetype */
export const intrinsics = (item: DimItem): Benefit[] => {
  const sockets = item.sockets;

  if (!sockets) {
    return [];
  }

  const traits = new Set(
    sockets.categories
      .filter(
        (category) =>
          category.category.hash === SocketCategoryHashes.IntrinsicTraits,
      )
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

  const perks = visibleSandboxPerks(plug).flatMap((found) => {
    if (!found.isDisplayable || !found.displayProperties.name) {
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

/** Exotic catalysts and year one masterworks, not legendary masterworks or trackers */
export const isCatalyst = (def: DestinyInventoryItemDefinition): boolean => {
  const category = def.plug?.plugCategoryIdentifier ?? "";

  return category === "catalysts" || category.endsWith("masterwork");
};

/** Catalyst progress as the card shows it, undefined without account data */
export const catalystState = (
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

/** Every catalyst an exotic's socket takes; year one exotics add a masterwork unlocked by kills */
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
        (plug) => ({ def: plug.plugDef, plug, stats: changes(item, plug) }),
      ),
      // DIM skips this field beside a plug set
      ...(socket.socketDefinition.reusablePlugItems ?? []).flatMap((plug) => {
        const def = table?.getOptional(plug.plugItemHash);

        return def
          ? [
              {
                def,
                // Only isCatalyst defs are kept, and those have a plug
                plug: {
                  plugDef: def as PluggableInventoryItemDefinition,
                  plugObjectives: [],
                  enabled: true,
                  enableFailReasons: "",
                  stats: null,
                },
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
        def.itemType === DestinyItemType.Dummy ||
        def.plug?.plugCategoryHash ===
          PlugCategoryHashes.V400EmptyExoticMasterwork ||
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

    return ordered.map(({ def, plug, stats }) => {
      const own = new Set(ownHashes(def));
      const objectives = [
        ...(account?.objectives ?? []).filter((objective) =>
          own.has(objective.objectiveHash),
        ),
        ...unclaimed,
      ];

      return {
        hash: def.hash,
        plug,
        name: def.displayProperties.name,
        icon: iconOf(def.displayProperties),
        lines: catalystLines(def),
        stats,
        state: catalystState(account, objectives),
        objectives,
        inserted: item.id !== "0" && socket.plugged?.plugDef.hash === def.hash,
      };
    });
  }

  return [];
};
