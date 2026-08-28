const INTERVAL = 15_000;
const MINIMUM = 7_500;

interface Options {
  onRefresh: () => Promise<void>;
  busy: () => boolean;
}

export interface AutoRefresh {
  stop: () => void;
  now: () => void;
}

// Bungie has no push for profile data
export const startAutoRefresh = ({
  onRefresh,
  busy,
}: Options): AutoRefresh => {
  let timer: number | undefined = undefined;
  let last = 0;
  let stopped = false;

  const schedule = () => {
    window.clearTimeout(timer);

    if (!stopped) {
      timer = window.setTimeout(attempt, INTERVAL);
    }
  };

  const attempt = () => {
    // A refresh landing mid-move would rebuild the stores under it
    if (stopped || document.hidden || !navigator.onLine || busy()) {
      schedule();

      return;
    }

    // Visibility and the timer can fire together
    if (Date.now() - last < MINIMUM) {
      schedule();

      return;
    }

    last = Date.now();
    void onRefresh().finally(schedule);
  };

  const onVisible = () => {
    if (!document.hidden) {
      attempt();
    }
  };

  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", onVisible);
  schedule();

  return {
    stop: () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    },
    now: attempt,
  };
};
