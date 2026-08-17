import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { brotliCompressSync, constants } from "node:zlib";

import { resolveClosure, slimItem, type Tables } from "@dvm/defs-core";
import type { DestinyProfileResponse } from "bungie-api-ts/destiny2";

import { loadManifest, type RawTable } from "./manifest.ts";

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
const CACHE_ROOT = join(REPO_ROOT, ".cache", "manifest");
const PROFILE_FIXTURE = join(REPO_ROOT, ".cache", "profile.json");
const ARTIFACT_ROOT = join(REPO_ROOT, "artifacts");

const ITEMS = "DestinyInventoryItemDefinition";
const PLUG_SETS = "DestinyPlugSetDefinition";
const VENDORS = "DestinyVendorDefinition";

// getBuckets reads one vendor for the vault bucket mappings
const VAULT_VENDOR = 1037843411;

const mb = (n: number): string => `${(n / 1_048_576).toFixed(2)} MB`;

const contentHash = (body: Buffer): string =>
  createHash("sha256").update(body).digest("hex").slice(0, 16);

// No runtime brotli on Workers
const writeArtifact = async (
  dir: string,
  name: string,
  value: unknown,
): Promise<{ name: string; raw: number; compressed: number }> => {
  const raw = Buffer.from(JSON.stringify(value));
  const compressed = brotliCompressSync(raw, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  });

  const fileName = `${name}.${contentHash(raw)}.json.br`;
  await writeFile(join(dir, fileName), compressed);

  return { name: fileName, raw: raw.length, compressed: compressed.length };
};

const ownedHashes = async (): Promise<number[]> => {
  if (!existsSync(PROFILE_FIXTURE)) {
    return [];
  }

  const body = JSON.parse(await readFile(PROFILE_FIXTURE, "utf8")) as
    | DestinyProfileResponse
    | { Response: DestinyProfileResponse };

  const profile = "Response" in body ? body.Response : body;
  const hashes = new Set<number>();

  for (const item of profile.profileInventory?.data?.items ?? []) {
    hashes.add(item.itemHash);
  }

  for (const equipment of Object.values(profile.characterEquipment?.data ?? {})) {
    for (const item of equipment.items) {
      hashes.add(item.itemHash);
    }
  }

  for (const inventory of Object.values(profile.characterInventories?.data ?? {})) {
    for (const item of inventory.items) {
      hashes.add(item.itemHash);
    }
  }

  return [...hashes];
};

const main = async () => {
  const manifest = await loadManifest(CACHE_ROOT);
  const dir = join(ARTIFACT_ROOT, manifest.version);
  await mkdir(dir, { recursive: true });

  const rawItems = manifest.tables.get(ITEMS) as RawTable;
  const slimmed: RawTable = {};

  for (const [hash, item] of Object.entries(rawItems)) {
    slimmed[hash] = slimItem(item as never);
  }

  const tables: Tables = {
    items: rawItems as Tables["items"],
    plugSets: manifest.tables.get(PLUG_SETS) as Tables["plugSets"],
  };

  // A dangling ref here is a missing perk at runtime
  const owned = await ownedHashes();

  if (owned.length > 0) {
    const closure = resolveClosure(owned, tables);

    if (closure.missing.length > 0) {
      throw new Error(
        `Closure over ${owned.length} owned hashes has ${closure.missing.length} dangling references`,
      );
    }

    console.log(
      `\nvalidate: ${owned.length} owned hashes close over ${closure.items.size} items and ${closure.plugSets.size} plug sets, no dangling references`,
    );

    // What one client actually receives
    const payload = {
      items: [...closure.items].map((hash) => slimmed[hash]).filter(Boolean),
      plugSets: [...closure.plugSets].map((hash) => tables.plugSets[hash]).filter(Boolean),
    };

    const payloadRaw = Buffer.from(JSON.stringify(payload));
    const payloadBrotli = brotliCompressSync(payloadRaw, {
      params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
    });

    console.log(
      `payload: ${mb(payloadRaw.length)} raw, ${mb(payloadBrotli.length)} brotli, against DIM's 199 MB item table`,
    );
  } else {
    console.log("\nvalidate: skipped, no profile fixture");
  }

  console.log("\nWriting artifacts");

  const written = [
    await writeArtifact(dir, "items", slimmed),
    await writeArtifact(dir, "plugsets", tables.plugSets),
  ];

  for (const [table, contents] of manifest.tables) {
    if (table === ITEMS || table === PLUG_SETS) {
      continue;
    }

    const name = table.replace(/^Destiny|Definition$/g, "");
    const value =
      table === VENDORS ? { [VAULT_VENDOR]: contents[VAULT_VENDOR] } : contents;

    written.push(await writeArtifact(dir, name, value));
  }

  const index = {
    manifestVersion: manifest.version,
    files: written.map((file) => file.name),
  };

  await writeFile(join(dir, "index.json"), JSON.stringify(index, undefined, 2));

  let totalRaw = 0;
  let totalCompressed = 0;

  for (const file of written) {
    totalRaw += file.raw;
    totalCompressed += file.compressed;
  }

  for (const file of written.slice(0, 4)) {
    console.log(`  ${file.name.padEnd(44)} ${mb(file.raw).padStart(10)} -> ${mb(file.compressed)}`);
  }

  console.log(`  ... ${written.length - 4} more`);
  console.log(`\nTotal: ${mb(totalRaw)} raw, ${mb(totalCompressed)} brotli`);
  console.log(`Artifacts in ${dir}`);
};

await main();
