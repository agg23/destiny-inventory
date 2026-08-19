import type { DestinyInventoryItemDefinition } from "bungie-api-ts/destiny2";

const DUMMY = 20;

// Anything a profile can name, which is wider than what a vault can hold: profile-level
// pseudo-items such as the Artifact and Clan Banner carry no inventory bucket at all
export const isShipped = (item: DestinyInventoryItemDefinition): boolean =>
  item.itemType !== DUMMY &&
  !item.redacted &&
  Boolean(item.displayProperties?.name);
