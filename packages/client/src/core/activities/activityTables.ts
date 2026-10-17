import { keyBy } from "es-toolkit";
import { createResource } from "solid-js";

import type {
  SlimActivity,
  SlimActivitySet,
  SlimActivityType,
  SlimChallenge,
  SlimDifficulty,
  SlimGraphNode,
  SlimMode,
  SlimModifier,
  SlimPlace,
  SlimReward,
  SlimSkull,
} from "@dvm/defs-core";

import { fetchRecords, fetchTable } from "../api/artifacts.ts";
import { cached } from "../api/cache.ts";
import { loadConfig } from "../api/config.ts";
import type { ActivityTables } from "./types.ts";

type Table<T> = Record<number, T>;

export const activityTables = cached(async (): Promise<ActivityTables> => {
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
    skulls,
    modes,
  ] = await Promise.all([
    fetchTable<Table<SlimActivity>>(artifacts, "Activity"),
    fetchTable<Table<SlimModifier>>(artifacts, "ActivityModifier"),
    fetchTable<Table<SlimActivityType>>(artifacts, "ActivityType"),
    fetchTable<Table<SlimGraphNode>>(artifacts, "FireteamFinderActivityGraph"),
    fetchTable<Table<SlimActivitySet>>(artifacts, "FireteamFinderActivitySet"),
    fetchTable<Table<SlimPlace>>(artifacts, "Destination"),
    fetchTable<Table<SlimPlace>>(artifacts, "Place"),
    fetchRecords<SlimReward>(artifacts, "ActivityReward"),
    fetchRecords<SlimChallenge>(artifacts, "ActivityChallenge"),
    fetchTable<Table<SlimDifficulty>>(
      artifacts,
      "ActivityDifficultyTierCollection",
    ),
    fetchTable<Table<SlimSkull>>(
      artifacts,
      "ActivitySelectableSkullCollection",
    ),
    fetchTable<Table<SlimMode>>(artifacts, "ActivityMode"),
  ]);

  return {
    activities,
    modifiers,
    types,
    nodes,
    sets,
    destinations,
    places,
    rewards: keyBy(rewards, (reward) => reward.hash),
    challenges: keyBy(challenges, (challenge) => challenge.hash),
    difficulties,
    skulls,
    modes,
  };
});

/** The tables as a resource, starting from any already fetched */
export const useActivityTables = () =>
  createResource(activityTables, {
    initialValue: activityTables.settled(),
  })[0];
