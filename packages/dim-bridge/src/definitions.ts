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

const makeTable = <T>(
  name: string,
  raw: Record<string, unknown>,
  withheld?: Set<number>,
): DefinitionTable<T> => ({
  get: (hash: number): T => {
    const value = raw[hash] as T | undefined;

    // DIM guards every plug lookup with a falsy check
    if (value === undefined && !withheld?.has(hash)) {
      throw new HashLookupFailure(name, hash);
    }

    return value as T;
  },
  getOptional: (hash: number): T | undefined => raw[hash] as T | undefined,
  getAll: () => raw as { [hash: number]: T },
});

const shortName = (table: string): string =>
  table.replace(/^Destiny/, "").replace(/Definition$/, "");

const ITEMS = "InventoryItem";

export const buildDefinitions = (
  tables: Map<string, Record<string, unknown>>,
  withheld?: Set<number>,
): D2ManifestDefinitions => {
  const defs: Record<string, unknown> = { isDestiny2: true };

  for (const [table, raw] of tables) {
    const name = shortName(table);
    defs[name] = makeTable(name, raw, name === ITEMS ? withheld : undefined);
  }

  return defs as unknown as D2ManifestDefinitions;
};
