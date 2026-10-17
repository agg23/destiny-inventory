import type {
  D2ManifestDefinitions,
  DefinitionTable,
} from "app/destiny2/d2-definitions";
import type {
  DestinyGlobalConstantsDefinition,
  DestinyObjectiveProgress,
} from "bungie-api-ts/destiny2";
import { DestinyRecordState } from "bungie-api-ts/destiny2";
import { groupBy, sumBy } from "es-toolkit";

import { defs } from "../profile/defs.ts";
import type { CharacterRecords, OrderRewards } from "../profile/loadTypes.ts";

// DIM's manifest type predates the table
type Manifest = D2ManifestDefinitions & {
  GlobalConstants: DefinitionTable<DestinyGlobalConstantsDefinition>;
};

const manifest = (): Manifest | undefined => defs() as Manifest | undefined;

export interface Challenge {
  hash: number;
  name: string;
  description: string;
  progress: number;
  goal: number;
  complete: boolean;
  redeemed: boolean;
}

export type Period = "daily" | "weekly";

export interface ChallengeGroup {
  period: Period;
  challenges: Challenge[];
}

export interface OrderPayout {
  itemHash: number;
  name: string;
  waiting: number;
}

/** Progress and goal summed across every objective */
export const objectiveTotals = (
  objectives: DestinyObjectiveProgress[],
): { progress: number; goal: number } => ({
  progress: sumBy(objectives, (step) => step.progress ?? 0),
  goal: sumBy(objectives, (step) => step.completionValue),
});

const constants = (
  loaded: Manifest,
): DestinyGlobalConstantsDefinition | undefined =>
  Object.values(loaded.GlobalConstants.getAll())[0];

const challengeNodes = (): { node: number; records: number[] }[] => {
  const loaded = manifest();

  if (!loaded) {
    return [];
  }

  const card = loaded.EventCard.getOptional(
    constants(loaded)?.seasonalHubEventCardHash ?? 0,
  );
  const root = loaded.PresentationNode.getOptional(
    card?.weeklyChallengesPresentationNodeHash ?? 0,
  );

  return (root?.children?.presentationNodes ?? []).flatMap((child) => {
    const node = loaded.PresentationNode.getOptional(
      child.presentationNodeHash,
    );
    const records = (node?.children?.records ?? []).map(
      (one) => one.recordHash,
    );

    return records.length === 0
      ? []
      : [{ node: child.presentationNodeHash, records }];
  });
};

// The manifest has no period, daily groups hold a single record
const periodOf = (records: number[]): Period =>
  records.length === 1 ? "daily" : "weekly";

export const seasonalChallenges = (
  records: CharacterRecords,
  character: string | undefined,
): ChallengeGroup[] => {
  const loaded = manifest();

  if (!loaded || character === undefined) {
    return [];
  }

  const held = records[character] ?? {};
  const byPeriod = groupBy(challengeNodes(), (group) =>
    periodOf(group.records),
  );

  return (["daily", "weekly"] as const).flatMap((period) => {
    const challenges = (byPeriod[period] ?? []).flatMap((group) =>
      group.records.flatMap((hash): Challenge[] => {
        const live = held[hash];
        const def = loaded.Record.getOptional(hash);
        const name = def?.displayProperties?.name;

        // Obscured and invisible ones aren't on offer
        if (
          !live ||
          !name ||
          live.state &
            (DestinyRecordState.Obscured | DestinyRecordState.Invisible)
        ) {
          return [];
        }

        return [
          {
            hash,
            name,
            description: def?.displayProperties?.description ?? "",
            ...objectiveTotals(live.objectives ?? []),
            complete:
              (live.state & DestinyRecordState.ObjectiveNotCompleted) === 0,
            redeemed: (live.state & DestinyRecordState.RecordRedeemed) !== 0,
          },
        ];
      }),
    );

    return challenges.length === 0 ? [] : [{ period, challenges }];
  });
};

/** Payout counters rekeyed from profile unlock values to reward items */
export const payoutsByReward = (rewards: OrderRewards): OrderRewards => {
  const loaded = manifest();
  const byUnlockValue =
    (loaded &&
      constants(loaded)?.orderRewardsUnlockValueHashesToRewardItemHashes) ??
    {};
  const rows: OrderRewards = {};

  for (const [character, counts] of Object.entries(rewards)) {
    const row: Record<number, number> = {};

    for (const [unlockValue, waiting] of Object.entries(counts)) {
      const itemHash = byUnlockValue[Number(unlockValue)];

      if (itemHash !== undefined) {
        row[itemHash] = waiting;
      }
    }

    rows[character] = row;
  }

  return rows;
};

/** Order rewards earned and waiting to be collected, by payout tier */
export const orderPayouts = (
  rewards: OrderRewards,
  character: string | undefined,
): OrderPayout[] => {
  const loaded = manifest();

  if (!loaded || character === undefined) {
    return [];
  }

  const unclaimed = payoutsByReward(rewards)[character] ?? {};

  return Object.entries(unclaimed).flatMap(([hash, waiting]) => {
    const itemHash = Number(hash);
    const name =
      loaded.InventoryItem.getOptional(itemHash)?.displayProperties?.name;

    return name === undefined ? [] : [{ itemHash, name, waiting }];
  });
};
