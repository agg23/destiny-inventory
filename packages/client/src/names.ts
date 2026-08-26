import type { NameEntry } from "@dvm/defs-core";

import { fetchRecords } from "./artifacts.ts";
import type { ArtifactIndex } from "./config.ts";

const WEAPON = 3;
const ARMOR = 2;

const MINIMUM = 3;

let pending: Promise<NameEntry[]> | undefined = undefined;

// Content hashed, cached by the browser
const entries = (index: ArtifactIndex): Promise<NameEntry[]> => {
  pending ??= fetchRecords<NameEntry>(index, "names");

  return pending;
};

let table: Promise<Map<number, NameEntry>> | undefined = undefined;

/** Every shipped item's name by hash, for labelling items no profile ever owned */
export const nameTable = (
  index: ArtifactIndex,
): Promise<Map<number, NameEntry>> => {
  table ??= entries(index).then(
    (all) => new Map(all.map((entry) => [entry.hash, entry])),
  );

  return table;
};

/** Pulls the index down before the first search asks for it */
export const warmNames = (index: ArtifactIndex) => {
  void entries(index).catch(() => undefined);
};

/** Whether a query is a bare name and not a filter expression */
export const isName = (query: string): boolean => {
  const trimmed = query.trim();

  return trimmed.length >= MINIMUM && !/[:()]|\s-/.test(trimmed);
};

const kindRank = (type: number): number => {
  if (type === WEAPON) {
    return 0;
  }

  if (type === ARMOR) {
    return 1;
  }

  return 2;
};

const matchRank = (name: string, needle: string): number => {
  if (name === needle) {
    return 0;
  }

  if (name.startsWith(needle)) {
    return 1;
  }

  return name.includes(` ${needle}`) ? 2 : 3;
};

export const searchNames = async (
  index: ArtifactIndex,
  query: string,
  limit: number,
): Promise<NameEntry[]> => {
  const needle = query.trim().toLowerCase();

  if (!isName(query)) {
    return [];
  }

  const all = await entries(index);

  const matched = all.filter((entry) =>
    entry.name.toLowerCase().includes(needle),
  );

  matched.sort((a, b) => {
    const name =
      matchRank(a.name.toLowerCase(), needle) -
      matchRank(b.name.toLowerCase(), needle);

    if (name !== 0) {
      return name;
    }

    const kind = kindRank(a.type) - kindRank(b.type);

    if (kind !== 0) {
      return kind;
    }

    return b.tier - a.tier || a.name.length - b.name.length;
  });

  const seen = new Set<string>();

  // A weapon ships again for every reissue, and its pattern carries the same name
  const distinct = matched.filter((entry) => {
    const name = entry.name.toLowerCase();

    if (seen.has(name)) {
      return false;
    }

    seen.add(name);

    return true;
  });

  return distinct.slice(0, limit);
};
