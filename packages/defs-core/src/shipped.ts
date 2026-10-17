import type { DestinyInventoryItemDefinition } from "bungie-api-ts/destiny2";

const DUMMY = 20;

// Crafted weapons carry these plugged and nothing in the manifest references them
const CRAFTING_PLUGS = "crafting.plugs.";

// Wider than vault items. The Artifact and Clan Banner have no inventory bucket
export const isShipped = (item: DestinyInventoryItemDefinition): boolean =>
  item.itemType !== DUMMY &&
  !item.redacted &&
  (Boolean(item.displayProperties?.name) ||
    Boolean(item.plug?.plugCategoryIdentifier?.startsWith(CRAFTING_PLUGS)));
