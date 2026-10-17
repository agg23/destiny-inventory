import type { CatalystState } from "../items/perks.ts";
import type { Ownership } from "./types.ts";

export const STATUS_LABELS: Record<Ownership, string> = {
  owned: "Owned",
  unlocked: "Unlocked",
  neverseen: "Never seen",
};

export const CATALYST_LABELS: Record<CatalystState, string> = {
  missing: "Missing",
  obtained: "Obtained",
  complete: "Complete",
};
