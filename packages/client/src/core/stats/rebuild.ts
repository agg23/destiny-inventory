import type { D2ManifestDefinitions } from "app/destiny2/d2-definitions";
import type { InventoryBuckets } from "app/inventory/inventory-buckets";
import type { DimItem } from "app/inventory/item-types";
import { makeItem } from "app/inventory/store/d2-item-factory";
import {
  ComponentPrivacySetting,
  type DestinyItemComponentSetOfint64,
  type DestinyProfileResponse,
} from "bungie-api-ts/destiny2";

import { SNAPSHOT_KEYS, type ItemSnapshot } from "./types.ts";

/** A snapshot as the item component set DIM reads, same reshaping as its makeItemSingle */
export const componentsOf = (
  snapshot: ItemSnapshot,
): DestinyItemComponentSetOfint64 => {
  const id = snapshot.item.itemInstanceId ?? "0";

  return Object.fromEntries(
    SNAPSHOT_KEYS.map((key) => {
      const entry = snapshot.components[key];

      return [
        key,
        {
          privacy: ComponentPrivacySetting.Public,
          data: entry === undefined ? {} : { [id]: entry },
        },
      ];
    }),
  ) as unknown as DestinyItemComponentSetOfint64;
};

/** The item from its snapshot, through the same makeItem as the page. The profile supplies records, like crafting patterns and catalysts */
export const rebuildItem = (
  defs: D2ManifestDefinitions,
  buckets: InventoryBuckets,
  profile: DestinyProfileResponse,
  snapshot: ItemSnapshot,
): DimItem | undefined =>
  makeItem(
    {
      defs,
      buckets,
      profileResponse: profile,
      customStats: [],
      itemComponents: componentsOf(snapshot),
    },
    snapshot.item,
    undefined,
  );
