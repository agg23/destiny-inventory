const KEY = "dvm.searches";

const LIMIT = 20;

const read = (): string[] => {
  const raw = localStorage.getItem(KEY);

  if (raw === null) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
};

/** Past searches, newest first */
export const recentSearches = (): string[] => read();

/** Records a search, moving it to the front if it was already there */
export const rememberSearch = (query: string): string[] => {
  const trimmed = query.trim();

  if (trimmed === "") {
    return read();
  }

  const kept = [trimmed, ...read().filter((entry) => entry !== trimmed)].slice(
    0,
    LIMIT,
  );

  localStorage.setItem(KEY, JSON.stringify(kept));

  return kept;
};

export const forgetSearch = (query: string): string[] => {
  const kept = read().filter((entry) => entry !== query);

  localStorage.setItem(KEY, JSON.stringify(kept));

  return kept;
};
