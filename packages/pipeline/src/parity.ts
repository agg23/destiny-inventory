// Slim defs must produce identical DimItems, or the projection dropped a field

import { getBuckets } from "app/destiny2/d2-buckets";
import type { DimItem } from "app/inventory/item-types";
import { makeItem } from "app/inventory/store/d2-item-factory";
import type { DimStore } from "app/inventory/store-types";
import type { DestinyProfileResponse } from "bungie-api-ts/destiny2";

import { loadManifest, type RawTable, type TableName } from "@dvm/build";
import { slimItem } from "@dvm/defs-core";
import { buildDefinitions } from "@dvm/dim-bridge";

import { CACHE_ROOT, collectItems, loadProfile } from "./fixture.ts";

const VAULT_STORE = { id: "vault", name: "Vault" } as DimStore;

interface Summary {
  name: string;
  typeName: string;
  power: number | undefined;
  stats: string[];
  perks: string[];
}

const summarize = (item: DimItem): Summary => ({
  name: item.name,
  typeName: item.typeName,
  power: item.power,
  stats: (item.stats ?? []).map((stat) => `${stat.statHash}:${stat.value}`),
  perks: (item.sockets?.allSockets ?? []).map((socket) =>
    socket.plugged ? String(socket.plugged.plugDef.hash) : "-",
  ),
});

const buildAll = (
  tables: Map<TableName, RawTable>,
  profile: DestinyProfileResponse,
): Map<string, Summary> => {
  const defs = buildDefinitions(tables);
  const buckets = getBuckets(defs);
  const summaries = new Map<string, Summary>();

  for (const raw of collectItems(profile)) {
    const item = makeItem(
      { defs, buckets, profileResponse: profile, customStats: [] },
      raw,
      VAULT_STORE,
    );

    if (item) {
      summaries.set(item.id === "0" ? `${raw.itemHash}` : item.id, summarize(item));
    }
  }

  return summaries;
};

const main = async () => {
  const profile = await loadProfile();

  if (!profile) {
    throw new Error("No profile fixture, run: pnpm --filter @dvm/pipeline profile");
  }

  const manifest = await loadManifest(CACHE_ROOT);

  console.log("\nBuilding from full manifest");
  const full = buildAll(manifest.tables, profile);

  const rawItems = manifest.tables.get("DestinyInventoryItemDefinition") as RawTable;
  const slimmed: RawTable = {};

  for (const [hash, item] of Object.entries(rawItems)) {
    slimmed[hash] = slimItem(item as never);
  }

  const slimTables = new Map(manifest.tables);
  slimTables.set("DestinyInventoryItemDefinition", slimmed);

  console.log("Building from slim projection");
  const slim = buildAll(slimTables, profile);

  console.log(`\nFull: ${full.size} items, slim: ${slim.size} items`);

  const differences: string[] = [];

  for (const [id, expected] of full) {
    const actual = slim.get(id);

    if (!actual) {
      differences.push(`${expected.name}: missing from slim build`);
      continue;
    }

    for (const field of ["name", "typeName", "power", "stats", "perks"] as const) {
      const a = JSON.stringify(expected[field]);
      const b = JSON.stringify(actual[field]);

      if (a !== b) {
        differences.push(`${expected.name} ${field}:\n    full ${a}\n    slim ${b}`);
      }
    }
  }

  if (differences.length === 0) {
    console.log("\nIdentical. The slim projection is sufficient for every item tested");

    return;
  }

  console.log(`\n${differences.length} differences:`);
  for (const difference of differences.slice(0, 20)) {
    console.log(`  ${difference}`);
  }

  process.exitCode = 1;
};

await main();
