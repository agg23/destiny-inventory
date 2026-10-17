import type { DestinyObjectiveProgress } from "bungie-api-ts/destiny2";

import type { SlimCollectible } from "@dvm/defs-core";

import type { Grouping } from "../url.ts";

interface Collected {
  key: string;
  name: string;
  plainName: string;
  rarity: string;
  newestItemHash: number;
  itemHashes: number[];
  collectibleHashes: number[];
  icon: string;
  watermark: string | undefined;
  itemCategoryHashes: number[];
  bucketHash: number;
  typeName: string;
  sources: string[];
  sourceKeys: string[];
  index: number;
}

export interface Weapon extends Collected {
  kind: "weapon";
  damageTypeHash: number | undefined;
  ammoType: number;
  typeKey: string;
  catalystRecordHash: number | undefined;
}

export interface Armor extends Collected {
  kind: "armor";
  classType: number;
  /** Keyed by class and Bungie's set node name, undefined for exotics */
  setKey: string | undefined;
  setName: string | undefined;
  /** The set bonus, from an Edge of Fate reissue when the collectible predates it */
  itemSetHash: number | undefined;
}

export type Entry = Weapon | Armor;

/** Any other item, which gets a collection page but no place in the index */
export interface Cosmetic {
  kind: "cosmetic";
  key: string;
  name: string;
  rarity: string;
  newestItemHash: number;
  itemHashes: number[];
  collectibleHashes: number[];
}

export interface ArmorSet {
  kind: "set";
  name: string;
  rarity: string;
  icon: string;
  classType: number;
}

export type Ownership = "owned" | "unlocked" | "neverseen";

export interface Catalyst {
  unlocked: boolean;
  complete: boolean;
  progress: number;
  objectives: DestinyObjectiveProgress[];
}

export interface Group {
  key: string;
  label: string;
  /** The query terms that pick this group, like is:autorifle is:primary */
  terms: string[];
  entries: Entry[];
}

export interface Section {
  label: string;
  groups: Group[];
}

export interface Collections {
  weapons: Weapon[];
  armor: Armor[];
  byItemHash: Map<number, Entry>;
  byKey: Map<string, Entry>;
  collectibles: Record<number, SlimCollectible>;
  sections: Record<Grouping, Section[]>;
  armorSections: Section[];
}

export interface EntryFacts {
  ownership: (entry: Entry) => Ownership | undefined;
  catalyst: (entry: Entry) => Catalyst | undefined;
}
