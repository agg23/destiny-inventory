import { normalizeQuotes, plainString } from "app/search/text-utils";
import type {
  DestinyInventoryItemDefinition,
  DestinyItemSocketEntryDefinition,
  DestinyPlugSetDefinition,
} from "bungie-api-ts/destiny2";
import { emptyPlugHashes } from "data/d2/empty-plug-hashes";
import { createSignal } from "solid-js";

import type { Collections, Weapon } from "../collections.ts";
import { defs } from "../defs.ts";
import { readMerged, type Session } from "../load.ts";
import { isCatalyst } from "../perks.ts";
import { PLUG_SETS } from "../store.ts";

/** One plug's searchable text, lowercased and stripped of accents */
export interface PerkText {
  names: string[];
  descriptions: string[];
}

// SocketCategoryHashes
const INTRINSIC_TRAITS = 3956125808;
const WEAPON_PERKS = 4241085061;
const WEAPON_MODS = 2685412949;

// PlugCategoryHashes.V400EmptyExoticMasterwork
const EMPTY_EXOTIC_MASTERWORK = 1915962497;

// ItemPerkVisibility.Hidden
const HIDDEN = 2;

// DestinyItemType.Dummy
const DUMMY = 20;

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

  for (const perk of plug.perks ?? []) {
    const found = defs()?.SandboxPerk.getOptional(perk.perkHash);

    if (perk.perkVisibility !== HIDDEN && found?.displayProperties.name) {
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
  const weaponDefs = new Map(
    (
      await readMerged(
        session.store,
        index.weapons.flatMap((weapon) => weapon.itemHashes),
      )
    ).map((def) => [def.hash, def]),
  );

  const entries = new Map<number, DestinyItemSocketEntryDefinition[]>();
  const catalystEntries = new Set<DestinyItemSocketEntryDefinition>();
  const plugSetHashes = new Set<number>();

  for (const def of weaponDefs.values()) {
    const sockets = def.sockets;

    if (!sockets) {
      continue;
    }

    const kept = sockets.socketCategories.flatMap((category) =>
      category.socketCategoryHash === INTRINSIC_TRAITS ||
      category.socketCategoryHash === WEAPON_PERKS ||
      category.socketCategoryHash === WEAPON_MODS
        ? category.socketIndexes.flatMap((socketIndex) => {
            const entry = sockets.socketEntries[socketIndex];

            if (!entry) {
              return [];
            }

            if (category.socketCategoryHash === WEAPON_MODS) {
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

  const plugSets = new Map(
    (
      await session.store.getMany<DestinyPlugSetDefinition>(PLUG_SETS, [
        ...plugSetHashes,
      ])
    ).map((set) => [set.hash, set]),
  );

  const plugsOf = (entry: DestinyItemSocketEntryDefinition): number[] => [
    entry.singleInitialItemHash,
    ...(entry.reusablePlugItems ?? []).map((plug) => plug.plugItemHash),
    ...(
      plugSets.get(entry.reusablePlugSetHash ?? 0)?.reusablePlugItems ?? []
    ).map((plug) => plug.plugItemHash),
    ...(plugSets.get(entry.randomizedPlugSetHash ?? 0)?.reusablePlugItems ?? [])
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

  const plugDefs = new Map(
    (await readMerged(session.store, [...plugHashes])).map((def) => [
      def.hash,
      def,
    ]),
  );
  const texts = new Map<number, PerkText>();
  const built = new Map<Weapon, PerkText[]>();

  for (const weapon of index.weapons) {
    const seen = new Set<number>();

    for (const itemHash of weapon.itemHashes) {
      for (const entry of entries.get(itemHash) ?? []) {
        const plugs = plugsOf(entry).flatMap((hash) => {
          const def = plugDefs.get(hash);

          return def ? [def] : [];
        });

        for (const plug of plugs) {
          if (
            emptyPlugHashes.has(plug.hash) ||
            plug.itemType === DUMMY ||
            plug.plug?.plugCategoryHash === EMPTY_EXOTIC_MASTERWORK ||
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
          text = textOf(plugDefs.get(hash)!);
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
