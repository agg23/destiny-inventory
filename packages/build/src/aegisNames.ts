import type {
  DestinyInventoryItemDefinition,
  DestinyPlugSetDefinition,
} from "bungie-api-ts/destiny2";

// The sheets drift from the manifest in case, punctuation, and accents, as in "Ir Yût"
export const nameKey = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const fixes = (pairs: [string, string][]): Map<string, string> =>
  new Map(pairs.map(([from, to]) => [nameKey(from), nameKey(to)]));

const NAME_FIXES = fixes([
  ["Mykel's Reverance", "Mykel's Reverence"],
  ["Sherpard's Watch", "Shepherd's Watch"],
  ["Appetance", "Appetence"],
  ["Glaciocasm", "Glacioclasm"],
  ["Willful Harmatia", "Willful Hamartia"],
  ["Fimbulwinter Snitch", "Fimbulwinter Stitch"],
  ["Graviton Spike Grenades", "Graviton Spike"],
]);

const PERK_FIXES = fixes([
  ["Destablizing Rounds", "Destabilizing Rounds"],
  ["Attritiion Orbs", "Attrition Orbs"],
  ["Ambitious Assasin", "Ambitious Assassin"],
  ["Ambition Assassin", "Ambitious Assassin"],
  ["Blunt Execution", "Blunt Execution Rounds"],
]);

export const weaponKey = (name: string): string =>
  NAME_FIXES.get(nameKey(name)) ?? nameKey(name);

export const perkKey = (name: string): string =>
  PERK_FIXES.get(nameKey(name)) ?? nameKey(name);

export const cleanName = (raw: string): string => raw.split("\n")[0]!.trim();

const NON_PERK = new Set(["", "-", "none", "n/a", "any"]);

export const perkNames = (cell: string | undefined): string[] => {
  if (!cell) {
    return [];
  }

  return cell
    .split("\n")
    .map((line) => line.replace(/\*+$/, "").trim())
    .filter((line) => !NON_PERK.has(line.toLowerCase()));
};

export interface Pool {
  names: Map<string, Set<number>>;
  randomized: boolean;
}

export const poolFor = (
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
      const key = nameKey(items[hash]?.displayProperties?.name ?? "");

      if (!key) {
        continue;
      }

      const existing = names.get(key);

      if (existing) {
        existing.add(hash);
      } else {
        names.set(key, new Set([hash]));
      }
    }
  }

  return { names, randomized };
};
