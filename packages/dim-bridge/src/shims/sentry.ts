// DIM's version transitively pulls an oauth module that reads localStorage at import time

export const reportException = (
  name: string,
  e: unknown,
  errorInfo?: Record<string, unknown>,
): void => {
  console.error(`[exception] ${name}`, e, errorInfo ?? "");
};
