import type {
  DestinyCollectibleDefinition,
  DestinyInventoryItemDefinition,
} from "bungie-api-ts/destiny2";

export const createCollectibleFinder =
  () =>
  (itemDef: DestinyInventoryItemDefinition): DestinyCollectibleDefinition | undefined =>
    undefined;
