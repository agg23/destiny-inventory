import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  DestinyCollectibleDefinition,
  DestinyInventoryItemDefinition,
  DestinySocketTypeDefinition,
} from "bungie-api-ts/destiny2";

import missingSources from "../../../vendor/DIM/src/data/d2/missing-source-info.ts";
import D2Sources from "../../../vendor/DIM/src/data/d2/source-info-v2.ts";

import {
  coreItem,
  detailItem,
  hasDetail,
  isShipped,
  resolveClosure,
  slimActivity,
  slimActivitySet,
  slimActivityType,
  slimChallenge,
  slimCollectible,
  slimDifficulty,
  slimGraphNode,
  slimItem,
  slimMode,
  slimModifier,
  slimPlace,
  slimReward,
  slimVendor,
  skullTable,
  type SlimItemSource,
  type SlimOrnament,
  type SlimVendorItem,
  type Tables,
} from "@dvm/defs-core";

import { mb, writeArtifact } from "./artifactFiles.ts";
import { buildLooks } from "./looks.ts";
import {
  loadGearAssets,
  loadManifest,
  table,
  type RawTable,
} from "./manifest.ts";
import { ARTIFACT_ROOT, CACHE_ROOT, DATA_ROOT } from "./paths.ts";

const AEGIS_DATA = join(DATA_ROOT, "aegis.json");
const PVP_DATA = join(DATA_ROOT, "pvp.json");

const ITEMS = "DestinyInventoryItemDefinition";
const PLUG_SETS = "DestinyPlugSetDefinition";

const COLLECTIBLES = "DestinyCollectibleDefinition";
const PRESENTATION_NODES = "DestinyPresentationNodeDefinition";
const ACTIVITIES = "DestinyActivityDefinition";
const VENDORS = "DestinyVendorDefinition";
const OBJECTIVES = "DestinyObjectiveDefinition";
const SKULLS = "DestinyActivitySelectableSkullCollectionDefinition";
const SOCKET_TYPES = "DestinySocketTypeDefinition";

const EMPTY_CATALYST = "v400.empty.exotic.masterwork";

// DestinyItemType
const ARMOR = 2;
const WEAPON = 3;
const DUMMY = 20;

// DestinyItemSubType
const ORNAMENT = 21;

// TierType.Exotic
const EXOTIC = 6;

const SLIM: Record<string, (record: never) => { hash: number }> = {
  DestinyActivityDefinition: slimActivity,
  DestinyActivityDifficultyTierCollectionDefinition: slimDifficulty,
  DestinyActivityModeDefinition: slimMode,
  DestinyActivityModifierDefinition: slimModifier,
  DestinyActivityTypeDefinition: slimActivityType,
  DestinyCollectibleDefinition: slimCollectible,
  DestinyFireteamFinderActivityGraphDefinition: slimGraphNode,
  DestinyFireteamFinderActivitySetDefinition: slimActivitySet,
  DestinyDestinationDefinition: slimPlace,
  DestinyPlaceDefinition: slimPlace,
  DestinyVendorDefinition: slimVendor,
};

const project = (tableName: string, contents: RawTable): RawTable => {
  // PGCRs name skulls by an identifier nested inside the collections
  if (tableName === SKULLS) {
    return skullTable(contents) as RawTable;
  }

  const slim = SLIM[tableName];

  if (!slim) {
    return contents;
  }

  const projected: RawTable = {};

  for (const [hash, record] of Object.entries(contents)) {
    projected[hash] = slim(record as never);
  }

  return projected;
};

// Year one exotics leave their second catalyst out of the socket
const addCatalysts = (
  tables: Tables,
  socketTypes: Record<number, DestinySocketTypeDefinition>,
): number => {
  const items = Object.values(tables.items) as DestinyInventoryItemDefinition[];
  const byCategory = new Map<string, DestinyInventoryItemDefinition[]>();
  let added = 0;

  for (const item of items) {
    const category = item.plug?.plugCategoryIdentifier;

    if (category && item.itemType !== DUMMY) {
      byCategory.set(category, [...(byCategory.get(category) ?? []), item]);
    }
  }

  for (const weapon of items) {
    if (weapon.itemType !== WEAPON || weapon.inventory?.tierType !== EXOTIC) {
      continue;
    }

    for (const entry of weapon.sockets?.socketEntries ?? []) {
      const categories = (
        socketTypes[entry.socketTypeHash]?.plugWhitelist ?? []
      ).map((allowed) => allowed.categoryIdentifier);

      const masterworks = categories.filter(
        (category) =>
          category !== EMPTY_CATALYST && category.endsWith("masterwork"),
      );

      if (masterworks.length === 0) {
        continue;
      }

      const listed = (
        tables.plugSets[entry.reusablePlugSetHash ?? 0]?.reusablePlugItems ?? []
      ).some((plug) => {
        const item = tables.items[plug.plugItemHash];

        return (
          item !== undefined &&
          item.itemType !== DUMMY &&
          item.plug?.plugCategoryIdentifier !== EMPTY_CATALYST
        );
      });

      if (listed) {
        continue;
      }

      const own = new Set(
        (entry.reusablePlugItems ?? []).map((plug) => plug.plugItemHash),
      );
      const candidates = masterworks
        .flatMap((category) => byCategory.get(category) ?? [])
        .filter(
          (candidate) =>
            !own.has(candidate.hash) && candidate.displayProperties.name,
        );
      const named = candidates.filter(
        (candidate) =>
          candidate.displayProperties.name ===
          `${weapon.displayProperties.name} Catalyst`,
      );
      const picked =
        named.length > 0 ? named : candidates.length === 1 ? candidates : [];

      Object.assign(entry, {
        reusablePlugItems: [
          ...(entry.reusablePlugItems ?? []),
          ...picked.map((plug) => ({ plugItemHash: plug.hash })),
        ],
      });
      added += picked.length;
    }
  }

  return added;
};

// Bungie sources DIM has no tag for
const SOURCE_STRING_KEYS: Record<string, string> = {
  "Source: Exotic engrams; extremely rare world drops.": "exoticengram",
  "Source: Exotic Archive at the Tower": "exoticarchive",
  "Source: Xûr": "xur",
  "Source: Acquired from Xûr": "xur",
};

const VERSION_SUFFIX = / \((Adept|Timelost|Harrowed)\)$/;

// Reissues often have no collectible
const itemSources = (
  all: DestinyInventoryItemDefinition[],
  shipped: DestinyInventoryItemDefinition[],
  collectibles: Record<number, DestinyCollectibleDefinition>,
): SlimItemSource[] => {
  const canonical = new Map<string, string>(
    Object.entries(D2Sources).flatMap(([key, info]) =>
      (info.aliases ?? []).map((alias): [string, string] => [alias, key]),
    ),
  );
  const bySource = new Map<number, string[]>();
  const byItem = new Map<number, string[]>();

  const add = (map: Map<number, string[]>, hash: number, key: string) => {
    map.set(hash, [...(map.get(hash) ?? []), key]);
  };

  for (const [key, info] of Object.entries(D2Sources)) {
    for (const hash of info.sourceHashes ?? []) {
      add(bySource, hash, key);
    }

    for (const hash of info.itemHashes ?? []) {
      add(byItem, hash, key);
    }
  }

  for (const [alias, hashes] of Object.entries(missingSources)) {
    for (const hash of hashes) {
      add(byItem, hash, canonical.get(alias) ?? alias);
    }
  }

  const groupOf = (item: DestinyInventoryItemDefinition) =>
    `${item.displayProperties.name.replace(VERSION_SUFFIX, "")}|${item.itemType}|${item.classType}`;
  const gear = (item: DestinyInventoryItemDefinition) =>
    (item.itemType === WEAPON || item.itemType === ARMOR) &&
    !!item.displayProperties?.name;

  const own = new Map<number, Set<string>>();
  const pooled = new Map<string, Set<string>>();

  for (const item of all.filter(gear)) {
    const collectible =
      item.collectibleHash === undefined
        ? undefined
        : collectibles[item.collectibleHash];
    const keys = new Set([
      ...(byItem.get(item.hash) ?? []),
      ...(collectible?.sourceHash === undefined
        ? []
        : (bySource.get(collectible.sourceHash) ?? [])),
      ...(collectible && SOURCE_STRING_KEYS[collectible.sourceString]
        ? [SOURCE_STRING_KEYS[collectible.sourceString]!]
        : []),
    ]);

    if (keys.size === 0) {
      continue;
    }

    own.set(item.hash, keys);

    const group = groupOf(item);
    pooled.set(group, new Set([...(pooled.get(group) ?? []), ...keys]));
  }

  // DIM lists all of Monument under one source hash
  const breadth = new Map<string, number>();

  for (const keys of pooled.values()) {
    for (const key of keys) {
      breadth.set(key, (breadth.get(key) ?? 0) + 1);
    }
  }

  const narrowest = (keys: Set<string>) =>
    [...keys].sort((a, b) => breadth.get(a)! - breadth.get(b)!);

  return shipped.filter(gear).flatMap((item): SlimItemSource[] => {
    const keys = own.get(item.hash) ?? pooled.get(groupOf(item));

    return keys ? [{ hash: item.hash, keys: narrowest(keys) }] : [];
  });
};

const main = async () => {
  const manifest = await loadManifest(CACHE_ROOT);
  const dir = join(ARTIFACT_ROOT, manifest.version);
  await mkdir(dir, { recursive: true });

  const tables: Tables = {
    items: table(manifest, ITEMS)!,
    plugSets: table(manifest, PLUG_SETS)!,
  };

  const catalysts = addCatalysts(tables, table(manifest, SOCKET_TYPES) ?? {});

  const all = Object.values(tables.items) as DestinyInventoryItemDefinition[];
  const shipped = all.filter(isShipped);
  const shippedHashes = new Set(shipped.map((item) => item.hash));

  const closure = resolveClosure(shippedHashes, tables);

  // A dangling ref here is a missing perk at runtime
  if (closure.missing.length > 0) {
    throw new Error(
      `Universal closure has ${closure.missing.length} dangling references`,
    );
  }

  console.log(`\n${all.length} items, ${shipped.length} shipped`);
  console.log(`${catalysts} catalysts added to their sockets`);
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

  const plugsets = [...closure.plugSets]
    .map((hash) => tables.plugSets[hash])
    .filter(Boolean);

  // Lets the client tell withheld defs from missing ones
  const hidden = all
    .filter((item) => !shippedHashes.has(item.hash))
    .map((item) => item.hash);

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

  // Activity loot items are dummies too
  const rewardHashes = new Set<number>();
  const challengeHashes = new Set<number>();

  for (const activity of Object.values(table(manifest, ACTIVITIES) ?? {})) {
    for (const reward of activity.rewards ?? []) {
      for (const item of reward.rewardItems ?? []) {
        rewardHashes.add(item.itemHash);
      }
    }

    for (const challenge of activity.challenges ?? []) {
      challengeHashes.add(challenge.objectiveHash);
    }
  }

  // Pursuit rewards are dummies too, found via item.value
  for (const item of shipped) {
    for (const reward of item.value?.itemValue ?? []) {
      if (reward.itemHash) {
        rewardHashes.add(reward.itemHash);
      }
    }
  }

  // Vendor stock is dummies. Only the vendor's item list references them
  const vendorHashes = new Set<number>();

  for (const vendor of Object.values(table(manifest, VENDORS) ?? {})) {
    for (const entry of vendor.itemList ?? []) {
      vendorHashes.add(entry.itemHash);

      for (const cost of entry.currencies ?? []) {
        vendorHashes.add(cost.itemHash);
      }
    }
  }

  // Some vendors sell a dummy copy of a real item, linked only by name
  const sameNamed = new Map<string, number[]>();

  for (const item of shipped) {
    const key = `${item.displayProperties.name}|${item.inventory?.tierType}`;

    sameNamed.set(key, [...(sameNamed.get(key) ?? []), item.hash]);
  }

  const vendorItems = [...vendorHashes].flatMap((hash): SlimVendorItem[] => {
    const item = tables.items[hash];

    if (!item) {
      return [];
    }

    const matches =
      item.itemType === DUMMY
        ? sameNamed.get(
            `${item.displayProperties.name}|${item.inventory?.tierType}`,
          )
        : undefined;

    return [
      {
        ...slimReward(item),
        standIn: matches?.length === 1 ? matches[0] : undefined,
      },
    ];
  });

  // Ornament defs don't name their item, only the sockets offering them do
  const ornamentHashes = new Set(
    all
      .filter((item) => item.itemSubType === ORNAMENT)
      .map((item) => item.hash),
  );
  const fits = new Map<number, Set<number>>();

  for (const item of shipped) {
    if (item.itemType !== WEAPON && item.itemType !== ARMOR) {
      continue;
    }

    for (const entry of item.sockets?.socketEntries ?? []) {
      const sets = [entry.reusablePlugSetHash, entry.randomizedPlugSetHash];
      const offered = [
        ...(entry.reusablePlugItems ?? []).map((plug) => plug.plugItemHash),
        ...sets.flatMap((hash) =>
          hash === undefined
            ? []
            : (tables.plugSets[hash]?.reusablePlugItems ?? []).map(
                (plug) => plug.plugItemHash,
              ),
        ),
      ];

      for (const plug of offered) {
        if (ornamentHashes.has(plug)) {
          fits.set(plug, (fits.get(plug) ?? new Set()).add(item.hash));
        }
      }
    }
  }

  // Universal ornaments fit a whole slot and get no link
  const ornaments = [...fits].flatMap(([hash, targets]): SlimOrnament[] => {
    const names = new Set(
      [...targets].map((one) => tables.items[one]?.displayProperties.name),
    );

    return names.size === 1 ? [{ hash, items: [...targets] }] : [];
  });

  const rewards = [...rewardHashes].flatMap((hash) => {
    const item = tables.items[hash];

    return item ? [slimReward(item)] : [];
  });

  const objectives = table(manifest, OBJECTIVES) ?? {};

  const challenges = [...challengeHashes].flatMap((hash) => {
    const objective = objectives[hash];

    return objective ? [slimChallenge(objective)] : [];
  });

  const coreFile = await emit("core", core);
  await emit("ActivityReward", rewards);
  await emit("ActivityChallenge", challenges);
  await emit("VendorItem", vendorItems);
  await emit("OrnamentTarget", ornaments);

  const looks = await buildLooks(
    shipped,
    tables.items,
    table(manifest, COLLECTIBLES) ?? {},
    table(manifest, PRESENTATION_NODES) ?? {},
    fits,
    await loadGearAssets(CACHE_ROOT),
    join(DATA_ROOT, "icons"),
  );

  await emit("LookItem", looks.items);

  for (const [name, shard] of looks.shards) {
    await emit(name, shard);
  }
  await emit(
    "ItemSource",
    itemSources(
      all,
      shipped,
      table(manifest, COLLECTIBLES) ?? {},
    ),
  );
  const detailFile = await emit("detail", detail);
  await emit("plugsets", plugsets);
  await emit("hidden", hidden);

  // Refreshed out of band by build:rolls
  if (existsSync(AEGIS_DATA)) {
    await emit("rolls", JSON.parse(await readFile(AEGIS_DATA, "utf8")));
  } else {
    console.log("  no aegis.json, skipping rolls");
  }

  if (existsSync(PVP_DATA)) {
    await emit("pvprolls", JSON.parse(await readFile(PVP_DATA, "utf8")));
  } else {
    console.log("  no pvp.json, skipping pvprolls");
  }

  for (const [tableName, contents] of manifest.tables) {
    if (tableName === ITEMS || tableName === PLUG_SETS) {
      continue;
    }

    const name = tableName.replace(/^Destiny|Definition$/g, "");
    await emit(name, project(tableName, contents));
  }

  await writeFile(
    join(dir, "index.json"),
    JSON.stringify({ manifestVersion: manifest.version, files }, undefined, 2),
  );

  console.log(
    `  tier 1 core   ${String(core.length).padStart(6)} records ${mb(
      coreFile.raw,
    ).padStart(10)} across ${coreFile.files.length} files`,
  );
  console.log(
    `  tier 2 detail ${String(detail.length).padStart(6)} records ${mb(
      detailFile.raw,
    ).padStart(10)} across ${detailFile.files.length} files`,
  );
  console.log(`  withheld      ${String(hidden.length).padStart(6)} hashes`);
  console.log(
    `\nTotal: ${mb(
      totalRaw,
    )} raw across ${fileCount} files, compressed by the edge`,
  );
  console.log(`Artifacts in ${dir}`);
};

await main();
