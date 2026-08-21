import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

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
] as const;

export type TableName = (typeof TABLES)[number];

export type RawTable = Record<string, unknown>;

export interface Manifest {
  version: string;
  tables: Map<TableName, RawTable>;
}

interface ManifestIndexResponse {
  Response: {
    version: string;
    jsonWorldComponentContentPaths: Record<string, Record<string, string>>;
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
