import { brotliCompressSync } from "node:zlib";
import { join } from "node:path";

import { resolveClosure, slimItem, type Tables } from "@dvm/defs-core";
import type { DestinyInventoryItemDefinition } from "bungie-api-ts/destiny2";

import { loadManifest } from "./manifest.ts";

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
const CACHE_ROOT = join(REPO_ROOT, ".cache", "manifest");

const LEGENDARY = 5;
const WEAPON = 3;
const ARMOR = 2;
const SAMPLE_SIZE = 300;

const bytes = (value: unknown): number => JSON.stringify(value).length;

const mb = (n: number): string => `${(n / 1_048_576).toFixed(2)} MB`;

// Randomized perk columns
const isRolledLegendaryWeapon = (item: DestinyInventoryItemDefinition): boolean =>
  item.inventory?.tierType === LEGENDARY &&
  item.itemType === WEAPON &&
  (item.sockets?.socketEntries ?? []).some((socket) => socket.randomizedPlugSetHash);

const main = async () => {
  const manifest = await loadManifest(CACHE_ROOT);

  const tables: Tables = {
    items: manifest.tables.get("DestinyInventoryItemDefinition") as Tables["items"],
    plugSets: manifest.tables.get("DestinyPlugSetDefinition") as Tables["plugSets"],
  };

  const candidates = Object.values(tables.items)
    .filter(isRolledLegendaryWeapon)
    .map((item) => item.hash);

  const step = Math.max(1, Math.floor(candidates.length / SAMPLE_SIZE));
  const sample: number[] = [];

  for (let i = 0; sample.length < SAMPLE_SIZE && i < candidates.length; i += step) {
    sample.push(candidates[i]!);
  }

  console.log(`Rolled legendary weapons in manifest: ${candidates.length}`);
  console.log(`Sampled: ${sample.length}\n`);

  let naiveBytes = 0;
  let naivePlugs = 0;
  const perWeapon: number[] = [];

  for (const hash of sample) {
    const closure = resolveClosure([hash], tables);
    let weaponBytes = 0;

    for (const plugHash of closure.items) {
      weaponBytes += bytes(tables.items[plugHash]);
    }

    naiveBytes += weaponBytes;
    naivePlugs += closure.items.size;
    perWeapon.push(closure.items.size);
  }

  perWeapon.sort((a, b) => a - b);
  const median = perWeapon[Math.floor(perWeapon.length / 2)]!;

  const union = resolveClosure(sample, tables);

  const owned = new Set(sample);
  let unionBytes = 0;
  let plugOnlyBytes = 0;
  let plugOnlyCount = 0;

  const slimPayload: unknown[] = [];

  for (const plugHash of union.items) {
    const item = tables.items[plugHash];

    if (!item) {
      continue;
    }

    unionBytes += bytes(item);
    slimPayload.push(slimItem(item));

    if (!owned.has(plugHash)) {
      plugOnlyBytes += bytes(item);
      plugOnlyCount += 1;
    }
  }

  const slimRaw = JSON.stringify(slimPayload);
  const slimBrotli = brotliCompressSync(Buffer.from(slimRaw)).length;

  console.log(`Distinct plugs per weapon, median: ${median}`);
  console.log(`Distinct plugs per weapon, mean:   ${Math.round(naivePlugs / sample.length)}\n`);

  console.log(`Naive, per-item closures concatenated: ${mb(naiveBytes)}`);
  console.log(`Deduped union, full defs:              ${mb(unionBytes)}`);
  console.log(`  of which plugs only (${plugOnlyCount}):        ${mb(plugOnlyBytes)}`);
  console.log(`Deduped union, slim projection:        ${mb(slimRaw.length)}`);
  console.log(`Deduped union, slim and brotli:        ${mb(slimBrotli)}`);
  console.log(`\nCollapse: ${Math.round(naiveBytes / unionBytes)}x`);
  console.log(`Union item defs: ${union.items.size}, plug sets: ${union.plugSets.size}`);

  // Armour pulls the universal mod pools, weapons alone understate this badly
  const vaultCandidates = Object.values(tables.items)
    .filter(
      (item) =>
        (item.inventory?.tierType ?? 0) >= LEGENDARY &&
        (item.itemType === WEAPON || item.itemType === ARMOR),
    )
    .map((item) => item.hash);

  console.log("\nSynthetic vault scaling");
  console.log("owned   closure   raw        brotli");

  for (const size of [100, 500, 1000, 1500, 3000]) {
    const vaultStep = Math.max(1, Math.floor(vaultCandidates.length / size));
    const vault: number[] = [];

    for (let i = 0; vault.length < size && i < vaultCandidates.length; i += vaultStep) {
      vault.push(vaultCandidates[i]!);
    }

    const vaultClosure = resolveClosure(vault, tables);
    const payload = [...vaultClosure.items].flatMap((hash) => {
      const item = tables.items[hash];

      return item ? [slimItem(item)] : [];
    });

    const raw = Buffer.from(JSON.stringify(payload));
    const compressed = brotliCompressSync(raw);

    console.log(
      `${String(vault.length).padEnd(7)} ${String(vaultClosure.items.size).padEnd(9)} ${mb(raw.length).padStart(9)}  ${mb(compressed.length)}`,
    );
  }

  if (union.missing.length > 0) {
    console.log(`\nDangling references: ${union.missing.length}`);
    for (const ref of union.missing.slice(0, 5)) {
      console.log(`  ${ref.table}[${ref.hash}]`);
    }
  } else {
    console.log("\nNo dangling references");
  }
};

await main();
