import type {
  DestinyVendorItemComponentSetOfint32,
  DestinyVendorSaleItemComponent,
  DestinyVendorsResponse,
} from "bungie-api-ts/destiny2";

import type { SlimVendorItem } from "@dvm/defs-core";

import type { CardCost } from "../items/preview.ts";

export type Mode = "visit" | "offers" | "claims" | "rotation";

export interface Watch {
  vendor: number;
  mode: Mode;
  name?: string;
  categories?: string[];
  only?: number[];
  skip?: number[];
  rows?: number[][];
  currency?: number;
  // Stack label of stock the vendor stops offering once you hold it
  owned?: string;
  pursuits?: number[];
}

export type VendorItems = Record<number, SlimVendorItem>;

export interface Cost {
  itemHash: number;
  name: string;
  quantity: number;
}

export interface Offer {
  index: number;
  itemHash: number;
  name: string;
  icon: string | undefined;
  quantity: number;
  costs: Cost[];
  available: boolean;
  reasons: string[];
  pursuit: PursuitState | undefined;
}

export type PursuitState =
  | { kind: "held"; progress: string; expiresAt: number | undefined }
  | { kind: "completed" };

export interface SlotItem {
  vendor: number;
  itemHash: number;
  vendorItemIndex: number;
}

export interface Slot {
  name: string;
  remaining: number;
  allowed: number;
  items: SlotItem[];
}

export interface RotationItem extends SlotItem {
  cost: CardCost;
  reasons: string[];
  purchased: boolean;
}

export interface VendorState {
  hash: number;
  name: string;
  mode: Mode;
  refreshesAt: number | undefined;
  offers: Offer[];
  slots: Slot[];
  rows: RotationItem[][];
}

export interface Priority extends Offer {
  vendor: string;
}

export type VendorComponents = Record<
  number,
  DestinyVendorItemComponentSetOfint32
>;

export interface VendorFetch {
  character: string;
  response: DestinyVendorsResponse;
  items: VendorItems;
  components: VendorComponents;
  ornaments: DestinyVendorSaleItemComponent[];
}

export interface RankReset {
  vendor: number;
  name: string;
  rank: number;
  cap: number;
  resets: number;
}
