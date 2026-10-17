import type { WishListRoll } from "app/wishlists/types";

import {
  TIERS,
  type AegisData,
  type AegisPerk,
  type AegisRoll,
  type AegisSetBonus,
  type Tier,
} from "@dvm/defs-core";

export const MODES = ["pve", "pvp"] as const;

export type Mode = (typeof MODES)[number];

export const MODE_NAMES: Record<Mode, string> = { pve: "PvE", pvp: "PvP" };

export type Rating = Omit<AegisRoll, "hashes" | "slots">;

export interface Sheet {
  byHash: Map<number, WishListRoll[]>;
  ratings: Map<number, Rating>;
  perkRanks: Map<number, AegisPerk>;
  setBonuses: Map<number, AegisSetBonus>;
  slotsByHash: Map<number, number[][]>;
  versionsByHash: Map<number, number[]>;
  captured: string | undefined;
}

export const rank = (tier: Tier | undefined): number =>
  tier === undefined ? TIERS.length : TIERS.indexOf(tier);

/** Sheet rank for sorting, unranked last */
export const rankOf = (ranked: { rank: number | undefined }): number =>
  ranked.rank ?? Number.MAX_SAFE_INTEGER;

export interface CachedRolls {
  source: string;
  data: AegisData;
}

export type CachedSheets = Record<Mode, CachedRolls | undefined>;

export interface SlotPerk {
  name: string;
  hash: number;
  rank: number | undefined;
  wanted: boolean;
  plugged: boolean;
}

export interface SlotVerdict {
  /** One-based, matching the sheet's column numbers */
  slot: number;
  /** The wanted perk if rolled, otherwise the plugged one */
  rolled: { name: string; hash: number; rank: number | undefined } | undefined;
  wanted: number[];
  options: SlotPerk[];
  picks: string[];
  matched: boolean;
}

export interface Assessment {
  rating: Rating;
  slots: SlotVerdict[];
  /** Columns that rolled one of Aegis's picks */
  score: number;
  of: number;
  /** Base tier stepped down once per missed column */
  overall: Tier | undefined;
}
