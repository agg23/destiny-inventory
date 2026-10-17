import type { DimItem } from "app/inventory/item-types";
import type { InventoryBuckets } from "app/inventory/inventory-buckets";
import type { DimStore } from "app/inventory/store-types";
import type {
  DestinyCharacterActivitiesComponent,
  DestinyInventoryItemDefinition,
  DestinyPlugSetDefinition,
  DestinyRecordComponent,
} from "bungie-api-ts/destiny2";

import type { ArtifactIndex } from "@dvm/service";

import type { Membership } from "../api/bungie.ts";
import type { Guest } from "./guest.ts";
import type { DefStore } from "./store.ts";
import type { Failure } from "./stores.ts";

export type ItemDef = DestinyInventoryItemDefinition;
export type PlugSetDef = DestinyPlugSetDefinition;

export interface LoadResult {
  stores: DimStore[];
  buckets: InventoryBuckets;
  items: DimItem[];
  manifestVersion: string;
  tier: "core" | "detail";
  source: "cache" | "live";
  counts: { owned: number; defs: number; skipped: number; hidden: number };
  skipped: Failure[];
  degraded: Failure[];
  session: Session;
  playing: string | undefined;
  activities: CharacterActivities;
  variables: StringVariables;
  records: CharacterRecords;
  orderRewards: OrderRewards;
}

export type CharacterActivities = Record<
  string,
  DestinyCharacterActivitiesComponent
>;

export type StringVariables = Record<string, Record<number, number>>;

export type CharacterRecords = Record<
  string,
  Record<number, DestinyRecordComponent>
>;

export type OrderRewards = Record<string, Record<number, number>>;

export interface Session {
  store: DefStore;
  index: ArtifactIndex;
  membership: Membership;
  support: Map<string, Record<string, unknown>>;
  items: Record<number, ItemDef>;
  plugSets: Record<number, PlugSetDef>;
  hidden: Set<number>;
  minted: number;
  /** Mint time of the profile the stores were built from */
  builtFrom: number;
  /** Profile serialized without the fields that change on every mint */
  contents: string;
  guest: Guest | undefined;
}

type RefreshStatus = "updated" | "unchanged" | "manifest-changed";

export interface RefreshOutcome {
  status: RefreshStatus;
  playing: string | undefined;
  result: LoadResult | undefined;
}
