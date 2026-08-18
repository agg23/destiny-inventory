import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startAutoRefresh } from "./refresh.ts";

const listeners = new Map<string, () => void>();

const setHidden = (hidden: boolean) => {
  vi.stubGlobal("document", {
    get hidden() {
      return hidden;
    },
    addEventListener: (event: string, handler: () => void) => listeners.set(event, handler),
    removeEventListener: (event: string) => listeners.delete(event),
  });
};

describe("auto refresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    listeners.clear();
    setHidden(false);
    vi.stubGlobal("navigator", { onLine: true });
    vi.stubGlobal("window", {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      addEventListener: (event: string, handler: () => void) => listeners.set(event, handler),
      removeEventListener: (event: string) => listeners.delete(event),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("polls on an interval while visible", async () => {
    const onRefresh = vi.fn(() => Promise.resolve());
    const stop = startAutoRefresh({ onRefresh, busy: () => false });

    await vi.advanceTimersByTimeAsync(31_000);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(31_000);
    expect(onRefresh).toHaveBeenCalledTimes(2);

    stop();
  });

  it("does not poll while the tab is hidden", async () => {
    setHidden(true);
    const onRefresh = vi.fn(() => Promise.resolve());
    const stop = startAutoRefresh({ onRefresh, busy: () => false });

    await vi.advanceTimersByTimeAsync(120_000);
    expect(onRefresh).not.toHaveBeenCalled();

    stop();
  });

  it("does not poll during a move", async () => {
    const onRefresh = vi.fn(() => Promise.resolve());
    const stop = startAutoRefresh({ onRefresh, busy: () => true });

    await vi.advanceTimersByTimeAsync(120_000);
    expect(onRefresh).not.toHaveBeenCalled();

    stop();
  });

  it("throttles a visibility change that lands right after a poll", async () => {
    const onRefresh = vi.fn(() => Promise.resolve());
    const stop = startAutoRefresh({ onRefresh, busy: () => false });

    await vi.advanceTimersByTimeAsync(31_000);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    listeners.get("visibilitychange")?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    stop();
  });

  it("stops polling once torn down", async () => {
    const onRefresh = vi.fn(() => Promise.resolve());
    const stop = startAutoRefresh({ onRefresh, busy: () => false });
    stop();

    await vi.advanceTimersByTimeAsync(120_000);
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
