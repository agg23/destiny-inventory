import type {
  D2ManifestDefinitions,
  DefinitionTable,
} from "app/destiny2/d2-definitions";
import type { DestinyGlobalConstantsDefinition } from "bungie-api-ts/destiny2";

import { defs } from "./defs.ts";
import type { CharacterRecords, OrderRewards } from "./load.ts";

// DIM's manifest type predates the table
type Manifest = D2ManifestDefinitions & {
  GlobalConstants: DefinitionTable<DestinyGlobalConstantsDefinition>;
};

const manifest = (): Manifest | undefined => defs() as Manifest | undefined;

// DestinyRecordState
const REDEEMED = 1;
const NOT_COMPLETED = 4;
const OBSCURED = 8;
const INVISIBLE = 16;

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

const constants = (
  loaded: Manifest,
): DestinyGlobalConstantsDefinition | undefined =>
  Object.values(loaded.GlobalConstants.getAll())[0];

/**
 * The hub's challenge node holds one child node per reset group, each carrying its own
 * records. Nothing in the manifest names the groups or their period.
 */
export const challengeNodes = (): { node: number; records: number[] }[] => {
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

/**
 * The seasonal hub's live challenges. Obscured and invisible records are the ones the
 * hub is not offering, so they never reach the list.
 */
/**
 * Nothing in the manifest names a group's period. The hub offers one record per daily
 * slot and keeps the week's set in a single pool, and the pairs bear it out - "B Great"
 * wants 2 Ops where the pool's "B Greater" wants 7.
 */
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
  const byPeriod = new Map<Period, Challenge[]>();

  for (const group of challengeNodes()) {
    const challenges = group.records.flatMap((hash) => {
      const live = held[hash];
      const def = loaded.Record.getOptional(hash);
      const name = def?.displayProperties?.name;

      if (!live || !name || live.state & (OBSCURED | INVISIBLE)) {
        return [];
      }

      const steps = live.objectives ?? [];
      const progress = steps.reduce(
        (sum, step) => sum + (step.progress ?? 0),
        0,
      );
      const goal = steps.reduce((sum, step) => sum + step.completionValue, 0);

      return [
        {
          hash,
          name,
          description: def?.displayProperties?.description ?? "",
          progress,
          goal,
          complete: (live.state & NOT_COMPLETED) === 0,
          redeemed: (live.state & REDEEMED) !== 0,
        },
      ];
    });

    if (challenges.length === 0) {
      continue;
    }

    const period = periodOf(group.records);

    byPeriod.set(period, [...(byPeriod.get(period) ?? []), ...challenges]);
  }

  return (["daily", "weekly"] as const).flatMap((period) => {
    const challenges = byPeriod.get(period);

    return challenges === undefined ? [] : [{ period, challenges }];
  });
};

/** Payout counters rekeyed from the unlock values the profile uses to the reward items */
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
