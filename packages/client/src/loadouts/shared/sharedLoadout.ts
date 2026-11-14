import type { Loadout, LoadoutItem } from "@destinyitemmanager/dim-api-types";
import type { DimItem, DimPlug } from "app/inventory/item-types";
import type { ItemCreationContext } from "app/inventory/store/d2-item-factory";
import {
  applySocketOverrides,
  type SocketOverrides,
} from "app/inventory/store/override-sockets";
import { buildDefinedPlug } from "app/inventory/store/sockets";
import { resolveLoadoutModHashes } from "app/loadout-drawer/loadout-utils";
import {
  ArmorBucketHashes,
  permissiveArmorEnergyRules,
} from "app/loadout-builder/types";
import {
  fitMostMods,
  pickPlugPositions,
} from "app/loadout/mod-assignment-utils";
import { getTotalModStatChanges } from "app/loadout/stats";
import {
  armorStats,
  deprecatedPlaceholderArmorModHash,
} from "app/search/d2-known-values";
import {
  getSocketsByCategoryHash,
  getSocketsByIndexes,
  plugFitsIntoSocket,
} from "app/utils/socket-utils";
import {
  DestinyEnergyType,
  type DestinyProfileResponse,
} from "bungie-api-ts/destiny2";
import { emptyPlugHashes } from "data/d2/empty-plug-hashes";
import { BucketHashes, SocketCategoryHashes } from "data/d2/generated-enums";

import { callService } from "../../core/api/auth.ts";
import { isIntrinsicPlug, type StatChange } from "../../core/items/perks.ts";
import { defs } from "../../core/profile/defs.ts";
import { fakeItems } from "../../core/profile/fakeItems.ts";
import { materializeItems } from "../../core/profile/load.ts";
import type { LoadResult } from "../../core/profile/loadTypes.ts";
import { sentence } from "../../core/text.ts";

const ENDPOINT = "/api/loadout-share";

// Shares drop the armor's tier
const TIER_5_ENERGY = 11;

// Taken from DIM's loadout-import.ts
const DIM_GG = /^(?:(?:https?:\/\/)?dim\.gg\/)?([a-z0-9]{7,})(?:\/.*)?$/;

export interface SharedPlug {
  item: DimItem;
  plug: DimPlug;
}

export interface Modifier extends SharedPlug {
  count: number;
}

export interface ModifierGroup {
  title: string;
  modifiers: Modifier[];
}

export interface SharedItem {
  item: DimItem;
  mods: SharedPlug[];
}

export interface SharedLoadout {
  loadout: Loadout;
  subclass: DimItem | undefined;
  equipped: SharedItem[];
  unequipped: DimItem[];
  exotic: DimItem | undefined;
  mods: SharedPlug[];
  armor: boolean;
  artifactItem: DimItem | undefined;
  artifact: SharedPlug[];
  modifiers: ModifierGroup[];
  stats: StatChange[];
}

const counted = (plugs: SharedPlug[]): Modifier[] => {
  const byHash = new Map<number, Modifier>();

  for (const one of plugs) {
    const held = byHash.get(one.plug.plugDef.hash);

    if (held) {
      held.count += 1;
    } else {
      byHash.set(one.plug.plugDef.hash, { ...one, count: 1 });
    }
  }

  return [...byHash.values()];
};

const directLoadout = (link: string): Loadout | undefined => {
  try {
    const url = new URL(link);
    const raw = url.searchParams.get("loadout");

    if (!url.pathname.endsWith("/loadouts") || !raw) {
      return undefined;
    }

    return JSON.parse(raw) as Loadout;
  } catch {
    return undefined;
  }
};

/** The share id for a dim.gg link, otherwise the whole link */
export const lookupKey = (link: string): string => {
  const trimmed = link.trim();

  return trimmed.match(DIM_GG)?.[1] ?? trimmed;
};

/** The loadout behind a dim.gg link or a DIM ?loadout= link */
export const fetchLoadout = async (link: string): Promise<Loadout> => {
  const trimmed = link.trim();
  const direct = directLoadout(trimmed);

  if (direct) {
    return direct;
  }

  const shareId = trimmed.match(DIM_GG)?.[1];

  if (!shareId) {
    throw new Error("Not a DIM loadout link");
  }

  // Every form of a link shares one browser cache entry
  const response = await callService(
    `${ENDPOINT}?${new URLSearchParams({ link: shareId }).toString()}`,
  );

  if (!response) {
    throw new Error("Sign in to open dim.gg links");
  }

  const body = (await response.json()) as { loadout?: Loadout; error?: string };

  if (!body.loadout) {
    throw new Error(
      body.error ?? `Loadout share failed with ${response.status}`,
    );
  }

  return body.loadout;
};

/** Display-only items and plugs for a loadout, configured the way it was saved */
export const resolveLoadout = async (
  loaded: LoadResult,
  loadout: Loadout,
): Promise<SharedLoadout> => {
  const parameters = loadout.parameters ?? {};
  const listed = [
    ...(loadout.equipped ?? []).map((one) => ({ one, equipped: true })),
    ...(loadout.unequipped ?? []).map((one) => ({ one, equipped: false })),
  ];
  const byBucket = parameters.modsByBucket ?? {};
  const exoticHash =
    parameters.exoticArmorHash !== undefined && parameters.exoticArmorHash > 0
      ? parameters.exoticArmorHash
      : undefined;
  const modHashes = (parameters.mods ?? []).map(Number);
  const artifactHashes = (
    parameters.artifactUnlocks?.unlockedItemHashes ?? []
  ).map(Number);

  await materializeItems(loaded.session, [
    ...listed.flatMap(({ one }) => Object.values(one.socketOverrides ?? {})),
    ...Object.values(byBucket).flat(),
    ...modHashes,
    deprecatedPlaceholderArmorModHash,
  ]);

  const built = await fakeItems(loaded, [
    ...listed.map(({ one }) => Number(one.hash)),
    ...(loadout.emblemHash ? [loadout.emblemHash] : []),
    ...(exoticHash ? [exoticHash] : []),
    ...artifactHashes,
  ]);
  const table = defs();

  if (!table) {
    throw new Error("Item definitions aren't loaded");
  }

  const context: ItemCreationContext = {
    defs: table,
    buckets: loaded.buckets,
    profileResponse: {} as DestinyProfileResponse,
    customStats: [],
  };

  const configured = (one: LoadoutItem, equipped: boolean) => {
    const item = built.get(Number(one.hash));

    if (!item) {
      return undefined;
    }

    const overrides: SocketOverrides = { ...one.socketOverrides };

    // DIM only plugs bucket mods into equipped armor
    if (equipped) {
      for (const modHash of byBucket[item.bucket.hash] ?? []) {
        const socket = item.sockets?.allSockets.find(
          (candidate) =>
            overrides[candidate.socketIndex] === undefined &&
            plugFitsIntoSocket(candidate, modHash),
        );

        if (socket) {
          overrides[socket.socketIndex] = modHash;
        }
      }
    }

    return applySocketOverrides(context, item, overrides);
  };

  const plugs = (hashes: number[], hosts: Map<number, DimItem>): SharedPlug[] =>
    hashes.flatMap((hash) => {
      const item = hosts.get(hash);
      const plug = table.InventoryItem.getOptional(hash)
        ? buildDefinedPlug(table, hash)
        : null;

      return item && plug ? [{ item, plug }] : [];
    });

  const isArmor = (item: DimItem) =>
    (ArmorBucketHashes as number[]).includes(item.bucket.hash);

  // Stand-ins have no socket state or energy
  const opened = (item: DimItem): DimItem => {
    if (!item.sockets) {
      return item;
    }

    const modIndexes = new Set(
      getSocketsByCategoryHash(
        item.sockets,
        SocketCategoryHashes.ArmorMods,
      ).map((socket) => socket.socketIndex),
    );
    const allSockets = item.sockets.allSockets.map((socket) => {
      if (!modIndexes.has(socket.socketIndex)) {
        return socket;
      }

      const empty = socket.emptyPlugItemHash;
      const plugged =
        socket.plugged ??
        (empty && table.InventoryItem.getOptional(empty)
          ? buildDefinedPlug(table, empty)
          : null);

      return { ...socket, visibleInGame: true, plugged };
    });

    return {
      ...item,
      sockets: { ...item.sockets, allSockets },
      energy: item.energy ?? {
        energyTypeHash: 0,
        energyType: DestinyEnergyType.Any,
        energyCapacity: TIER_5_ENERGY,
        energyUsed: 0,
        energyUnused: TIER_5_ENERGY,
      },
    };
  };

  const items = listed.flatMap(({ one, equipped }) => {
    const item = configured(one, equipped);

    if (!item) {
      return [];
    }

    return [
      { item: equipped && isArmor(item) ? opened(item) : item, equipped, one },
    ];
  });
  const subclassEntry = items.find(
    ({ item }) => item.bucket.hash === BucketHashes.Subclass,
  );
  const subclass = subclassEntry?.item;
  const artifactEntry = items.find(
    ({ item }) => item.bucket.hash === BucketHashes.Artifacts,
  );
  const rest = items.filter(
    (entry) => entry.item !== subclass && entry !== artifactEntry,
  );
  // Fakes all share id 0 and fitMostMods keys on it
  const armor = rest.flatMap((one, index) =>
    one.equipped && isArmor(one.item)
      ? [{ ...one.item, id: `${index + 1}` }]
      : [],
  );

  const planned = resolveLoadoutModHashes(table, modHashes, new Set()).map(
    (mod) => mod.resolvedMod,
  );
  const { itemModAssignments, unassignedMods, invalidMods } = fitMostMods({
    defs: table,
    items: armor,
    plannedMods: planned,
    armorEnergyRules: permissiveArmorEnergyRules,
  });

  const withMods = (item: DimItem): SharedItem => {
    const overrides: SocketOverrides = {};

    for (const assignment of pickPlugPositions(
      table,
      item,
      itemModAssignments[item.id] ?? [],
    )) {
      overrides[assignment.socketIndex] = assignment.mod.hash;
    }

    const modded = applySocketOverrides(context, item, overrides);
    const plugged = getSocketsByCategoryHash(
      modded.sockets,
      SocketCategoryHashes.ArmorMods,
    ).flatMap((socket) =>
      socket.plugged && !emptyPlugHashes.has(socket.plugged.plugDef.hash)
        ? [socket.plugged]
        : [],
    );
    const used = plugged.reduce(
      (total, plug) => total + (plug.plugDef.plug.energyCost?.energyCost ?? 0),
      0,
    );
    const energy = modded.energy;
    const withEnergy = energy
      ? {
          ...modded,
          id: "0",
          energy: {
            ...energy,
            energyUsed: used,
            energyUnused: energy.energyCapacity - used,
          },
        }
      : { ...modded, id: "0" };

    return {
      item: withEnergy,
      mods: plugged.map((plug) => ({ item: withEnergy, plug })),
    };
  };

  const equipped = rest.flatMap((one, index) => {
    if (!one.equipped) {
      return [];
    }

    if (!isArmor(one.item)) {
      return [{ item: one.item, mods: [] }];
    }

    return [withMods({ ...one.item, id: `${index + 1}` })];
  });
  const emblem = loadout.emblemHash ? built.get(loadout.emblemHash) : undefined;

  if (emblem && !equipped.some((one) => one.item.hash === emblem.hash)) {
    equipped.push({ item: emblem, mods: [] });
  }

  // fitMostMods drops mods meant for armor pieces it wasn't given
  const placed = [
    ...Object.values(itemModAssignments).flat(),
    ...unassignedMods,
    ...invalidMods,
  ];
  const dropped = [];

  for (const mod of planned) {
    const index = placed.indexOf(mod);

    if (index === -1) {
      dropped.push(mod);
    } else {
      placed.splice(index, 1);
    }
  }

  const loose = [...unassignedMods, ...invalidMods, ...dropped].map(
    (mod) => mod.hash,
  );
  const looseHosts = await fakeItems(loaded, loose);

  const artifactItem = artifactEntry?.item;
  const chosen = Object.keys(artifactEntry?.one.socketOverrides ?? {})
    .map(Number)
    .sort((a, b) => a - b)
    .flatMap((index): SharedPlug[] => {
      const plug = artifactItem?.sockets?.allSockets.find(
        (socket) => socket.socketIndex === index,
      )?.plugged;

      return artifactItem && plug ? [{ item: artifactItem, plug }] : [];
    });
  const unlocked = plugs(artifactHashes, built).filter(
    (one) =>
      !chosen.some((held) => held.plug.plugDef.hash === one.plug.plugDef.hash),
  );

  const subclassGroups: ModifierGroup[] = [];

  if (subclass?.sockets) {
    for (const category of subclass.sockets.categories) {
      const modifiers = counted(
        getSocketsByIndexes(subclass.sockets, category.socketIndexes).flatMap(
          (socket): SharedPlug[] =>
            socket.plugged &&
            socket.plugged.plugDef.displayProperties.icon &&
            !isIntrinsicPlug(socket.plugged) &&
            !emptyPlugHashes.has(socket.plugged.plugDef.hash)
              ? [{ item: subclass, plug: socket.plugged }]
              : [],
        ),
      );

      subclassGroups.push({
        // Bungie writes these in capitals
        title: sentence(category.category.displayProperties.name.toLowerCase()),
        modifiers,
      });
    }
  }

  const totals = getTotalModStatChanges(
    table,
    [...chosen, ...unlocked].map((one) => one.plug.plugDef),
    subclassEntry && {
      item: subclassEntry.item,
      loadoutItem: {
        ...subclassEntry.one,
        id: subclassEntry.item.id,
        hash: subclassEntry.item.hash,
        amount: 1,
        equip: true,
      },
    },
    loadout.classType,
    false,
  );

  return {
    loadout,
    subclass,
    equipped,
    unequipped: rest.filter((one) => !one.equipped).map((one) => one.item),
    exotic: exoticHash ? built.get(exoticHash) : undefined,
    mods: plugs(loose, looseHosts),
    armor: armor.length > 0,
    artifactItem,
    artifact: [...chosen, ...unlocked],
    modifiers: [
      ...subclassGroups,
      { title: "Artifact", modifiers: counted([...chosen, ...unlocked]) },
      {
        title: "Armor mods",
        modifiers: counted([
          ...equipped.flatMap((one) => one.mods),
          ...plugs(loose, looseHosts),
        ]),
      },
    ].filter((group) => group.modifiers.length > 0),
    stats: armorStats.flatMap((statHash): StatChange[] => {
      const value = totals[statHash].value;

      if (value === 0) {
        return [];
      }

      const name =
        table.Stat.getOptional(statHash)?.displayProperties.name ??
        `Stat ${statHash}`;

      return [{ name, value, better: value > 0 }];
    }),
  };
};
