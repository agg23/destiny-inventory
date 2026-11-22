export const LOOK_SLOTS = ["helmet", "arms", "chest", "legs", "class"] as const;

export type LookSlot = (typeof LOOK_SLOTS)[number];

interface LookEntry {
  /** The newest version, the one rendered */
  hash: number;
  /** Every reissue that shares the name */
  hashes: number[];
  name: string;
  icon: string;
  tierType: number;
  collectibleHashes: number[];
}

export interface LookArmor extends LookEntry {
  kind: "armor";
  classType: number;
  slot: LookSlot;
}

export interface LookShader extends LookEntry {
  kind: "shader";
}

export interface LookOrnament extends LookEntry {
  kind: "ornament";
  classType: number;
  slot: LookSlot;
  /** Armor hashes for an item-specific ornament, undefined for a universal one */
  items: number[] | undefined;
}

/** The game's own "Default Shader" or "Default Ornament", which clear the choice */
export interface LookDefault extends LookEntry {
  kind: "default";
  replaces: "shader" | "ornament";
}

export type LookItem = LookArmor | LookShader | LookOrnament | LookDefault;

/** What tgxm-loader reads for one hash */
export interface LookAsset {
  definition: {
    hash: number;
    itemType: number;
    itemSubType: number;
    itemCategoryHashes: number[];
    traitIds: string[] | undefined;
    defaultDamageType: number;
    translationBlock: unknown;
  };
  gearAsset: unknown;
}

export const LOOK_ASSET_SHARDS = 64;

export const lookAssetShard = (hash: number): string =>
  `LookAsset-${hash % LOOK_ASSET_SHARDS}`;
