// A refresh rebuilds every object and For diffs by reference
const unchanged = <T>(was: T[], next: T[]): boolean =>
  was.length === next.length &&
  was.every((one, at) => JSON.stringify(one) === JSON.stringify(next[at]));

export const held = <T>() => ({ equals: unchanged<T> });
