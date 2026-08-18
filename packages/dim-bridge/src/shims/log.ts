type Collector = (tag: string, message: unknown, error: Error) => void;

let collector: Collector | undefined = undefined;

// processItems swallows a failed item rather than throwing, so this is the only place a
// skipped item is observable
export const collectErrors = (next: Collector | undefined): void => {
  collector = next;
};

export const infoLog = (tag: string, message: unknown, ...args: unknown[]): void => {
  console.log(`[${tag}]`, message, ...args);
};

export const warnLog = (tag: string, message: unknown, ...args: unknown[]): void => {
  console.warn(`[${tag}]`, message, ...args);
};

export const warnLogCollapsedStack = warnLog;

export const errorLog = (tag: string, message: unknown, ...args: unknown[]): void => {
  const error = args.find((arg) => arg instanceof Error);

  if (collector && error) {
    collector(tag, message, error);

    return;
  }

  console.error(`[${tag}]`, message, ...args);
};

export const timer = (tag: string, message: string): (() => void) => {
  const label = `[${tag}] ${message}`;
  console.time(label);

  return () => console.timeEnd(label);
};
