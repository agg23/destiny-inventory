import type { ActivityTables } from "../activities.ts";
import {
  byBucket,
  localDay,
  type BucketGroup,
  type HistoryRun,
} from "../history.ts";
import type { ActivityLookup } from "./activityLookup.ts";

export interface Day {
  day: string;
  runs: HistoryRun[];
}

export const groupDays = (runs: HistoryRun[]): Day[] => {
  const groups: Day[] = [];

  for (const run of runs) {
    const day = localDay(run.startedAt);
    const last = groups[groups.length - 1];

    if (last !== undefined && last.day === day) {
      last.runs.push(run);

      continue;
    }

    groups.push({ day, runs: [run] });
  }

  return groups;
};

export const groupBuckets = (
  tables: ActivityTables | undefined,
  runs: HistoryRun[],
  lookup: ActivityLookup,
): BucketGroup[] => {
  if (!tables) {
    return [];
  }

  const byType = new Map(
    Object.values(tables.modes).map((mode) => [mode.modeType, mode] as const),
  );

  const ancestors = (mode: number): number[] => {
    const chain: number[] = [];
    let at = byType.get(mode);

    while (at) {
      const [parent] = at.parentHashes;
      const up = parent === undefined ? undefined : tables.modes[parent];

      if (!up || chain.includes(up.modeType)) {
        break;
      }

      chain.push(up.modeType);
      at = byType.get(up.modeType);
    }

    return chain;
  };

  return byBucket(runs, {
    modesOf: (referenceId) => tables.activities[referenceId]?.modeTypes ?? [],
    ancestors,
    rungOf: lookup.rungOf,
    labelOf: lookup.labelOf,
  });
};
