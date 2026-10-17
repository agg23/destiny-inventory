import type { DimItem } from "app/inventory/item-types";
import { plainString } from "app/search/text-utils";
import { createSignal } from "solid-js";

import type { SlimOrnament } from "@dvm/defs-core";

import { fetchRecords } from "../api/artifacts.ts";
import { loadConfig } from "../api/config.ts";
import { defs } from "../profile/defs.ts";
import type { Session } from "../profile/loadTypes.ts";
import {
  ARMOR,
  armorKey,
  buildCollections,
  rarityOf,
  WEAPON,
} from "./build.ts";
import type { Collections, Cosmetic, Entry } from "./types.ts";
import { primeWeaponPerks } from "./weaponPerks.ts";

/** The entry for any weapon or armor hash, matched by name when that version has no collectible */
export const entryForHash = (
  index: Collections,
  hash: number,
): Entry | undefined => {
  const held = index.byItemHash.get(hash);

  if (held) {
    return held;
  }

  const item = defs()?.InventoryItem.getOptional(hash);
  const name = item?.displayProperties?.name;

  if (!item || !name) {
    return undefined;
  }

  // A cosmetic can share a name with a weapon
  if (item.itemType !== ARMOR && item.itemType !== WEAPON) {
    return undefined;
  }

  return index.byKey.get(
    item.itemType === ARMOR
      ? armorKey(name, rarityOf(item), item.classType)
      : `${name}|${rarityOf(item)}`,
  );
};

export const cosmeticEntry = (index: Collections, item: DimItem): Cosmetic => ({
  kind: "cosmetic",
  key: `${item.name}|${item.rarity}`,
  name: item.name,
  rarity: item.rarity,
  newestItemHash: item.hash,
  itemHashes: [item.hash],
  collectibleHashes: Object.values(index.collectibles).flatMap((one) =>
    one.itemHash === item.hash ? [one.hash] : [],
  ),
});

let ornamentsPending: Promise<Map<number, number[]>> | undefined = undefined;

/** Items an item-specific ornament applies to, read from the served index */
export const ornamentTargets = (): Promise<Map<number, number[]>> => {
  ornamentsPending ??= (async () => {
    const { artifacts } = await loadConfig();
    const rows = await fetchRecords<SlimOrnament>(artifacts, "OrnamentTarget");

    return new Map(rows.map((row) => [row.hash, row.items]));
  })();

  return ornamentsPending;
};

/** The snapshot paint carries a session with no definitions behind it */
export const definedSession = (
  session: Session | undefined,
): Session | undefined =>
  session && session.support.size > 0 ? session : undefined;

const [built, setBuilt] = createSignal<Collections | undefined>(undefined);

let building: Promise<Collections> | undefined = undefined;

export const collections = built;

/** Starts the index build once; safe to call on every focus */
export const primeCollections = (session: Session): Promise<Collections> => {
  if (!building) {
    building = buildCollections(session).then((result) => {
      setBuilt(result);
      void primeWeaponPerks(session, result);

      return result;
    });

    building.catch(() => {
      building = undefined;
    });
  }

  return building;
};

/** Names starting with the text first, keeping the index order otherwise */
export const rankByName = <T extends Entry>(
  entries: T[],
  name: string,
): T[] => {
  const needle = plainString(name.trim().toLowerCase(), "en");

  return [
    ...entries.filter((entry) => entry.plainName.startsWith(needle)),
    ...entries.filter((entry) => !entry.plainName.startsWith(needle)),
  ];
};
