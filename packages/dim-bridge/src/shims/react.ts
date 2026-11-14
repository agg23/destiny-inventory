// Only DIM's hooks use these, and we never call them
const unavailable = (): never => {
  throw new Error("React hooks aren't available outside DIM");
};

export const useState: <S>(
  initial: S | (() => S),
) => [S, (next: S | ((previous: S) => S)) => void] = unavailable;

export const useCallback: <T>(callback: T, deps: unknown[]) => T = unavailable;
