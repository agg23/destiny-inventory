import { normalizeQuotes, plainString } from "app/search/text-utils";
import {
  DestinyItemType,
  type DestinyInventoryItemDefinition,
  type DestinyItemSocketEntryDefinition,
  type DestinyPlugSetDefinition,
} from "bungie-api-ts/destiny2";
import { emptyPlugHashes } from "data/d2/empty-plug-hashes";
import {
  PlugCategoryHashes,
  SocketCategoryHashes,
} from "data/d2/generated-enums";
import { keyBy } from "es-toolkit";
import { createSignal } from "solid-js";

import { isCatalyst, visibleSandboxPerks } from "../items/perks.ts";
import { readMerged } from "../profile/load.ts";
import type { Session } from "../profile/loadTypes.ts";
import { PLUG_SETS } from "../profile/store.ts";
import type { Collections, Weapon } from "./types.ts";

/** One plug's searchable text, lowercased and stripped of accents */
export interface PerkText {
  names: string[];
  descriptions: string[];
}

const KEPT_SOCKET_CATEGORIES = new Set<number>([
  SocketCategoryHashes.IntrinsicTraits,
  SocketCategoryHashes.WeaponPerks_Reusable,
  SocketCategoryHashes.WeaponMods,
]);

const [pool, setPool] = createSignal<Map<Weapon, PerkText[]> | undefined>(
  undefined,
);

/** Every plug each weapon can roll across its versions, undefined until primed */
export const weaponPerks = pool;

let building: Promise<void> | undefined = undefined;

const plain = (text: string): string =>
  plainString(normalizeQuotes(text), "en");

const textOf = (plug: DestinyInventoryItemDefinition): PerkText => {
  const names = [plug.displayProperties?.name ?? ""];
  const descriptions = [plug.displayProperties?.description ?? ""];

  for (const found of visibleSandboxPerks(plug)) {
    if (found.displayProperties.name) {
      names.push(found.displayProperties.name);
      descriptions.push(found.displayProperties.description);
    }
  }

  return {
    names: names.filter((name) => name !== "").map(plain),
    descriptions: descriptions.filter((text) => text !== "").map(plain),
  };
};

const buildPerks = async (session: Session, index: Collections) => {
  const weaponDefs = keyBy(
    await readMerged(
      session.store,
      index.weapons.flatMap((weapon) => weapon.itemHashes),
    ),
    (def) => def.hash,
  );

  const entries = new Map<number, DestinyItemSocketEntryDefinition[]>();
  const catalystEntries = new Set<DestinyItemSocketEntryDefinition>();
  const plugSetHashes = new Set<number>();

  for (const def of Object.values(weaponDefs)) {
    const sockets = def.sockets;

    if (!sockets) {
      continue;
    }

    const kept = sockets.socketCategories.flatMap((category) =>
      KEPT_SOCKET_CATEGORIES.has(category.socketCategoryHash)
        ? category.socketIndexes.flatMap((socketIndex) => {
            const entry = sockets.socketEntries[socketIndex];

            if (!entry) {
              return [];
            }

            if (
              category.socketCategoryHash === SocketCategoryHashes.WeaponMods
            ) {
              catalystEntries.add(entry);
            }

            return [entry];
          })
        : [],
    );

    for (const entry of kept) {
      if (entry.reusablePlugSetHash) {
        plugSetHashes.add(entry.reusablePlugSetHash);
      }

      if (entry.randomizedPlugSetHash) {
        plugSetHashes.add(entry.randomizedPlugSetHash);
      }
    }

    entries.set(def.hash, kept);
  }

  const plugSets = keyBy(
    await session.store.getMany<DestinyPlugSetDefinition>(PLUG_SETS, [
      ...plugSetHashes,
    ]),
    (set) => set.hash,
  );

  const plugsOf = (entry: DestinyItemSocketEntryDefinition): number[] => [
    entry.singleInitialItemHash,
    ...(entry.reusablePlugItems ?? []).map((plug) => plug.plugItemHash),
    ...(plugSets[entry.reusablePlugSetHash ?? 0]?.reusablePlugItems ?? []).map(
      (plug) => plug.plugItemHash,
    ),
    ...(plugSets[entry.randomizedPlugSetHash ?? 0]?.reusablePlugItems ?? [])
      .filter((plug) => plug.currentlyCanRoll)
      .map((plug) => plug.plugItemHash),
  ];

  const plugHashes = new Set<number>();

  for (const kept of entries.values()) {
    for (const entry of kept) {
      for (const hash of plugsOf(entry)) {
        plugHashes.add(hash);
      }
    }
  }

  const plugDefs = keyBy(
    await readMerged(session.store, [...plugHashes]),
    (def) => def.hash,
  );
  const texts = new Map<number, PerkText>();
  const built = new Map<Weapon, PerkText[]>();

  for (const weapon of index.weapons) {
    const seen = new Set<number>();

    for (const itemHash of weapon.itemHashes) {
      for (const entry of entries.get(itemHash) ?? []) {
        const plugs = plugsOf(entry).flatMap((hash) => {
          const def = plugDefs[hash];

          return def ? [def] : [];
        });

        for (const plug of plugs) {
          if (
            emptyPlugHashes.has(plug.hash) ||
            plug.itemType === DestinyItemType.Dummy ||
            plug.plug?.plugCategoryHash ===
              PlugCategoryHashes.V400EmptyExoticMasterwork ||
            // Of the mod sockets only the catalyst's count
            (catalystEntries.has(entry) && !isCatalyst(plug))
          ) {
            continue;
          }

          seen.add(plug.hash);
        }
      }
    }

    built.set(
      weapon,
      [...seen].map((hash) => {
        let text = texts.get(hash);

        if (!text) {
          // Only found defs are seen
          text = textOf(plugDefs[hash]!);
          texts.set(hash, text);
        }

        return text;
      }),
    );
  }

  setPool(built);
};

/** Reads every weapon's plug pools out of the def store, once per index */
export const primeWeaponPerks = (
  session: Session,
  index: Collections,
): Promise<void> => {
  if (!building) {
    building = buildPerks(session, index);

    building.catch(() => {
      building = undefined;
    });
  }

  return building;
};
