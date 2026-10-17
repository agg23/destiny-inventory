/** Merges rows by key; the later updatedAt wins */
export const mergeNewer = <T extends { updatedAt: number }>(
  current: T[],
  incoming: T[],
  keyOf: (row: T) => string,
): T[] => {
  const map = new Map(current.map((row) => [keyOf(row), row]));

  for (const row of incoming) {
    const existing = map.get(keyOf(row));

    if (!existing || row.updatedAt >= existing.updatedAt) {
      map.set(keyOf(row), row);
    }
  }

  return [...map.values()];
};
