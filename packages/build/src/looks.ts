import type { DestinyInventoryItemDefinition } from "bungie-api-ts/destiny2";

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

// DestinyItemType
const ARMOR = 2;
const MOD = 19;

const DEFAULT_SHADER = 4_248_210_736;
const DEFAULT_ORNAMENT = 702_981_643;

// DestinyItemSubType
const SHADER = 20;
const ORNAMENT = 21;

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

const entryOf = (group: DestinyInventoryItemDefinition[]) => {
  const newest = group.reduce((best, item) =>
    item.index > best.index ? item : best,
  );

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
  };
};

const byName = (a: LookItem, b: LookItem): number =>
  a.name.localeCompare(b.name);

/** Picker entries plus the loader's per-hash data, sharded by hash */
export const buildLooks = (
  shipped: DestinyInventoryItemDefinition[],
  items: Record<number, DestinyInventoryItemDefinition>,
  ornamentFits: Map<number, Set<number>>,
  gearAssets: Map<number, unknown>,
): { items: LookItem[]; shards: Map<string, Record<number, LookAsset>> } => {
  const renderable = shipped.filter((item) => gearAssets.has(item.hash));
  const slotOf = (item: DestinyInventoryItemDefinition) =>
    SLOT_BY_BUCKET[item.inventory?.bucketTypeHash ?? 0];

  const armorItems = renderable.filter(
    (item) => item.itemType === ARMOR && slotOf(item) !== undefined,
  );
  const armor = groupBy(
    armorItems,
    (item) =>
      `${item.displayProperties.name}|${item.inventory?.tierType}|${item.classType}|${slotOf(item)}`,
  ).map((group): LookArmor => ({
    kind: "armor",
    ...entryOf(group),
    classType: group[0]!.classType,
    slot: slotOf(group[0]!)!,
  }));

  const shaders = groupBy(
    renderable.filter(
      (item) => item.itemType === MOD && item.itemSubType === SHADER,
    ),
    (item) => item.displayProperties.name,
  ).map((group): LookShader => ({ kind: "shader", ...entryOf(group) }));

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
      ...entryOf(group),
      classType: targets[0]!.classType,
      slot: slotOf(targets[0]!)!,
      items:
        names.size === 1
          ? [...new Set(targets.map((target) => target.hash))]
          : undefined,
    };
  });

  const defaults = (
    [
      ["shader", DEFAULT_SHADER],
      ["ornament", DEFAULT_ORNAMENT],
    ] as const
  ).flatMap(([replaces, hash]): LookDefault[] => {
    const item = items[hash];

    return item
      ? [
          {
            kind: "default",
            replaces,
            ...entryOf([item]),
            hashes: [],
            collectibleHashes: [],
          },
        ]
      : [];
  });

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
