import { createSignal } from "solid-js";

import { HOUR, MINUTE } from "./time.ts";

const AWAY = 30 * MINUTE;

const RUNNING = document.querySelector<HTMLMetaElement>(
  'meta[name="build-version"]',
)?.content;

const [latest, setLatest] = createSignal<string | undefined>(undefined);
const [closed, setClosed] = createSignal<string | undefined>(undefined);

export const pendingUpdate = (): string | undefined => {
  const version = latest();

  if (!version || version === RUNNING || version === closed()) {
    return undefined;
  }

  return version;
};

export const closeUpdate = () => {
  setClosed(latest());
};

const check = async () => {
  if (pendingUpdate() !== undefined) {
    return;
  }

  try {
    const response = await fetch("/version.json", { cache: "no-store" });

    if (!response.ok) {
      return;
    }

    const body = (await response.json()) as { version?: string };

    setLatest(body.version);
  } catch {
    // Offline or mid-deploy
  }
};

/** Polls for a newer deploy hourly while visible and on return from a long absence */
export const startUpdateCheck = (): (() => void) => {
  if (RUNNING === undefined) {
    return () => {};
  }

  let hiddenAt: number | undefined = undefined;

  const onVisibility = () => {
    if (document.hidden) {
      hiddenAt = Date.now();

      return;
    }

    if (hiddenAt !== undefined && Date.now() - hiddenAt >= AWAY) {
      void check();
    }

    hiddenAt = undefined;
  };

  // Old chunks are gone after a deploy
  const onPreloadError = () => {
    void check();
  };

  const timer = window.setInterval(() => {
    if (!document.hidden) {
      void check();
    }
  }, HOUR);

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("vite:preloadError", onPreloadError);

  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("vite:preloadError", onPreloadError);
  };
};
