const INTERVAL = 30_000;
const MINIMUM = 15_000;

interface Options {
  onRefresh: () => Promise<void>;
  // True while a move is in flight, since refreshing mid move would fight it
  busy: () => boolean;
}

// Bungie has no push for profile data. The timer restarts after each refresh rather than
// running on a schedule, so a slow refresh cannot stack calls up behind it
export const startAutoRefresh = ({
  onRefresh,
  busy,
}: Options): (() => void) => {
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

    // Visibility and the timer can fire together, and the throttle stops one poll becoming two
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

  return () => {
    stopped = true;
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("online", onVisible);
  };
};
