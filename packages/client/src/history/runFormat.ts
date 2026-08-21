import { DIFFICULTIES } from "@dvm/defs-core";

import type { HistoryRun } from "../history.ts";

export const stamp = (at: number): string =>
  new Date(at).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export const ratio = (run: HistoryRun): string =>
  (run.deaths > 0 ? run.kills / run.deaths : run.kills).toFixed(2);

export const plural = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

export const score = (value: number): string =>
  value > 0 ? value.toLocaleString() : "-";

export const shortDay = (at: number): string =>
  new Date(at).toLocaleDateString([], { month: "short", day: "numeric" });

export const clock = (at: number): string =>
  new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const dateLabel = (at: number): string =>
  new Date(at).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export const dayTitle = (day: string): string =>
  new Date(`${day}T12:00:00`).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const HERO_RANK = DIFFICULTIES.indexOf("Hero");
const LEGEND_RANK = DIFFICULTIES.indexOf("Legend");
const MASTER_RANK = DIFFICULTIES.indexOf("Master");

// Destiny's palette: purple for the Legend rungs, red from Master up
export const rungColor = (name: string): string => {
  const rank = DIFFICULTIES.indexOf(name);

  if (rank >= MASTER_RANK) {
    return "text-danger";
  }

  if (rank >= LEGEND_RANK) {
    return "text-legendary";
  }

  if (rank >= HERO_RANK) {
    return "text-text";
  }

  return "text-dim";
};
