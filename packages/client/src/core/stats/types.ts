import type { DestinyItemComponent } from "bungie-api-ts/destiny2";

/** The per-instance item components DIM's makeItem reads. Stats come from defs and plugs */
export const SNAPSHOT_KEYS = [
  "instances",
  "sockets",
  "reusablePlugs",
  "plugObjectives",
  "objectives",
] as const;

/** One item as the profile held it, enough to rebuild its roll after it's gone */
export interface ItemSnapshot {
  item: DestinyItemComponent;
  components: Partial<Record<(typeof SNAPSHOT_KEYS)[number], unknown>>;
}

/** Every change carries the mint window it happened in: after `from`, at or before `at` */
interface Window {
  from: number;
  at: number;
}

export type Change = Window &
  (
    | {
        kind: "item";
        instanceId: string;
        itemHash: number;
        // Undefined for the vault
        characterId: string | undefined;
        bucketHash: number;
        added: boolean;
        // Drops only
        snapshot?: ItemSnapshot;
      }
    | { kind: "stack"; itemHash: number; before: number; after: number }
    | { kind: "currency"; itemHash: number; before: number; after: number }
    | {
        kind: "objective";
        instanceId: string;
        itemHash: number;
        objectiveHash: number;
        before: number;
        after: number;
      }
    | {
        kind: "progression";
        progressionHash: number;
        before: number;
        after: number;
      }
    | { kind: "power"; characterId: string; before: number; after: number }
    | {
        kind: "equip";
        characterId: string;
        bucketHash: number;
        instanceId: string;
        itemHash: number;
      }
    | {
        kind: "activity";
        characterId: string;
        // 0 when the character is not in game
        activityHash: number;
        modeHash: number;
        playlistHash: number;
        startedAt: number;
      }
  );

export type ChangeKind = Change["kind"];

export interface HeldItem {
  itemHash: number;
  characterId: string | undefined;
  bucketHash: number;
}

export interface HeldActivity {
  activityHash: number;
  modeHash: number;
  playlistHash: number;
  startedAt: number;
}

/** Every tracked value read off one profile */
export interface Observed {
  minted: number;
  items: Record<string, HeldItem>;
  stacks: Record<number, number>;
  currencies: Record<number, number>;
  // Keyed by instance id and objective hash
  objectives: Record<string, { itemHash: number; progress: number }>;
  // Account wide only, Bungie repeats them under every character
  progressions: Record<number, number>;
  power: Record<string, number>;
  // Keyed by character id and bucket hash
  equipped: Record<string, { instanceId: string; itemHash: number }>;
  activities: Record<string, HeldActivity>;
}

/** Changes from one stretch of polling. Synced to the service as one row */
export interface Chunk {
  membershipId: string;
  startsAt: number;
  endsAt: number;
  changes: Change[];
  synced: boolean;
}
