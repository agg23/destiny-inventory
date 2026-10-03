import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";
import { ItemRarityMap } from "app/search/d2-known-values";
import {
  d2AmmoTypes,
  itemCategoryFilter,
} from "app/search/items/search-filters/known-values";
import { plainString } from "app/search/text-utils";
import type {
  DestinyInventoryItemDefinition,
  DestinyObjectiveProgress,
  DestinyPresentationNodeDefinition,
} from "bungie-api-ts/destiny2";
import exoticToCatalystRecordHash from "data/d2/exotic-to-catalyst-record.json" with { type: "json" };
import extendedICH from "data/d2/extended-ich.json" with { type: "json" };
import { ItemCategoryHashes } from "data/d2/generated-enums";
import D2Sources from "data/d2/source-info-v2";
import { createSignal } from "solid-js";

import type { SlimCollectible } from "@dvm/defs-core";

import { fetchTable } from "./artifacts.ts";
import { primeWeaponPerks } from "./collections/weaponPerks.ts";
import { accessToken } from "./auth.ts";
import { fetchCollectibles } from "./bungie.ts";
import { NotSignedIn, type CharacterRecords, type Session } from "./load.ts";
import { CORE } from "./store.ts";
import type { Grouping } from "./url.ts";

const WEAPONS_NODE = 1528930164;

// Exotics sit under Items > Exotic, split by slot
const EXOTIC_WEAPONS_NODE = 2214408526;

// DestinyCollectibleState
const NOT_ACQUIRED = 1;

// DestinyRecordState
const RECORD_REDEEMED = 1;
const OBJECTIVE_NOT_COMPLETED = 4;
const OBSCURED = 8;

// DestinyItemType
const WEAPON = 3;

// DestinyAmmunitionType
const AMMO_SECTIONS: [number, string][] = [
  [1, "Primary"],
  [2, "Special"],
  [3, "Heavy"],
];

const CATALYST_RECORDS = exoticToCatalystRecordHash as Record<
  string,
  number | undefined
>;

export interface Weapon {
  key: string;
  name: string;
  plainName: string;
  rarity: string;
  newestItemHash: number;
  itemHashes: number[];
  collectibleHashes: number[];
  icon: string;
  watermark: string | undefined;
  damageTypeHash: number | undefined;
  ammoType: number;
  itemCategoryHashes: number[];
  bucketHash: number;
  typeName: string;
  typeKey: string;
  sources: string[];
  sourceKeys: string[];
  index: number;
  catalystRecordHash: number | undefined;
}

export type Ownership = "owned" | "unlocked" | "neverseen";

export interface Catalyst {
  unlocked: boolean;
  complete: boolean;
  progress: number;
  objectives: DestinyObjectiveProgress[];
}

export interface Group {
  key: string;
  label: string;
  /** The query terms that pick this group, like is:autorifle is:primary */
  terms: string[];
  weapons: Weapon[];
}

export interface Section {
  label: string;
  groups: Group[];
}

export interface Collections {
  weapons: Weapon[];
  byItemHash: Map<number, Weapon>;
  collectibles: Record<number, SlimCollectible>;
  sections: Record<Grouping, Section[]>;
}

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
    ],
  },
];

export const OTHER = "other";

const AMMO_NAMES = new Map<number, string>(
  Object.entries(d2AmmoTypes).map(([name, ammo]) => [ammo, name]),
);

const CATEGORY_KEYWORDS = new Set<string>(itemCategoryFilter.keywords);

/** Whether a term is one the rail writes, so a rail click replaces it */
export const isRailTerm = (key: string | undefined, value: string): boolean =>
  key === "source" ||
  (key === "is" &&
    (CATEGORY_KEYWORDS.has(value) ||
      (d2AmmoTypes as Record<string, number>)[value] !== undefined));

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

const rarityOf = (item: DestinyInventoryItemDefinition): string =>
  ItemRarityMap[item.inventory?.tierType ?? 0] ?? "Common";

const buildCollections = async (session: Session): Promise<Collections> => {
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

  const items = await readItems(
    session,
    placed.map((entry) => entry.collectible.itemHash),
  );

  const byKey = new Map<string, Weapon>();
  const typeLabels = new Map<string, string>();

  for (const { collectible, typeLabel } of placed) {
    const item = items.get(collectible.itemHash);

    // Weapon Ornaments hangs off the same nodes
    if (item?.itemType !== WEAPON || !item.displayProperties?.name) {
      continue;
    }

    const name = item.displayProperties.name;
    const rarity = rarityOf(item);
    const key = `${name}|${rarity}`;
    const typeKey = `${item.equippingBlock?.ammoType ?? 0}:${item.itemSubType}`;
    const held = byKey.get(key);
    const sourceKeys = sourceKeysOf(collectible);

    if (typeLabel !== undefined && !typeLabels.has(typeKey)) {
      typeLabels.set(typeKey, typeLabel);
    }

    if (!held) {
      byKey.set(key, {
        key,
        name,
        plainName: plainString(name.toLowerCase(), "en"),
        rarity,
        newestItemHash: item.hash,
        itemHashes: [item.hash],
        collectibleHashes: [collectible.hash],
        icon: item.displayProperties.icon ?? "",
        watermark: item.iconWatermark || undefined,
        damageTypeHash: item.damageTypeHashes?.[0],
        ammoType: item.equippingBlock?.ammoType ?? 0,
        itemCategoryHashes: categoriesOf(item),
        bucketHash: item.inventory?.bucketTypeHash ?? 0,
        typeName: item.itemTypeDisplayName ?? "",
        typeKey,
        sources: collectible.sourceString ? [collectible.sourceString] : [],
        sourceKeys,
        index: collectible.index,
        catalystRecordHash: CATALYST_RECORDS[item.hash],
      });

      continue;
    }

    held.itemHashes.push(item.hash);
    held.collectibleHashes.push(collectible.hash);
    held.catalystRecordHash ??= CATALYST_RECORDS[item.hash];

    if (
      collectible.sourceString &&
      !held.sources.includes(collectible.sourceString)
    ) {
      held.sources.push(collectible.sourceString);
    }

    for (const sourceKey of sourceKeys) {
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
  }

  const weapons = [...byKey.values()].sort(
    (one, other) => other.index - one.index,
  );
  const byItemHash = new Map<number, Weapon>();

  for (const weapon of weapons) {
    for (const hash of weapon.itemHashes) {
      byItemHash.set(hash, weapon);
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
          weapons: held,
        };
      }),
  }));

  // Ammo is only needed where a category shows up in more than one section
  const categoryCount = new Map<string, number>();

  for (const group of typeSections.flatMap((section) => section.groups)) {
    const category = group.terms[0];

    if (category !== undefined && group.weapons.length > 0) {
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

  const sourceSections: Section[] = SOURCE_SECTIONS.map((section) => ({
    label: section.label,
    groups: section.keys.map(([key, label]) => ({
      key,
      label,
      terms: [`source:${key}`],
      weapons: weapons.filter((weapon) => weapon.sourceKeys.includes(key)),
    })),
  }));

  sourceSections[sourceSections.length - 1]!.groups.push({
    key: OTHER,
    label: "Everything else",
    terms: [`source:${OTHER}`],
    weapons: weapons.filter(
      (weapon) => !weapon.sourceKeys.some((key) => listed.has(key)),
    ),
  });

  const filled = (sections: Section[]): Section[] =>
    sections.flatMap((section) => {
      const groups = section.groups.filter((group) => group.weapons.length > 0);

      return groups.length === 0 ? [] : [{ ...section, groups }];
    });

  return {
    weapons,
    byItemHash,
    collectibles,
    sections: { type: filled(typeSections), source: filled(sourceSections) },
  };
};

/** The snapshot paint carries a session with no definitions behind it */
export const definedSession = (
  session: Session | undefined,
): Session | undefined =>
  session && session.support.size > 0 ? session : undefined;

const [built, setBuilt] = createSignal<Collections | undefined>(undefined);

let building: Promise<Collections> | undefined = undefined;

export const collections = built;

/** Starts the index build once; safe to call on every focus */
export const primeCollections = (session: Session): Promise<Collections> => {
  if (!building) {
    building = buildCollections(session).then((result) => {
      setBuilt(result);
      void primeWeaponPerks(session, result);

      return result;
    });

    building.catch(() => {
      building = undefined;
    });
  }

  return building;
};

const fetchAcquired = async (session: Session): Promise<Set<number>> => {
  const token = await accessToken();

  if (!token) {
    throw new NotSignedIn();
  }

  const profile = await fetchCollectibles(session.membership, token);
  const acquired = new Set<number>();
  const states = [
    profile.profileCollectibles?.data?.collectibles ?? {},
    ...Object.values(profile.characterCollectibles?.data ?? {}).map(
      (held) => held.collectibles,
    ),
  ];

  for (const collectibles of states) {
    for (const [hash, component] of Object.entries(collectibles)) {
      if ((component.state & NOT_ACQUIRED) === 0) {
        acquired.add(Number(hash));
      }
    }
  }

  return acquired;
};

const acquiredByMember = new Map<
  string,
  { minted: number; pending: Promise<Set<number>> }
>();

/** Collected state, refetched when the profile's minted time changes */
export const acquiredFor = (session: Session): Promise<Set<number>> => {
  const key = session.membership.membershipId;
  const held = acquiredByMember.get(key);

  if (held && held.minted === session.minted) {
    return held.pending;
  }

  const pending = fetchAcquired(session);

  acquiredByMember.set(key, { minted: session.minted, pending });
  pending.catch(() => {
    if (acquiredByMember.get(key)?.pending === pending) {
      acquiredByMember.delete(key);
    }
  });

  return pending;
};

const SOURCE_PREFIX = /^Source:\s*/;

export const sourceLabel = (sourceString: string): string =>
  sourceString.replace(SOURCE_PREFIX, "");

export const isCollected = (weapon: Weapon, acquired: Set<number>): boolean =>
  weapon.collectibleHashes.some((hash) => acquired.has(hash));

/** Held weapons keyed like Weapon.key, since reissues get new hashes */
export const copiesByKey = (stores: DimStore[]): Map<string, DimItem[]> => {
  const copies = new Map<string, DimItem[]>();

  for (const store of stores) {
    for (const item of store.items) {
      if (!item.bucket.inWeapons) {
        continue;
      }

      const key = `${item.name}|${item.rarity}`;
      const held = copies.get(key);

      if (held) {
        held.push(item);
      } else {
        copies.set(key, [item]);
      }
    }
  }

  return copies;
};

/** Undefined until collection state arrives, unless a copy is held */
export const ownershipOf = (
  weapon: Weapon,
  copies: DimItem[] | undefined,
  acquired: Set<number> | undefined,
): Ownership | undefined => {
  if (copies && copies.length > 0) {
    return "owned";
  }

  if (!acquired) {
    return undefined;
  }

  return isCollected(weapon, acquired) ? "unlocked" : "neverseen";
};

const catalystRecord = (
  recordHash: number | undefined,
  records: CharacterRecords,
): Catalyst | undefined => {
  if (recordHash === undefined) {
    return undefined;
  }

  const record = Object.values(records).find((held) => held[recordHash])?.[
    recordHash
  ];

  if (!record) {
    return undefined;
  }

  const objectives = record.objectives ?? [];
  const complete =
    (record.state & OBJECTIVE_NOT_COMPLETED) === 0 ||
    (record.state & RECORD_REDEEMED) !== 0;
  const fractions = objectives.map((objective) =>
    Math.min(
      1,
      (objective.progress ?? 0) / Math.max(1, objective.completionValue),
    ),
  );

  return {
    unlocked: (record.state & OBSCURED) === 0,
    complete,
    progress: complete
      ? 1
      : fractions.length === 0
        ? 0
        : fractions.reduce((total, one) => total + one, 0) / fractions.length,
    objectives,
  };
};

export const catalystFor = (
  weapon: Weapon,
  records: CharacterRecords,
): Catalyst | undefined => catalystRecord(weapon.catalystRecordHash, records);

/** The account's catalyst triumph for one exotic item hash */
export const catalystForItem = (
  itemHash: number,
  records: CharacterRecords,
): Catalyst | undefined => catalystRecord(CATALYST_RECORDS[itemHash], records);

/** Names starting with the text first, keeping the index order otherwise */
export const rankByName = (weapons: Weapon[], name: string): Weapon[] => {
  const needle = plainString(name.trim().toLowerCase(), "en");

  return [
    ...weapons.filter((weapon) => weapon.plainName.startsWith(needle)),
    ...weapons.filter((weapon) => !weapon.plainName.startsWith(needle)),
  ];
};

export interface WeaponFacts {
  ownership: (weapon: Weapon) => Ownership | undefined;
  catalyst: (weapon: Weapon) => Catalyst | undefined;
}

export const RARITIES = [
  "common",
  "uncommon",
  "rare",
  "legendary",
  "exotic",
] as const;

export const STATUSES = ["owned", "unlocked", "neverseen"] as const;

export const CATALYSTS = ["missing", "obtained", "complete"] as const;

const TERM = /(-?)(?:(\w+):)?("[^"]*"|\S+)/g;

/** The one value set for key, or undefined when the query sets none or several */
export const termValue = <T extends string>(
  query: string,
  key: string,
  values: readonly T[],
): T | undefined => {
  const found = [...query.matchAll(TERM)].flatMap(([, negated, term, raw]) =>
    !negated && term === key && values.includes(raw!.toLowerCase() as T)
      ? [raw!.toLowerCase() as T]
      : [],
  );

  return found.length === 1 ? found[0] : undefined;
};

/** The query with every term drop picks removed and added appended */
export const withTerms = (
  query: string,
  drop: (key: string | undefined, value: string) => boolean,
  added: string[],
): string =>
  [
    ...[...query.matchAll(TERM)]
      .filter(
        ([, negated, key, raw]) => negated || !drop(key, raw!.toLowerCase()),
      )
      .map(([whole]) => whole),
    ...added,
  ].join(" ");

/** Replaces key's terms from values with value, leaving the rest of the query alone */
export const withTerm = (
  query: string,
  key: string,
  values: readonly string[],
  value: string | undefined,
): string =>
  withTerms(
    query,
    (term, raw) => term === key && values.includes(raw),
    value === undefined ? [] : [`${key}:${value}`],
  );

/** Whether a group's terms are all in the query; a missing ammo term is fine when none is set */
export const queryPicks = (query: string, group: Group): boolean => {
  const present = new Set(
    [...query.matchAll(TERM)].flatMap(([, negated, key, raw]) =>
      negated || key === undefined ? [] : [`${key}:${raw!.toLowerCase()}`],
    ),
  );
  const anyAmmo = [...AMMO_NAMES.values()].some((ammo) =>
    present.has(`is:${ammo}`),
  );

  return (
    group.terms.length > 0 &&
    group.terms.every(
      (term) =>
        present.has(term) ||
        (!anyAmmo &&
          [...AMMO_NAMES.values()].some((ammo) => term === `is:${ammo}`)),
    )
  );
};
