import { readStored, writeStored } from "../storage.ts";

export const ITEM_SEARCHES = "dvm.searches";

const LIMIT = 20;

const read = (key: string): string[] => {
  const parsed = readStored(key);

  return Array.isArray(parsed)
    ? parsed.filter((entry): entry is string => typeof entry === "string")
    : [];
};

/** Past searches, newest first */
export const recentSearches = (key: string): string[] => read(key);

/** Records a search, moving it to the front if it was already there */
export const rememberSearch = (query: string, key: string): string[] => {
  const trimmed = query.trim();

  if (trimmed === "") {
    return read(key);
  }

  const kept = [
    trimmed,
    ...read(key).filter((entry) => entry !== trimmed),
  ].slice(0, LIMIT);

  writeStored(key, kept);

  return kept;
};

export const forgetSearch = (query: string, key: string): string[] => {
  const kept = read(key).filter((entry) => entry !== query);

  writeStored(key, kept);

  return kept;
};
