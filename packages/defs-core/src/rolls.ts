export const TIERS = ["S", "A", "B", "C", "D", "E", "F"] as const;

export type Tier = (typeof TIERS)[number];

export interface AegisRoll {
  name: string;
  category: string;
  tier: Tier | undefined;
  /** Position within its category, best first */
  rank: number | undefined;
  /** Weapons ranked in the category, as in "3 of 62" */
  ranked: number;
  hashes: number[];
  /** Plug hashes per perk column, already covering enhanced variants */
  slots: number[][];
  notes: string | undefined;
  season: string | undefined;
}

export interface AegisPerk {
  name: string;
  hashes: number[];
  kind: "perk" | "origin";
  /** Rank among perks of its kind, best first. Only the top ones have one */
  rank: number | undefined;
  tier: Tier | undefined;
  tags: string | undefined;
  effect: string | undefined;
}

export interface AegisSetBonus {
  name: string;
  /** The DestinySandboxPerkDefinition the set definition points at */
  hash: number;
  set: string;
  pieces: number;
  /** Position across every set bonus of either size, best first */
  rank: number | undefined;
  tier: Tier | undefined;
  tags: string | undefined;
  trigger: string | undefined;
  effect: string | undefined;
  notes: string | undefined;
}

/** One sheet in the Aegis layout. The PvP sheet is modeled on it */
export interface AegisData {
  source: string;
  captured: string;
  rolls: AegisRoll[];
  perks: AegisPerk[];
  setBonuses: AegisSetBonus[];
}
