import type {
  SlimActivity,
  SlimActivitySet,
  SlimActivityType,
  SlimChallenge,
  SlimDifficulty,
  SlimGraphNode,
  SlimModifier,
  SlimPlace,
  SlimReward,
} from "@dvm/defs-core";

import type { ActivityTables } from "./activities.ts";
import { fetchRecords, fetchTable } from "./artifacts.ts";
import { loadConfig } from "./config.ts";

type Table<T> = Record<number, T>;

const byHash = <T extends { hash: number }>(records: T[]): Table<T> => {
  const table: Table<T> = {};

  for (const record of records) {
    table[record.hash] = record;
  }

  return table;
};

// A quarter of a megabyte only the activities tab uses, so it waits for the tab to open
let pending: Promise<ActivityTables> | undefined = undefined;

export const activityTables = (): Promise<ActivityTables> => {
  pending ??= (async () => {
    const { artifacts } = await loadConfig();

    const [
      activities,
      modifiers,
      types,
      nodes,
      sets,
      destinations,
      places,
      rewards,
      challenges,
      difficulties,
    ] = await Promise.all([
      fetchTable<Table<SlimActivity>>(artifacts, "Activity"),
      fetchTable<Table<SlimModifier>>(artifacts, "ActivityModifier"),
      fetchTable<Table<SlimActivityType>>(artifacts, "ActivityType"),
      fetchTable<Table<SlimGraphNode>>(
        artifacts,
        "FireteamFinderActivityGraph",
      ),
      fetchTable<Table<SlimActivitySet>>(
        artifacts,
        "FireteamFinderActivitySet",
      ),
      fetchTable<Table<SlimPlace>>(artifacts, "Destination"),
      fetchTable<Table<SlimPlace>>(artifacts, "Place"),
      fetchRecords<SlimReward>(artifacts, "ActivityReward"),
      fetchRecords<SlimChallenge>(artifacts, "ActivityChallenge"),
      fetchTable<Table<SlimDifficulty>>(
        artifacts,
        "ActivityDifficultyTierCollection",
      ),
    ]);

    return {
      activities,
      modifiers,
      types,
      nodes,
      sets,
      destinations,
      places,
      rewards: byHash(rewards),
      challenges: byHash(challenges),
      difficulties,
    };
  })();

  return pending;
};
