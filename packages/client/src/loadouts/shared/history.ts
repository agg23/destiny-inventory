import { readStored, writeStored } from "../../core/storage.ts";

const KEY = "dvm.loadouts";

const LIMIT = 20;

export interface LookedUp {
  /** The share id for dim.gg links, otherwise the whole link */
  key: string;
  link: string;
  name: string;
  classType: number;
  subclass: string | undefined;
}

const read = (): LookedUp[] => {
  const parsed = readStored(KEY);

  return Array.isArray(parsed)
    ? parsed.filter(
        (entry): entry is LookedUp =>
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as LookedUp).key === "string" &&
          typeof (entry as LookedUp).link === "string",
      )
    : [];
};

const write = (kept: LookedUp[]): LookedUp[] => {
  const trimmed = kept.slice(0, LIMIT);

  writeStored(KEY, trimmed);

  return trimmed;
};

/** Most recent first */
export const lookedUp = (): LookedUp[] => read();

export const rememberLookup = (entry: LookedUp): LookedUp[] =>
  write([entry, ...read().filter((held) => held.key !== entry.key)]);

export const forgetLookup = (key: string): LookedUp[] =>
  write(read().filter((held) => held.key !== key));
