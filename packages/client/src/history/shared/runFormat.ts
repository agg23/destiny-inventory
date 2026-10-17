import { DIFFICULTIES } from "@dvm/defs-core";

import type { HistoryRun } from "../../core/activities/history.ts";

export const ratio = (run: HistoryRun): string =>
  (run.deaths > 0 ? run.kills / run.deaths : run.kills).toFixed(2);

export const score = (value: number): string =>
  value > 0 ? value.toLocaleString() : "-";

const HERO_RANK = DIFFICULTIES.indexOf("Hero");
const LEGEND_RANK = DIFFICULTIES.indexOf("Legend");
const MASTER_RANK = DIFFICULTIES.indexOf("Master");

// Destiny's palette: purple for the Legend rungs, red from Master up
export const rungColor = (name: string): string => {
  const rank = DIFFICULTIES.indexOf(name);

  if (rank >= MASTER_RANK) {
    return "text-destructive";
  }

  if (rank >= LEGEND_RANK) {
    return "text-legendary";
  }

  if (rank >= HERO_RANK) {
    return "text-foreground";
  }

  return "text-muted-foreground";
};
