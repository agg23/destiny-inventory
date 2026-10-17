import type { D2ManifestDefinitions } from "app/destiny2/d2-definitions";
import type { InventoryBuckets } from "app/inventory/inventory-buckets";
import type { DimItem } from "app/inventory/item-types";
import { makeItem } from "app/inventory/store/d2-item-factory";
import type { DimStore } from "app/inventory/store-types";
import type { DestinyItemComponent, DestinyProfileResponse } from "bungie-api-ts/destiny2";

import { collectItems } from "./fixture.ts";

// makeItem skips itemComponents when the owner is undefined
const VAULT_STORE = { id: "vault", name: "Vault" } as DimStore;

/** makeItem over every profile item, owned by the vault. Throws unless onError is passed */
export const buildItems = (
  defs: D2ManifestDefinitions,
  buckets: InventoryBuckets,
  profile: DestinyProfileResponse,
  onError?: (raw: DestinyItemComponent, error: unknown) => void,
): { raw: DestinyItemComponent; item: DimItem }[] => {
  const built: { raw: DestinyItemComponent; item: DimItem }[] = [];

  for (const raw of collectItems(profile)) {
    try {
      const item = makeItem(
        { defs, buckets, profileResponse: profile, customStats: [] },
        raw,
        VAULT_STORE,
      );

      if (item) {
        built.push({ raw, item });
      }
    } catch (e) {
      if (!onError) {
        throw e;
      }

      onError(raw, e);
    }
  }

  return built;
};
