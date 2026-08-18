export interface BrowserOptions {
  dsn?: string;
  environment?: string;
}

interface Scope {
  setTag: (key: string, value: unknown) => void;
  setExtra: (key: string, value: unknown) => void;
  setExtras: (extras: Record<string, unknown>) => void;
  setFingerprint: (fingerprint: string[]) => void;
  setLevel: (level: string) => void;
}

const SCOPE: Scope = {
  setTag: () => {},
  setExtra: () => {},
  setExtras: () => {},
  setFingerprint: () => {},
  setLevel: () => {},
};

export const init = (options?: BrowserOptions): void => {};

export const captureException = (e: unknown): void => {
  console.error("[sentry] captureException", e);
};

export const withScope = (callback: (scope: Scope) => void): void => {
  callback(SCOPE);
};

export const setTag = (key: string, value: string | undefined): void => {};

export const setUser = (user: Record<string, unknown> | undefined): void => {};

export const browserTracingIntegration = () => ({ name: "BrowserTracing" });

export const startSpan = <T>(options: { name: string }, callback: () => T): T => callback();
