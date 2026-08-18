import type {
  DestinyDisplayPropertiesDefinition,
  DestinyInventoryItemDefinition,
} from "bungie-api-ts/destiny2";

// Display properties are projected too, so the shipped shape is narrower than Bungie's
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
  itemType: item.itemType,
  itemSubType: item.itemSubType,
  classType: item.classType,
  defaultDamageType: item.defaultDamageType,
  damageTypeHashes: item.damageTypeHashes,
  inventory: item.inventory,
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

// The socket fields are what pull the plug pools in, so tier 1 goes without them
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
  item.sockets !== undefined || item.plug !== undefined || item.perks !== undefined;
