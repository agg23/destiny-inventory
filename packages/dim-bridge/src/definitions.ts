import type { D2ManifestDefinitions, DefinitionTable } from "app/destiny2/d2-definitions";

export class HashLookupFailure extends Error {
  constructor(
    public table: string,
    public hash: number,
  ) {
    super(`Missing definition: ${table}[${hash}]`);
    this.name = "HashLookupFailure";
  }
}

const makeTable = <T>(name: string, raw: Record<string, unknown>): DefinitionTable<T> => ({
  get: (hash: number): T => {
    const value = raw[hash] as T | undefined;

    if (value === undefined) {
      throw new HashLookupFailure(name, hash);
    }

    return value;
  },
  getOptional: (hash: number): T | undefined => raw[hash] as T | undefined,
  getAll: () => raw as { [hash: number]: T },
});

const shortName = (table: string): string =>
  table.replace(/^Destiny/, "").replace(/Definition$/, "");

export const buildDefinitions = (
  tables: Map<string, Record<string, unknown>>,
): D2ManifestDefinitions => {
  const defs: Record<string, unknown> = { isDestiny2: true };

  for (const [table, raw] of tables) {
    const name = shortName(table);
    defs[name] = makeTable(name, raw);
  }

  return defs as unknown as D2ManifestDefinitions;
};
