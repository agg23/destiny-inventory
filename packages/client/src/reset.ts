export const DAY = 86_400_000;

export const WEEK = 7 * DAY;

// Epoch is a Thursday, so every offset below is measured from Thursday 00:00 UTC
const DAILY = 61_200_000;

const WEEKLY = 493_200_000;

const WEEKEND = 118_800_000;

const nextAt = (period: number, offset: number, now: number): number => {
  const phase = offset % period;
  const since = ((now % period) + period) % period;

  return now - since + phase + (since < phase ? 0 : period);
};

/** Epoch ms of the next 17:00 UTC daily reset */
export const nextDailyReset = (now: number): number => nextAt(DAY, DAILY, now);

/** Epoch ms of the next Tuesday 17:00 UTC weekly reset */
export const nextWeeklyReset = (now: number): number =>
  nextAt(WEEK, WEEKLY, now);

// Xur alone refreshes at 09:00 UTC, confirmed against his live nextRefreshDate
/** Epoch ms of the next Friday 09:00 UTC weekend reset, when Xur arrives */
export const nextWeekendReset = (now: number): number =>
  nextAt(WEEK, WEEKEND, now);

/** True while Xur is in the world, Friday 09:00 UTC through the weekly reset */
export const xurPresent = (now: number): boolean =>
  nextWeeklyReset(now) < nextWeekendReset(now);

/** Coarse countdown that drops to the two largest units it needs */
export const remaining = (ms: number): string => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m ${seconds}s`;
};
