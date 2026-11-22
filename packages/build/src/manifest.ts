import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AllDestinyManifestComponents } from "bungie-api-ts/destiny2";
import { unzipSync } from "fflate";

const MANIFEST_INDEX = "https://www.bungie.net/Platform/Destiny2/Manifest/";
const BUNGIE_ROOT = "https://www.bungie.net";

export const TABLES = [
  "DestinyInventoryItemDefinition",
  "DestinyInventoryBucketDefinition",
  "DestinyObjectiveDefinition",
  "DestinySandboxPerkDefinition",
  "DestinyStatDefinition",
  "DestinyStatGroupDefinition",
  "DestinyDamageTypeDefinition",
  "DestinyProgressionDefinition",
  "DestinyItemCategoryDefinition",
  "DestinySocketCategoryDefinition",
  "DestinySocketTypeDefinition",
  "DestinyMaterialRequirementSetDefinition",
  "DestinySeasonDefinition",
  "DestinySeasonPassDefinition",
  "DestinyPlugSetDefinition",
  "DestinyCollectibleDefinition",
  "DestinyPresentationNodeDefinition",
  "DestinyRecordDefinition",
  "DestinyMetricDefinition",
  "DestinyTraitDefinition",
  "DestinyBreakerTypeDefinition",
  "DestinyEnergyTypeDefinition",
  "DestinyPowerCapDefinition",
  "DestinyClassDefinition",
  "DestinyRaceDefinition",
  "DestinyGenderDefinition",
  "DestinyFactionDefinition",
  "DestinyVendorDefinition",
  "DestinyVendorGroupDefinition",
  "DestinyEquipableItemSetDefinition",
  "DestinyInventoryItemConstantsDefinition",
  "DestinyIconDefinition",
  "DestinyActivityDefinition",
  "DestinyActivityDifficultyTierCollectionDefinition",
  "DestinyActivityModeDefinition",
  "DestinyActivityModifierDefinition",
  "DestinyActivitySelectableSkullCollectionDefinition",
  "DestinyActivityTypeDefinition",
  "DestinyFireteamFinderActivityGraphDefinition",
  "DestinyFireteamFinderActivitySetDefinition",
  "DestinyDestinationDefinition",
  "DestinyPlaceDefinition",
  "DestinyEventCardDefinition",
  "DestinyGlobalConstantsDefinition",
] as const;

export type TableName = (typeof TABLES)[number];

export type RawTable = Record<string, unknown>;

export interface Manifest {
  version: string;
  tables: Map<TableName, RawTable>;
}

/** A manifest table typed by name, undefined when this manifest lacks it */
export const table = <Name extends TableName>(
  manifest: Manifest,
  name: Name,
): AllDestinyManifestComponents[Name] | undefined =>
  manifest.tables.get(name) as AllDestinyManifestComponents[Name] | undefined;

interface ManifestIndexResponse {
  Response: {
    version: string;
    jsonWorldComponentContentPaths: Record<string, Record<string, string>>;
    mobileGearAssetDataBases: { version: number; path: string }[];
  };
}

// No API key needed
const fetchIndex = async (): Promise<ManifestIndexResponse["Response"]> => {
  const response = await fetch(MANIFEST_INDEX);

  if (!response.ok) {
    throw new Error(
      `Manifest index failed: ${response.status} ${response.statusText}`,
    );
  }

  const body = (await response.json()) as ManifestIndexResponse;

  return body.Response;
};

const fetchTable = async (
  path: string,
  destination: string,
): Promise<RawTable> => {
  const response = await fetch(`${BUNGIE_ROOT}${path}`);

  if (!response.ok) {
    throw new Error(`Table fetch failed: ${response.status} ${path}`);
  }

  const text = await response.text();
  await writeFile(destination, text, "utf8");

  return JSON.parse(text) as RawTable;
};

const loadTable = async (
  table: TableName,
  path: string,
  cacheDir: string,
): Promise<RawTable> => {
  const destination = join(cacheDir, `${table}.json`);

  if (existsSync(destination)) {
    return JSON.parse(await readFile(destination, "utf8")) as RawTable;
  }

  console.log(`  downloading ${table}`);

  return fetchTable(path, destination);
};

/** DestinyGearAssetsDefinition by item hash, only published as the mobile SQLite database */
export const loadGearAssets = async (
  cacheRoot: string,
): Promise<Map<number, unknown>> => {
  const index = await fetchIndex();
  const path = index.mobileGearAssetDataBases.at(-1)?.path;

  if (!path) {
    throw new Error("Manifest index has no gear asset database");
  }

  const cacheDir = join(cacheRoot, index.version);
  const destination = join(cacheDir, `${basename(path)}.sqlite`);

  await mkdir(cacheDir, { recursive: true });

  if (!existsSync(destination)) {
    console.log("  downloading gear assets");

    const response = await fetch(`${BUNGIE_ROOT}${path}`);

    if (!response.ok) {
      throw new Error(`Gear asset fetch failed: ${response.status} ${path}`);
    }

    const [database] = Object.values(
      unzipSync(new Uint8Array(await response.arrayBuffer())),
    );

    if (!database) {
      throw new Error(`Gear asset archive is empty: ${path}`);
    }

    await writeFile(destination, database);
  }

  const database = new DatabaseSync(destination, { readOnly: true });
  const rows = database
    .prepare("SELECT id, json FROM DestinyGearAssetsDefinition")
    .all() as { id: number; json: string }[];
  const assets = new Map<number, unknown>();

  // Row ids are the hash as a signed int32
  for (const row of rows) {
    assets.set(row.id >>> 0, JSON.parse(row.json));
  }

  database.close();

  return assets;
};

export const loadManifest = async (cacheRoot: string): Promise<Manifest> => {
  const index = await fetchIndex();
  const paths = index.jsonWorldComponentContentPaths.en;

  if (!paths) {
    throw new Error("Manifest index has no 'en' content paths");
  }

  const cacheDir = join(cacheRoot, index.version);
  await mkdir(cacheDir, { recursive: true });

  console.log(`Manifest ${index.version}`);

  const tables = new Map<TableName, RawTable>();

  for (const table of TABLES) {
    const path = paths[table];

    if (!path) {
      console.log(`  skipping ${table}, absent from this manifest`);
      continue;
    }

    tables.set(table, await loadTable(table, path, cacheDir));
  }

  return { version: index.version, tables };
};
