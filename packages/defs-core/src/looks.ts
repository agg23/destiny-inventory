export const LOOK_SLOTS = ["helmet", "arms", "chest", "legs", "class"] as const;

export type LookSlot = (typeof LOOK_SLOTS)[number];

export const WEAPON_SLOTS = ["kinetic", "energy", "power"] as const;

export type WeaponSlot = (typeof WEAPON_SLOTS)[number];

interface LookEntry {
  /** The newest version, the one rendered */
  hash: number;
  /** Every reissue that shares the name */
  hashes: number[];
  name: string;
  icon: string;
  tierType: number;
  collectibleHashes: number[];
  /** The collectible's source text, without "Source:" */
  source: string | undefined;
}

export interface LookArmor extends LookEntry {
  kind: "armor";
  classType: number;
  slot: LookSlot;
  /** Collections set name, undefined for exotics */
  set: string | undefined;
}

export const SHADER_COLORS = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
  "brown",
  "black",
  "grey",
  "white",
] as const;

export type ShaderColor = (typeof SHADER_COLORS)[number];

export interface LookShader extends LookEntry {
  kind: "shader";
  /** Percent of the icon in each color, from the icon swatch */
  colors: Partial<Record<ShaderColor, number>>;
}

export interface LookOrnament extends LookEntry {
  kind: "ornament";
  classType: number;
  slot: LookSlot;
  /** Armor hashes for an item-specific ornament, undefined for a universal one */
  items: number[] | undefined;
  set: string | undefined;
}

export interface LookWeapon extends LookEntry {
  kind: "weapon";
  slot: WeaponSlot;
  /** Like "Auto Rifle" */
  typeName: string;
}

export interface LookWeaponOrnament extends LookEntry {
  kind: "weaponOrnament";
  /** Weapon hashes whose sockets offer it */
  items: number[];
}

/** The game's own "Default Shader", which clears the choice */
export interface LookDefault extends LookEntry {
  kind: "default";
}

export type LookItem =
  | LookArmor
  | LookShader
  | LookOrnament
  | LookWeapon
  | LookWeaponOrnament
  | LookDefault;

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
