import { activityName, type SlimActivity } from "@dvm/defs-core";

import type { ActivityTables } from "../activities.ts";
import { NO_TIER, type ActivityRow, type HistoryRun } from "../history.ts";
import type { PlateProps } from "./ActivityRow.tsx";

const tierName = (
  tables: ActivityTables | undefined,
  activity: SlimActivity | undefined,
  picked: number | undefined,
): string | undefined =>
  picked === undefined || picked === NO_TIER
    ? undefined
    : tables?.difficulties[activity?.difficultyHash ?? 0]?.tiers.find(
        (tier) => tier.index === picked,
      )?.name;

export interface ActivityLookup {
  activityOf: (run: HistoryRun) => SlimActivity | undefined;
  typeOf: (activity: SlimActivity | undefined) => string | undefined;
  labelOf: (run: HistoryRun) => string;
  rungOf: (run: HistoryRun) => string | undefined;
  runPlate: (run: HistoryRun) => PlateProps;
  rowPlate: (row: ActivityRow) => PlateProps;
}

export const activityLookup = (
  tables: ActivityTables | undefined,
): ActivityLookup => {
  const activityOf = (run: HistoryRun): SlimActivity | undefined =>
    tables?.activities[run.referenceId] ??
    tables?.activities[run.directorActivityHash];

  const typeOf = (activity: SlimActivity | undefined): string | undefined =>
    activity?.activityTypeHash === undefined
      ? undefined
      : tables?.types[activity.activityTypeHash]?.name;

  const labelOf = (run: HistoryRun): string => {
    const found = activityOf(run);

    return found === undefined
      ? `Activity ${run.referenceId}`
      : activityName(found.name);
  };

  const rungOf = (run: HistoryRun): string | undefined => {
    const activity = activityOf(run);

    return (
      tierName(tables, activity, run.difficultyTier) ?? activity?.difficulty
    );
  };

  const runPlate = (run: HistoryRun): PlateProps => {
    const activity = activityOf(run);

    return {
      name: labelOf(run),
      art: activity?.pgcrImage,
      difficulty: rungOf(run),
      note: typeOf(activity),
    };
  };

  const rowPlate = (row: ActivityRow): PlateProps => {
    const activity = tables?.activities[row.referenceId];

    return {
      name: row.label,
      art: activity?.pgcrImage,
      difficulty: row.difficulty,
      note: typeOf(activity),
    };
  };

  return { activityOf, typeOf, labelOf, rungOf, runPlate, rowPlate };
};
