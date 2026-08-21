import { DAY_MS } from "../history.ts";
import { dateLabel, dayTitle } from "./runFormat.ts";

export interface Range {
  id: string;
  label: string;
  days: number | undefined;
}

export const RANGES: Range[] = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
  { id: "365d", label: "Last 12 months", days: 365 },
  { id: "all", label: "All time", days: undefined },
];

export interface Span {
  from: number | undefined;
  to: number | undefined;
  label: string;
}

export const pinnedSpan = (
  day: string | undefined,
  days: number | undefined,
): Span | undefined => {
  if (day === undefined || days === undefined) {
    return undefined;
  }

  const from = new Date(`${day}T00:00:00`).getTime();

  if (Number.isNaN(from)) {
    return undefined;
  }

  const to = from + days * DAY_MS;

  if (days === 1) {
    return { from, to, label: dayTitle(day) };
  }

  if (days === 7) {
    return { from, to, label: `Week of ${dayTitle(day)}` };
  }

  return { from, to, label: `${dateLabel(from)} - ${dateLabel(to)}` };
};

export const spanOf = (
  id: string,
  pinned: Span | undefined,
  oldest: number,
): Span => {
  if (pinned) {
    return pinned;
  }

  const found = RANGES.find((one) => one.id === id) ?? RANGES[0];
  const from =
    found?.days === undefined ? undefined : Date.now() - found.days * DAY_MS;

  return {
    from,
    to: undefined,
    label: `${dateLabel(from ?? oldest)} - ${dateLabel(Date.now())}`,
  };
};
