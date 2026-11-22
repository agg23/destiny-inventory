import type {
  DestinyCollectibleDefinition,
  DestinyInventoryItemDefinition,
  DestinyPresentationNodeDefinition,
} from "bungie-api-ts/destiny2";

import {
  lookAssetShard,
  type LookArmor,
  type LookAsset,
  type LookDefault,
  type LookItem,
  type LookOrnament,
  type LookShader,
  type LookSlot,
} from "@dvm/defs-core";

import { loadShaderColors } from "./shaderColors.ts";

// DestinyItemType
const ARMOR = 2;
const MOD = 19;

const DEFAULT_SHADER = 4_248_210_736;

// DestinyItemSubType
const SHADER = 20;
const ORNAMENT = 21;

const SOURCE_PREFIX = /^Source:\s*/;

// Collections > Armor, whose grandchildren are one node per set
const ARMOR_NODE = 1_605_042_242;

// BucketHashes, whose enum file Node can't strip
const SLOT_BY_BUCKET: Record<number, LookSlot> = {
  3448274439: "helmet",
  3551918588: "arms",
  14239492: "chest",
  20886954: "legs",
  1585787867: "class",
};

const groupBy = (
  items: DestinyInventoryItemDefinition[],
  keyOf: (item: DestinyInventoryItemDefinition) => string,
): DestinyInventoryItemDefinition[][] => {
  const groups = new Map<string, DestinyInventoryItemDefinition[]>();

  for (const item of items) {
    const key = keyOf(item);
    const held = groups.get(key);

    if (held) {
      held.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  return [...groups.values()];
};

const entryOf = (
  group: DestinyInventoryItemDefinition[],
  collectibles: Record<number, DestinyCollectibleDefinition>,
) => {
  const newest = group.reduce((best, item) =>
    item.index > best.index ? item : best,
  );
  const source = group
    .map((item) => collectibles[item.collectibleHash ?? 0]?.sourceString)
    .find((text) => !!text);

  return {
    hash: newest.hash,
    hashes: group.map((item) => item.hash),
    name: newest.displayProperties.name,
    icon: newest.displayProperties.icon,
    tierType: newest.inventory?.tierType ?? 0,
    collectibleHashes: [
      ...new Set(
        group.flatMap((item) =>
          item.collectibleHash === undefined ? [] : [item.collectibleHash],
        ),
      ),
    ],
    source: source?.replace(SOURCE_PREFIX, ""),
  };
};

const setNames = (
  nodes: Record<number, DestinyPresentationNodeDefinition>,
): Map<number, string> => {
  const childrenOf = (hash: number) =>
    (nodes[hash]?.children.presentationNodes ?? []).flatMap((child) => {
      const node = nodes[child.presentationNodeHash];

      return node ? [node] : [];
    });
  const sets = childrenOf(ARMOR_NODE)
    .flatMap((node) => childrenOf(node.hash))
    .flatMap((node) => childrenOf(node.hash));

  return new Map(
    sets.flatMap((node) =>
      node.children.collectibles.map(
        (child) => [child.collectibleHash, node.displayProperties.name] as const,
      ),
    ),
  );
};

const byName = (a: LookItem, b: LookItem): number =>
  a.name.localeCompare(b.name);

/** Picker entries plus the loader's per-hash data, sharded by hash */
export const buildLooks = async (
  shipped: DestinyInventoryItemDefinition[],
  items: Record<number, DestinyInventoryItemDefinition>,
  collectibles: Record<number, DestinyCollectibleDefinition>,
  nodes: Record<number, DestinyPresentationNodeDefinition>,
  ornamentFits: Map<number, Set<number>>,
  gearAssets: Map<number, unknown>,
  iconCacheDir: string,
): Promise<{
  items: LookItem[];
  shards: Map<string, Record<number, LookAsset>>;
}> => {
  const renderable = shipped.filter((item) => gearAssets.has(item.hash));
  const slotOf = (item: DestinyInventoryItemDefinition) =>
    SLOT_BY_BUCKET[item.inventory?.bucketTypeHash ?? 0];
  const sets = setNames(nodes);
  const setOf = (group: DestinyInventoryItemDefinition[]) =>
    group
      .map((item) => sets.get(item.collectibleHash ?? 0))
      .find((name) => name !== undefined);

  const armorItems = renderable.filter(
    (item) => item.itemType === ARMOR && slotOf(item) !== undefined,
  );
  const armor = groupBy(
    armorItems,
    (item) =>
      `${item.displayProperties.name}|${item.inventory?.tierType}|${item.classType}|${slotOf(item)}`,
  ).map((group): LookArmor => ({
    kind: "armor",
    ...entryOf(group, collectibles),
    classType: group[0]!.classType,
    slot: slotOf(group[0]!)!,
    set: setOf(group),
  }));

  const shaderGroups = groupBy(
    renderable.filter(
      (item) => item.itemType === MOD && item.itemSubType === SHADER,
    ),
    (item) => item.displayProperties.name,
  );
  const colors = await loadShaderColors(
    iconCacheDir,
    shaderGroups.map((group) => entryOf(group, collectibles).icon),
  );
  const shaders = shaderGroups.map((group): LookShader => {
    const entry = entryOf(group, collectibles);

    return { kind: "shader", ...entry, colors: colors.get(entry.icon) ?? {} };
  });

  const ornamentItems = renderable.flatMap((item) => {
    if (item.itemSubType !== ORNAMENT) {
      return [];
    }

    const fitting = [...(ornamentFits.get(item.hash) ?? [])].flatMap((hash) => {
      const target = items[hash];

      return target && target.itemType === ARMOR && slotOf(target)
        ? [target]
        : [];
    });
    // Exotic ornaments share one plug set per slot, only the description names the armor
    const named = fitting.filter((target) =>
      item.displayProperties.description.includes(
        target.displayProperties.name,
      ),
    );
    const targets = named.length > 0 ? named : fitting;

    return targets.length > 0 ? [{ item, targets }] : [];
  });
  const targetsOf = new Map(
    ornamentItems.map(({ item, targets }) => [item.hash, targets]),
  );
  const ornaments = groupBy(
    ornamentItems.map(({ item }) => item),
    (item) => {
      const [target] = targetsOf.get(item.hash)!;

      return `${item.displayProperties.name}|${target!.classType}|${slotOf(target!)}`;
    },
  ).map((group): LookOrnament => {
    const targets = group.flatMap((item) => targetsOf.get(item.hash)!);
    const names = new Set(
      targets.map((target) => target.displayProperties.name),
    );

    return {
      kind: "ornament",
      ...entryOf(group, collectibles),
      classType: targets[0]!.classType,
      slot: slotOf(targets[0]!)!,
      items:
        names.size === 1
          ? [...new Set(targets.map((target) => target.hash))]
          : undefined,
      set: setOf(group),
    };
  });

  const defaultShader = items[DEFAULT_SHADER];
  const defaults: LookDefault[] = defaultShader
    ? [
        {
          kind: "default",
          ...entryOf([defaultShader], collectibles),
          hashes: [],
          collectibleHashes: [],
        },
      ]
    : [];

  const entries = [
    ...defaults,
    ...armor.sort(byName),
    ...shaders.sort(byName),
    ...ornaments.sort(byName),
  ];

  const shards = new Map<string, Record<number, LookAsset>>();

  for (const hash of entries.flatMap((entry) => entry.hashes)) {
    const item = items[hash]!;
    const name = lookAssetShard(hash);
    const shard = shards.get(name) ?? {};

    shard[hash] = {
      definition: {
        hash,
        itemType: item.itemType,
        itemSubType: item.itemSubType,
        itemCategoryHashes: item.itemCategoryHashes ?? [],
        traitIds: item.traitIds,
        defaultDamageType: item.defaultDamageType,
        translationBlock: item.translationBlock,
      },
      gearAsset: gearAssets.get(hash),
    };
    shards.set(name, shard);
  }

  return { items: entries, shards };
};
