import type { DestinyInventoryItemDefinition } from "bungie-api-ts/destiny2";

export type SlimItem = Partial<DestinyInventoryItemDefinition>;

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
