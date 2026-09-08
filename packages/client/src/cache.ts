export interface Cached<T> {
  (): Promise<T>;
  settled: () => T | undefined;
}

/** Fetches once and keeps the value readable without awaiting */
export const cached = <T>(fetch: () => Promise<T>): Cached<T> => {
  let pending: Promise<T> | undefined = undefined;
  let settled: T | undefined = undefined;

  const run = (): Promise<T> => {
    pending ??= fetch().then((value) => {
      settled = value;

      return value;
    });

    return pending;
  };

  return Object.assign(run, { settled: () => settled });
};
