import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  DestinyEquipableItemSetDefinition,
  DestinyInventoryItemDefinition,
  DestinyPlugSetDefinition,
  DestinySandboxPerkDefinition,
} from "bungie-api-ts/destiny2";

import { loadManifest } from "./manifest.ts";

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
const CACHE_ROOT = join(REPO_ROOT, ".cache", "manifest");
const DATA_ROOT = join(REPO_ROOT, ".cache");

const SHEET = "1JM-0SlxVDAi-C6rGVlLxa-J1WGewEeL8Qvq4htWZHhY";

// The CSV export 429s permanently on this sheet. htmlview serves the same cells
const sheetUrl = (gid: string): string =>
  `https://docs.google.com/spreadsheets/d/${SHEET}/htmlview/sheet?headers=true&gid=${gid}`;

const INDEX_URL = `https://docs.google.com/spreadsheets/d/${SHEET}/htmlview`;

const WEAPON_CATEGORY = 1;

// DPS numbers per archetype, nothing to resolve
const SKIP_TABS = new Set([
  "Experimental",
  "Exotic Armor (ignore)",
  "Builds (ignore)",
]);

// No Perk 1 column, rating only
const RATING_ONLY = new Set(["Exotic Weapons"]);

const ROLL_TABS = new Set([
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
]);

// Rank tabs grade a perk or origin trait on its own, apart from any weapon
const RANK_TABS: Record<string, { rank: string; tier?: string }> = {
  Perks: { rank: "#" },
  "Origin Traits": { rank: "Rank", tier: "Tier" },
};

const SET_BONUS_TAB = "Set Bonuses";

const TIERS = ["S", "A", "B", "C", "D", "E", "F"] as const;

export type Tier = (typeof TIERS)[number];

export interface AegisRoll {
  name: string;
  category: string;
  tier: Tier | undefined;
  /** Position within its category, best first */
  rank: number | undefined;
  /** How many weapons the category ranks, so a rank reads as "3 of 62" */
  ranked: number;
  hashes: number[];
  /** Plug hashes per perk column, already covering enhanced variants */
  slots: number[][];
  notes: string | undefined;
  season: string | undefined;
}

export interface AegisPerk {
  name: string;
  hashes: number[];
  kind: "perk" | "origin";
  /** Position across every perk of its kind, best first. Only the top ones are ranked */
  rank: number | undefined;
  tier: Tier | undefined;
  tags: string | undefined;
  effect: string | undefined;
}

export interface AegisSetBonus {
  name: string;
  /** The DestinySandboxPerkDefinition the set definition points at */
  hash: number;
  set: string;
  pieces: number;
  /** Position across every set bonus of either size, best first */
  rank: number | undefined;
  tier: Tier | undefined;
  tags: string | undefined;
  trigger: string | undefined;
  effect: string | undefined;
  notes: string | undefined;
}

export interface AegisData {
  source: string;
  captured: string;
  rolls: AegisRoll[];
  perks: AegisPerk[];
  setBonuses: AegisSetBonus[];
}

interface Tab {
  gid: string;
  name: string;
}

const fetchText = async (url: string): Promise<string> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Sheet fetch failed: ${response.status} ${url}`);
  }

  return response.text();
};

const decodeEntities = (value: string): string =>
  value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#([0-9]+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .trim();

const parseRows = (html: string): string[][] => {
  const rows: string[][] = [];

  for (const [, body = ""] of html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)) {
    const cells: string[] = [];

    for (const [, cell = ""] of body.matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs)) {
      cells.push(decodeEntities(cell));
    }

    rows.push(cells);
  }

  return rows;
};

const fetchTabs = async (): Promise<Tab[]> => {
  const html = await fetchText(INDEX_URL);
  const tabs: Tab[] = [];

  for (const [, name = "", gid = ""] of html.matchAll(
    /items\.push\(\{name: "((?:[^"\\]|\\.)*)".*?gid: "([0-9]+)"/g,
  )) {
    tabs.push({ gid, name: JSON.parse(`"${name}"`) as string });
  }

  if (tabs.length === 0) {
    throw new Error(
      "Sheet index listed no tabs, the htmlview bootstrap changed",
    );
  }

  return tabs;
};

const headerRow = (rows: string[][], label: string): number => {
  for (let index = 0; index < Math.min(rows.length, 8); index += 1) {
    if (rows[index]?.includes(label)) {
      return index;
    }
  }

  return -1;
};

// The sheet puts qualifiers such as "Pantheon version" on a second line
const cleanName = (raw: string): string => raw.split("\n")[0]!.trim();

const NON_PERK = new Set(["", "-", "none", "n/a", "any"]);

const perkNames = (cell: string | undefined): string[] => {
  if (!cell) {
    return [];
  }

  return cell
    .split("\n")
    .map((line) => line.replace(/\*+$/, "").trim())
    .filter((line) => !NON_PERK.has(line.toLowerCase()));
};

interface Pool {
  names: Map<string, Set<number>>;
  randomized: boolean;
}

const poolFor = (
  item: DestinyInventoryItemDefinition,
  items: Record<string, DestinyInventoryItemDefinition>,
  plugSets: Record<string, DestinyPlugSetDefinition>,
): Pool => {
  const names = new Map<string, Set<number>>();
  let randomized = false;

  for (const entry of item.sockets?.socketEntries ?? []) {
    if (entry.randomizedPlugSetHash) {
      randomized = true;
    }

    const fromSets = [entry.randomizedPlugSetHash, entry.reusablePlugSetHash]
      .filter((hash): hash is number => !!hash)
      .flatMap((hash) =>
        (plugSets[hash]?.reusablePlugItems ?? []).map(
          (plug) => plug.plugItemHash,
        ),
      );

    const inline = (entry.reusablePlugItems ?? []).map(
      (plug) => plug.plugItemHash,
    );

    for (const hash of [...fromSets, ...inline]) {
      // The sheet's capitalization drifts from the manifest's, as in "Lead from Light"
      const name = items[hash]?.displayProperties?.name?.toLowerCase();

      if (!name) {
        continue;
      }

      const existing = names.get(name);

      if (existing) {
        existing.add(hash);
      } else {
        names.set(name, new Set([hash]));
      }
    }
  }

  return { names, randomized };
};

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

const main = async () => {
  const manifest = await loadManifest(CACHE_ROOT);

  const items = manifest.tables.get(
    "DestinyInventoryItemDefinition",
  ) as unknown as Record<string, DestinyInventoryItemDefinition>;
  const plugSets = manifest.tables.get(
    "DestinyPlugSetDefinition",
  ) as unknown as Record<string, DestinyPlugSetDefinition>;
  const itemSets = manifest.tables.get(
    "DestinyEquipableItemSetDefinition",
  ) as unknown as Record<string, DestinyEquipableItemSetDefinition>;
  const sandboxPerks = manifest.tables.get(
    "DestinySandboxPerkDefinition",
  ) as unknown as Record<string, DestinySandboxPerkDefinition>;

  const byName = new Map<string, DestinyInventoryItemDefinition[]>();

  for (const item of Object.values(items)) {
    if (!item.itemCategoryHashes?.includes(WEAPON_CATEGORY)) {
      continue;
    }

    const name = item.displayProperties?.name?.trim();

    if (!name) {
      continue;
    }

    const existing = byName.get(name);

    if (existing) {
      existing.push(item);
    } else {
      byName.set(name, [item]);
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

  console.log("\nReading sheet");

  const discovered = await fetchTabs();
  const tabs = discovered.filter(
    (tab) =>
      !SKIP_TABS.has(tab.name) &&
      (ROLL_TABS.has(tab.name) || RATING_ONLY.has(tab.name)),
  );
  const rankTabs = discovered.filter((tab) => RANK_TABS[tab.name]);
  const setTabs = discovered.filter((tab) => tab.name === SET_BONUS_TAB);

  console.log(`  ${tabs.length} tabs`);

  const rolls: AegisRoll[] = [];
  const unresolvedNames: string[] = [];
  const unresolvedPerks: string[] = [];
  const everyPlug = new Map<string, Set<number>>();
  let perkRefs = 0;

  for (const tab of tabs) {
    const rows = parseRows(await fetchText(sheetUrl(tab.gid)));
    const header = headerRow(rows, "Name");

    if (header < 0) {
      throw new Error(`Tab ${tab.name} has no header row`);
    }

    const columns = rows[header]!;
    const column = (row: string[], label: string): string | undefined => {
      const index = columns.indexOf(label);

      return index < 0 ? undefined : row[index];
    };

    let kept = 0;

    for (const row of rows.slice(header + 1)) {
      const name = cleanName(column(row, "Name") ?? "");

      if (!name) {
        continue;
      }

      const all = byName.get(name) ?? [];
      const rollable = all.filter((item) => cachedPool(item).randomized);
      const candidates = rollable.length > 0 ? rollable : all;

      if (candidates.length === 0) {
        unresolvedNames.push(`${tab.name}: ${name}`);
        continue;
      }

      const union = new Map<string, Set<number>>();

      for (const item of candidates) {
        for (const [perk, hashes] of cachedPool(item).names) {
          const existing = union.get(perk);

          if (existing) {
            for (const hash of hashes) {
              existing.add(hash);
            }
          } else {
            union.set(perk, new Set(hashes));
          }

          const global = everyPlug.get(perk);

          if (global) {
            for (const hash of hashes) {
              global.add(hash);
            }
          } else {
            everyPlug.set(perk, new Set(hashes));
          }
        }
      }

      const slots: number[][] = [];

      for (const label of ["Perk 1", "Perk 2"]) {
        const resolved: number[] = [];

        for (const perk of perkNames(column(row, label))) {
          perkRefs += 1;
          const hashes = union.get(perk.toLowerCase());

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

      rolls.push({
        name,
        category: tab.name,
        tier: tierOf(column(row, "Tier")),
        rank: numberOf(column(row, "#")),
        ranked: 0,
        hashes: [...new Set(candidates.map((item) => item.hash))],
        slots,
        notes: column(row, "Notes") || column(row, "Description") || undefined,
        season: column(row, "Season") || undefined,
      });

      kept += 1;
    }

    for (const entry of rolls) {
      if (entry.category === tab.name) {
        entry.ranked = kept;
      }
    }

    console.log(`  ${tab.name.padEnd(16)} ${String(kept).padStart(4)} weapons`);
  }

  const perks: AegisPerk[] = [];
  const unresolvedRanked: string[] = [];

  for (const tab of rankTabs) {
    const spec = RANK_TABS[tab.name]!;
    const rows = parseRows(await fetchText(sheetUrl(tab.gid)));
    const header = headerRow(rows, "Name");

    if (header < 0) {
      throw new Error(`Tab ${tab.name} has no header row`);
    }

    const columns = rows[header]!;
    const column = (row: string[], label: string): string | undefined => {
      const index = columns.indexOf(label);

      return index < 0 ? undefined : row[index];
    };

    let kept = 0;

    for (const row of rows.slice(header + 1)) {
      const name = cleanName(column(row, "Name") ?? "");

      if (!name) {
        continue;
      }

      const hashes = everyPlug.get(name.toLowerCase());

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

    console.log(`  ${tab.name.padEnd(16)} ${String(kept).padStart(4)} ranked`);
  }

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

  const setBonuses: AegisSetBonus[] = [];
  const unresolvedBonuses: string[] = [];

  for (const tab of setTabs) {
    const rows = parseRows(await fetchText(sheetUrl(tab.gid)));
    const header = headerRow(rows, "Bonus");

    if (header < 0) {
      throw new Error(`Tab ${tab.name} has no header row`);
    }

    const columns = rows[header]!;
    const column = (row: string[], label: string): string | undefined => {
      const index = columns.indexOf(label);

      return index < 0 ? undefined : row[index];
    };

    for (const row of rows.slice(header + 1)) {
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
          rank: numberOf(column(row, "#")),
          tier: tierOf(column(row, "Tier")),
          tags: column(row, "Tags")?.replaceAll("\n", ", ") || undefined,
          trigger: column(row, "Trigger") || undefined,
          effect: column(row, "Effect") || undefined,
          notes: column(row, "Description") || undefined,
        });
      }
    }

    console.log(
      `  ${tab.name.padEnd(16)} ${String(setBonuses.length).padStart(
        4,
      )} bonuses`,
    );
  }

  const data: AegisData = {
    source: INDEX_URL,
    captured: new Date().toISOString().slice(0, 10),
    rolls,
    perks,
    setBonuses,
  };

  await mkdir(DATA_ROOT, { recursive: true });
  const destination = join(DATA_ROOT, "aegis.json");
  await writeFile(destination, JSON.stringify(data));

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
    } with rolls`,
  );
  console.log(
    `perks ${resolvedPerks}/${perkRefs} ${pct(resolvedPerks, perkRefs)}`,
  );

  const ranked = perks.filter((perk) => perk.rank !== undefined).length;

  console.log(
    `${perks.length} perks and origin traits, ${ranked} of them ranked`,
  );

  console.log(`${setBonuses.length} of ${bonusPerks.size} set bonuses rated`);

  if (unresolvedBonuses.length > 0) {
    console.log(`\nUnresolved set bonuses (${unresolvedBonuses.length}):`);

    for (const entry of unresolvedBonuses) {
      console.log(`  ${entry}`);
    }
  }

  if (unresolvedRanked.length > 0) {
    console.log(`\nUnresolved perk names (${unresolvedRanked.length}):`);

    for (const entry of unresolvedRanked) {
      console.log(`  ${entry}`);
    }
  }

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

  if (unresolvedNames.length > 0) {
    console.log(`\nUnresolved names (${unresolvedNames.length}):`);

    for (const entry of unresolvedNames) {
      console.log(`  ${entry}`);
    }
  }

  if (unresolvedPerks.length > 0) {
    console.log(`\nUnresolved perks (${unresolvedPerks.length}):`);

    for (const entry of unresolvedPerks) {
      console.log(`  ${entry}`);
    }
  }

  console.log(`\nWrote ${destination}`);
};

await main();
