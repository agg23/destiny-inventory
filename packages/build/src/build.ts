import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  coreItem,
  detailItem,
  hasDetail,
  isShipped,
  resolveClosure,
  slimItem,
  type Tables,
} from "@dvm/defs-core";
import type { DestinyInventoryItemDefinition } from "bungie-api-ts/destiny2";

import { loadManifest, type RawTable } from "./manifest.ts";

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
const CACHE_ROOT = join(REPO_ROOT, ".cache", "manifest");
const ARTIFACT_ROOT = join(REPO_ROOT, "artifacts");

const ITEMS = "DestinyInventoryItemDefinition";
const PLUG_SETS = "DestinyPlugSetDefinition";
const VENDORS = "DestinyVendorDefinition";

// getBuckets reads one vendor for the vault bucket mappings
const VAULT_VENDOR = 1037843411;

const mb = (n: number): string => `${(n / 1_048_576).toFixed(2)} MB`;

const contentHash = (body: Buffer): string =>
  createHash("sha256").update(body).digest("hex").slice(0, 16);

// Static assets cap a single file, and the edge compresses on the way out
const CHUNK_BYTES = 15 * 1_048_576;

const writeOne = async (dir: string, name: string, value: unknown, part?: number) => {
  const raw = Buffer.from(JSON.stringify(value));
  const suffix = part === undefined ? "" : `-${part}`;
  const file = `${name}${suffix}.${contentHash(raw)}.json`;

  await writeFile(join(dir, file), raw);

  return { file, raw: raw.length };
};

// Serving these ourselves is what broke on Workers: the edge re-compresses a body that
// already carries Content-Encoding, so they ship plain and the platform handles encoding
const writeArtifact = async (
  dir: string,
  name: string,
  value: unknown,
): Promise<{ files: string[]; raw: number }> => {
  if (!Array.isArray(value)) {
    const only = await writeOne(dir, name, value);

    return { files: [only.file], raw: only.raw };
  }

  const perRecord = Buffer.byteLength(JSON.stringify(value)) / Math.max(value.length, 1);
  const perChunk = Math.max(1, Math.floor(CHUNK_BYTES / Math.max(perRecord, 1)));

  const files: string[] = [];
  let raw = 0;
  let part = 0;

  for (let start = 0; start < value.length; start += perChunk) {
    const written = await writeOne(dir, name, value.slice(start, start + perChunk), part);

    files.push(written.file);
    raw += written.raw;
    part += 1;
  }

  return { files, raw };
};

const main = async () => {
  const manifest = await loadManifest(CACHE_ROOT);
  const dir = join(ARTIFACT_ROOT, manifest.version);
  await mkdir(dir, { recursive: true });

  const tables: Tables = {
    items: manifest.tables.get(ITEMS) as Tables["items"],
    plugSets: manifest.tables.get(PLUG_SETS) as Tables["plugSets"],
  };

  const all = Object.values(tables.items) as DestinyInventoryItemDefinition[];
  const shipped = all.filter(isShipped);
  const shippedHashes = new Set(shipped.map((item) => item.hash));

  const closure = resolveClosure(shippedHashes, tables);

  // A dangling ref here is a missing perk at runtime
  if (closure.missing.length > 0) {
    throw new Error(`Universal closure has ${closure.missing.length} dangling references`);
  }

  console.log(`\n${all.length} items, ${shipped.length} shipped`);
  console.log(
    `closure: ${closure.items.size} items, ${closure.plugSets.size} plug sets, no dangling references`,
  );

  const core = shipped.map(coreItem);

  const detail = [
    ...shipped.filter(hasDetail).map(detailItem),
    ...[...closure.items]
      .filter((hash) => !shippedHashes.has(hash))
      .flatMap((hash) => {
        const item = tables.items[hash];

        return item ? [slimItem(item)] : [];
      }),
  ];

  const plugsets = [...closure.plugSets].map((hash) => tables.plugSets[hash]).filter(Boolean);

  // Profiles reference these, so the client needs to tell a withheld definition from a
  // missing one. validate() walks definitions and cannot see a reference arriving from a
  // profile, which is how Dummy items reached the client as errors
  const hidden = all.filter((item) => !shippedHashes.has(item.hash)).map((item) => item.hash);

  console.log("\nWriting artifacts");

  const files: Record<string, string[]> = {};
  let totalRaw = 0;
  let fileCount = 0;

  const emit = async (name: string, value: unknown) => {
    const result = await writeArtifact(dir, name, value);

    files[name] = result.files;
    totalRaw += result.raw;
    fileCount += result.files.length;

    return result;
  };

  const coreFile = await emit("core", core);
  const detailFile = await emit("detail", detail);
  await emit("plugsets", plugsets);
  await emit("hidden", hidden);

  for (const [table, contents] of manifest.tables) {
    if (table === ITEMS || table === PLUG_SETS) {
      continue;
    }

    const name = table.replace(/^Destiny|Definition$/g, "");
    const value = table === VENDORS ? { [VAULT_VENDOR]: contents[VAULT_VENDOR] } : contents;

    await emit(name, value);
  }

  await writeFile(
    join(dir, "index.json"),
    JSON.stringify({ manifestVersion: manifest.version, files }, undefined, 2),
  );

  console.log(
    `  tier 1 core   ${String(core.length).padStart(6)} records ${mb(coreFile.raw).padStart(10)} across ${coreFile.files.length} files`,
  );
  console.log(
    `  tier 2 detail ${String(detail.length).padStart(6)} records ${mb(detailFile.raw).padStart(10)} across ${detailFile.files.length} files`,
  );
  console.log(`  withheld      ${String(hidden.length).padStart(6)} hashes`);
  console.log(`\nTotal: ${mb(totalRaw)} raw across ${fileCount} files, compressed by the edge`);
  console.log(`Artifacts in ${dir}`);
};

await main();
