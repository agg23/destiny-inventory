/** Runs the callback when the main thread is idle, returning a cancel function */
export const onIdle = (callback: () => void): (() => void) => {
  // Safari only ships requestIdleCallback behind a flag
  if (typeof window.requestIdleCallback !== "function") {
    const timer = window.setTimeout(callback, 1);

    return () => window.clearTimeout(timer);
  }

  const idle = window.requestIdleCallback(callback);

  return () => window.cancelIdleCallback(idle);
};
