export const MINUTE = 60_000;

export const stamp = (at: number): string =>
  new Date(at).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });

export const day = (at: number): string =>
  new Date(at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

export const exact = (at: number): string =>
  new Date(at).toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/**
 * A refresh rebuilds every derived object, and For diffs by reference, so without this a
 * poll replaces rows that render exactly the same thing.
 */
const unchanged = <T>(was: T[], next: T[]): boolean =>
  was.length === next.length &&
  was.every((one, at) => JSON.stringify(one) === JSON.stringify(next[at]));

export const held = <T>() => ({ equals: unchanged<T> });
