import { guest, guestParam } from "./guest.ts";

export interface Codec<T> {
  read: (raw: string | undefined) => T;
  write: (value: T) => string | undefined;
}

const text = (): Codec<string | undefined> => ({
  read: (raw) => (raw === undefined || raw === "" ? undefined : raw),
  write: (value) => (value === "" ? undefined : value),
});

const filled = (fallback: string): Codec<string> => ({
  read: (raw) => (raw === undefined || raw === "" ? fallback : raw),
  write: (value) => (value === fallback ? undefined : value),
});

const choice = <T extends string>(
  allowed: readonly T[],
  fallback: T,
): Codec<T> => ({
  read: (raw) => allowed.find((one) => one === raw) ?? fallback,
  write: (value) => (value === fallback ? undefined : value),
});

const flag = (): Codec<boolean> => ({
  read: (raw) => raw === "1",
  write: (value) => (value ? "1" : undefined),
});

const flagOn = (): Codec<boolean> => ({
  read: (raw) => raw !== "0",
  write: (value) => (value ? undefined : "0"),
});

const count = (): Codec<number | undefined> => ({
  read: (raw) => {
    const parsed = raw === undefined ? Number.NaN : Number.parseInt(raw, 10);

    return Number.isFinite(parsed) ? parsed : undefined;
  },
  write: (value) => value?.toString(),
});

// URLSearchParams leaves only * - . _ unescaped
const SEPARATOR = "_";

const ids = (): Codec<string[]> => ({
  read: (raw) => (raw === undefined || raw === "" ? [] : raw.split(SEPARATOR)),
  write: (value) => (value.length === 0 ? undefined : value.join(SEPARATOR)),
});

export const HISTORY_TABS = ["recent", "series", "map"] as const;

export type HistoryTab = (typeof HISTORY_TABS)[number];

export const TRIAGE_STEPS = ["tag", "compare", "trash"] as const;

export type TriageStep = (typeof TRIAGE_STEPS)[number];

export const TRIAGE_SORTS = ["received", "power", "name", "type"] as const;

export type TriageSort = (typeof TRIAGE_SORTS)[number];

export const GROUPINGS = ["type", "source"] as const;

export type Grouping = (typeof GROUPINGS)[number];

export const LAYOUTS = ["grid", "list"] as const;

export type Layout = (typeof LAYOUTS)[number];

export const PARAMS = {
  q: filled(""),
  guest: text(),
  character: text(),
  pin: ids(),
  realm: text(),
  section: text(),
  rest: flag(),
  view: choice(HISTORY_TABS, "recent"),
  range: filled("30d"),
  from: text(),
  days: count(),
  metric: text(),
  open: ids(),
  shown: count(),
  rung: text(),
  run: text(),
  step: choice(TRIAGE_STEPS, "tag"),
  sort: choice(TRIAGE_SORTS, "received"),
  tagged: flag(),
  guard: flagOn(),
  tag: filled("junk"),
  group: count(),
  by: choice(GROUPINGS, "type"),
  layout: choice(LAYOUTS, "grid"),
};

export type Params = {
  [K in keyof typeof PARAMS]: (typeof PARAMS)[K] extends Codec<infer T>
    ? T
    : never;
};

export type ParamKey = keyof Params;

export const readParam = <K extends ParamKey>(
  key: K,
  raw: string | undefined,
): Params[K] => (PARAMS[key] as unknown as Codec<Params[K]>).read(raw);

export const writeParams = (
  patch: Partial<Params>,
): Record<string, string | undefined> => {
  const written: Record<string, string | undefined> = {};

  for (const key of Object.keys(patch) as ParamKey[]) {
    written[key] = (PARAMS[key] as unknown as Codec<Params[ParamKey]>).write(
      patch[key] as Params[ParamKey],
    );
  }

  return written;
};

export const TABS = [
  "vault",
  "triage",
  "collections",
  "activities",
  "todo",
  "history",
] as const;

export type Tab = (typeof TABS)[number];

// A path drops every param it does not spell out, and leaving a guest has to be deliberate
const scoped = (href: string): string => {
  const who = guest();

  if (who === undefined) {
    return href;
  }

  return `${href}${href.includes("?") ? "&" : "?"}guest=${guestParam(who)}`;
};

// Each tab starts with a clean filter
export const tabHref = (tab: Tab): string => scoped(`/${tab}`);

// The router hands back the path segment still encoded
export const activityLabel = (raw: string | undefined): string | undefined => {
  if (raw === undefined) {
    return undefined;
  }

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

export const activityHref = (label: string, rung: string | undefined): string =>
  scoped(
    `/history/activity/${encodeURIComponent(label)}${
      rung === undefined ? "" : `?rung=${encodeURIComponent(rung)}`
    }`,
  );

export const collectionsHref = (
  path: string,
  patch: Partial<Params>,
): string => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(writeParams(patch))) {
    if (value !== undefined) {
      params.set(key, value);
    }
  }

  const search = params.toString();

  return scoped(search === "" ? path : `${path}?${search}`);
};

export const weaponHref = (
  itemHash: number,
  patch: Partial<Params> = {},
): string => collectionsHref(`/collections/${itemHash}`, patch);

export const vaultHref = (query: string, pin: string | undefined): string => {
  const params = new URLSearchParams({ q: query });

  if (pin !== undefined) {
    params.set("pin", pin);
  }

  return scoped(`/vault?${params.toString()}`);
};

export const runHref = (
  label: string,
  rung: string | undefined,
  instanceId: string,
): string => {
  const href = activityHref(label, rung);

  return `${href}${href.includes("?") ? "&" : "?"}run=${instanceId}`;
};
