import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DestinyInventoryItemDefinition } from "bungie-api-ts/destiny2";

import {
  TIERS,
  type AegisData,
  type AegisPerk,
  type AegisRoll,
  type AegisSetBonus,
  type Tier,
} from "@dvm/defs-core";

import {
  cleanName,
  nameKey,
  perkKey,
  perkNames,
  poolFor,
  weaponKey,
  type Pool,
} from "./aegisNames.ts";
import { loadManifest, table } from "./manifest.ts";
import { CACHE_ROOT, DATA_ROOT } from "./paths.ts";
import { fetchTabs, indexUrl, readTab, type Tab } from "./sheets.ts";

const WEAPON_CATEGORY = 1;

interface RollTab {
  category?: string;
  rank?: string;
  tiers?: readonly Tier[];
}

interface SheetSource {
  label: string;
  sheet: string;
  file: string;
  rollTabs: Record<string, RollTab>;
  rankTabs: Record<string, { rank: string; tier?: string }>;
  setBonusRank: string;
  perkColumns: string[];
  notesColumns: string[];
}

const AEGIS_ROLL_TABS = [
  "Autos",
  "Bows",
  "HCs",
  "Pulses",
  "Scouts",
  "Sidearms",
  "SMGs",
  "BGLs",
  "Fusions",
  "Glaives",
  "Shotguns",
  "Snipers",
  "Rocket Sidearms",
  "Traces",
  "HGLs",
  "LFRs",
  "LMGs",
  "Rockets",
  "Swords",
  "Other",
];

const AEGIS: SheetSource = {
  label: "Aegis",
  sheet: "1JM-0SlxVDAi-C6rGVlLxa-J1WGewEeL8Qvq4htWZHhY",
  file: "aegis.json",
  rollTabs: {
    ...Object.fromEntries(AEGIS_ROLL_TABS.map((name) => [name, { rank: "#" }])),
    "Exotic Weapons": {},
  },
  // Rank tabs grade perks and origin traits standalone
  rankTabs: {
    Perks: { rank: "#" },
    "Origin Traits": { rank: "Rank", tier: "Tier" },
  },
  setBonusRank: "#",
  perkColumns: ["Perk 1", "Perk 2"],
  notesColumns: ["Notes", "Description"],
};

const PVP: SheetSource = {
  label: "PvP",
  sheet: "1TVgtTRWNGEPi6OMlTLxXFSKUTi_ycwykhwuw8EW_jJ0",
  file: "pvp.json",
  rollTabs: {
    "Legendary Weapons": { category: "Type" },
    // Only S has been redone for PvP. A-F are left over from PvE
    "Exotic Weapons": { tiers: ["S"] },
  },
  // Perks and Origin Traits are unpublished PvE copies
  rankTabs: {},
  setBonusRank: "Rank",
  perkColumns: ["Column 1", "Column 2"],
  notesColumns: ["Role / Notes", "Description"],
};

const SET_BONUS_TAB = "Set Bonuses";

const numberOf = (raw: string | undefined): number | undefined => {
  const value = Number((raw ?? "").trim());

  return Number.isInteger(value) && value > 0 ? value : undefined;
};

const tierOf = (raw: string | undefined): Tier | undefined => {
  const value = (raw ?? "").trim().toUpperCase();

  return (TIERS as readonly string[]).includes(value)
    ? (value as Tier)
    : undefined;
};

interface Lookups {
  byName: Map<string, DestinyInventoryItemDefinition[]>;
  cachedPool: (item: DestinyInventoryItemDefinition) => Pool;
  bonusPerks: Map<string, { hash: number; pieces: number; set: string }[]>;
}

const addHashes = (
  map: Map<string, Set<number>>,
  key: string,
  hashes: Iterable<number>,
) => {
  const existing = map.get(key);

  if (existing) {
    for (const hash of hashes) {
      existing.add(hash);
    }
  } else {
    map.set(key, new Set(hashes));
  }
};

const listMisses = (label: string, entries: string[]) => {
  if (entries.length === 0) {
    return;
  }

  console.log(`\n${label} (${entries.length}):`);

  for (const entry of entries) {
    console.log(`  ${entry}`);
  }
};

const readRolls = async (
  source: SheetSource,
  tabs: Tab[],
  lookups: Lookups,
) => {
  const { byName, cachedPool } = lookups;
  const rolls: AegisRoll[] = [];
  const unresolvedNames: string[] = [];
  const unresolvedPerks: string[] = [];
  const everyPlug = new Map<string, Set<number>>();
  let perkRefs = 0;
  let narrowed = 0;

  for (const tab of tabs) {
    const spec = source.rollTabs[tab.name]!;
    const { rows, column } = await readTab(source.sheet, tab, "Name");

    let kept = 0;
    let untrusted = 0;

    for (const row of rows) {
      const [firstLine = "", ...qualifiers] = (column(row, "Name") ?? "")
        .split("\n")
        .map((line) => line.trim());

      if (!firstLine) {
        continue;
      }

      const tier = tierOf(column(row, "Tier"));

      if (spec.tiers && (tier === undefined || !spec.tiers.includes(tier))) {
        untrusted += 1;
        continue;
      }

      // Aegis puts "Pantheon version" on a second line. PvP appends "(... Variant)"
      let name = firstLine;
      let qualified = qualifiers.some((line) => line.length > 0);
      let all = byName.get(weaponKey(name));
      const stripped = firstLine.replace(/\s*\([^)]*\)$/, "");

      if (!all && stripped !== firstLine) {
        name = stripped;
        qualified = true;
        all = byName.get(weaponKey(name));
      }

      all = all ?? [];

      const rollable = all.filter((item) => cachedPool(item).randomized);
      let candidates = rollable.length > 0 ? rollable : all;

      if (candidates.length === 0) {
        unresolvedNames.push(`${tab.name}: ${firstLine}`);
        continue;
      }

      const listed = source.perkColumns.flatMap((label) =>
        perkNames(column(row, label)).map(perkKey),
      );

      // Variants share a name
      if (qualified && listed.length > 0) {
        const fitting = candidates.filter((item) =>
          listed.every((perk) => cachedPool(item).names.has(perk)),
        );

        if (fitting.length > 0 && fitting.length < candidates.length) {
          candidates = fitting;
          narrowed += 1;
        }
      }

      const union = new Map<string, Set<number>>();

      for (const item of candidates) {
        for (const [perk, hashes] of cachedPool(item).names) {
          addHashes(union, perk, hashes);
          addHashes(everyPlug, perk, hashes);
        }
      }

      const slots: number[][] = [];

      for (const label of source.perkColumns) {
        const resolved: number[] = [];

        for (const perk of perkNames(column(row, label))) {
          perkRefs += 1;
          const hashes = union.get(perkKey(perk));

          if (hashes) {
            resolved.push(...hashes);
          } else {
            unresolvedPerks.push(`${name}: ${perk}`);
          }
        }

        if (resolved.length > 0) {
          slots.push([...new Set(resolved)]);
        }
      }

      const notes = source.notesColumns
        .map((label) => column(row, label))
        .find((value) => !!value);

      rolls.push({
        name,
        category: (spec.category && column(row, spec.category)) || tab.name,
        tier,
        rank: spec.rank ? numberOf(column(row, spec.rank)) : undefined,
        ranked: 0,
        hashes: [...new Set(candidates.map((item) => item.hash))],
        slots,
        notes,
        season: column(row, "Season") || undefined,
      });

      kept += 1;
    }

    const skipped = untrusted > 0 ? `, ${untrusted} left unrated` : "";

    console.log(
      `  ${tab.name.padEnd(17)} ${String(kept).padStart(4)} weapons${skipped}`,
    );
  }

  const perCategory = new Map<string, number>();

  for (const entry of rolls) {
    perCategory.set(entry.category, (perCategory.get(entry.category) ?? 0) + 1);
  }

  for (const entry of rolls) {
    entry.ranked = perCategory.get(entry.category)!;
  }

  return {
    rolls,
    everyPlug,
    perkRefs,
    narrowed,
    unresolvedNames,
    unresolvedPerks,
  };
};

const readRankedPerks = async (
  source: SheetSource,
  tabs: Tab[],
  everyPlug: Map<string, Set<number>>,
) => {
  const perks: AegisPerk[] = [];
  const unresolvedRanked: string[] = [];

  for (const tab of tabs) {
    const spec = source.rankTabs[tab.name]!;
    const { rows, column } = await readTab(source.sheet, tab, "Name");

    let kept = 0;

    for (const row of rows) {
      const name = cleanName(column(row, "Name") ?? "");

      if (!name) {
        continue;
      }

      const hashes = everyPlug.get(perkKey(name));

      if (!hashes) {
        unresolvedRanked.push(`${tab.name}: ${name}`);
        continue;
      }

      perks.push({
        name,
        hashes: [...hashes],
        kind: tab.name === "Perks" ? "perk" : "origin",
        rank: numberOf(column(row, spec.rank)),
        tier: spec.tier ? tierOf(column(row, spec.tier)) : undefined,
        tags: column(row, "Tags")?.replaceAll("\n", ", ") || undefined,
        effect:
          column(row, "Effect") || column(row, "Description") || undefined,
      });

      kept += 1;
    }

    console.log(`  ${tab.name.padEnd(17)} ${String(kept).padStart(4)} ranked`);
  }

  return { perks, unresolvedRanked };
};

const readSetBonuses = async (
  source: SheetSource,
  tabs: Tab[],
  bonusPerks: Lookups["bonusPerks"],
) => {
  const setBonuses: AegisSetBonus[] = [];
  const unresolvedBonuses: string[] = [];

  for (const tab of tabs) {
    const { rows, column } = await readTab(source.sheet, tab, "Bonus");

    for (const row of rows) {
      const name = cleanName(column(row, "Bonus") ?? "");

      if (!name) {
        continue;
      }

      const found = bonusPerks.get(name.toLowerCase());

      if (!found) {
        unresolvedBonuses.push(name);
        continue;
      }

      for (const perk of found) {
        setBonuses.push({
          name,
          hash: perk.hash,
          set: perk.set,
          pieces: perk.pieces,
          rank: numberOf(column(row, source.setBonusRank)),
          tier: tierOf(column(row, "Tier")),
          tags: column(row, "Tags")?.replaceAll("\n", ", ") || undefined,
          trigger: column(row, "Trigger") || undefined,
          effect: column(row, "Effect") || undefined,
          notes: column(row, "Description") || undefined,
        });
      }
    }

    console.log(
      `  ${tab.name.padEnd(17)} ${String(setBonuses.length).padStart(
        4,
      )} bonuses`,
    );
  }

  return { setBonuses, unresolvedBonuses };
};

const importSheet = async (
  source: SheetSource,
  lookups: Lookups,
): Promise<AegisData> => {
  console.log(`\nReading ${source.label} sheet`);

  const discovered = await fetchTabs(source.sheet);
  const tabs = discovered.filter((tab) => source.rollTabs[tab.name]);
  const rankTabs = discovered.filter((tab) => source.rankTabs[tab.name]);
  const setTabs = discovered.filter((tab) => tab.name === SET_BONUS_TAB);

  console.log(`  ${tabs.length} tabs`);

  const {
    rolls,
    everyPlug,
    perkRefs,
    narrowed,
    unresolvedNames,
    unresolvedPerks,
  } = await readRolls(source, tabs, lookups);

  const { perks, unresolvedRanked } = await readRankedPerks(
    source,
    rankTabs,
    everyPlug,
  );

  const { setBonuses, unresolvedBonuses } = await readSetBonuses(
    source,
    setTabs,
    lookups.bonusPerks,
  );

  const claims = new Map<number, AegisRoll[]>();

  for (const entry of rolls) {
    for (const hash of entry.hashes) {
      const existing = claims.get(hash);

      if (existing) {
        existing.push(entry);
      } else {
        claims.set(hash, [entry]);
      }
    }
  }

  const contested = [...claims.entries()].filter(
    ([, entries]) => new Set(entries.map((entry) => entry.tier)).size > 1,
  );

  const hashes = new Set(rolls.flatMap((roll) => roll.hashes));
  const resolvedPerks = perkRefs - unresolvedPerks.length;
  const pct = (part: number, whole: number): string =>
    whole === 0 ? "-" : `${((part / whole) * 100).toFixed(1)}%`;

  console.log(
    `\n${rolls.length} weapons, ${hashes.size} item hashes, ${
      rolls.filter((roll) => roll.slots.length > 0).length
    } with rolls, ${narrowed} variants narrowed by perk pool`,
  );
  console.log(
    `perks ${resolvedPerks}/${perkRefs} ${pct(resolvedPerks, perkRefs)}`,
  );

  const ranked = perks.filter((perk) => perk.rank !== undefined).length;

  console.log(
    `${perks.length} perks and origin traits, ${ranked} of them ranked`,
  );

  console.log(`${setBonuses.length} of ${lookups.bonusPerks.size} set bonuses rated`);

  listMisses("Unresolved set bonuses", unresolvedBonuses);
  listMisses("Unresolved perk names", unresolvedRanked);

  if (contested.length > 0) {
    const names = new Set(
      contested.flatMap(([, entries]) =>
        entries.map((entry) => `${entry.name} (${entry.category})`),
      ),
    );

    console.log(
      `\n${contested.length} hashes claimed at more than one tier, the client keeps the best:`,
    );

    for (const name of names) {
      console.log(`  ${name}`);
    }
  }

  listMisses("Unresolved names", unresolvedNames);
  listMisses("Unresolved perks", unresolvedPerks);

  return {
    source: indexUrl(source.sheet),
    captured: new Date().toISOString().slice(0, 10),
    rolls,
    perks,
    setBonuses,
  };
};

const main = async () => {
  const manifest = await loadManifest(CACHE_ROOT);

  const items = table(manifest, "DestinyInventoryItemDefinition")!;
  const plugSets = table(manifest, "DestinyPlugSetDefinition")!;
  const itemSets = table(manifest, "DestinyEquipableItemSetDefinition")!;
  const sandboxPerks = table(manifest, "DestinySandboxPerkDefinition")!;

  const byName = new Map<string, DestinyInventoryItemDefinition[]>();

  for (const item of Object.values(items)) {
    if (!item.itemCategoryHashes?.includes(WEAPON_CATEGORY)) {
      continue;
    }

    const key = nameKey(item.displayProperties?.name ?? "");

    if (!key) {
      continue;
    }

    const existing = byName.get(key);

    if (existing) {
      existing.push(item);
    } else {
      byName.set(key, [item]);
    }
  }

  const pools = new Map<number, Pool>();

  const cachedPool = (item: DestinyInventoryItemDefinition): Pool => {
    const existing = pools.get(item.hash);

    if (existing) {
      return existing;
    }

    const built = poolFor(item, items, plugSets);
    pools.set(item.hash, built);

    return built;
  };

  const bonusPerks = new Map<
    string,
    { hash: number; pieces: number; set: string }[]
  >();

  for (const set of Object.values(itemSets)) {
    for (const perk of set.setPerks) {
      const name = sandboxPerks[perk.sandboxPerkHash]?.displayProperties?.name
        ?.trim()
        .toLowerCase();

      if (!name) {
        continue;
      }

      const entry = {
        hash: perk.sandboxPerkHash,
        pieces: perk.requiredSetCount,
        set: set.displayProperties.name,
      };
      const existing = bonusPerks.get(name);

      if (existing) {
        existing.push(entry);
      } else {
        bonusPerks.set(name, [entry]);
      }
    }
  }

  await mkdir(DATA_ROOT, { recursive: true });

  for (const source of [AEGIS, PVP]) {
    const data = await importSheet(source, { byName, cachedPool, bonusPerks });
    const destination = join(DATA_ROOT, source.file);

    await writeFile(destination, JSON.stringify(data));

    console.log(`\nWrote ${destination}`);
  }
};

await main();
