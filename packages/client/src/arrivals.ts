import type { DimItem } from "app/inventory/item-types";
import type { DimStore } from "app/inventory/store-types";

import { assess, MODE_NAMES, type Assessment, type Mode } from "./rolls.ts";

const PADDING = 20;
const SHOWN = 10;

/** Sort key for when an item was acquired; instance ids ascend but outgrow any digit count */
export const recency = (item: DimItem): string => item.id.padStart(PADDING, "0");

// Stacks all share the id "0"
const dropped = (item: DimItem) => item.id !== "0" && item.equipment;

export const acquired = (stores: DimStore[]): DimItem[] =>
  stores
    .flatMap((store) => store.items)
    .filter(dropped)
    .sort((a, b) => (recency(a) < recency(b) ? 1 : -1))
    .slice(0, SHOWN);

export type VerdictKind = "only" | "better" | "equal" | "worse" | "mixed";

export interface Verdict {
  kind: VerdictKind;
  rival: DimItem | undefined;
  /** Perks this roll hits that the rival misses */
  gains: string[];
  /** Perks the rival hits that this roll misses */
  losses: string[];
}

/** The best verdict across both sheets, and the modes it holds in */
export interface ModeVerdict extends Verdict {
  modes: Mode[];
  /** Every shown sheet rated the roll and they all agree */
  unanimous: boolean;
}

export interface Contender {
  item: DimItem;
  read: Assessment;
}

const hitSlots = (read: Assessment): Set<number> =>
  new Set(read.slots.filter((slot) => slot.matched).map((slot) => slot.slot));

const relate = (mine: Set<number>, theirs: Set<number>): VerdictKind => {
  const gained = [...mine].some((slot) => !theirs.has(slot));
  const lost = [...theirs].some((slot) => !mine.has(slot));

  if (!gained && !lost) {
    return "equal";
  }

  if (!lost) {
    return "better";
  }

  if (!gained) {
    return "worse";
  }

  return "mixed";
};

const rolledNames = (read: Assessment, slots: Set<number>): string[] =>
  read.slots.flatMap((slot) =>
    slots.has(slot.slot) && slot.rolled ? [slot.rolled.name] : [],
  );

/** How this roll stands against the other copies held, judged on Aegis's rated columns */
export const verdictOf = (mine: Assessment, rivals: Contender[]): Verdict => {
  const held = hitSlots(mine);

  if (rivals.length === 0) {
    return { kind: "only", rival: undefined, gains: [], losses: [] };
  }

  const scored = rivals
    .map((rival) => ({ ...rival, hits: hitSlots(rival.read) }))
    .sort((a, b) => b.hits.size - a.hits.size);

  const against = (rival: (typeof scored)[number]) => ({
    gains: rolledNames(
      mine,
      new Set([...held].filter((slot) => !rival.hits.has(slot))),
    ),
    losses: rolledNames(
      rival.read,
      new Set([...rival.hits].filter((slot) => !held.has(slot))),
    ),
  });

  const dominator = scored.find((rival) => relate(held, rival.hits) === "worse");

  if (dominator) {
    return { kind: "worse", rival: dominator.item, ...against(dominator) };
  }

  const twin = scored.find((rival) => relate(held, rival.hits) === "equal");

  if (twin) {
    return { kind: "equal", rival: twin.item, gains: [], losses: [] };
  }

  if (scored.every((rival) => relate(held, rival.hits) === "better")) {
    return { kind: "better", rival: scored[0]!.item, ...against(scored[0]!) };
  }

  // The three checks above guarantee one exists
  const mixed = scored.find((rival) => relate(held, rival.hits) === "mixed")!;

  return { kind: "mixed", rival: mixed.item, ...against(mixed) };
};

// A roll only has to be good in one mode to keep
const STANDING: VerdictKind[] = ["only", "better", "mixed", "equal", "worse"];

/** Picks the strongest of each shown mode's verdict, the main mode first on a tie */
export const combineVerdicts = (
  verdicts: Partial<Record<Mode, Verdict>>,
  shown: Mode[],
): ModeVerdict | undefined => {
  const rated = shown.flatMap((mode) => {
    const verdict = verdicts[mode];

    return verdict ? [{ mode, verdict }] : [];
  });

  if (rated.length === 0) {
    return undefined;
  }

  let best = rated[0]!;

  for (const entry of rated) {
    if (
      STANDING.indexOf(entry.verdict.kind) < STANDING.indexOf(best.verdict.kind)
    ) {
      best = entry;
    }
  }

  const modes = rated
    .filter((entry) => entry.verdict.kind === best.verdict.kind)
    .map((entry) => entry.mode);

  return {
    ...best.verdict,
    modes,
    unanimous: rated.length === shown.length && modes.length === rated.length,
  };
};

const verdictIn = (
  item: DimItem,
  stores: DimStore[],
  mode: Mode,
): Verdict | undefined => {
  const read = assess(item, mode);

  if (!read || read.of === 0) {
    return undefined;
  }

  const rivals = stores
    .flatMap((store) => store.items)
    .filter(
      (other) =>
        other.hash === item.hash &&
        other.id !== item.id &&
        other.id !== "0" &&
        !!other.sockets &&
        !other.sockets.fromDefinitions,
    )
    .flatMap((other) => {
      const rival = assess(other, mode);

      return rival ? [{ item: other, read: rival }] : [];
    });

  return verdictOf(read, rivals);
};

/** Which mode a verdict speaks for, or undefined when both sheets agree */
export const verdictMode = (verdict: ModeVerdict): string | undefined => {
  if (verdict.kind === "only" || verdict.unanimous) {
    return undefined;
  }

  return verdict.modes.map((mode) => MODE_NAMES[mode]).join(" and ");
};

/** No verdict without a real roll, a sheet rating, and rated columns to judge */
export const verdictFor = (
  item: DimItem,
  stores: DimStore[],
  shown: Mode[],
): ModeVerdict | undefined => {
  if (!item.sockets || item.sockets.fromDefinitions) {
    return undefined;
  }

  const verdicts: Partial<Record<Mode, Verdict>> = {};

  for (const mode of shown) {
    verdicts[mode] = verdictIn(item, stores, mode);
  }

  return combineVerdicts(verdicts, shown);
};
