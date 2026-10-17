import type { DimItem } from "app/inventory/item-types";
import { ItemRarityMap } from "app/search/d2-known-values";
import { itemCategoryFilter } from "app/search/items/search-filters/known-values";
import { plainString } from "app/search/text-utils";
import type {
  DestinyInventoryItemDefinition,
  DestinyEquipableItemSetDefinition,
  DestinyPresentationNodeDefinition,
} from "bungie-api-ts/destiny2";
import exoticToCatalystRecordHash from "data/d2/exotic-to-catalyst-record.json" with { type: "json" };
import extendedICH from "data/d2/extended-ich.json" with { type: "json" };
import { ItemCategoryHashes } from "data/d2/generated-enums";
import D2Sources from "data/d2/source-info-v2";

import type { SlimCollectible } from "@dvm/defs-core";

import { fetchTable } from "../api/artifacts.ts";
import type { Session } from "../profile/loadTypes.ts";
import { CORE } from "../profile/store.ts";
import { AMMO_NAMES, AMMO_SECTIONS, EXOTIC, OTHER } from "./terms.ts";
import type { Armor, Collections, Entry, Section, Weapon } from "./types.ts";

const WEAPONS_NODE = 1528930164;
const ARMOR_NODE = 1605042242;

// Exotics sit under Items > Exotic, split by slot or class
const EXOTIC_WEAPONS_NODE = 2214408526;
const EXOTIC_ARMOR_NODE = 1789205056;

// DestinyItemType
export const ARMOR = 2;
export const WEAPON = 3;

export const CATALYST_RECORDS = exoticToCatalystRecordHash as Record<
  string,
  number | undefined
>;

const SOURCE_SECTIONS: { label: string; keys: [string, string][] }[] = [
  {
    label: "Raids",
    keys: [
      ["desertperpetual", "The Desert Perpetual"],
      ["salvationsedge", "Salvation's Edge"],
      ["crotasend", "Crota's End"],
      ["rootofnightmares", "Root of Nightmares"],
      ["kingsfall", "King's Fall"],
      ["vowofthedisciple", "Vow of the Disciple"],
      ["vaultofglass", "Vault of Glass"],
      ["deepstonecrypt", "Deep Stone Crypt"],
      ["gardenofsalvation", "Garden of Salvation"],
      ["crownofsorrow", "Crown of Sorrow"],
      ["scourgeofthepast", "Scourge of the Past"],
      ["lastwish", "Last Wish"],
      ["spireofstars", "Spire of Stars"],
      ["eow", "Eater of Worlds"],
      ["leviathan", "Leviathan"],
    ],
  },
  {
    label: "Dungeons",
    keys: [
      ["equilibrium", "Equilibrium"],
      ["sundereddoctrine", "Sundered Doctrine"],
      ["vespershost", "Vesper's Host"],
      ["warlordsruin", "Warlord's Ruin"],
      ["ghostsofthedeep", "Ghosts of the Deep"],
      ["spireofthewatcher", "Spire of the Watcher"],
      ["duality", "Duality"],
      ["grasp", "Grasp of Avarice"],
      ["prophecy", "Prophecy"],
      ["pit", "Pit of Heresy"],
      ["shatteredthrone", "The Shattered Throne"],
    ],
  },
  {
    label: "Playlists",
    keys: [
      ["nightfall", "Nightfall"],
      ["strikes", "Vanguard"],
      ["pinnacleops", "Pinnacle Ops"],
      ["crucible", "Crucible"],
      ["trials", "Trials of Osiris"],
      ["ironbanner", "Iron Banner"],
      ["gambit", "Gambit"],
      ["gambitprime", "Gambit Prime"],
    ],
  },
  {
    label: "Destinations",
    keys: [
      ["kepler", "Kepler"],
      ["paleheart", "The Pale Heart"],
      ["neomuna", "Neomuna"],
      ["throneworld", "Throne World"],
      ["europa", "Europa"],
      ["moon", "The Moon"],
      ["dreaming", "Dreaming City"],
      ["tangled", "Tangled Shore"],
      ["nessus", "Nessus"],
      ["edz", "European Dead Zone"],
    ],
  },
  {
    label: "Elsewhere",
    keys: [
      ["legendaryengram", "World drops"],
      ["campaign", "Campaigns"],
      ["seasonpass", "Seasons"],
      ["events", "Events"],
      ["gunsmith", "Gunsmith"],
      ["exoticquest", "Exotic quests"],
      ["eververse", "Eververse"],
    ],
  },
];

// DIM's own item-to-term mapping
const categoryTerm = (weapon: Weapon): string =>
  itemCategoryFilter.fromItem({
    itemCategoryHashes: weapon.itemCategoryHashes,
  } as DimItem);

const sourceKeysOf = (collectible: SlimCollectible): string[] =>
  Object.entries(D2Sources).flatMap(([key, info]) =>
    (collectible.sourceHash !== undefined &&
      info.sourceHashes?.includes(collectible.sourceHash)) ||
    info.itemHashes?.includes(collectible.itemHash)
      ? [key]
      : [],
  );

// Mirrors DIM's unexported getItemCategoryHashes, minus the armor branch
const categoriesOf = (item: DestinyInventoryItemDefinition): number[] => {
  const raw = item.itemCategoryHashes ?? [];
  const categories =
    raw.includes(ItemCategoryHashes.GrenadeLaunchers) &&
    !raw.includes(ItemCategoryHashes.PowerWeapon) &&
    !raw.includes(ItemCategoryHashes.Dummies)
      ? [
          ...raw.filter((hash) => hash !== ItemCategoryHashes.GrenadeLaunchers),
          -ItemCategoryHashes.GrenadeLaunchers,
        ]
      : raw;
  const extra = (extendedICH as Record<string, number>)[item.hash];

  return extra === undefined ? categories : [...categories, extra];
};

const readItems = async (
  session: Session,
  hashes: number[],
): Promise<Map<number, DestinyInventoryItemDefinition>> => {
  const found = new Map<number, DestinyInventoryItemDefinition>();
  const missing: number[] = [];

  for (const hash of hashes) {
    const held = session.items[hash];

    if (held) {
      found.set(hash, held);
    } else {
      missing.push(hash);
    }
  }

  for (const item of await session.store.getMany<DestinyInventoryItemDefinition>(
    CORE,
    missing,
  )) {
    found.set(item.hash, item);
  }

  return found;
};

export const armorKey = (name: string, rarity: string, classType: number): string =>
  `${name}|${rarity}|${classType}`;

export const rarityOf = (item: DestinyInventoryItemDefinition): string =>
  ItemRarityMap[item.inventory?.tierType ?? 0] ?? "Common";

export const buildCollections = async (session: Session): Promise<Collections> => {
  const nodes = session.support.get("PresentationNode") as
    | Record<number, DestinyPresentationNodeDefinition>
    | undefined;

  if (!nodes) {
    throw new Error("Presentation nodes not loaded");
  }

  const collectibles = await fetchTable<Record<number, SlimCollectible>>(
    session.index,
    "Collectible",
  );

  const childrenOf = (hash: number): DestinyPresentationNodeDefinition[] =>
    (nodes[hash]?.children.presentationNodes ?? []).flatMap((child) => {
      const node = nodes[child.presentationNodeHash];

      return node ? [node] : [];
    });

  const placed: {
    collectible: SlimCollectible;
    typeLabel: string | undefined;
  }[] = [];

  for (const ammo of childrenOf(WEAPONS_NODE)) {
    for (const type of childrenOf(ammo.hash)) {
      for (const child of type.children.collectibles) {
        const collectible = collectibles[child.collectibleHash];

        if (collectible) {
          placed.push({ collectible, typeLabel: type.displayProperties.name });
        }
      }
    }
  }

  for (const slot of childrenOf(EXOTIC_WEAPONS_NODE)) {
    for (const child of slot.children.collectibles) {
      const collectible = collectibles[child.collectibleHash];

      if (collectible) {
        placed.push({ collectible, typeLabel: undefined });
      }
    }
  }

  const armorPlaced: {
    collectible: SlimCollectible;
    setName: string | undefined;
  }[] = [];

  for (const classNode of childrenOf(ARMOR_NODE)) {
    for (const category of childrenOf(classNode.hash)) {
      for (const set of childrenOf(category.hash)) {
        for (const child of set.children.collectibles) {
          const collectible = collectibles[child.collectibleHash];

          if (collectible) {
            armorPlaced.push({
              collectible,
              setName: set.displayProperties.name,
            });
          }
        }
      }
    }
  }

  for (const classNode of childrenOf(EXOTIC_ARMOR_NODE)) {
    for (const child of classNode.children.collectibles) {
      const collectible = collectibles[child.collectibleHash];

      if (collectible) {
        armorPlaced.push({ collectible, setName: undefined });
      }
    }
  }

  const itemSets = Object.values(
    (session.support.get("EquipableItemSet") ?? {}) as Record<
      number,
      DestinyEquipableItemSetDefinition
    >,
  );

  const items = await readItems(session, [
    ...placed.map((entry) => entry.collectible.itemHash),
    ...armorPlaced.map((entry) => entry.collectible.itemHash),
    ...itemSets.flatMap((set) => set.setItems),
  ]);

  const collected = (
    key: string,
    item: DestinyInventoryItemDefinition,
    collectible: SlimCollectible,
  ) => {
    const name = item.displayProperties.name;

    return {
      key,
      name,
      plainName: plainString(name.toLowerCase(), "en"),
      rarity: rarityOf(item),
      newestItemHash: item.hash,
      itemHashes: [item.hash],
      collectibleHashes: [collectible.hash],
      icon: item.displayProperties.icon ?? "",
      watermark: item.iconWatermark || undefined,
      itemCategoryHashes: categoriesOf(item),
      bucketHash: item.inventory?.bucketTypeHash ?? 0,
      typeName: item.itemTypeDisplayName ?? "",
      sources: collectible.sourceString ? [collectible.sourceString] : [],
      sourceKeys: sourceKeysOf(collectible),
      index: collectible.index,
    };
  };

  const merge = (
    held: Entry,
    item: DestinyInventoryItemDefinition,
    collectible: SlimCollectible,
  ) => {
    held.itemHashes.push(item.hash);
    held.collectibleHashes.push(collectible.hash);

    if (
      collectible.sourceString &&
      !held.sources.includes(collectible.sourceString)
    ) {
      held.sources.push(collectible.sourceString);
    }

    for (const sourceKey of sourceKeysOf(collectible)) {
      if (!held.sourceKeys.includes(sourceKey)) {
        held.sourceKeys.push(sourceKey);
      }
    }

    if (collectible.index > held.index) {
      held.index = collectible.index;
      held.newestItemHash = item.hash;
      held.icon = item.displayProperties.icon ?? held.icon;
      held.watermark = item.iconWatermark || held.watermark;
    }
  };

  const byKey = new Map<string, Weapon>();
  const typeLabels = new Map<string, string>();

  for (const { collectible, typeLabel } of placed) {
    const item = items.get(collectible.itemHash);

    // Weapon Ornaments hangs off the same nodes
    if (item?.itemType !== WEAPON || !item.displayProperties?.name) {
      continue;
    }

    const key = `${item.displayProperties.name}|${rarityOf(item)}`;
    const typeKey = `${item.equippingBlock?.ammoType ?? 0}:${item.itemSubType}`;
    const held = byKey.get(key);

    if (typeLabel !== undefined && !typeLabels.has(typeKey)) {
      typeLabels.set(typeKey, typeLabel);
    }

    if (!held) {
      byKey.set(key, {
        ...collected(key, item, collectible),
        kind: "weapon",
        damageTypeHash: item.damageTypeHashes?.[0],
        ammoType: item.equippingBlock?.ammoType ?? 0,
        typeKey,
        catalystRecordHash: CATALYST_RECORDS[item.hash],
      });

      continue;
    }

    merge(held, item, collectible);
    held.catalystRecordHash ??= CATALYST_RECORDS[item.hash];
  }

  const armorByKey = new Map<string, Armor>();

  for (const { collectible, setName } of armorPlaced) {
    const item = items.get(collectible.itemHash);

    // Ornament sets sit beside the armor
    if (item?.itemType !== ARMOR || !item.displayProperties?.name) {
      continue;
    }

    const key = armorKey(
      item.displayProperties.name,
      rarityOf(item),
      item.classType,
    );
    const held = armorByKey.get(key);

    if (!held) {
      armorByKey.set(key, {
        ...collected(key, item, collectible),
        kind: "armor",
        classType: item.classType,
        setKey:
          setName === undefined ? undefined : `${item.classType}|${setName}`,
        setName,
        itemSetHash: item.equippingBlock?.equipableItemSetHash,
      });

      continue;
    }

    merge(held, item, collectible);
    held.itemSetHash ??= item.equippingBlock?.equipableItemSetHash;
  }

  // Reissues with set bonuses often have no collectible of their own
  for (const set of itemSets) {
    for (const hash of set.setItems) {
      const item = items.get(hash);
      const held =
        item &&
        armorByKey.get(
          armorKey(item.displayProperties.name, rarityOf(item), item.classType),
        );

      if (!item || !held) {
        continue;
      }

      held.itemSetHash = set.hash;

      if (!held.itemHashes.includes(hash)) {
        held.itemHashes.push(hash);
        held.newestItemHash = hash;
        held.icon = item.displayProperties.icon ?? held.icon;
        held.watermark = item.iconWatermark || held.watermark;
      }
    }
  }

  const newestFirst = <T extends Entry>(entries: Iterable<T>): T[] =>
    [...entries].sort((one, other) => other.index - one.index);

  const weapons = newestFirst(byKey.values());
  const armor = newestFirst(armorByKey.values());
  const byItemHash = new Map<number, Entry>();
  const byEntryKey = new Map<string, Entry>();

  for (const entry of [...weapons, ...armor]) {
    byEntryKey.set(entry.key, entry);

    for (const hash of entry.itemHashes) {
      byItemHash.set(hash, entry);
    }
  }

  // Off-ammo exotics like Arbalest have no legendary node to borrow a label from
  for (const weapon of weapons) {
    if (!typeLabels.has(weapon.typeKey)) {
      typeLabels.set(weapon.typeKey, `${weapon.typeName}s`);
    }
  }

  const typeSections: Section[] = AMMO_SECTIONS.map(([ammo, label]) => ({
    label,
    groups: [...typeLabels]
      .filter(([typeKey]) => typeKey.startsWith(`${ammo}:`))
      .map(([typeKey, typeLabel]) => {
        const held = weapons.filter((weapon) => weapon.typeKey === typeKey);
        const category = held[0] ? categoryTerm(held[0]) : "";

        return {
          key: typeKey,
          label: typeLabel,
          terms:
            category === "" ? [] : [category, `is:${AMMO_NAMES.get(ammo)}`],
          entries: held,
        };
      }),
  }));

  // Ammo is only needed where a category shows up in more than one section
  const categoryCount = new Map<string, number>();

  for (const group of typeSections.flatMap((section) => section.groups)) {
    const category = group.terms[0];

    if (category !== undefined && group.entries.length > 0) {
      categoryCount.set(category, (categoryCount.get(category) ?? 0) + 1);
    }
  }

  for (const group of typeSections.flatMap((section) => section.groups)) {
    if ((categoryCount.get(group.terms[0] ?? "") ?? 0) === 1) {
      group.terms = group.terms.slice(0, 1);
    }
  }

  const listed = new Set(
    SOURCE_SECTIONS.flatMap((section) => section.keys.map(([key]) => key)),
  );

  const sourceSections = (entries: Entry[]): Section[] => {
    const sections = SOURCE_SECTIONS.map((section) => ({
      label: section.label,
      groups: section.keys.map(([key, label]) => ({
        key,
        label,
        terms: [`source:${key}`],
        entries: entries.filter((entry) => entry.sourceKeys.includes(key)),
      })),
    }));

    sections[sections.length - 1]!.groups.push({
      key: OTHER,
      label: "Everything else",
      terms: [`source:${OTHER}`],
      entries: entries.filter(
        (entry) => !entry.sourceKeys.some((key) => listed.has(key)),
      ),
    });

    return sections;
  };

  const filled = (sections: Section[]): Section[] =>
    sections.flatMap((section) => {
      const groups = section.groups.filter((group) => group.entries.length > 0);

      return groups.length === 0 ? [] : [{ ...section, groups }];
    });

  // Exotics have no set
  const armorSections: Section[] = [
    {
      label: "",
      groups: [
        {
          key: EXOTIC,
          label: "Exotics",
          terms: [`is:${EXOTIC}`],
          entries: armor.filter((piece) => piece.setKey === undefined),
        },
      ],
    },
    ...sourceSections(armor.filter((piece) => piece.setKey !== undefined)),
  ];

  return {
    weapons,
    armor,
    byItemHash,
    byKey: byEntryKey,
    collectibles,
    sections: {
      type: filled(typeSections),
      source: filled(sourceSections(weapons)),
    },
    armorSections: filled(armorSections),
  };
};
