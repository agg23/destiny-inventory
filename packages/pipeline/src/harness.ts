import { getBuckets } from "app/destiny2/d2-buckets";
import type { DimItem } from "app/inventory/item-types";
import { makeItem } from "app/inventory/store/d2-item-factory";
import type { DimStore } from "app/inventory/store-types";

import { loadManifest } from "@dvm/build";
import { buildDefinitions } from "@dvm/dim-bridge";

import { CACHE_ROOT, collectItems, loadProfile, PROFILE_FIXTURE } from "./fixture.ts";

// makeItem skips itemComponents when the owner is undefined
const VAULT_STORE = { id: "vault", name: "Vault" } as DimStore;

const describe = (item: DimItem): string => {
  const power = item.power ? `${item.power} power` : "no power";
  const stats = item.stats?.length ?? 0;
  const perks =
    item.sockets?.allSockets.filter((socket) => socket.plugged !== undefined).length ?? 0;

  return `${item.name} (${item.typeName}) ${power}, ${stats} stats, ${perks} plugged sockets`;
};

const dump = (item: DimItem) => {
  console.log(`\n${item.name}, ${item.typeName}, power ${item.power}`);

  for (const stat of item.stats ?? []) {
    console.log(`  ${stat.displayProperties.name.padEnd(22)} ${stat.value}`);
  }

  const perks = (item.sockets?.allSockets ?? [])
    .filter((socket) => socket.plugged && socket.isPerk)
    .map((socket) => socket.plugged!.plugDef.displayProperties.name)
    .filter((name) => name.length > 0);

  console.log(`  perks: ${perks.join(", ")}`);
};

const main = async () => {
  const manifest = await loadManifest(CACHE_ROOT);
  const defs = buildDefinitions(manifest.tables);
  const buckets = getBuckets(defs);

  const itemCount = Object.keys(defs.InventoryItem.getAll()).length;
  console.log(`\nDefinitions built: ${itemCount} items, ${buckets.byHash ? "buckets ok" : "buckets EMPTY"}`);

  const profile = await loadProfile();

  if (!profile) {
    console.log(`\nNo profile fixture at ${PROFILE_FIXTURE}, so stat correctness is untested.`);
    console.log("The pipeline imported, bundled, and built definitions without DIM.");

    return;
  }

  const rawItems = collectItems(profile);
  console.log(`Profile items: ${rawItems.length}`);

  const built: DimItem[] = [];
  const failures: { hash: number; error: string }[] = [];

  for (const raw of rawItems) {
    try {
      const item = makeItem(
        { defs, buckets, profileResponse: profile, customStats: [] },
        raw,
        VAULT_STORE,
      );

      if (item) {
        built.push(item);
      }
    } catch (e) {
      failures.push({ hash: raw.itemHash, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const withStats = built.filter((item) => (item.stats?.length ?? 0) > 0);
  const withSockets = built.filter((item) => item.sockets !== undefined);

  console.log(`\nBuilt ${built.length} DimItems, ${failures.length} failures`);
  console.log(`  with stats:   ${withStats.length}`);
  console.log(`  with sockets: ${withSockets.length}`);

  if (failures.length > 0) {
    console.log("\nFirst failures:");
    for (const failure of failures.slice(0, 5)) {
      console.log(`  ${failure.hash}: ${failure.error}`);
    }
  }

  console.log("\nSample:");
  for (const item of built.filter((i) => i.power).slice(0, 8)) {
    console.log(`  ${describe(item)}`);
  }

  // A broken join yields the right number of zeroes
  for (const item of [
    built.find((i) => i.bucket.sort === "Weapons"),
    built.find((i) => i.bucket.sort === "Armor"),
  ]) {
    if (item) {
      dump(item);
    }
  }
};

await main();
