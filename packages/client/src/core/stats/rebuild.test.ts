import type { D2ManifestDefinitions } from "app/destiny2/d2-definitions";
import { getBuckets } from "app/destiny2/d2-buckets";
import type { InventoryBuckets } from "app/inventory/inventory-buckets";
import type { DimItem } from "app/inventory/item-types";
import { buildStores } from "app/inventory/store/d2-store-factory";
import type { DestinyProfileResponse } from "bungie-api-ts/destiny2";
import { getTestDefinitions, getTestProfile } from "testing/test-utils.ts";
import { beforeAll, describe, expect, it } from "vitest";

import { snapshotOf } from "./observe.ts";
import { rebuildItem } from "./rebuild.ts";
import type { ItemSnapshot } from "./types.ts";

let defs: D2ManifestDefinitions;
let buckets: InventoryBuckets;
let profile: DestinyProfileResponse;
let items: DimItem[] = [];

beforeAll(async () => {
  defs = await getTestDefinitions();
  buckets = getBuckets(defs);
  profile = getTestProfile();
  items = buildStores({
    defs,
    buckets,
    profileResponse: profile,
    customStats: [],
  }).flatMap((store) => store.items);
});

const plugs = (item: DimItem) =>
  item.sockets?.allSockets.map((socket) => socket.plugged?.plugDef.hash);

// Mod and cosmetic options are left out of snapshots
const perkOptions = (item: DimItem) =>
  item.sockets?.allSockets
    .filter((socket) => socket.isPerk)
    .map((socket) => socket.plugOptions.map((plug) => plug.plugDef.hash));

const stats = (item: DimItem) =>
  item.stats?.map((stat) => [stat.statHash, stat.value]);

// D1 stores the snapshot as JSON
const stored = (snapshot: ItemSnapshot): ItemSnapshot =>
  JSON.parse(JSON.stringify(snapshot)) as ItemSnapshot;

describe("item snapshots", () => {
  it.each(["weapon", "armor"] as const)(
    "rebuilds a %s's roll from its stored snapshot alone",
    (kind) => {
      const live = items.find(
        (item) =>
          item.id !== "0" &&
          !!item.sockets &&
          (kind === "weapon" ? item.bucket.inWeapons : item.bucket.inArmor),
      )!;
      const rebuilt = rebuildItem(
        defs,
        buckets,
        profile,
        stored(snapshotOf(profile, live.id, defs)!),
      )!;

      expect(rebuilt.id).toBe(live.id);
      expect(rebuilt.power).toBe(live.power);
      expect(rebuilt.masterwork).toBe(live.masterwork);
      expect(plugs(rebuilt)).toEqual(plugs(live));
      expect(perkOptions(rebuilt)).toEqual(perkOptions(live));
      expect(stats(rebuilt)).toEqual(stats(live));
    },
  );

  it("keeps crafted and catalyst state, which come from records", () => {
    const special = items.filter(
      (item) =>
        item.id !== "0" &&
        (!!item.crafted || !!item.catalystInfo) &&
        !!snapshotOf(profile, item.id, defs),
    );

    expect(special.length).toBeGreaterThan(0);

    for (const live of special) {
      const rebuilt = rebuildItem(
        defs,
        buckets,
        profile,
        stored(snapshotOf(profile, live.id, defs)!),
      )!;

      expect([rebuilt.crafted, rebuilt.catalystInfo]).toEqual([
        live.crafted,
        live.catalystInfo,
      ]);
    }
  });
});
