import type {
  DestinyCollectibleDefinition,
  DestinyDisplayPropertiesDefinition,
  DestinyInventoryItemDefinition,
} from "bungie-api-ts/destiny2";

// displayProperties are projected too
export type SlimItem = Partial<
  Omit<DestinyInventoryItemDefinition, "displayProperties">
> & { displayProperties?: Partial<DestinyDisplayPropertiesDefinition> };

export const slimItem = (item: DestinyInventoryItemDefinition): SlimItem => ({
  hash: item.hash,
  displayProperties: {
    name: item.displayProperties.name,
    description: item.displayProperties.description,
    icon: item.displayProperties.icon,
    hasIcon: item.displayProperties.hasIcon,
  },
  iconWatermark: item.iconWatermark,
  screenshot: item.screenshot,
  itemType: item.itemType,
  itemSubType: item.itemSubType,
  itemCategoryHashes: item.itemCategoryHashes,
  classType: item.classType,
  defaultDamageType: item.defaultDamageType,
  damageTypeHashes: item.damageTypeHashes,
  inventory: item.inventory,
  objectives: item.objectives,
  setData: item.setData,
  value: item.value,
  stats: item.stats,
  investmentStats: item.investmentStats,
  sockets: item.sockets,
  quality: item.quality,
  equippingBlock: item.equippingBlock,
  itemTypeDisplayName: item.itemTypeDisplayName,
  plug: item.plug,
  perks: item.perks,
  breakerType: item.breakerType,
});

// Tier 1 skips sockets to avoid pulling in the plug pools
export const coreItem = (item: DestinyInventoryItemDefinition): SlimItem => {
  const { sockets, plug, perks, ...core } = slimItem(item);

  return core;
};

export const detailItem = (item: DestinyInventoryItemDefinition): SlimItem => ({
  hash: item.hash,
  sockets: item.sockets,
  plug: item.plug,
  perks: item.perks,
});

export const hasDetail = (item: DestinyInventoryItemDefinition): boolean =>
  item.sockets !== undefined ||
  item.plug !== undefined ||
  item.perks !== undefined;

export interface SlimCollectible {
  hash: number;
  index: number;
  itemHash: number;
  scope: number;
  sourceString: string;
  sourceHash: number | undefined;
  parentNodeHashes: number[];
}

/** Collectible source and tree position. Name and icon live on its item */
export const slimCollectible = (
  collectible: DestinyCollectibleDefinition,
): SlimCollectible => ({
  hash: collectible.hash,
  index: collectible.index,
  itemHash: collectible.itemHash,
  scope: collectible.scope,
  sourceString: collectible.sourceString,
  sourceHash: collectible.sourceHash,
  parentNodeHashes: collectible.parentNodeHashes ?? [],
});
