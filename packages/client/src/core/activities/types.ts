import type {
  GearTier,
  SlimActivity,
  SlimActivitySet,
  SlimActivityType,
  SlimChallenge,
  SlimDifficulty,
  SlimGraphNode,
  SlimModifier,
  SlimPlace,
  SlimMode,
  SlimReward,
  SlimSkull,
  SlimTier,
} from "@dvm/defs-core";


export interface ActivityTables {
  activities: Record<number, SlimActivity>;
  modifiers: Record<number, SlimModifier>;
  types: Record<number, SlimActivityType>;
  nodes: Record<number, SlimGraphNode>;
  sets: Record<number, SlimActivitySet>;
  destinations: Record<number, SlimPlace>;
  places: Record<number, SlimPlace>;
  rewards: Record<number, SlimReward>;
  challenges: Record<number, SlimChallenge>;
  difficulties: Record<number, SlimDifficulty>;
  skulls: Record<number, SlimSkull>;
  modes: Record<number, SlimMode>;
}

// Bungie's quantity is a flag, not a tally
export interface Loot {
  hash: number;
  name: string;
  icon: string | undefined;
  quantity: number;
}

export interface Challenge {
  name: string;
  progress: number;
  goal: number;
  complete: boolean;
}

export type Matchmaking = "required" | "optional" | "none";

export interface GearDrop {
  base: GearTier;
  top: GearTier;
}

export interface Variant {
  hash: number;
  name: string;
  difficulty: string | undefined;
  power: number | undefined;
  matchmade: boolean;
  gearTier: GearTier | undefined;
}

export interface Recalled {
  flag: string;
  bonusDrops: number;
  focus: Loot | undefined;
  bonus: Loot[];
}

export type Recall = (activityHash: number) => Recalled | undefined;

export interface Available {
  key: string;
  hash: number;
  name: string;
  description: string;
  pgcrImage: string | undefined;
  typeName: string | undefined;
  power: number | undefined;
  topPower: number | undefined;
  location: string | undefined;
  featured: boolean;
  bonus: Loot[];
  bonusDrops: number;
  focus: Loot | undefined;
  matchmaking: Matchmaking;
  challenges: Challenge[];
  // Bungie drops consumed rewards from the payload
  dropsTaken: number;
  spentFocus: Loot | undefined;
  spentBonus: Loot[];
  variants: Variant[];
  gear: GearDrop | undefined;
  modifiers: SlimModifier[];
  difficulties: SlimTier[];
  locked: string[];
}

export interface Category {
  hash: number;
  name: string;
  icon: string | undefined;
  entries: Available[];
  bonusDrops: number;
  bonus: number;
}

export interface Realm {
  name: string;
  categories: Category[];
  bonusDrops: number;
  bonus: number;
}
